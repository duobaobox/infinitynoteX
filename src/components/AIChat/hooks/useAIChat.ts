/**
 * useAIChat Hook - AI 对话管理
 *
 * 封装消息管理、流式处理、历史记录加载/保存等逻辑
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useXChat } from '@ant-design/x-sdk';
import { aiConversationService } from '../../../services';
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
    sources?: Array<{
      noteId: string;
      noteTitle: string;
      excerpt: string;
      score: number;
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
}

/**
 * AI 对话管理 Hook
 */
export const useAIChat = ({
  conversationId,
  isConfigured,
  useKnowledgeBase = false,
  onTitleChange,
}: UseAIChatOptions): UseAIChatReturn => {
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');

  const lastRequestHadErrorRef = useRef(false);
  const prevIsRequestingRef = useRef(false);

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
    return messages.map((m) => ({
      key: String(m.id),
      role: m.message.role,
      content: m.message.content,
      timestamp: m.message.timestamp,
      sources: m.message.sources,
      references: m.message.references,
      isStreaming: m.status === 'loading' || m.status === 'updating',
    }));
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
                id: msg.id ?? `${msg.role}-${msg.timestamp}-${index}`,
                status: 'success' as const,
                message: {
                  role: msg.role === 'assistant' ? ('ai' as const) : ('user' as const),
                  content,
                  timestamp: msg.timestamp ?? Date.now(),
                  sources: msg.sources,
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
            id: item.key || `${item.role}-${item.timestamp}-${index}`,
            role: item.role === 'user' ? ('user' as const) : ('assistant' as const),
            content,
            timestamp: item.timestamp ?? Date.now(),
            reasoning,
            sources: item.sources,
          };
        });

        await aiConversationService.saveMessages(conversationId, messages);
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
      let ragContext = '';
      let ragSources: Array<{
        noteId: string;
        noteTitle: string;
        excerpt: string;
        score: number;
      }> = [];

      if (useKnowledgeBase) {
        try {
          const searchResults = await window.knowledge?.search(text, 3);
          if (searchResults && searchResults.length > 0) {
            ragSources = searchResults;
            ragContext = '\n\n以下是与用户问题相关的笔记内容，请参考回答：\n\n';
            searchResults.forEach((result, index) => {
              ragContext += `[来源 ${index + 1}: ${result.noteTitle}]\n${result.excerpt}\n\n`;
            });
          }
        } catch (err) {
          console.warn('[RAG] Knowledge search failed:', err);
        }
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

        const messageWithContext = ragContext ? text + ragContext : text;

        onRequest({
          text,
          message: messageWithContext,
          messages: historyMessages,
          ragSources: ragSources.length > 0 ? ragSources : undefined,
          references,
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
