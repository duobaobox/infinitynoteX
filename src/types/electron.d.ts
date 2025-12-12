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
    /**
     * 知识库 API
     */
    knowledge: {
      /**
       * 获取知识库配置
       */
      getConfig(): Promise<{
        enabled: boolean;
        embedding?: {
          providerId?: string;
          provider: string;
          baseURL: string;
          apiKey?: string;
          model: string;
          dimensions?: number;
        };
      } | null>;
      /**
       * 设置知识库配置
       */
      setConfig(config: {
        enabled: boolean;
        embedding?: {
          providerId?: string;
          provider: string;
          baseURL: string;
          apiKey?: string;
          model: string;
          dimensions?: number;
        };
      }): Promise<void>;
      /**
       * 测试 Embedding 连接
       */
      testEmbedding(config: {
        baseURL: string;
        apiKey: string;
        model: string;
        dimensions?: number;
      }): Promise<{ ok: boolean; message: string }>;
      /**
       * 重建索引
       */
      rebuildIndex(): Promise<{
        success: boolean;
        indexedNotes: number;
        totalVectors: number;
        error?: string;
      }>;
      /**
       * 获取统计信息
       */
      getStats(): Promise<{
        enabled: boolean;
        indexedNotes: number;
        totalVectors: number;
        lastIndexedAt?: number;
      }>;
      /**
       * 语义搜索
       */
      search(
        query: string,
        topK?: number,
      ): Promise<
        Array<{
          noteId: string;
          noteTitle: string;
          excerpt: string;
          score: number;
        }>
      >;
      /**
       * 获取数据块列表
       */
      getChunks(options?: { noteId?: string; offset?: number; limit?: number }): Promise<{
        chunks: Array<{
          id: string;
          noteId: string;
          noteTitle: string;
          chunkIndex: number;
          content: string;
          dimension: number;
          createdAt: number;
        }>;
        total: number;
      }>;
      /**
       * 获取笔记索引列表
       */
      getNoteIndexList(): Promise<
        Array<{
          noteId: string;
          noteTitle: string;
          chunkCount: number;
          status: 'indexed' | 'pending' | 'failed';
          lastIndexedAt?: number;
        }>
      >;
      /**
       * 语义搜索测试
       */
      testSearch(
        query: string,
        options?: { topK?: number; minScore?: number },
      ): Promise<
        Array<{
          noteId: string;
          noteTitle: string;
          excerpt: string;
          score: number;
        }>
      >;
      /**
       * 增量更新索引
       */
      incrementalUpdate(): Promise<{
        success: boolean;
        updated: number;
        added: number;
        removed: number;
        totalVectors: number;
        error?: string;
      }>;
      /**
       * 重新索引单个笔记
       */
      reindexNote(noteId: string): Promise<{
        success: boolean;
        vectorCount: number;
        error?: string;
      }>;
      /**
       * 删除笔记索引
       */
      deleteNoteIndex(noteId: string): Promise<{
        success: boolean;
        deleted: number;
      }>;
    };
  }
}

export {};
