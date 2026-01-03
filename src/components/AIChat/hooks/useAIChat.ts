/**
 * useAIChat Hook - AI 对话管理
 *
 * 封装消息管理、流式处理、历史记录加载/保存等逻辑
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useXChat } from '@ant-design/x-sdk';
import { aiConversationService } from '../../../services';
import { useWorkspaceStore } from '../../../store/workspaceStore';
import type { ChatItem, NoteReference, UseAIChatReturn, StreamChunkData } from '../types';
import type { AIMessage } from '../../../services/aiConfig';
import { IpcChatProvider, type IpcStreamInput, type XChatMessage } from '../xsdk/IpcChatProvider';

// AI 对话完整类型（包含 messages）
interface AIConversationFull {
  id: string;
  title: string;
  excerpt: string;
  messages?: Array<{
    id?: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
    reasoning?: string;
    ragSources?: Array<{
      key: number;
      title: string;
      description?: string;
      noteId?: string;
    }>;
  }>;
  createdAt: number;
  updatedAt: number;
  isDefault?: boolean;
}

interface UseAIChatOptions {
  /** 对话 ID */
  conversationId: string | null;
  /** 是否已配置 AI */
  isConfigured: boolean;
  /** 是否启用知识库增强 */
  useKnowledgeBase?: boolean;
  /** 标题变更回调 */
  onTitleChange?: (title: string) => void;
  /** 对话来源：note=便签, workbench=AI工坊, global=全局 */
  source?: 'note' | 'workbench' | 'global';
}

/**
 * AI 对话管理 Hook
 */
