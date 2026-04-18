import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  app: {
    getPath: () => '/tmp/infinitynotex-test',
  },
}));

const generateText = vi.fn();
const streamText = vi.fn();
const stepCountIs = vi.fn(() => 'step-limit');

vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>();
  return {
    ...actual,
    generateText,
    streamText,
    stepCountIs,
  };
});

const chatModel = vi.fn(() => 'mock-model');
const createOpenAICompatible = vi.fn(() => ({
  chatModel,
}));

vi.mock('@ai-sdk/openai-compatible', () => ({
  createOpenAICompatible,
}));

describe('OpenAICompatibleAdapter retrieval policy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    generateText.mockResolvedValue({
      reasoningText: undefined,
      text: 'ok',
      finishReason: 'stop',
    });
  });

  it('omits proactive retrieval tools when active retrieval is disabled', async () => {
    const { OpenAICompatibleAdapter } = await import('../../../../electron/ai/adapter');

    const adapter = new OpenAICompatibleAdapter({
      providerId: 'deepseek',
      provider: 'DeepSeek',
      baseURL: 'https://api.deepseek.com/v1',
      apiKey: 'test-key',
      model: 'deepseek-chat',
    });

    await adapter.chat({
      message: '帮我回答这个问题',
      messages: [],
      allowActiveRetrieval: false,
    });

    const runtimeOptions = generateText.mock.calls[0]?.[0];
    expect(runtimeOptions).toBeTruthy();
    expect(runtimeOptions.tools.getNote).toBeUndefined();
    expect(runtimeOptions.tools.searchNotes).toBeUndefined();
    expect(runtimeOptions.tools.searchKnowledge).toBeUndefined();
    expect(runtimeOptions.tools.saveToNote).toBeDefined();
  });

  it('keeps proactive retrieval tools available when active retrieval is enabled', async () => {
    const { OpenAICompatibleAdapter } = await import('../../../../electron/ai/adapter');

    const adapter = new OpenAICompatibleAdapter({
      providerId: 'deepseek',
      provider: 'DeepSeek',
      baseURL: 'https://api.deepseek.com/v1',
      apiKey: 'test-key',
      model: 'deepseek-chat',
    });

    await adapter.chat({
      message: '帮我回答这个问题',
      messages: [],
      allowActiveRetrieval: true,
    });

    const runtimeOptions = generateText.mock.calls[0]?.[0];
    expect(runtimeOptions).toBeTruthy();
    expect(runtimeOptions.tools.getNote).toBeDefined();
    expect(runtimeOptions.tools.searchNotes).toBeDefined();
    expect(runtimeOptions.tools.searchKnowledge).toBeDefined();
  });
});
