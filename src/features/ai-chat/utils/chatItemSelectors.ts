import type { Message } from '../../../store/slices/aiConversationSlice';
import type { ToolCall } from '../../../store/slices/toolCallSlice';
import type { AIToolDraft, ChatItem } from '../types';
import { buildChatItems } from './messageConverter';

function getToolDraft(toolCall: ToolCall | undefined): AIToolDraft | null {
  if (!toolCall || toolCall.state.type !== 'DRAFTING') {
    return null;
  }

  return {
    toolCallId: toolCall.id,
    toolName: toolCall.toolName,
    inputText: toolCall.state.input,
  };
}

export function buildChatItemsFromStore(
  messages: Message[],
  toolCalls: Record<string, ToolCall>,
): ChatItem[] {
  return buildChatItems(messages).map((item, index) => {
    const message = messages[index];
    const toolDrafts = (message?.relatedToolCallIds ?? [])
      .map((toolCallId) => getToolDraft(toolCalls[toolCallId]))
      .filter((draft): draft is AIToolDraft => draft !== null);

    if (!toolDrafts.length) {
      return item;
    }

    return {
      ...item,
      toolDrafts,
    };
  });
}
