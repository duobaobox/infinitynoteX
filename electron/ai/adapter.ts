/**
 * 基于 Vercel AI SDK Core 的 OpenAI 兼容运行时适配器。
 *
 * 设计目标：
 * - 保留现有 Electron IPC 协议与前端聊天 UI
 * - 用现成 SDK 接管 provider / streaming / tool loop
 * - 为后续 agent 架构预留 read-only tools 基础
 */

import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { generateText, stepCountIs, streamText, type ModelMessage } from 'ai';

import type {
  AIConfig,
  ChatPayload,
  ChatResponse,
  ConnectionTestResult,
  StreamChunk,
} from '../../src/services/aiConfig';
import { getProviderCapabilities } from '../../src/services/aiProviders';
import {
  buildUnsupportedToolActionMessage,
  detectRequiredTools,
  type RequiredToolName,
} from './actionIntent';
import { buildModelMessages, mergeReasoningAndText } from './contextBuilder';
import { createAgentTools } from './toolRegistry';

export class OpenAICompatibleAdapter {
  private config: AIConfig;

  constructor(config: AIConfig) {
    this.config = config;
  }

  private buildAPIURL(endpoint: string): string {
    const url = new URL(this.config.baseURL);
    const sanitizedEndpoint = endpoint.replace(/^\/+/, '');
    const basePath = url.pathname.endsWith('/') ? url.pathname : `${url.pathname}/`;
    const trimmedBase = basePath.replace(/\/+$/g, '');
    const combined = `${trimmedBase}/${sanitizedEndpoint}`.replace(/\/{2,}/g, '/');
    const normalized = combined.startsWith('/') ? combined : `/${combined}`;
    url.pathname = normalized || '/';
    return url.toString();
  }

  private createModel() {
    const provider = createOpenAICompatible({
      name: this.config.providerId || this.config.provider || 'custom',
      baseURL: this.config.baseURL,
      apiKey: this.config.apiKey,
    });

    return provider.chatModel(this.config.model);
  }

  buildRequestMessages(payload: ChatPayload): ModelMessage[] {
    return buildModelMessages(this.config, payload);
  }

  private resolveToolStrategy(payload: ChatPayload): {
    requiredTools: RequiredToolName[];
    unsupportedToolActionMessage?: string;
  } {
    const capabilities = getProviderCapabilities(this.config);
    const requiredTools = detectRequiredTools(payload.message);

    if (!capabilities.toolCalling && requiredTools.length > 0) {
      return {
        requiredTools,
        unsupportedToolActionMessage: buildUnsupportedToolActionMessage(requiredTools),
      };
    }

    return {
      requiredTools,
    };
  }

  getUnsupportedToolActionMessage(payload: ChatPayload): string | undefined {
    return this.resolveToolStrategy(payload).unsupportedToolActionMessage;
  }

  private buildRuntimeOptionsForMessages(
    messages: ModelMessage[],
    signal?: AbortSignal,
    requiredTools?: RequiredToolName[],
    allowActiveRetrieval: boolean = true,
  ) {
    const capabilities = getProviderCapabilities(this.config);
    const tools = capabilities.toolCalling ? createAgentTools({ allowActiveRetrieval }) : undefined;

    return {
      model: this.createModel(),
      messages,
      tools,
      activeTools: tools && requiredTools && requiredTools.length > 0 ? requiredTools : undefined,
      toolChoice: tools
        ? requiredTools && requiredTools.length > 0
          ? requiredTools.length === 1
            ? ({ type: 'tool', toolName: requiredTools[0] } as const)
            : ('required' as const)
          : undefined
        : undefined,
      stopWhen: tools ? stepCountIs(5) : undefined,
      temperature: this.config.temperature ?? 0.7,
      maxOutputTokens: this.config.max_tokens,
      abortSignal: signal,
      timeout: this.config.timeoutMs ? { totalMs: this.config.timeoutMs } : undefined,
    };
  }

