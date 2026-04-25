import { beforeEach, describe, expect, it, vi } from 'vitest';

const vectorStore = {
  deleteByNoteId: vi.fn(),
  getChunksByNoteId: vi.fn(),
  deleteByIds: vi.fn(),
  upsertBatch: vi.fn(),
};

vi.mock('../../../../electron/knowledge/vectorStore', () => ({
  getVectorStore: () => vectorStore,
}));

vi.mock('../../../../electron/storage', () => ({
  storageManager: {
    notes: {
      list: vi.fn(),
      get: vi.fn(),
    },
  },
}));

import { smartIndexNote } from '../../../../electron/knowledge/knowledgeIndex';
import type { EmbeddingService } from '../../../../electron/knowledge/embedding';

describe('knowledge index', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vectorStore.getChunksByNoteId.mockReturnValue([]);
  });

  it('stores full chunk content when smart reindexing a note', async () => {
    const longText = '这是一段用于知识库检索的长内容。'.repeat(40);
    const embeddingService = {
      embedBatch: vi.fn(async (texts: string[]) => texts.map(() => [0.1, 0.2, 0.3])),
    } as unknown as EmbeddingService;

    await smartIndexNote(
      'note-1',
      '长内容便签',
      {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: longText }],
          },
        ],
      },
      embeddingService,
    );

    const firstBatch = vectorStore.upsertBatch.mock.calls[0]?.[0];

    expect(firstBatch[0].metadata.content.length).toBeGreaterThan(200);
    expect(firstBatch[0].metadata.content).toContain('这是一段用于知识库检索的长内容');
  });
});
