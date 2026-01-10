/**
 * Knowledge IPC Handlers
 * 知识库相关 IPC 处理器 - 从 main.ts 抽离
 */

import { ipcMain } from 'electron';
import {
  readKnowledgeConfig,
  writeKnowledgeConfig,
  createEmbeddingService,
  type EmbeddingConfig,
} from '../knowledge';

/**
 * 注册知识库相关 IPC 处理器
 */
export function registerKnowledgeHandlers(): void {
  ipcMain.handle('knowledge:getConfig', async () => {
    return await readKnowledgeConfig();
  });

  ipcMain.handle(
    'knowledge:setConfig',
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
    'knowledge:testEmbedding',
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

  ipcMain.handle('knowledge:rebuildIndex', async () => {
    const { rebuildAllIndex } = await import('../knowledge');
    return await rebuildAllIndex();
  });

  ipcMain.handle('knowledge:getStats', async () => {
    const { getIndexStats } = await import('../knowledge');
    return getIndexStats();
  });

  ipcMain.handle('knowledge:search', async (_, query: string, topK?: number) => {
    const { semanticSearch } = await import('../knowledge');
    return await semanticSearch(query, topK ?? 3);
  });

  ipcMain.handle(
    'knowledge:getChunks',
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

  ipcMain.handle('knowledge:getNoteIndexList', async () => {
    const { getVectorStore } = await import('../knowledge');
    const store = getVectorStore();
    if (store.getNoteIndexList) {
      return store.getNoteIndexList();
    }
    return [];
  });

  ipcMain.handle(
    'knowledge:testSearch',
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

  ipcMain.handle('knowledge:incrementalUpdate', async () => {
    const { incrementalUpdate } = await import('../knowledge');
    return await incrementalUpdate();
  });

  ipcMain.handle('knowledge:reindexNote', async (_, noteId: string) => {
    const { reindexNote } = await import('../knowledge');
    return await reindexNote(noteId);
  });

  ipcMain.handle('knowledge:deleteNoteIndex', async (_, noteId: string) => {
    const { deleteNoteFromIndex } = await import('../knowledge');
    const deleted = deleteNoteFromIndex(noteId);
    return { success: true, deleted };
  });

  ipcMain.handle('knowledge:runDiagnostics', async () => {
    const { runDiagnostics } = await import('../knowledge');
    return await runDiagnostics();
  });

  ipcMain.handle('knowledge:repairIndex', async () => {
    const { repairIndex } = await import('../knowledge');
    return await repairIndex();
  });

  ipcMain.handle('knowledge:getIndexingConfig', async () => {
    const { getIndexingConfig } = await import('../knowledge');
    return getIndexingConfig();
  });

  ipcMain.handle(
    'knowledge:setIndexingConfig',
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

  ipcMain.handle('knowledge:resetIndexingConfig', async () => {
    const { resetIndexingConfig } = await import('../knowledge');
    resetIndexingConfig();
    return { success: true };
  });

  ipcMain.handle('knowledge:getDefaultIndexingConfig', async () => {
    const { getDefaultIndexingConfig } = await import('../knowledge');
    return getDefaultIndexingConfig();
  });
}
