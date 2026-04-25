import { beforeEach, describe, expect, it, vi } from 'vitest';

const vectorStore = {
  getStats: vi.fn(),
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
      list: vi.fn(),
      get: vi.fn(),
    },
  },
}));

describe('knowledge stats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vectorStore.getStats.mockReturnValue({
      uniqueNotes: 6,
      totalVectors: 18,
    });
  });

  it('returns the persisted knowledge-base enabled flag instead of always true', async () => {
    readKnowledgeConfig.mockResolvedValue({
      enabled: false,
    });

    const { getIndexStats } = await import('../../../../electron/knowledge/knowledgeIndex');
    const stats = await getIndexStats();

    expect(stats).toEqual({
      enabled: false,
      indexedNotes: 6,
      totalVectors: 18,
    });
  });
});
