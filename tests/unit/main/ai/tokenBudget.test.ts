import { describe, expect, it } from 'vitest';

import {
  estimateTextTokens,
  resolveContextTokenBudget,
  truncateTextToTokenLimit,
} from '../../../../electron/ai/tokenBudget';

describe('tokenBudget', () => {
  it('estimates Chinese text as more expensive than sparse ASCII text', () => {
    expect(estimateTextTokens('这是一个中文句子')).toBeGreaterThan(
      estimateTextTokens('short ascii'),
    );
  });

  it('truncates long text to the requested token ceiling', () => {
    const original = 'A'.repeat(10_000);
    const truncated = truncateTextToTokenLimit(original, 120);

    expect(truncated.length).toBeLessThan(original.length);
    expect(estimateTextTokens(truncated)).toBeLessThanOrEqual(120);
  });

  it('resolves a positive input budget after reserving output and safety tokens', () => {
    const budget = resolveContextTokenBudget(
      {
        providerId: 'deepseek',
        provider: 'DeepSeek',
        baseURL: 'https://api.deepseek.com/v1',
        apiKey: 'test',
        model: 'deepseek-chat',
        max_tokens: 4096,
      },
      '请帮我总结当前方案',
    );

    expect(budget.contextWindowTokens).toBeGreaterThan(budget.inputBudgetTokens);
    expect(budget.inputBudgetTokens).toBeGreaterThan(0);
    expect(budget.historyBudgetTokens).toBeGreaterThan(0);
    expect(budget.referenceBudgetTokens).toBeGreaterThan(0);
  });
});
