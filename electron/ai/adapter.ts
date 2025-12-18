/**
 * 通用 OpenAI 兼容适配器
 * 支持任何兼容 OpenAI /v1/chat/completions 接口的服务
 */

import type {
  AIConfig,
  AIMessage,
  ChatPayload,
  ChatResponse,
  StreamChunk,
  ConnectionTestResult,
} from '../../src/services/aiConfig';

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
   * 构建 RAG 上下文的系统提示词
   */
  private buildRagContextPrompt(ragContext: NonNullable<ChatPayload['ragContext']>): string {
    const { results } = ragContext;

    const formattedResults = results
      .map((r, i) => `### [来源 ${i + 1}] ${r.noteTitle}\n${r.excerpt}`)
      .join('\n\n---\n\n');

    return `## 参考资料（来自用户知识库，共 ${results.length} 条）

请优先基于以下参考资料回答用户问题。引用时请使用 [来源 X] 格式标注。
如果参考资料中没有相关信息，请诚实告知用户。

${formattedResults}

---
**注意**：以上内容来自用户的个人笔记。请准确引用，不要编造不存在的信息。`;
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
      // 1. 用户配置的系统提示词
      ...(this.config.systemPrompt
        ? [{ role: 'system' as const, content: this.config.systemPrompt }]
        : []),
      // 2. RAG 上下文作为独立系统消息（如果有）
      ...(payload.ragContext && payload.ragContext.results.length > 0
        ? [{ role: 'system' as const, content: this.buildRagContextPrompt(payload.ragContext) }]
        : []),
      // 3. 历史消息
      ...payload.messages,
      // 4. 当前用户消息
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

      const data = (await response.json()) as unknown;
      const choices = (data as { choices?: unknown[] } | null | undefined)?.choices;
      const firstChoice = (Array.isArray(choices) ? choices[0] : undefined) as
        | { message?: { content?: unknown }; finish_reason?: unknown }
        | undefined;
      const content =
        typeof firstChoice?.message?.content === 'string' ? firstChoice.message.content : '';

      if (!content) {
        throw new Error('No content in response');
      }

      return {
        content,
        finishReason:
          typeof firstChoice?.finish_reason === 'string' ? firstChoice.finish_reason : undefined,
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
  async *chatStream(
    payload: ChatPayload,
    options?: {
      signal?: AbortSignal;
    },
  ): AsyncGenerator<StreamChunk, void> {
    const messages: AIMessage[] = [
      // 1. 用户配置的系统提示词
      ...(this.config.systemPrompt
        ? [{ role: 'system' as const, content: this.config.systemPrompt }]
        : []),
      // 2. RAG 上下文作为独立系统消息（如果有）
      ...(payload.ragContext && payload.ragContext.results.length > 0
        ? [{ role: 'system' as const, content: this.buildRagContextPrompt(payload.ragContext) }]
        : []),
      // 3. 历史消息
      ...payload.messages,
      // 4. 当前用户消息（不再拼接 RAG 上下文）
      { role: 'user' as const, content: payload.message },
    ];

    try {
      const url = this.buildAPIURL('chat/completions');
      const timeoutMs = this.config.timeoutMs || 60000;
      const timeoutSignal = AbortSignal.timeout(timeoutMs);
      const signal = options?.signal
        ? AbortSignal.any([options.signal, timeoutSignal])
        : timeoutSignal;
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
        signal,
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
      let receivedDone = false;

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
              if (data === '[DONE]') {
                receivedDone = true;
                break;
              }

              try {
                const json = JSON.parse(data) as unknown;
                const choices = (json as { choices?: unknown[] } | null | undefined)?.choices;
                const choiceItem = (Array.isArray(choices) ? choices[0] : undefined) as
                  | { delta?: Record<string, unknown>; finish_reason?: unknown }
                  | undefined;
                const deltaObj = choiceItem?.delta ?? {};
                const delta = typeof deltaObj?.content === 'string' ? deltaObj.content : '';
                const reasoningRaw = (deltaObj as Record<string, unknown>)['reasoning_content'];
                const reasoningDelta = typeof reasoningRaw === 'string' ? reasoningRaw : undefined;
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

          if (receivedDone) break;
        }

        // 处理剩余缓冲区
        if (!receivedDone && buffer.trim() && buffer.trim() !== ':') {
          if (buffer.trim().startsWith('data: ')) {
            const data = buffer.trim().slice(6);
            if (data !== '[DONE]') {
              try {
                const json = JSON.parse(data) as unknown;
                const choices = (json as { choices?: unknown[] } | null | undefined)?.choices;
                const choiceItem = (Array.isArray(choices) ? choices[0] : undefined) as
                  | { delta?: Record<string, unknown>; finish_reason?: unknown }
                  | undefined;
                const deltaObj = choiceItem?.delta ?? {};
                const delta = typeof deltaObj?.content === 'string' ? deltaObj.content : '';
                const reasoningRaw = (deltaObj as Record<string, unknown>)['reasoning_content'];
                const reasoningDelta = typeof reasoningRaw === 'string' ? reasoningRaw : undefined;
                if (delta || reasoningDelta) {
                  yield {
                    delta: delta || '',
                    reasoningDelta: reasoningDelta || undefined,
                    finishReason:
                      typeof choiceItem?.finish_reason === 'string'
                        ? choiceItem.finish_reason
                        : undefined,
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
