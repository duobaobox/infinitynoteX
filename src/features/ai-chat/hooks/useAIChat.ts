/**
 * useAIChat Hook - AI 对话管理
 *
 * 通过 workspace store + ChatOrchestrator 管理对话状态。
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';

import { useWorkspaceStore } from '../../../store/workspaceStore';
import type { AIConversationBinding, AIConversation } from '../../../services/types';
import type { NoteReference, UseAIChatReturn } from '../types';
import { ChatOrchestrator } from '../orchestrators/ChatOrchestrator';
import { buildChatItemsFromStore } from '../utils/chatItemSelectors';

interface UseAIChatOptions {
  conversationId: string | null;
  conversationBinding?: AIConversationBinding | null;
  isConfigured: boolean;
  allowActiveRetrieval?: boolean;
  useFallbackRag?: boolean;
  onTitleChange?: (title: string) => void;
  source?: 'note' | 'workbench' | 'canvas' | 'global';
  autoSave?: boolean;
}

function getEphemeralConversationKey(source: NonNullable<UseAIChatOptions['source']>): string {
  return `temp-${source}`;
}

export const useAIChat = ({
  conversationId,
  conversationBinding = null,
  isConfigured,
  allowActiveRetrieval = false,
  useFallbackRag = false,
  onTitleChange,
  source = 'workbench',
  autoSave = true,
}: UseAIChatOptions): UseAIChatReturn => {
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isResolvingConversation, setIsResolvingConversation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [activeConversationId, setActiveConversationId] = useState<string | null>(conversationId);

  const orchestratorRef = useRef<ChatOrchestrator | null>(null);
  if (!orchestratorRef.current) {
    orchestratorRef.current = new ChatOrchestrator(useWorkspaceStore);
  }

  const bindingSource = conversationBinding?.source ?? null;
  const bindingEntityId = conversationBinding?.entityId ?? null;

  const persistedConversationId =
    bindingSource && bindingEntityId ? activeConversationId : conversationId;
  const runtimeConversationId = persistedConversationId ?? getEphemeralConversationKey(source);

  const messages = useWorkspaceStore((state) =>
    state.getConversationMessages(runtimeConversationId),
  );
  const toolCalls = useWorkspaceStore((state) => state.toolCalls);
  const requests = useWorkspaceStore((state) => state.requests);
  const messageRefreshTrigger = useWorkspaceStore(
    (state) =>
      (persistedConversationId ? state.messageRefreshTriggers[persistedConversationId] : 0) ?? 0,
  );

  const activeRequest = useMemo(() => {
    return (
      Object.values(requests)
        .filter((request) => request.conversationId === runtimeConversationId)
        .sort((left, right) => right.startTime - left.startTime)
        .find((request) => request.state !== 'COMPLETED' && request.state !== 'ERROR') ?? null
    );
  }, [requests, runtimeConversationId]);

  const chatItems = useMemo(() => {
    const baseItems = buildChatItemsFromStore(messages, toolCalls);
    const isRequestActive =
      activeRequest?.state === 'GENERATING' ||
      activeRequest?.state === 'WAITING_APPROVALS' ||
      activeRequest?.state === 'EXECUTING_TOOLS';

    if (!activeRequest || !isRequestActive) {
      return baseItems;
    }

    const streamingMessageIds = new Set(activeRequest.messageIds);
    return baseItems.map((item) =>
      item.role === 'ai' && streamingMessageIds.has(item.key)
        ? { ...item, isStreaming: true }
        : item,
    );
  }, [activeRequest, messages, toolCalls]);

  const isLoading =
    activeRequest?.state === 'GENERATING' ||
    activeRequest?.state === 'WAITING_APPROVALS' ||
    activeRequest?.state === 'EXECUTING_TOOLS';

  useEffect(() => {
    return () => {
      orchestratorRef.current?.cleanup();
    };
  }, []);

  useEffect(() => {
    if (!bindingSource || !bindingEntityId) {
      setActiveConversationId(conversationId);
      setIsResolvingConversation(false);
      return;
    }

    let cancelled = false;

    const resolveExistingConversation = async () => {
      setIsResolvingConversation(true);
      setError(null);

      try {
        const conversation = await window.storage.resolveAIConversationBinding(
          { source: bindingSource, entityId: bindingEntityId },
          { autoCreate: false },
        );

        if (cancelled) {
          return;
        }

        setActiveConversationId(conversation?.id ?? null);
        if (conversation) {
          onTitleChange?.(conversation.title || 'AI 对话');
        }
      } catch (err) {
        if (!cancelled) {
          console.error('[useAIChat] Failed to resolve bound conversation:', err);
          setActiveConversationId(null);
        }
      } finally {
        if (!cancelled) {
          setIsResolvingConversation(false);
        }
      }
    };

    void resolveExistingConversation();

    return () => {
      cancelled = true;
    };
  }, [bindingEntityId, bindingSource, conversationId, onTitleChange]);

  const handleMissingConversation = useCallback(
    (missingConversationId: string) => {
      useWorkspaceStore.getState().clearConversationMessages(missingConversationId);
      setActiveConversationId(null);

      if (source !== 'workbench') {
        return;
      }

      const store = useWorkspaceStore.getState();
      if (
        store.selectedAIWorkbenchItem?.conversationId === missingConversationId ||
        store.selectedToolItemId === missingConversationId
      ) {
        store.setSelectedAIWorkbenchItem(null);
      }
    },
    [source],
  );

  const isConversationNotFoundError = useCallback((err: unknown): err is Error => {
    return err instanceof Error && err.message.includes('not found');
  }, []);

  useEffect(() => {
    if (!persistedConversationId) {
      setIsLoadingHistory(false);
      return;
    }

    let cancelled = false;

    const loadConversation = async () => {
      setIsLoadingHistory(true);
      setError(null);

      try {
        await orchestratorRef.current?.loadConversation(persistedConversationId, { onTitleChange });
      } catch (err) {
        if (cancelled) {
          return;
        }

        if (isConversationNotFoundError(err)) {
          handleMissingConversation(persistedConversationId);
          return;
        }

        console.error('[useAIChat] Failed to load conversation history:', err);
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) {
          setIsLoadingHistory(false);
        }
      }
    };

    void loadConversation();

    return () => {
      cancelled = true;
    };
  }, [
    handleMissingConversation,
    isConversationNotFoundError,
    onTitleChange,
    persistedConversationId,
  ]);

  const previousRefreshTriggerRef = useRef(messageRefreshTrigger);
  useEffect(() => {
    if (
      !persistedConversationId ||
      messageRefreshTrigger === previousRefreshTriggerRef.current ||
      isLoading
    ) {
      previousRefreshTriggerRef.current = messageRefreshTrigger;
      return;
    }

    previousRefreshTriggerRef.current = messageRefreshTrigger;
    void orchestratorRef.current
      ?.loadConversation(persistedConversationId, { onTitleChange })
      .catch((err) => {
        console.error('[useAIChat] Failed to refresh conversation from store:', err);
      });
  }, [isLoading, messageRefreshTrigger, onTitleChange, persistedConversationId]);

  const ensureConversationTarget = useCallback(async (): Promise<string> => {
    if (persistedConversationId) {
      return persistedConversationId;
    }

    if (bindingSource && bindingEntityId && autoSave) {
      setIsResolvingConversation(true);
      try {
        const conversation = (await window.storage.resolveAIConversationBinding(
          { source: bindingSource, entityId: bindingEntityId },
          { autoCreate: true },
        )) as AIConversation | null;

        if (!conversation) {
          throw new Error('Failed to create bound conversation');
        }

        setActiveConversationId(conversation.id);
        onTitleChange?.(conversation.title || 'AI 对话');
        return conversation.id;
      } finally {
        setIsResolvingConversation(false);
      }
    }

    return runtimeConversationId;
  }, [
    autoSave,
    bindingEntityId,
    bindingSource,
    onTitleChange,
    persistedConversationId,
    runtimeConversationId,
  ]);

  const sendMessage = useCallback(
    async (text: string, references?: NoteReference[]) => {
      if (!text.trim() || !isConfigured) {
        return;
      }

      setInputValue('');
      setError(null);

      try {
        const targetConversationId = await ensureConversationTarget();
        if (targetConversationId !== runtimeConversationId) {
          useWorkspaceStore.getState().clearConversationMessages(runtimeConversationId);
        }

        await orchestratorRef.current?.handleSendMessage({
          conversationId: targetConversationId,
          text,
          references,
          allowActiveRetrieval,
          useFallbackRag,
          source,
          sourceEntityId: bindingEntityId,
          autoSave,
          onTitleChange,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
      }
    },
    [
      allowActiveRetrieval,
      autoSave,
      bindingEntityId,
      ensureConversationTarget,
      isConfigured,
      onTitleChange,
      runtimeConversationId,
      source,
      useFallbackRag,
    ],
  );

  const respondToToolApproval = useCallback(
    async (approvalId: string, approved: boolean) => {
      try {
        await orchestratorRef.current?.respondToToolApproval({
          conversationId: runtimeConversationId,
          approvalId,
          approved,
          autoSave,
          source,
          sourceEntityId: bindingEntityId,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [autoSave, bindingEntityId, runtimeConversationId, source],
  );

  const abort = useCallback(() => {
    if (!activeRequest?.id) {
      return;
    }

    void orchestratorRef.current?.abortRequest(activeRequest.id).catch((err) => {
      setError(err instanceof Error ? err.message : String(err));
    });
  }, [activeRequest?.id]);

  const clearChat = useCallback(() => {
    setError(null);
    void orchestratorRef.current?.clearConversation(runtimeConversationId, {
      autoSave: autoSave && Boolean(persistedConversationId),
      source,
      sourceEntityId: bindingEntityId,
    });
  }, [autoSave, bindingEntityId, persistedConversationId, runtimeConversationId, source]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    activeConversationId,
    chatItems,
    isLoading: Boolean(isLoading),
    isResolvingConversation,
    isLoadingHistory,
    error,
    inputValue,
    setInputValue,
    sendMessage,
    abort,
    clearChat,
    clearError,
    respondToToolApproval,
  };
};
