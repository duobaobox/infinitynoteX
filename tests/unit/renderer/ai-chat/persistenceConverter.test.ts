import type { AIMessage } from '../../../../src/services/types';
import type { Message } from '../../../../src/store/slices/aiConversationSlice';
import {
  persistedMessagesToStoreMessages,
  storeMessagesToPersistedMessages,
} from '../../../../src/features/ai-chat/utils/persistenceConverter';

describe('persistenceConverter', () => {
  it('restores persisted reasoning without embedding think tags into Message.content', () => {
    const restored = persistedMessagesToStoreMessages([
      {
        role: 'assistant',
        content: '正文',
        reasoning: '思考过程',
        timestamp: 1,
      },
    ] satisfies AIMessage[]);

    expect(restored).toEqual([
      {
        id: 'persisted_0',
        role: 'assistant',
        content: '正文',
        reasoning: '思考过程',
        timestamp: 1,
        references: undefined,
        ragSources: undefined,
        toolApprovals: undefined,
        runTrace: undefined,
      },
    ] satisfies Message[]);
  });

  it('persists store messages without leaking think tags into storage content', () => {
    const persisted = storeMessagesToPersistedMessages([
      {
        id: 'm1',
        role: 'assistant',
        content: '正文',
        reasoning: '思考过程',
        timestamp: 1,
      },
    ] satisfies Message[]);

    expect(persisted).toEqual([
      {
        id: 'm1',
        role: 'assistant',
        content: '正文',
        reasoning: '思考过程',
        timestamp: 1,
        references: undefined,
        ragSources: undefined,
        toolApprovals: undefined,
        runTrace: undefined,
      },
    ] satisfies AIMessage[]);
  });
});
