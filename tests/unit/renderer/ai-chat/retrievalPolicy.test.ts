import { describe, expect, it } from 'vitest';

import { resolveAIRetrievalPolicy } from '../../../../src/features/ai-chat/retrievalPolicy';

describe('resolveAIRetrievalPolicy', () => {
  it('disables all active retrieval when the toggle is off', () => {
    expect(
      resolveAIRetrievalPolicy({
        useKnowledgeBase: false,
        supportsToolCalling: true,
      }),
    ).toEqual({
      allowActiveRetrieval: false,
      useFallbackRag: false,
    });
  });

  it('prefers tool-based retrieval for tool-calling models', () => {
    expect(
      resolveAIRetrievalPolicy({
        useKnowledgeBase: true,
        supportsToolCalling: true,
      }),
    ).toEqual({
      allowActiveRetrieval: true,
      useFallbackRag: false,
    });
  });

  it('still delegates fallback decisions to the main-process orchestrator for non-tool models', () => {
    expect(
      resolveAIRetrievalPolicy({
        useKnowledgeBase: true,
        supportsToolCalling: false,
      }),
    ).toEqual({
      allowActiveRetrieval: true,
      useFallbackRag: false,
    });
  });
});
