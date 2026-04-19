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

  it('forces save tool only for actionable intent', async () => {
    const { OpenAICompatibleAdapter } = await import('../../../../electron/ai/adapter');

    const adapter = new OpenAICompatibleAdapter({
      providerId: 'deepseek',
      provider: 'DeepSeek',
      baseURL: 'https://api.deepseek.com/v1',
      apiKey: 'test-key',
      model: 'deepseek-chat',
    });

    await adapter.chat({
      message: '请把这段总结保存成便签',
      messages: [],
      allowActiveRetrieval: false,
    });

    const runtimeOptions = generateText.mock.calls[0]?.[0];
    expect(runtimeOptions.activeTools).toEqual(['saveToNote']);
    expect(runtimeOptions.toolChoice).toEqual({ type: 'tool', toolName: 'saveToNote' });
  });

  it('does not force write tools for exploratory prompts', async () => {
    const { OpenAICompatibleAdapter } = await import('../../../../electron/ai/adapter');

    const adapter = new OpenAICompatibleAdapter({
      providerId: 'deepseek',
      provider: 'DeepSeek',
      baseURL: 'https://api.deepseek.com/v1',
      apiKey: 'test-key',
      model: 'deepseek-chat',
    });

    await adapter.chat({
      message: '如何把会议纪要整理成便签？先别执行，只讨论方案',
      messages: [],
      allowActiveRetrieval: false,
    });

    const runtimeOptions = generateText.mock.calls[0]?.[0];
    expect(runtimeOptions.activeTools).toBeUndefined();
    expect(runtimeOptions.toolChoice).toBeUndefined();
  });

  it('returns unsupported-tool message only for actionable intent on non-tool models', async () => {
    const { OpenAICompatibleAdapter } = await import('../../../../electron/ai/adapter');

    const adapter = new OpenAICompatibleAdapter({
      providerId: 'deepseek',
      provider: 'DeepSeek',
      baseURL: 'https://api.deepseek.com/v1',
      apiKey: 'test-key',
      model: 'deepseek-reasoner',
    });

    const response = await adapter.chat({
      message: '请帮我创建一条待办任务',
      messages: [],
      allowActiveRetrieval: false,
    });

    expect(response.content).toContain('当前所选模型不支持工具调用');
    expect(generateText).not.toHaveBeenCalled();
  });

  it('keeps regular chat available on non-tool models for non-actionable prompts', async () => {
    const { OpenAICompatibleAdapter } = await import('../../../../electron/ai/adapter');

    const adapter = new OpenAICompatibleAdapter({
      providerId: 'deepseek',
      provider: 'DeepSeek',
      baseURL: 'https://api.deepseek.com/v1',
      apiKey: 'test-key',
      model: 'deepseek-reasoner',
    });

    const response = await adapter.chat({
      message: '如何创建一条待办任务？先别执行，只给我建议',
      messages: [],
      allowActiveRetrieval: false,
    });

    expect(response.content).toBe('ok');
    expect(generateText).toHaveBeenCalledTimes(1);
  });
});
