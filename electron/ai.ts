/**
 * 主进程 AI 配置管理与通用 OpenAI 兼容适配器
 * 支持任何 OpenAI 兼容的模型（如 Ollama、本地服务、云服务等）
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { app } from 'electron';
import type {
  AIConfig,
  AIMessage,
  ChatPayload,
  ChatResponse,
  StreamChunk,
  ConnectionTestResult,
} from '../src/services/aiConfig';

/**
 * 配置文件路径
 */
function getConfigPath(): string {
  return path.join(app.getPath('userData'), 'ai-config.json');
}

/**
 * 读取配置
 */
export async function readAIConfig(): Promise<AIConfig | null> {
  try {
    const configPath = getConfigPath();
    const data = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(data) as AIConfig;
  } catch (error) {
    console.warn('[AI] Config file not found or invalid:', error);
    return null;
  }
}

/**
 * 写入配置
 */
export async function writeAIConfig(config: AIConfig): Promise<void> {
  try {
    const configPath = getConfigPath();
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
    console.log('[AI] Config saved:', { provider: config.provider, model: config.model });
  } catch (error) {
    console.error('[AI] Failed to save config:', error);
    throw new Error('Failed to save AI config');
  }
}

/**
 * 通用 OpenAI 兼容适配器
 * 支持任何兼容 OpenAI /v1/chat/completions 接口的服务
 */
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
    const messages: AIMessage[] = [
      ...(this.config.systemPrompt
        ? [{ role: 'system' as const, content: this.config.systemPrompt }]
        : []),
      ...payload.messages,
      { role: 'user' as const, content: payload.message },
    ];

    try {
      const url = this.buildAPIURL('chat/completions');
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          messages,
          temperature: this.config.temperature ?? 0.7,
          max_tokens: this.config.max_tokens,
          stream: false,
        }),
        signal: AbortSignal.timeout(this.config.timeoutMs || 60000),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = (await response.json()) as any;
      const content = data?.choices?.[0]?.message?.content || '';

      if (!content) {
        throw new Error('No content in response');
      }

      return {
        content,
        finishReason: data?.choices?.[0]?.finish_reason,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(`Chat failed: ${msg}`);
    }
  }

  /**
   * 流式聊天请求
   * 返回异步迭代器，逐段产生内容
   */
  async *chatStream(payload: ChatPayload): AsyncGenerator<StreamChunk, void> {
    const messages: AIMessage[] = [
      ...(this.config.systemPrompt
        ? [{ role: 'system' as const, content: this.config.systemPrompt }]
        : []),
      ...payload.messages,
      { role: 'user' as const, content: payload.message },
    ];

    try {
      const url = this.buildAPIURL('chat/completions');
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          messages,
          temperature: this.config.temperature ?? 0.7,
          max_tokens: this.config.max_tokens,
          stream: true,
        }),
        signal: AbortSignal.timeout(this.config.timeoutMs || 60000),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      // 读取流并解析 SSE
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed === ':') continue;

            if (trimmed.startsWith('data: ')) {
              const data = trimmed.slice(6);
              if (data === '[DONE]') continue;

              try {
                const json = JSON.parse(data);
                const choices = (json?.choices as unknown[]) || [];
                const choiceItem = choices[0] as Record<string, unknown>;
                const deltaObj = (choiceItem?.delta as Record<string, unknown>) || {};
                const delta = (deltaObj?.content as string) || '';
                const reasoningDelta = (deltaObj as any)?.reasoning_content as string | undefined;
                if (delta || reasoningDelta) {
                  yield {
                    delta: delta || '',
                    reasoningDelta: reasoningDelta || undefined,
                    finishReason: choiceItem?.finish_reason as string | undefined,
                  };
                }
              } catch (e) {
                console.warn('[AI] Failed to parse SSE:', trimmed);
              }
            }
          }
        }

        // 处理剩余缓冲区
        if (buffer.trim() && buffer.trim() !== ':') {
          if (buffer.trim().startsWith('data: ')) {
            const data = buffer.trim().slice(6);
            if (data !== '[DONE]') {
              try {
                const json = JSON.parse(data);
                const deltaObj = (json?.choices?.[0]?.delta as any) || {};
                const delta = (deltaObj?.content as string) || '';
                const reasoningDelta = deltaObj?.reasoning_content as string | undefined;
                if (delta || reasoningDelta) {
                  yield {
                    delta: delta || '',
                    reasoningDelta: reasoningDelta || undefined,
                    finishReason: json?.choices?.[0]?.finish_reason,
                  };
                }
              } catch (e) {
                console.warn('[AI] Failed to parse final SSE:', buffer);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
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
