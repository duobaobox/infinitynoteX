/**
 * useAIChat Hook - AI 对话管理
 *
 * 核心功能：消息管理、流式处理、历史记录加载/保存
 *
 * conversationId 行为：
 * - null: 临时对话，不加载历史，不保存
 * - string: 持久对话，自动加载和保存历史
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useXChat } from '@ant-design/x-sdk';

import { useWorkspaceStore } from '../../../store/workspaceStore';
import type { ChatMessage } from '../../../services/aiConfig';
import type {
  AIConversation,
  AIConversationBinding,
  AIRunTrace,
  AIToolApproval,
} from '../../../services/types';
import type {
  AIToolDraft,
  ChatItem,
  NoteReference,
  StreamChunkData,
  UseAIChatReturn,
} from '../types';
import {
  mergeToolDrafts,
  mergeToolApprovals,
  removeToolDraft,
  resolveApprovalContinuationContent,
  stripToolDrafts,
} from '../approvalFlow';
import {
  type ChatMessageInfo,
  findMessageIndexByApprovalId,
  findMessageIndexByRequestId,
  mergeApprovalsIntoInfos,
  mergeRunTraceIntoInfos,
  mergeToolDraftsIntoInfos,
  removeToolDraftFromInfos,
} from '../messageState';
import { IpcChatProvider, type IpcStreamInput, type XChatMessage } from '../xsdk/IpcChatProvider';

function toChatItemsFromInfos(
  infos: ChatMessageInfo[],
  currentRagSources?: ChatItem['ragSources'],
): ChatItem[] {
  return infos.map((info) => {
    const isAiMessage = info.message.role === 'ai';
    const isStreaming = info.status === 'loading' || info.status === 'updating';

    return {
      key: String(info.id),
      role: info.message.role,
      content: info.message.content,
      timestamp: info.message.timestamp,
      references: info.message.references,
      toolApprovals: info.message.toolApprovals,
      toolDrafts: info.message.toolDrafts,
      runTrace: info.message.runTrace,
      isStreaming,
      ragSources: isAiMessage ? (info.message.ragSources ?? currentRagSources) : undefined,
    };
  });
}

interface UseAIChatOptions {
  /** 对话 ID */
  conversationId: string | null;
  /** 绑定型对话（如 note/global） */
  conversationBinding?: AIConversationBinding | null;
  /** 是否已配置 AI */
  isConfigured: boolean;
  /** 是否允许 AI 主动检索用户资料 */
  allowActiveRetrieval?: boolean;
  /** 是否回退到旧的前置 RAG 检索 */
  useFallbackRag?: boolean;
  /** 标题变更回调 */
  onTitleChange?: (title: string) => void;
  /** 对话来源：note=便签, workbench=AI工坊, canvas=画布, global=全局 */
  source?: 'note' | 'workbench' | 'canvas' | 'global';
  /** 是否自动保存对话历史（默认 true）*/
  autoSave?: boolean;
}

