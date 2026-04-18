import type { ModelMessage } from 'ai';

import type { AIConfig } from '../../src/services/aiConfig';
import { getConservativeContextWindow } from '../../src/services/aiProviders';

const MIN_RESPONSE_RESERVE_TOKENS = 768;
const MAX_RESPONSE_RESERVE_TOKENS = 8_192;
const MIN_INPUT_BUDGET_TOKENS = 4_096;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function isCjk(char: string): boolean {
  return /[\u3400-\u9fff\uf900-\ufaff]/.test(char);
}

export function estimateTextTokens(text: string): number {
  if (!text.trim()) {
    return 0;
  }

  let cjkChars = 0;
  let nonAsciiChars = 0;
  let asciiChars = 0;
  let whitespaceChars = 0;

  for (const char of text) {
    if (/\s/.test(char)) {
      whitespaceChars += 1;
    } else if (isCjk(char)) {
      cjkChars += 1;
    } else if (char.charCodeAt(0) > 127) {
      nonAsciiChars += 1;
    } else {
      asciiChars += 1;
    }
  }

  const estimate =
    cjkChars * 1.15 + nonAsciiChars * 1.5 + asciiChars / 4 + whitespaceChars / 10 + 8;

  return Math.ceil(estimate);
}

export function estimateMessageTokens(message: ModelMessage): number {
  if (typeof message.content === 'string') {
    return estimateTextTokens(message.content) + 4;
  }

  const flattened = message.content
    .map((part) => {
      if ('text' in part && typeof part.text === 'string') {
        return part.text;
      }
      if ('toolName' in part && typeof part.toolName === 'string') {
        return part.toolName;
      }
      return '';
    })
    .join('\n');

  return estimateTextTokens(flattened) + 8;
}

export function estimateMessagesTokens(messages: ModelMessage[]): number {
  return messages.reduce((sum, message) => sum + estimateMessageTokens(message), 0);
}

export function truncateTextToTokenLimit(text: string, maxTokens: number): string {
  if (maxTokens <= 0) {
    return '';
  }

  if (estimateTextTokens(text) <= maxTokens) {
    return text;
  }

  const chars = Array.from(text);
  let low = 0;
  let high = chars.length;
  let best = '';

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const candidate = `${chars.slice(0, mid).join('').trimEnd()}…`;
    const estimated = estimateTextTokens(candidate);

    if (estimated <= maxTokens) {
      best = candidate;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return best || '…';
}

export interface ContextTokenBudget {
  contextWindowTokens: number;
  responseReserveTokens: number;
  safetyReserveTokens: number;
  inputBudgetTokens: number;
  currentMessageBudgetTokens: number;
  referenceBudgetTokens: number;
  ragBudgetTokens: number;
  historyBudgetTokens: number;
}

export function resolveContextTokenBudget(
  config: AIConfig,
  currentMessage: string,
): ContextTokenBudget {
  const contextWindowTokens = getConservativeContextWindow(config).tokens;
  const responseReserveTokens = clamp(
    config.max_tokens ?? 4096,
    MIN_RESPONSE_RESERVE_TOKENS,
    Math.min(MAX_RESPONSE_RESERVE_TOKENS, Math.floor(contextWindowTokens * 0.3)),
  );
  const safetyReserveTokens = Math.max(1024, Math.floor(contextWindowTokens * 0.08));
  const inputBudgetTokens = Math.max(
    MIN_INPUT_BUDGET_TOKENS,
    contextWindowTokens - responseReserveTokens - safetyReserveTokens,
  );

  const currentMessageEstimate = estimateTextTokens(currentMessage);
  const currentMessageBudgetTokens = clamp(
    Math.max(currentMessageEstimate + 256, Math.floor(inputBudgetTokens * 0.22)),
    1200,
    Math.max(1200, Math.floor(inputBudgetTokens * 0.45)),
  );

  const remaining = Math.max(1200, inputBudgetTokens - currentMessageBudgetTokens);
  const referenceBudgetTokens = Math.floor(remaining * 0.3);
  const ragBudgetTokens = Math.floor(remaining * 0.18);
  const historyBudgetTokens = Math.max(1000, remaining - referenceBudgetTokens - ragBudgetTokens);

  return {
    contextWindowTokens,
    responseReserveTokens,
    safetyReserveTokens,
    inputBudgetTokens,
    currentMessageBudgetTokens,
    referenceBudgetTokens,
    ragBudgetTokens,
    historyBudgetTokens,
  };
}
