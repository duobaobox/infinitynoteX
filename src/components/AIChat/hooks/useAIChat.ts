/**
 * useAIChat Hook - AI 对话管理
 *
 * 封装消息管理、流式处理、历史记录加载/保存等逻辑
 */

import { useState, useEffect, useCallback } from 'react';
import { aiConversationService } from '../../../services';
import type { ChatItem, UseAIChatReturn, StreamChunkData, StreamErrorPayload } from '../types';

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
  /** 标题变更回调 */
  onTitleChange?: (title: string) => void;
}

/**
 * AI 对话管理 Hook
 */
export const useAIChat = ({
  conversationId,
  isConfigured,
  onTitleChange,
}: UseAIChatOptions): UseAIChatReturn => {
  const [chatItems, setChatItems] = useState<ChatItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [streamingKey, setStreamingKey] = useState<string | null>(null);

  // 加载对话历史
  useEffect(() => {
    const loadConversationHistory = async () => {
      if (!conversationId) {
        setChatItems([]);
        return;
      }

      try {
        // getConversations 返回完整的 AIConversation 对象（包含 messages）
        const conversations =
          (await aiConversationService.getConversations()) as AIConversationFull[];
        const conversation = conversations.find((c) => c.id === conversationId);

        if (conversation) {
          // 通知标题变更
          onTitleChange?.(conversation.title || 'AI 对话');

          if (conversation.messages && conversation.messages.length > 0) {
            // 转换存储格式到 ChatItem 格式
            const items: ChatItem[] = conversation.messages.map((msg, index) => ({
              key: msg.id ?? `${msg.role}-${msg.timestamp}-${index}`,
              role: msg.role === 'assistant' ? 'ai' : 'user',
              content: msg.content,
              timestamp: msg.timestamp ?? Date.now(),
              thoughtChainText: msg.reasoning || undefined,
            }));
            setChatItems(items);
          } else {
            setChatItems([]);
          }
        }
      } catch (err) {
        console.error('Failed to load conversation history:', err);
        setChatItems([]);
      }
    };

    loadConversationHistory();
  }, [conversationId, onTitleChange]);

  // 保存对话历史
  const saveConversationHistory = useCallback(
    async (items: ChatItem[]) => {
      if (!conversationId) return;

      try {
        const messages = items.map((item, index) => ({
          id: item.key || `${item.role}-${item.timestamp}-${index}`,
          role: item.role === 'user' ? ('user' as const) : ('assistant' as const),
          content: item.content,
          timestamp: item.timestamp ?? Date.now(),
          reasoning: item.thoughtChainText || undefined,
        }));

        await aiConversationService.saveMessages(conversationId, messages);
      } catch (err) {
        console.error('Failed to save conversation history:', err);
      }
    },
    [conversationId],
  );

  // 监听 IPC 流式事件
  useEffect(() => {
    const unsubscribeChunk = window.ai?.onStreamChunk?.((data: StreamChunkData) => {
      if (streamingKey) {
        setChatItems((prev) =>
          prev.map((item) =>
            item.key === streamingKey
              ? {
                  ...item,
                  content: item.content + (data.delta || ''),
                  thoughtChainText: (item.thoughtChainText || '') + (data.reasoningDelta || ''),
                }
              : item,
          ),
        );
      }
    });

    const unsubscribeDone = window.ai?.onStreamDone?.(() => {
      if (streamingKey) {
        setChatItems((prev) => {
          const updated = prev.map((item) =>
            item.key === streamingKey ? { ...item, isStreaming: false } : item,
          );
          // 流式传输完成后保存对话历史
          saveConversationHistory(updated);
          return updated;
        });
      }
      setStreamingKey(null);
      setIsLoading(false);
    });

    const unsubscribeError = window.ai?.onStreamError?.((data: StreamErrorPayload) => {
      setError(data.error || '流式传输出错');
      setStreamingKey(null);
      setIsLoading(false);
    });

    return () => {
      unsubscribeChunk?.();
      unsubscribeDone?.();
      unsubscribeError?.();
    };
  }, [streamingKey, saveConversationHistory]);

  // 发送消息
  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || !isConfigured) return;

      // 清空输入框
      setInputValue('');

      const userItem: ChatItem = {
        key: `u-${Date.now()}-${Math.random()}`,
        role: 'user',
        content: text,
        timestamp: Date.now(),
      };
      const newChatItems = [...chatItems, userItem];
      setChatItems(newChatItems);
      setError(null);
      setIsLoading(true);

      // 创建 AI 气泡占位符
      const aiKey = `a-${Date.now()}-${Math.random()}`;
      const aiItem: ChatItem = {
        key: aiKey,
        role: 'ai',
        content: '',
        timestamp: Date.now(),
        isStreaming: true,
      };
      const updatedChatItems = [...newChatItems, aiItem];
      setChatItems(updatedChatItems);
      setStreamingKey(aiKey);

      // 调用流式 API
      try {
        const payload = {
          message: text,
          messages: chatItems.map((m) => ({
            role: m.role === 'user' ? 'user' : 'assistant',
            content: m.content,
          })),
        };
        const result = await window.ai.chatStream(payload);
        if (!result?.success) {
          throw new Error(result?.error || '流式请求失败');
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        // 移除失败的 AI 气泡
        setChatItems((prev) => prev.filter((item) => item.key !== aiKey));
        setStreamingKey(null);
        setIsLoading(false);
      }
    },
    [chatItems, isConfigured],
  );

  // 清空对话
  const clearChat = useCallback(() => {
    setChatItems([]);
    setError(null);
    saveConversationHistory([]);
  }, [saveConversationHistory]);

  // 清除错误
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    chatItems,
    isLoading,
    error,
    inputValue,
    setInputValue,
    sendMessage,
    clearChat,
    clearError,
  };
};
