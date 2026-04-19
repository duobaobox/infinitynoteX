/**
 * Message Converter Utilities
 *
 * 转换 Message（store 真相格式）和 ChatItem（UI 格式）之间的数据。
 */

import type { Message } from '../../../store/slices/aiConversationSlice';
import type { ChatItem } from '../types';

function normalizeReasoning(reasoning?: string): string | undefined {
  const normalized = reasoning?.trim().replace(/\n\n+/g, '\n');
  return normalized ? normalized : undefined;
}

function splitReasoningContent(content: string): { content: string; reasoning?: string } {
  const thinkMatch = content.match(/<think>([\s\S]*?)<\/think>\s*/);
  if (!thinkMatch) {
    return { content };
  }

  const reasoning = normalizeReasoning(thinkMatch[1]);
  const visibleContent = content.replace(/<think>[\s\S]*?<\/think>\s*/, '').trim();

  return {
    content: visibleContent,
    reasoning,
  };
}

function mergeReasoningContent(content: string, reasoning?: string): string {
  const normalizedReasoning = normalizeReasoning(reasoning);
  if (!normalizedReasoning) {
    return content;
  }

  return `<think>${normalizedReasoning}</think>\n${content}`;
}

export function messageToChatItem(message: Message): ChatItem {
  return {
    key: message.id,
    role: message.role === 'assistant' ? 'ai' : 'user',
    content: mergeReasoningContent(message.content, message.reasoning),
    timestamp: message.timestamp,
    references: message.references,
    ragSources: message.ragSources,
    toolApprovals: message.toolApprovals,
    runTrace: message.runTrace,
  };
}

export function chatItemToMessage(item: ChatItem): Message {
  const parsed = splitReasoningContent(item.content);

  return {
    id: item.key,
    role: item.role === 'ai' ? 'assistant' : 'user',
    content: parsed.content,
    reasoning: parsed.reasoning,
    timestamp: item.timestamp,
    references: item.references,
    ragSources: item.ragSources,
    toolApprovals: item.toolApprovals,
    runTrace: item.runTrace,
  };
}

export function messagesToChatItems(messages: Message[]): ChatItem[] {
  return messages.map(messageToChatItem);
}

export function buildChatItems(messages: Message[]): ChatItem[] {
  return messagesToChatItems(messages);
}

export function mergeChatItemsWithToolData(items: ChatItem[]): ChatItem[] {
  return items.map((item) => item);
}

export { mergeReasoningContent, splitReasoningContent };
