import type { ModelMessage } from 'ai';

import type { AIConfig, ChatMessage, ChatPayload } from '../../src/services/aiConfig';
import type { NoteReference } from '../../src/services/types';
import {
  estimateMessagesTokens,
  estimateTextTokens,
  resolveContextTokenBudget,
  truncateTextToTokenLimit,
  type ContextTokenBudget,
} from './tokenBudget';

const TOOL_ACTION_POLICY_PROMPT = `## 工具执行规则

当用户要求你执行“创建便签 / 保存为便签 / 追加到便签 / 创建任务 / 生成待办”等落地动作时，你必须遵守：
- 只有在你真实发起了工具调用，并且收到了审批或执行结果后，才能说“已创建”“已保存”“已追加”“已生成”
- 如果你还没有发起工具调用，绝不能假装动作已经完成
- 如果当前模型或环境不支持工具调用，你必须明确说明“现在还没有实际执行”，并提示用户切换到支持工具调用的模型
- 如果需要用户审批，先说明“我准备这样做，等待你确认”，不能提前宣称执行成功`;

function flattenMessageContent(content: ModelMessage['content']): string {
  if (typeof content === 'string') {
    return content;
  }

  return content
    .map((part) => {
      if ('text' in part && typeof part.text === 'string') {
        return part.text;
      }
      return '';
    })
    .join('\n');
}

function trimPromptToBudget(prompt: string, maxTokens: number): string | null {
  const normalized = prompt.trim();
  if (!normalized) {
    return null;
  }

  const truncated = truncateTextToTokenLimit(normalized, maxTokens);
  return truncated.trim() ? truncated : null;
}

function buildRagContextPrompt(
  ragContext: NonNullable<ChatPayload['ragContext']>,
  maxTokens: number,
): string | null {
  const budgetPerItem = Math.max(
    180,
    Math.floor(maxTokens / Math.max(ragContext.results.length, 1)),
  );
  const formattedResults = ragContext.results
    .map((result, index) => {
      const excerptBudget = Math.max(120, budgetPerItem - 48);
      const excerpt = truncateTextToTokenLimit(result.excerpt, excerptBudget);
      return `### [来源 ${index + 1}] ${result.noteTitle}\n${excerpt}`;
    })
    .join('\n\n---\n\n');

  const prompt = `## 参考资料（来自用户知识库，共 ${ragContext.results.length} 条）

请优先基于以下参考资料回答用户问题。

回答原则：
- 如果参考资料中没有相关信息，请明确说明
- 不要编造参考资料中不存在的信息
- 如果引用资料，请在回答里直接说明来源编号

${formattedResults}`;

  return trimPromptToBudget(prompt, maxTokens);
}

function buildReferenceContextPrompt(
  references: NoteReference[],
  maxTokens: number,
): string | null {
  const budgetPerReference = Math.max(180, Math.floor(maxTokens / Math.max(references.length, 1)));
  const formattedReferences = references
    .map((reference, index) => {
      const contentBudget = Math.max(140, budgetPerReference - 48);
      const content = truncateTextToTokenLimit(reference.content, contentBudget);
      return `### [引用 ${index + 1}] ${reference.title}\n${content}`;
    })
    .join('\n\n---\n\n');

  const prompt = `## 用户主动引用的便签内容

以下内容由用户显式引用，请把它们当作额外上下文使用。
- 优先结合这些便签内容回答
- 如果便签内容与历史消息冲突，明确说明冲突点
- 不要把这些上下文误写成用户当前输入的一部分

${formattedReferences}`;

  return trimPromptToBudget(prompt, maxTokens);
}

