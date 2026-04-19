import type { AIMessage } from '../../../services/types';
import type { Message } from '../../../store/slices/aiConversationSlice';

export function persistedMessagesToStoreMessages(messages: AIMessage[]): Message[] {
  return messages.map((message, index) => ({
    id: message.id ?? `persisted_${index}`,
    role: message.role,
    content: message.content,
    reasoning: message.reasoning,
    timestamp: message.timestamp,
    references: message.references,
    ragSources: message.ragSources,
    toolApprovals: message.toolApprovals,
    runTrace: message.runTrace,
  }));
}

export function storeMessagesToPersistedMessages(messages: Message[]): AIMessage[] {
  return messages.map((message) => ({
    id: message.id,
    role: message.role,
    content: message.content,
    reasoning: message.reasoning,
    timestamp: message.timestamp,
    references: message.references,
    ragSources: message.ragSources,
    toolApprovals: message.toolApprovals,
    runTrace: message.runTrace,
  }));
}
