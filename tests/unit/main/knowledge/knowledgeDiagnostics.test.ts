import { beforeEach, describe, expect, it, vi } from 'vitest';

const vectorStore = {
  getDiagnostics: vi.fn(),
  getStats: vi.fn(),
  getOrphanedVectorCount: vi.fn(),
  getNoteIndexList: vi.fn(),
};

const readKnowledgeConfig = vi.fn();

vi.mock('../../../../electron/knowledge/vectorStore', () => ({
  getVectorStore: () => vectorStore,
}));

vi.mock('../../../../electron/knowledge/embedding', () => ({
  readKnowledgeConfig,
}));

vi.mock('../../../../electron/storage', () => ({
  storageManager: {
    notes: {
      list: vi.fn(async () => []),
      get: vi.fn(),
    },
  },
}));

describe('knowledge diagnostics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vectorStore.getDiagnostics.mockReturnValue({
      path: '/tmp/knowledge.db',
      sizeBytes: 1024,
      journalMode: 'wal',
      integrity: 'ok',
      integrityMessage: 'ok',
      dimension: 1024,
      tableExists: true,
    });
    vectorStore.getStats.mockReturnValue({
      totalVectors: 0,
      uniqueNotes: 0,
    });
    vectorStore.getOrphanedVectorCount.mockReturnValue(0);
    vectorStore.getNoteIndexList.mockReturnValue([]);
  });

  it('marks embedding config as incomplete when api key is missing', async () => {
    readKnowledgeConfig.mockResolvedValue({
      enabled: true,
      embedding: {
        provider: 'custom',
        baseURL: 'https://example.test/v1',
        apiKey: '',
        model: 'embed-model',
      },
    });

    const { runDiagnostics } = await import('../../../../electron/knowledge/knowledgeIndex');
    const diagnostics = await runDiagnostics();

    expect(diagnostics.embeddingConfig.configured).toBe(false);
  });
});