/**
 * AI 对话管理 Hook
 */
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

  const lastRequestHadErrorRef = useRef(false);
  const prevIsRequestingRef = useRef(false);
  const currentRagSourcesRef = useRef<ChatItem['ragSources']>(undefined);
  const bindingSource = conversationBinding?.source ?? null;
  const bindingEntityId = conversationBinding?.entityId ?? null;
  const boundConversationKey =
    bindingSource && bindingEntityId ? `bound-${bindingSource}-${bindingEntityId}` : null;
  const persistedConversationId =
    bindingSource && bindingEntityId ? activeConversationId : conversationId;
  const prevConversationIdRef = useRef<string | null>(persistedConversationId);

  const [provider] = useState(() => new IpcChatProvider());

  const { onRequest, messages, setMessages, isRequesting, abort } = useXChat<
    XChatMessage,
    XChatMessage,
    IpcStreamInput,
    StreamChunkData
  >({
    provider,
    conversationKey: boundConversationKey || conversationId || `temp-${source}`,
    requestPlaceholder: () => ({
      role: 'ai',
      content: '',
      timestamp: Date.now(),
    }),
    requestFallback: (_req, { error: reqError, messageInfo }) => {
      if (reqError?.name === 'AbortError') {
        lastRequestHadErrorRef.current = true;
        const partial = (messageInfo as { message?: { content?: unknown } } | undefined)?.message
          ?.content;
        return {
          role: 'ai',
          content: typeof partial === 'string' && partial.trim() ? partial : '已中止',
          timestamp: Date.now(),
        };
      }

      lastRequestHadErrorRef.current = true;
      const msg = reqError instanceof Error ? reqError.message : String(reqError);
      setError(msg);
      return {
        role: 'ai',
        content: msg,
        timestamp: Date.now(),
      };
    },
  });

  const messagesRef = useRef<ChatMessageInfo[]>([]);
  const currentRequestIdRef = useRef<string | null>(null);
  const requestApprovalsRef = useRef<Record<string, AIToolApproval[]>>({});
  const requestToolDraftsRef = useRef<Record<string, AIToolDraft[]>>({});
  const requestRunTracesRef = useRef<Record<string, AIRunTrace>>({});

  useEffect(() => {
    messagesRef.current = messages as ChatMessageInfo[];
  }, [messages]);

  const upsertRequestApprovals = useCallback(
    (requestId: string | null, approvals: AIToolApproval[]) => {
      if (!requestId || approvals.length === 0) {
        return;
      }

      const existing = requestApprovalsRef.current[requestId] ?? [];
      const next = [...existing];

      for (const approval of approvals) {
        const index = next.findIndex((item) => item.approvalId === approval.approvalId);
        if (index >= 0) {
          next[index] = approval;
        } else {
          next.push(approval);
        }
      }

      requestApprovalsRef.current[requestId] = next;
    },
    [],
  );

  const upsertRequestToolDraft = useCallback(
    (
      requestId: string | null,
      update: {
        phase: 'start' | 'delta';
        toolCallId: string;
        toolName?: string;
        title?: string;
        inputTextDelta?: string;
      },
    ): AIToolDraft | null => {
      if (!requestId) {
        return null;
      }

      const existing = requestToolDraftsRef.current[requestId] ?? [];
      const index = existing.findIndex((item) => item.toolCallId === update.toolCallId);
      const current = index >= 0 ? existing[index] : null;
      const toolName = update.toolName ?? current?.toolName;

      if (!toolName) {
        return null;
      }

      const nextDraft: AIToolDraft = {
        toolCallId: update.toolCallId,
        toolName,
        title: update.title ?? current?.title,
        inputText:
          update.phase === 'delta'
            ? `${current?.inputText ?? ''}${update.inputTextDelta ?? ''}`
            : (current?.inputText ?? ''),
      };

      requestToolDraftsRef.current[requestId] = mergeToolDrafts(existing, [nextDraft]);
      return nextDraft;
    },
    [],
  );

  const clearRequestToolDraft = useCallback((requestId: string | null, toolCallId: string) => {
    if (!requestId) {
      return;
    }

    const existing = requestToolDraftsRef.current[requestId];
    if (!existing?.length) {
      return;
    }

    const next = removeToolDraft(existing, toolCallId);
    if (next?.length) {
      requestToolDraftsRef.current[requestId] = next;
    } else {
      delete requestToolDraftsRef.current[requestId];
    }
  }, []);

  const chatItems: ChatItem[] = useMemo(() => {
    return toChatItemsFromInfos(messages as ChatMessageInfo[], currentRagSourcesRef.current);
  }, [messages]);

  const isLoading = isRequesting;

  useEffect(() => {
    if (bindingSource && bindingEntityId) {
      return;
    }

    setActiveConversationId(conversationId);
    setIsResolvingConversation(false);
  }, [bindingEntityId, bindingSource, conversationId]);

  useEffect(() => {
    if (!bindingSource || !bindingEntityId) {
      return;
    }

    let cancelled = false;

    const resolveExistingConversation = async () => {
      setIsResolvingConversation(true);
      setError(null);

      try {
        const conversation = await window.storage.resolveAIConversationBinding(
          { source: bindingSource, entityId: bindingEntityId },
          {
            autoCreate: false,
          },
        );

        if (cancelled) {
          return;
        }

        setActiveConversationId(conversation?.id ?? null);
        if (conversation) {
          onTitleChange?.(conversation.title || 'AI 对话');
        }
      } catch (err) {
        if (cancelled) {
          return;
        }

        console.error('[useAIChat] Failed to resolve bound conversation:', err);
        setActiveConversationId(null);
      } finally {
        if (!cancelled) {
          setIsResolvingConversation(false);
        }
      }
    };

    resolveExistingConversation();

    return () => {
      cancelled = true;
    };
  }, [bindingEntityId, bindingSource, onTitleChange]);

  const isConversationNotFoundError = useCallback((err: unknown): err is Error => {
    return err instanceof Error && err.message.includes('not found');
  }, []);

  const handleMissingConversation = useCallback(
    (missingConversationId: string) => {
      setMessages([]);
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
    [setMessages, source],
  );

  const loadExistingConversation = useCallback(
    async (id: string): Promise<AIConversation | null> => {
      const previews = await window.storage.listAIConversationPreviews();
      const exists = previews.some((conversation) => conversation.id === id);

      if (!exists) {
        handleMissingConversation(id);
        return null;
      }

      try {
        return (await window.storage.getAIConversation(id)) as AIConversation;
      } catch (err) {
        if (isConversationNotFoundError(err)) {
          handleMissingConversation(id);
          return null;
        }

        throw err;
      }
    },
    [handleMissingConversation, isConversationNotFoundError],
  );

  useEffect(() => {
    if (prevConversationIdRef.current !== persistedConversationId) {
      setMessages([]);
      setError(null);
      prevConversationIdRef.current = persistedConversationId;
    }

    const loadConversationHistory = async () => {
      if (!persistedConversationId) {
        setMessages([]);
        setIsLoadingHistory(false);
        return;
      }

      setIsLoadingHistory(true);

      try {
        const conversation = await loadExistingConversation(persistedConversationId);

        if (conversation) {
          onTitleChange?.(conversation.title || 'AI 对话');

          if (conversation.messages && conversation.messages.length > 0) {
            const infos = conversation.messages.map((msg, index) => {
              let content = msg.content;
              if (msg.reasoning) {
                const sanitizedReasoning = msg.reasoning.replace(/\n\n+/g, '\n');
                content = `<think>${sanitizedReasoning}</think>\n${msg.content}`;
              }

              return {
                id: msg.id ?? `hist_${persistedConversationId}_${index}`,
                status: 'success' as const,
                message: {
                  role: msg.role === 'assistant' ? ('ai' as const) : ('user' as const),
                  content,
                  timestamp: msg.timestamp ?? Date.now(),
                  ragSources: msg.ragSources,
                  references: msg.references,
                  toolApprovals: msg.toolApprovals,
                  runTrace: msg.runTrace,
                },
              };
            });
            setMessages(infos);
          } else {
            setMessages([]);
          }
        } else {
          setMessages([]);
        }
      } catch (err) {
        console.error('Failed to load conversation history:', err);
        setMessages([]);
      } finally {
        setIsLoadingHistory(false);
      }
    };

    loadConversationHistory();
  }, [persistedConversationId, loadExistingConversation, onTitleChange, setMessages]);

  const messageRefreshTrigger = useWorkspaceStore(
    (state) =>
      (persistedConversationId ? state.messageRefreshTriggers[persistedConversationId] : 0) ?? 0,
  );
  const prevRefreshTriggerRef = useRef(messageRefreshTrigger);

  useEffect(() => {
    if (
      messageRefreshTrigger !== prevRefreshTriggerRef.current &&
      persistedConversationId &&
      !isRequesting
    ) {
      prevRefreshTriggerRef.current = messageRefreshTrigger;
      const timer = setTimeout(async () => {
        try {
          const conversation = await loadExistingConversation(persistedConversationId);
          if (conversation?.messages && conversation.messages.length > 0) {
            const infos = conversation.messages.map((msg, index) => {
              let content = msg.content;
              if (msg.reasoning) {
                const sanitizedReasoning = msg.reasoning.replace(/\n\n+/g, '\n');
                content = `<think>${sanitizedReasoning}</think>\n${msg.content}`;
              }
              return {
                id: msg.id ?? `hist_${persistedConversationId}_${index}`,
                status: 'success' as const,
                message: {
                  role: msg.role === 'assistant' ? ('ai' as const) : ('user' as const),
                  content,
                  timestamp: msg.timestamp ?? Date.now(),
                  ragSources: msg.ragSources,
                  references: msg.references,
                  toolApprovals: msg.toolApprovals,
                  runTrace: msg.runTrace,
                },
              };
            });
            setMessages(infos);
          } else {
            setMessages([]);
          }
        } catch (err) {
          console.error('[useAIChat] Failed to refresh from external update:', err);
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [
    persistedConversationId,
    isRequesting,
    loadExistingConversation,
    messageRefreshTrigger,
    setMessages,
  ]);

  const saveConversationHistory = useCallback(
    async (items: ChatItem[]) => {
      if (!autoSave) return;

      try {
        let nextConversationId = persistedConversationId;

        if (!nextConversationId && bindingSource && bindingEntityId && items.length > 0) {
          const conversation = await window.storage.resolveAIConversationBinding(
            { source: bindingSource, entityId: bindingEntityId },
            {
              autoCreate: true,
            },
          );

          if (!conversation) {
            return;
          }

          nextConversationId = conversation.id;
          setActiveConversationId(conversation.id);
          onTitleChange?.(conversation.title || 'AI 对话');
        }

        if (!nextConversationId) {
          return;
        }

        const savedMessages = items.map((item, index) => {
          const thinkMatch = item.content.match(/<think>([\s\S]*?)<\/think>/);
          const reasoning = thinkMatch ? thinkMatch[1].trim() : undefined;
          const content = thinkMatch
            ? item.content.replace(/<think>[\s\S]*?<\/think>\s*/, '').trim()
            : item.content;

          return {
            id: `${nextConversationId}_${item.timestamp ?? Date.now()}_${index}`,
            role: item.role === 'user' ? ('user' as const) : ('assistant' as const),
            content,
            timestamp: item.timestamp ?? Date.now(),
            reasoning,
            ragSources: item.ragSources,
            references: item.references,
            toolApprovals: item.toolApprovals,
            runTrace: item.runTrace,
          };
        });

        await window.storage.saveAIConversationMessages(nextConversationId, savedMessages, {
          source,
          sourceEntityId: bindingEntityId ?? undefined,
        });
        useWorkspaceStore.getState().triggerMessageRefresh(nextConversationId);
      } catch (err) {
        console.error('Fail, autoSaveed to save conversation history:', err);
      }
    },
    [autoSave, bindingEntityId, bindingSource, onTitleChange, persistedConversationId, source],
  );

  const updateMessagesForApproval = useCallback(
    (
      approval: AIToolApproval,
      requestId: string | null = currentRequestIdRef.current,
      baseInfos: ChatMessageInfo[] = messagesRef.current,
    ) => {
      upsertRequestApprovals(requestId, [approval]);

      const withoutDraft = removeToolDraftFromInfos(baseInfos, approval.toolCallId);
      const currentInfos = mergeApprovalsIntoInfos(withoutDraft, [approval], { requestId });
      messagesRef.current = currentInfos;
      setMessages(currentInfos);
      return currentInfos;
    },
    [setMessages, upsertRequestApprovals],
  );

  const updateMessagesForToolDraft = useCallback(
    (
      update: {
        phase: 'start' | 'delta';
        toolCallId: string;
        toolName?: string;
        title?: string;
        inputTextDelta?: string;
      },
      requestId: string | null = currentRequestIdRef.current,
    ) => {
      const draft = upsertRequestToolDraft(requestId, update);
      if (!draft) {
        return messagesRef.current;
      }

      const currentInfos = mergeToolDraftsIntoInfos(messagesRef.current, [draft], { requestId });
      messagesRef.current = currentInfos;
      setMessages(currentInfos);
      return currentInfos;
    },
    [setMessages, upsertRequestToolDraft],
  );

  useEffect(() => {
    const requestId = currentRequestIdRef.current;
    if (!requestId) {
      return;
    }

    const approvals = requestApprovalsRef.current[requestId] ?? [];
    if (approvals.length === 0) {
      return;
    }

    const currentInfos = messages as ChatMessageInfo[];
    const reconciled = mergeApprovalsIntoInfos(currentInfos, approvals, { requestId });
    if (reconciled === currentInfos) {
      return;
    }

    messagesRef.current = reconciled;
    setMessages(reconciled);
  }, [messages, setMessages]);

  useEffect(() => {
    if (!window.ai?.onToolProgress) {
      return;
    }

    const unsubscribe = window.ai.onToolProgress((data) => {
      if (!data?.requestId || !data.progress) {
        return;
      }

      const knownRequest =
        data.requestId === currentRequestIdRef.current ||
        findMessageIndexByRequestId(messagesRef.current, data.requestId) >= 0 ||
        Boolean(requestToolDraftsRef.current[data.requestId]);

      if (!knownRequest) {
        return;
      }

      updateMessagesForToolDraft(data.progress, data.requestId);
    });

    return unsubscribe;
  }, [updateMessagesForToolDraft]);

  useEffect(() => {
    if (!window.ai?.onRunUpdate) {
      return;
    }

    const unsubscribe = window.ai.onRunUpdate((data) => {
      if (!data?.requestId || !data.run) {
        return;
      }

      const knownRequest =
        data.requestId === currentRequestIdRef.current ||
        findMessageIndexByRequestId(messagesRef.current, data.requestId) >= 0 ||
        Boolean(requestRunTracesRef.current[data.requestId]);

      if (!knownRequest) {
        return;
      }

      requestRunTracesRef.current[data.requestId] = data.run;
      const nextInfos = mergeRunTraceIntoInfos(messagesRef.current, data.run, {
        requestId: data.requestId,
      });
      messagesRef.current = nextInfos;
      setMessages(nextInfos);
    });

    return unsubscribe;
  }, [setMessages]);

  useEffect(() => {
    if (!window.ai?.onToolApprovalRequest) {
      return;
    }

    const unsubscribe = window.ai.onToolApprovalRequest((data) => {
      if (!data?.requestId || !data.approval) {
        return;
      }

      const knownRequest =
        data.requestId === currentRequestIdRef.current ||
        findMessageIndexByRequestId(messagesRef.current, data.requestId) >= 0 ||
        Boolean(requestApprovalsRef.current[data.requestId]);

      if (!knownRequest) {
        return;
      }

      clearRequestToolDraft(data.requestId, data.approval.toolCallId);
      const baseInfos = removeToolDraftFromInfos(messagesRef.current, data.approval.toolCallId);
      const nextInfos = updateMessagesForApproval(data.approval, data.requestId, baseInfos);
      saveConversationHistory(toChatItemsFromInfos(nextInfos, currentRagSourcesRef.current)).catch(
        (err) => {
          console.error('[useAIChat] Failed to persist tool approval request:', err);
        },
      );
    });

    return unsubscribe;
  }, [clearRequestToolDraft, saveConversationHistory, updateMessagesForApproval]);

  const respondToToolApproval = useCallback(
    async (approvalId: string, approved: boolean) => {
      const currentInfos = [...messagesRef.current];
      const targetMessageIndex = currentInfos.findIndex((info) =>
        info.message.toolApprovals?.some((approval) => approval.approvalId === approvalId),
      );

      if (targetMessageIndex < 0) {
        return;
      }

      const targetMessage = currentInfos[targetMessageIndex];
      const targetApproval = targetMessage.message.toolApprovals?.find(
        (approval) => approval.approvalId === approvalId,
      );

      if (!targetApproval) {
        return;
      }

      const processingApproval: AIToolApproval = {
        ...targetApproval,
        status: 'processing',
        error: undefined,
      };

      const targetRequestId =
        targetMessage.message.runTrace?.requestId ?? currentRequestIdRef.current;

      const processingInfos = updateMessagesForApproval(processingApproval, targetRequestId);
      saveConversationHistory(
        toChatItemsFromInfos(processingInfos, currentRagSourcesRef.current),
      ).catch((err) => {
        console.error('[useAIChat] Failed to persist processing approval state:', err);
      });

      try {
        const result = await window.ai.respondToolApproval({
          approvalId,
          approved,
        });

        if (!result.success || !result.approval) {
          throw new Error(result.error || '工具审批执行失败');
        }

        let nextInfos = updateMessagesForApproval(result.approval, targetRequestId);
        const approvalUpdates = [result.approval, ...(result.followUpApprovals ?? [])];

        if (result.followUpApprovals?.length) {
          upsertRequestApprovals(targetRequestId, result.followUpApprovals);
        }

        const nextTargetIndex = findMessageIndexByApprovalId(nextInfos, approvalId);
        if (nextTargetIndex >= 0) {
          const targetInfo = nextInfos[nextTargetIndex];
          nextInfos = [...nextInfos];
          nextInfos[nextTargetIndex] = {
            ...targetInfo,
            message: {
              ...targetInfo.message,
              content: resolveApprovalContinuationContent({
                currentContent: targetInfo.message.content,
                existingApprovals: targetInfo.message.toolApprovals,
                latestApproval: result.approval,
                continuationContent: result.content,
              }),
              toolApprovals: mergeToolApprovals(targetInfo.message.toolApprovals, approvalUpdates),
            },
          };
          messagesRef.current = nextInfos;
          setMessages(nextInfos);
        }

        await saveConversationHistory(
          toChatItemsFromInfos(nextInfos, currentRagSourcesRef.current),
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const failedApproval: AIToolApproval = {
          ...targetApproval,
          status: 'failed',
          error: msg,
        };
        const failedInfos = updateMessagesForApproval(failedApproval, targetRequestId);
        await saveConversationHistory(
          toChatItemsFromInfos(failedInfos, currentRagSourcesRef.current),
        );
        setError(msg);
      }
    },
    [saveConversationHistory, setMessages, updateMessagesForApproval, upsertRequestApprovals],
  );

  useEffect(() => {
    const prev = prevIsRequestingRef.current;
    if (prev && !isRequesting) {
      if (!lastRequestHadErrorRef.current) {
        const requestId = currentRequestIdRef.current;
        const approvals = requestId ? (requestApprovalsRef.current[requestId] ?? []) : [];
        const withApprovals = stripToolDrafts(
          mergeApprovalsIntoInfos(messagesRef.current, approvals, { requestId }),
        );
        const latestRunTrace = requestId ? requestRunTracesRef.current[requestId] : undefined;
        const reconciledInfos = latestRunTrace
          ? mergeRunTraceIntoInfos(withApprovals, latestRunTrace, { requestId })
          : withApprovals;

        if (reconciledInfos !== messagesRef.current) {
          messagesRef.current = reconciledInfos;
          setMessages(reconciledInfos);
        }

        saveConversationHistory(
          toChatItemsFromInfos(reconciledInfos, currentRagSourcesRef.current),
        ).catch((err) => {
          console.error('[AI] Failed to save conversation:', err);
        });
      }

      const requestId = currentRequestIdRef.current;
      if (requestId) {
        delete requestApprovalsRef.current[requestId];
        delete requestToolDraftsRef.current[requestId];
        delete requestRunTracesRef.current[requestId];
      }
    }
    prevIsRequestingRef.current = isRequesting;
  }, [isRequesting, saveConversationHistory, setMessages]);

  const sendMessage = useCallback(
    async (text: string, references?: NoteReference[]) => {
      if (!text.trim() || !isConfigured) return;

      setInputValue('');
      setError(null);
      lastRequestHadErrorRef.current = false;

      let ragContext:
        | {
            results: Array<{
              noteId: string;
              noteTitle: string;
              excerpt: string;
              score: number;
            }>;
          }
        | undefined;

      if (useFallbackRag) {
        try {
          const searchResults = await window.knowledge?.search(text, 3);
          if (searchResults && searchResults.length > 0) {
            ragContext = {
              results: searchResults.map((r) => ({
                noteId: r.noteId,
                noteTitle: r.noteTitle,
                excerpt: r.excerpt,
                score: r.score,
              })),
            };
            currentRagSourcesRef.current = searchResults.map((r, i) => ({
              key: i + 1,
              title: r.noteTitle,
              description: r.excerpt.slice(0, 100) + (r.excerpt.length > 100 ? '...' : ''),
              noteId: r.noteId,
            }));
          } else {
            currentRagSourcesRef.current = undefined;
          }
        } catch (err) {
          console.warn('[RAG] Knowledge search failed:', err);
          currentRagSourcesRef.current = undefined;
        }
      } else {
        currentRagSourcesRef.current = undefined;
      }

      try {
        const requestId =
          globalThis.crypto?.randomUUID?.() ??
          `req_${Date.now()}_${Math.random().toString(16).slice(2)}`;
        currentRequestIdRef.current = requestId;
        requestApprovalsRef.current[requestId] = [];
        requestToolDraftsRef.current[requestId] = [];
        delete requestRunTracesRef.current[requestId];

        const stripThink = (content: string): { content: string; reasoning?: string } => {
          const thinkMatch = content.match(/<think>([\s\S]*?)<\/think>/);
          const reasoning = thinkMatch ? thinkMatch[1].trim() : undefined;
          const cleaned = thinkMatch
            ? content.replace(/<think>[\s\S]*?<\/think>\s*/, '').trim()
            : content;
          return { content: cleaned, reasoning };
        };

        const historyMessages: ChatMessage[] = chatItems
          .filter((m) => !m.isStreaming)
          .map((m) => {
            const parsed = stripThink(m.content);
            return {
              role: m.role === 'user' ? ('user' as const) : ('assistant' as const),
              content: parsed.content,
              references: m.references,
            };
          });

        onRequest({
          requestId,
          text,
          message: text,
          messages: historyMessages,
          references,
          allowActiveRetrieval,
          ragContext,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        lastRequestHadErrorRef.current = true;
      }
    },
    [allowActiveRetrieval, chatItems, isConfigured, onRequest, useFallbackRag],
  );

  const clearChat = useCallback(() => {
    setMessages([]);
    setError(null);
    saveConversationHistory([]);
  }, [saveConversationHistory, setMessages]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    activeConversationId,
    chatItems,
    isLoading,
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
