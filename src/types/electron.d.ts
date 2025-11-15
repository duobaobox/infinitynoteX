/**
 * 全局 AI API 类型声明
 * 为 window.ai 暴露的接口定义类型
 */

import type { AIConfig, ChatPayload } from './services/aiConfig';

declare global {
  interface Window {
    ai: {
      getConfig(): Promise<AIConfig | null>;
      setConfig(config: AIConfig): Promise<void>;
      testConnection(): Promise<{ ok: boolean; message: string }>;
      chat(payload: ChatPayload): Promise<{ success: boolean; content?: string; error?: string }>;
      chatStream(payload: ChatPayload): Promise<{ success: boolean; error?: string }>;
      onStreamChunk(
        callback: (data: { delta: string; reasoningDelta?: string; finishReason?: string }) => void,
      ): () => void;
      onStreamDone(callback: (data: { success: boolean }) => void): () => void;
      onStreamError(callback: (data: { error: string }) => void): () => void;
    };
  }
}

export {};
