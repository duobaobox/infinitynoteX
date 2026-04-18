import { beforeEach, describe, expect, it, vi } from 'vitest';

const semanticSearch = vi.fn();
const listNotes = vi.fn();

vi.mock('../../../../electron/knowledge', () => ({
  semanticSearch,
}));

vi.mock('../../../../electron/storage', () => ({
  storageManager: {
    notes: {
      list: listNotes,
    },
  },
}));

describe('retrievalOrchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts knowledge and note prefetch in parallel for prefetch strategies', async () => {
    let resolveKnowledge: ((value: Array<unknown>) => void) | null = null;
    let resolveNotes: ((value: Array<unknown>) => void) | null = null;

    semanticSearch.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveKnowledge = resolve;
        }),
    );
    listNotes.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveNotes = resolve;
        }),
    );

    const { orchestrateRetrieval } = await import('../../../../electron/ai/retrievalOrchestrator');

    const pending = orchestrateRetrieval({
      message: '请根据我的资料总结一下',
      allowActiveRetrieval: true,
      supportsToolCalling: false,
    });

    await Promise.resolve();

    expect(semanticSearch).toHaveBeenCalled();
    expect(listNotes).toHaveBeenCalled();

    resolveKnowledge?.([]);
    resolveNotes?.([]);

    const result = await pending;
    expect(result.strategy).toBe('prefetch');
  });
});