export const useAIChat = ({
  conversationId,
  isConfigured,
  useKnowledgeBase = false,
  onTitleChange,
  source = 'workbench',
}: UseAIChatOptions): UseAIChatReturn => {
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');

  const lastRequestHadErrorRef = useRef(false);
  const prevIsRequestingRef = useRef(false);
  // 保存当前请求的 RAG sources，用于附加到 AI 回复消息
  const currentRagSourcesRef = useRef<ChatItem['ragSources']>(undefined);

  const [provider] = useState(() => new IpcChatProvider());

  const { onRequest, messages, setMessages, isRequesting, abort } = useXChat<
    XChatMessage,
    XChatMessage,
    IpcStreamInput,
    StreamChunkData
  >({
    provider,
    conversationKey: conversationId || 'default',
    requestPlaceholder: () => ({
      role: 'ai',
      content: '',
      timestamp: Date.now(),
    }),
    requestFallback: (_req, { error: reqError, messageInfo }) => {
      // Abort is a normal user action; don't raise the global error alert.
      if (reqError?.name === 'AbortError') {
        lastRequestHadErrorRef.current = true;
        const partial = (messageInfo as { message?: { content?: unknown } } | undefined)?.message
          ?.content;
        return {
          role: 'ai',
          // Keep the partial streamed content when user aborts (Ant Design X official pattern)
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

  const chatItems: ChatItem[] = useMemo(() => {
    return messages.map((m) => {
      const isAiMessage = m.message.role === 'ai';
      const isStreaming = m.status === 'loading' || m.status === 'updating';

      return {
        key: String(m.id),
        role: m.message.role,
        content: m.message.content,
        timestamp: m.message.timestamp,
        references: m.message.references,
        isStreaming,
        // AI 回复消息的 RAG sources：优先使用消息自带的（历史消息），否则使用当前 ref（流式消息）
        ragSources: isAiMessage
          ? (m.message.ragSources ?? currentRagSourcesRef.current)
          : undefined,
      };
    });
  }, [messages]);

  const isLoading = isRequesting;

  // 加载对话历史
  useEffect(() => {
    const loadConversationHistory = async () => {
      if (!conversationId) {
        setMessages([]);
        setIsLoadingHistory(false);
        return;
      }
      setIsLoadingHistory(true);

      try {
        // getConversations 返回完整的 AIConversation 对象（包含 messages）
        const conversations =
          (await aiConversationService.getConversations()) as AIConversationFull[];
        const conversation = conversations.find((c) => c.id === conversationId);

        if (conversation) {
          // 通知标题变更
          onTitleChange?.(conversation.title || 'AI 对话');

          if (conversation.messages && conversation.messages.length > 0) {
            const infos = conversation.messages.map((msg, index) => {
              let content = msg.content;
              if (msg.reasoning) {
                const sanitizedReasoning = msg.reasoning.replace(/\n\n+/g, '\n');
                content = `<think>${sanitizedReasoning}</think>\n${msg.content}`;
              }

              return {
                // 使用 hist_ 前缀确保与 useXChat 生成的 msg_X 格式不冲突
                id: msg.id ?? `hist_${conversationId}_${index}`,
                status: 'success' as const,
                message: {
                  role: msg.role === 'assistant' ? ('ai' as const) : ('user' as const),
                  content,
                  timestamp: msg.timestamp ?? Date.now(),
                  // 从存储中恢复 RAG 来源引用
                  ragSources: msg.ragSources,
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
  }, [conversationId, onTitleChange, setMessages]);

  // 监听其他实例触发的刷新信号，重新加载历史
  const messageRefreshTrigger = useWorkspaceStore(
    (state) => (conversationId ? state.messageRefreshTriggers[conversationId] : 0) ?? 0,
  );
  const prevRefreshTriggerRef = useRef(messageRefreshTrigger);

  useEffect(() => {
    // 仅当 trigger 变化且不是初始值时重新加载
    if (
      messageRefreshTrigger !== prevRefreshTriggerRef.current &&
      conversationId &&
      !isRequesting
    ) {
      prevRefreshTriggerRef.current = messageRefreshTrigger;
      // 延迟加载，避免与当前实例的保存冲突
      const timer = setTimeout(async () => {
        try {
          const conversations =
            (await aiConversationService.getConversations()) as AIConversationFull[];
          const conversation = conversations.find((c) => c.id === conversationId);
          if (conversation?.messages && conversation.messages.length > 0) {
            const infos = conversation.messages.map((msg, index) => {
              let content = msg.content;
              if (msg.reasoning) {
                const sanitizedReasoning = msg.reasoning.replace(/\n\n+/g, '\n');
                content = `<think>${sanitizedReasoning}</think>\n${msg.content}`;
              }
              return {
                id: msg.id ?? `hist_${conversationId}_${index}`,
                status: 'success' as const,
                message: {
                  role: msg.role === 'assistant' ? ('ai' as const) : ('user' as const),
                  content,
                  timestamp: msg.timestamp ?? Date.now(),
                  ragSources: msg.ragSources,
                },
              };
            });
            setMessages(infos);
          }
        } catch (err) {
          console.error('[useAIChat] Failed to refresh from external update:', err);
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [messageRefreshTrigger, conversationId, isRequesting, setMessages]);

  // 保存对话历史
  const saveConversationHistory = useCallback(
    async (items: ChatItem[]) => {
      if (!conversationId) return;

      try {
        const messages = items.map((item, index) => {
          // 从 content 中提取 <think> 标签
          const thinkMatch = item.content.match(/<think>([\s\S]*?)<\/think>/);
          const reasoning = thinkMatch ? thinkMatch[1].trim() : undefined;
          const content = thinkMatch
            ? item.content.replace(/<think>[\s\S]*?<\/think>\s*/, '').trim()
            : item.content;

          return {
            // 使用时间戳+索引生成持久化唯一 ID，避免 useXChat 的 msg_X 格式在重挂载时重复
            id: `${conversationId}_${item.timestamp ?? Date.now()}_${index}`,
            role: item.role === 'user' ? ('user' as const) : ('assistant' as const),
            content,
            timestamp: item.timestamp ?? Date.now(),
            reasoning,
            // 保存 RAG 来源引用（仅 AI 消息有）
            ragSources: item.ragSources,
          };
        });

        await aiConversationService.saveMessages(conversationId, messages, { source });
        // 触发刷新，通知其他使用同一 conversationId 的实例
        useWorkspaceStore.getState().triggerMessageRefresh(conversationId);
      } catch (err) {
        console.error('Failed to save conversation history:', err);
      }
    },
    [conversationId],
  );

  // 请求结束后保存一次
  useEffect(() => {
    const prev = prevIsRequestingRef.current;
    if (prev && !isRequesting) {
      if (!lastRequestHadErrorRef.current) {
        saveConversationHistory(chatItems).catch((err) => {
          console.error('[AI] Failed to save conversation:', err);
        });
      }
    }
    prevIsRequestingRef.current = isRequesting;
  }, [isRequesting, chatItems, saveConversationHistory]);

  // 发送消息
  const sendMessage = useCallback(
    async (text: string, references?: NoteReference[]) => {
      if (!text.trim() || !isConfigured) return;

      // 清空输入框
      setInputValue('');
      setError(null);
      lastRequestHadErrorRef.current = false;

      // RAG 增强：检索知识库
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

      if (useKnowledgeBase) {
        console.log('[RAG] Knowledge base enabled, searching for:', text);
        try {
          const searchResults = await window.knowledge?.search(text, 3);
          console.log('[RAG] Search results:', searchResults);
          if (searchResults && searchResults.length > 0) {
            ragContext = {
              results: searchResults.map((r) => ({
                noteId: r.noteId,
                noteTitle: r.noteTitle,
                excerpt: r.excerpt,
                score: r.score,
              })),
            };
            // 保存 sources 用于 AI 回复消息展示
            currentRagSourcesRef.current = searchResults.map((r, i) => ({
              key: i + 1,
              title: r.noteTitle,
              description: r.excerpt.slice(0, 100) + (r.excerpt.length > 100 ? '...' : ''),
              noteId: r.noteId,
            }));
            console.log(
              '[RAG] Found',
              searchResults.length,
              'relevant notes, ragContext:',
              ragContext,
            );
          } else {
            console.log('[RAG] No search results found');
            currentRagSourcesRef.current = undefined;
          }
        } catch (err) {
          console.warn('[RAG] Knowledge search failed:', err);
          currentRagSourcesRef.current = undefined;
        }
      } else {
        console.log('[RAG] Knowledge base NOT enabled');
        currentRagSourcesRef.current = undefined;
      }

      try {
        const stripThink = (content: string): { content: string; reasoning?: string } => {
          const thinkMatch = content.match(/<think>([\s\S]*?)<\/think>/);
          const reasoning = thinkMatch ? thinkMatch[1].trim() : undefined;
          const cleaned = thinkMatch
            ? content.replace(/<think>[\s\S]*?<\/think>\s*/, '').trim()
            : content;
          return { content: cleaned, reasoning };
        };

        const historyMessages: AIMessage[] = chatItems
          .filter((m) => !m.isStreaming)
          .map((m) => {
            const parsed = stripThink(m.content);
            return {
              role: m.role === 'user' ? ('user' as const) : ('assistant' as const),
              content: parsed.content,
            };
          });

        onRequest({
          text,
          message: text, // 用户原始消息，不再拼接 RAG 上下文
          messages: historyMessages,
          references,
          ragContext, // 结构化的 RAG 上下文
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        lastRequestHadErrorRef.current = true;
      }
    },
    [chatItems, isConfigured, onRequest, useKnowledgeBase],
  );

  // 清空对话
  const clearChat = useCallback(() => {
    setMessages([]);
    setError(null);
    saveConversationHistory([]);
  }, [saveConversationHistory, setMessages]);

  // 清除错误
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    chatItems,
    isLoading,
    isLoadingHistory,
    error,
    inputValue,
    setInputValue,
    sendMessage,
    abort,
    clearChat,
    clearError,
  };
};
