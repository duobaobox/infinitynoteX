import { act, renderHook, waitFor } from '@testing-library/react';

import { useWorkspaceStore } from '../../../../src/store/workspaceStore';
import { useAIChat } from '../../../../src/features/ai-chat/hooks/useAIChat';

describe('useAIChat', () => {
  beforeEach(() => {
    useWorkspaceStore.setState({
      conversationMessages: {},
      requests: {},
      currentRequest: null,
      toolCalls: {},
      messageRefreshTriggers: {},
    });

    const testWindow = window as Window & {
      ai: Window['ai'];
      storage: Window['storage'];
    };

    testWindow.ai = {} as Window['ai'];
    testWindow.storage = {
      getAIConversation: async () => ({
        id: 'conv-1',
        title: 'Mock Conversation',
        excerpt: '',
        messages: [],
        createdAt: 1,
        updatedAt: 1,
      }),
    } as Window['storage'];
  });

  it('derives chat items from workspace store messages instead of local hook state', async () => {
    useWorkspaceStore.getState().setConversationMessages('conv-1', [
      {
        id: 'msg-1',
        role: 'assistant',
        content: '答案正文',
        reasoning: '推理过程',
        timestamp: 1,
      },
    ]);

    const { result } = renderHook(() =>
      useAIChat({
        conversationId: 'conv-1',
        isConfigured: true,
        source: 'workbench',
        autoSave: false,
      }),
    );

    await waitFor(() => {
      expect(result.current.chatItems).toEqual([
        expect.objectContaining({
          key: 'msg-1',
          role: 'ai',
          content: '<think>推理过程</think>\n答案正文',
        }),
      ]);
    });
  });

  it('clears conversation messages through the store-backed path', async () => {
    useWorkspaceStore.getState().setConversationMessages('conv-1', [
      {
        id: 'msg-1',
        role: 'assistant',
        content: '答案正文',
        timestamp: 1,
      },
    ]);

    const { result } = renderHook(() =>
      useAIChat({
        conversationId: 'conv-1',
        isConfigured: true,
        source: 'workbench',
        autoSave: false,
      }),
    );

    await act(async () => {
      result.current.clearChat();
    });

    await waitFor(() => {
      expect(useWorkspaceStore.getState().getConversationMessages('conv-1')).toEqual([]);
    });
  });
});