function fitHistoricalMessage(message: ChatMessage, maxTokens: number): ModelMessage[] {
  const budget = Math.max(120, maxTokens);

  if (message.role !== 'user' || !message.references || message.references.length === 0) {
    const content = truncateTextToTokenLimit(message.content, Math.max(80, budget - 12));
    return content.trim()
      ? [
          {
            role: message.role,
            content,
          },
        ]
      : [];
  }

  const referenceBudget = Math.min(Math.max(120, Math.floor(budget * 0.4)), budget - 100);
  const referencePrompt = buildReferenceContextPrompt(message.references, referenceBudget);
  const userBudget = Math.max(
    80,
    budget - (referencePrompt ? estimateTextTokens(referencePrompt) : 0) - 16,
  );
  const userContent = truncateTextToTokenLimit(message.content, userBudget);

  return [
    ...(referencePrompt
      ? [
          {
            role: 'system' as const,
            content: referencePrompt,
          },
        ]
      : []),
    ...(userContent.trim()
      ? [
          {
            role: 'user' as const,
            content: userContent,
          },
        ]
      : []),
  ];
}

function buildHistoryMessages(history: ChatMessage[], budget: ContextTokenBudget): ModelMessage[] {
  const selected: ModelMessage[] = [];
  let remaining = budget.historyBudgetTokens;

  for (let index = history.length - 1; index >= 0; index -= 1) {
    const candidate = fitHistoricalMessage(history[index], remaining);
    if (candidate.length === 0) {
      continue;
    }

    const candidateTokens = estimateMessagesTokens(candidate);

    if (candidateTokens <= remaining) {
      selected.unshift(...candidate);
      remaining -= candidateTokens;
      continue;
    }

    const fitted = fitHistoricalMessage(history[index], remaining);
    const fittedTokens = estimateMessagesTokens(fitted);
    if (fitted.length > 0 && fittedTokens <= remaining) {
      selected.unshift(...fitted);
      remaining -= fittedTokens;
    }

    break;
  }

  return selected;
}

export interface BuiltModelContext {
  messages: ModelMessage[];
  budget: ContextTokenBudget;
}

export function buildModelContext(config: AIConfig, payload: ChatPayload): BuiltModelContext {
  const budget = resolveContextTokenBudget(config, payload.message);
  const currentUserContent = truncateTextToTokenLimit(
    payload.message,
    budget.currentMessageBudgetTokens,
  );

  const fixedMessages: ModelMessage[] = [
    ...(config.systemPrompt
      ? [
          {
            role: 'system' as const,
            content: config.systemPrompt,
          },
        ]
      : []),
    {
      role: 'system' as const,
      content: TOOL_ACTION_POLICY_PROMPT,
    },
  ];

  const contextualMessages: ModelMessage[] = [];

  if (payload.ragContext && payload.ragContext.results.length > 0) {
    const ragPrompt = buildRagContextPrompt(payload.ragContext, budget.ragBudgetTokens);
    if (ragPrompt) {
      contextualMessages.push({
        role: 'system',
        content: ragPrompt,
      });
    }
  }

  if (payload.references && payload.references.length > 0) {
    const referencePrompt = buildReferenceContextPrompt(
      payload.references,
      budget.referenceBudgetTokens,
    );
    if (referencePrompt) {
      contextualMessages.push({
        role: 'system',
        content: referencePrompt,
      });
    }
  }

  const historyMessages = buildHistoryMessages(payload.messages, budget);
  const messages: ModelMessage[] = [
    ...fixedMessages,
    ...historyMessages,
    ...contextualMessages,
    {
      role: 'user',
      content: currentUserContent,
    },
  ];

  return {
    messages,
    budget,
  };
}

export function buildModelMessages(config: AIConfig, payload: ChatPayload): ModelMessage[] {
  return buildModelContext(config, payload).messages;
}

export function mergeReasoningAndText(reasoningText: string | undefined, text: string): string {
  const normalizedReasoning = reasoningText?.trim();
  if (!normalizedReasoning) {
    return text;
  }

  return `<think>${normalizedReasoning}</think>\n${text}`;
}

export function debugFlattenModelMessages(messages: ModelMessage[]): string {
  return messages.map((message) => flattenMessageContent(message.content)).join('\n');
}
