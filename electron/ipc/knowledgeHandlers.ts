/**
 * Knowledge IPC Handlers
 * 知识库相关 IPC 处理器 - 从 main.ts 抽离
 */

import { ipcMain } from 'electron';
import { getIpcProxyChannel } from '../../src/shared/types/ipc';
import type { IpcProxyMethod } from '../../src/shared/types/ipc';
import {
  readKnowledgeConfig,
  writeKnowledgeConfig,
  createEmbeddingService,
  type EmbeddingConfig,
} from '../knowledge';

const knowledgeChannel = (method: IpcProxyMethod<'knowledge'>) =>
  getIpcProxyChannel('knowledge', method);

/**
 * 注册知识库相关 IPC 处理器
 */
export function registerKnowledgeHandlers(): void {
  ipcMain.handle(knowledgeChannel('getConfig'), async () => {
    return await readKnowledgeConfig();
  });

  ipcMain.handle(
    knowledgeChannel('setConfig'),
    async (
      _,
      config: {
        enabled: boolean;
        embedding?: EmbeddingConfig;
      },
    ) => {
      await writeKnowledgeConfig(config);
    },
  );

  ipcMain.handle(
    knowledgeChannel('testEmbedding'),
    async (
      _,
      config: {
        baseURL: string;
        apiKey: string;
        model: string;
        dimensions?: number;
      },
    ) => {
      try {
        const embeddingConfig: EmbeddingConfig = {
          provider: 'test',
          baseURL: config.baseURL,
          apiKey: config.apiKey,
          model: config.model,
          dimensions: config.dimensions,
          timeoutMs: 30000,
        };
        const service = createEmbeddingService(embeddingConfig);
        const result = await service.testConnection();
        return result;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return { ok: false, message: `测试失败: ${msg}` };
      }
    },
  );

  ipcMain.handle(knowledgeChannel('rebuildIndex'), async () => {
    const { rebuildAllIndex } = await import('../knowledge');
    return await rebuildAllIndex();
  });

  ipcMain.handle(knowledgeChannel('getStats'), async () => {
    const { getIndexStats } = await import('../knowledge');
    return getIndexStats();
  });

  ipcMain.handle(knowledgeChannel('search'), async (_, query: string, topK?: number) => {
    const { semanticSearch } = await import('../knowledge');
    return await semanticSearch(query, topK ?? 3);
  });

  ipcMain.handle(
    knowledgeChannel('getChunks'),
    async (
      _,
      options: {
        noteId?: string;
        offset?: number;
        limit?: number;
      },
    ) => {
      const { getVectorStore } = await import('../knowledge');
      const store = getVectorStore();
      if (store.getChunks) {
        return store.getChunks(options);
      }
      return { chunks: [], total: 0 };
    },
  );

  ipcMain.handle(knowledgeChannel('getNoteIndexList'), async () => {
    const { getVectorStore } = await import('../knowledge');
    const store = getVectorStore();
    if (store.getNoteIndexList) {
      return store.getNoteIndexList();
    }
    return [];
  });

  ipcMain.handle(
    knowledgeChannel('testSearch'),
    async (
      _,
      query: string,
      options?: {
        topK?: number;
        minScore?: number;
      },
    ) => {
      const { semanticSearch } = await import('../knowledge');
      const results = await semanticSearch(query, options?.topK ?? 5);
      if (options?.minScore) {
        return results.filter((r) => r.score >= (options.minScore ?? 0));
      }
      return results;
    },
  );

  ipcMain.handle(knowledgeChannel('incrementalUpdate'), async () => {
    const { incrementalUpdate } = await import('../knowledge');
    return await incrementalUpdate();
  });

  ipcMain.handle(knowledgeChannel('reindexNote'), async (_, noteId: string) => {
    const { reindexNote } = await import('../knowledge');
    return await reindexNote(noteId);
  });

  ipcMain.handle(knowledgeChannel('deleteNoteIndex'), async (_, noteId: string) => {
    const { deleteNoteFromIndex } = await import('../knowledge');
    const deleted = deleteNoteFromIndex(noteId);
    return { success: true, deleted };
  });

  ipcMain.handle(knowledgeChannel('runDiagnostics'), async () => {
    const { runDiagnostics } = await import('../knowledge');
    return await runDiagnostics();
  });

  ipcMain.handle(knowledgeChannel('repairIndex'), async () => {
    const { repairIndex } = await import('../knowledge');
    return await repairIndex();
  });

  ipcMain.handle(knowledgeChannel('getIndexingConfig'), async () => {
    const { getIndexingConfig } = await import('../knowledge');
    return getIndexingConfig();
  });

  ipcMain.handle(
    knowledgeChannel('setIndexingConfig'),
    async (
      _,
      config: {
        chunkSize?: number;
        chunkOverlap?: number;
        batchSize?: number;
        batchDelayMs?: number;
        rateLimitRetryMs?: number;
      },
    ) => {
      const { setIndexingConfig } = await import('../knowledge');
      setIndexingConfig(config);
      return { success: true };
    },
  );

  ipcMain.handle(knowledgeChannel('resetIndexingConfig'), async () => {
    const { resetIndexingConfig } = await import('../knowledge');
    resetIndexingConfig();
    return { success: true };
  });

  ipcMain.handle(knowledgeChannel('getDefaultIndexingConfig'), async () => {
    const { getDefaultIndexingConfig } = await import('../knowledge');
    return getDefaultIndexingConfig();
  });
}
