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
    attachments: {
      /**
       * 保存附件（从 Base64 Data URL）
       * @returns 包含附件 ID 的结果
       */
      save(dataUrl: string): Promise<{ success: boolean; id?: string; error?: string }>;
      /**
       * 获取附件的完整文件路径
       */
      getPath(id: string): Promise<string | null>;
      /**
       * 删除附件
       */
      delete(id: string): Promise<{ success: boolean; error?: string }>;
      /**
       * 列出所有附件
       */
      list(): Promise<
        Array<{
          id: string;
          filename: string;
          size: number;
          createdAt: number;
        }>
      >;
      /**
       * 清理未被引用的附件（垃圾回收）
       */
      cleanup(): Promise<{
        deleted: number;
        freedBytes: number;
        errors: string[];
      }>;
    };
  }
}

export {};