  private buildRuntimeOptions(payload: ChatPayload, signal?: AbortSignal) {
    const strategy = this.resolveToolStrategy(payload);
    return this.buildRuntimeOptionsForMessages(
      this.buildRequestMessages(payload),
      signal,
      strategy.requiredTools,
      payload.allowActiveRetrieval ?? false,
    );
  }

  createStreamResult(payload: ChatPayload, signal?: AbortSignal) {
    return streamText(this.buildRuntimeOptions(payload, signal));
  }

  /**
   * 测试连接
   */
  async testConnection(): Promise<ConnectionTestResult> {
    try {
      const url = this.buildAPIURL('models');
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        signal: AbortSignal.timeout(this.config.timeoutMs || 10000),
      });

      if (!response.ok) {
        if (response.status === 401) {
          return {
            ok: false,
            message: `连接失败：API Key 无效（${response.status} Unauthorized）`,
          };
        }
        return {
          ok: false,
          message: `连接失败：${response.status} ${response.statusText}`,
        };
      }

      return {
        ok: true,
        message: `连接成功！当前模型：${this.config.model}`,
        modelInfo: {
          model: this.config.model,
          provider: this.config.provider,
        },
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return {
        ok: false,
        message: `连接失败：${msg}`,
      };
    }
  }

  /**
   * 发送聊天请求（非流式）
   */
  async chat(payload: ChatPayload): Promise<ChatResponse> {
    try {
      const strategy = this.resolveToolStrategy(payload);
      if (strategy.unsupportedToolActionMessage) {
        return {
          content: strategy.unsupportedToolActionMessage,
          finishReason: 'stop',
        };
      }

      const result = await generateText(this.buildRuntimeOptions(payload));

      const content = mergeReasoningAndText(result.reasoningText, result.text);
      if (!content.trim()) {
        throw new Error('No content in response');
      }

      return {
        content,
        finishReason: result.finishReason,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(`Chat failed: ${msg}`);
    }
  }

  async continueWithMessages(
    messages: ModelMessage[],
    options?: { allowActiveRetrieval?: boolean },
  ): Promise<{
    content: string;
    finishReason?: string;
    toolCalls: Array<{ toolCallId: string; toolName: string; input: unknown }>;
    toolResults: unknown[];
    responseMessages: ModelMessage[];
  }> {
    try {
      const result = await generateText(
        this.buildRuntimeOptionsForMessages(
          messages,
          undefined,
          undefined,
          options?.allowActiveRetrieval ?? true,
        ),
      );
      return {
        content: mergeReasoningAndText(result.reasoningText, result.text),
        finishReason: result.finishReason,
        toolCalls: result.toolCalls.map((toolCall) => ({
          toolCallId: toolCall.toolCallId,
          toolName: toolCall.toolName,
          input: toolCall.input,
        })),
        toolResults: result.toolResults as unknown[],
        responseMessages: result.response.messages as ModelMessage[],
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(`Tool approval continuation failed: ${msg}`);
    }
  }

  /**
   * 流式聊天请求
   * 返回异步迭代器，逐段产生内容
   */
  async *chatStream(
    payload: ChatPayload,
    options?: {
      signal?: AbortSignal;
    },
  ): AsyncGenerator<StreamChunk, void> {
    try {
      const strategy = this.resolveToolStrategy(payload);
      if (strategy.unsupportedToolActionMessage) {
        yield {
          delta: strategy.unsupportedToolActionMessage,
          finishReason: 'stop',
        };
        return;
      }

      const result = this.createStreamResult(payload, options?.signal);

      for await (const part of result.fullStream) {
        switch (part.type) {
          case 'reasoning-delta':
            yield {
              delta: '',
              reasoningDelta: part.text,
            };
            break;
          case 'text-delta':
            yield {
              delta: part.text,
            };
            break;
          case 'finish':
            yield {
              delta: '',
              finishReason: part.finishReason,
            };
            break;
          default:
            break;
        }
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(`Stream failed: ${msg}`);
    }
  }
}

/**
 * 获取适配器（基于配置）
 */
export function createAdapter(config: AIConfig): OpenAICompatibleAdapter {
  return new OpenAICompatibleAdapter(config);
}
