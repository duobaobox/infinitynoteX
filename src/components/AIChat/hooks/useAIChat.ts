/**
 * useAIChat Hook - AI 对话管理
 *
 * 封装消息管理、流式处理、历史记录加载/保存等逻辑
 */

import { useState, useEffect, useCallback, useRef } from 'react';
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
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [streamingKey, setStreamingKey] = useState<string | null>(null);

  // 追踪当前是否在接收思考内容（使用 ref 避免闭包问题）
  const isInReasoningRef = useRef(false);

  // 加载对话历史
  useEffect(() => {
    const loadConversationHistory = async () => {
      if (!conversationId) {
        setChatItems([]);
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
            // 转换存储格式到 ChatItem 格式
            const items: ChatItem[] = conversation.messages.map((msg, index) => {
              let content = msg.content;

              // 如果有 reasoning,将其包装为 <think> 标签
              // 将空行替换为单换行，避免 marked 段落拆分
              if (msg.reasoning) {
                const sanitizedReasoning = msg.reasoning.replace(/\n\n+/g, '\n');
                content = `<think>${sanitizedReasoning}</think>\n${msg.content}`;
              }

              return {
                key: msg.id ?? `${msg.role}-${msg.timestamp}-${index}`,
                role: msg.role === 'assistant' ? 'ai' : 'user',
                content,
                timestamp: msg.timestamp ?? Date.now(),
              };
            });
            setChatItems(items);
          } else {
            setChatItems([]);
          }
        } else {
          setChatItems([]);
        }
      } catch (err) {
        console.error('Failed to load conversation history:', err);
        setChatItems([]);
      } finally {
        setIsLoadingHistory(false);
      }
    };

    loadConversationHistory();
  }, [conversationId, onTitleChange]);

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
          };
        });

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
          prev.map((item) => {
            if (item.key !== streamingKey) return item;

            let newContent = item.content;

            // 处理思维链增量
            if (data.reasoningDelta) {
              // 将空行（\n\n）替换为单换行（\n），避免 marked 将内容拆分为多个段落
              const sanitizedReasoning = data.reasoningDelta.replace(/\n\n+/g, '\n');
              if (!isInReasoningRef.current) {
                // 首次接收到思维链，创建 <think> 标签
                isInReasoningRef.current = true;
                newContent += `<think>${sanitizedReasoning}`;
              } else {
                // 继续追加思考内容
                newContent += sanitizedReasoning;
              }
            }

            // 处理普通内容增量
            if (data.delta) {
              if (isInReasoningRef.current) {
                // 从思考模式切换到正式内容，先闭合 <think> 标签
                // 使用单个换行符（与官方示例一致）
                isInReasoningRef.current = false;
                newContent += `</think>\n${data.delta}`;
              } else {
                // 直接追加内容
                newContent += data.delta;
              }
            }

            return { ...item, content: newContent };
          }),
        );
      }
    });

    const unsubscribeDone = window.ai?.onStreamDone?.(() => {
      if (streamingKey) {
        setChatItems((prev) => {
          const updated = prev.map((item) => {
            if (item.key !== streamingKey) return item;

            let content = item.content;
            // 如果流结束时仍在思考模式，闭合 <think> 标签
            if (isInReasoningRef.current) {
              content += '</think>';
            }

            return { ...item, content, isStreaming: false };
          });
          // 流式传输完成后保存对话历史
          saveConversationHistory(updated);
          return updated;
        });
      }
      // 重置状态
      isInReasoningRef.current = false;
      setStreamingKey(null);
      setIsLoading(false);
    });

    const unsubscribeError = window.ai?.onStreamError?.((data: StreamErrorPayload) => {
      setError(data.error || '流式传输出错');
      isInReasoningRef.current = false;
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
      // 重置思考状态追踪
      isInReasoningRef.current = false;

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
    isLoadingHistory,
    error,
    inputValue,
    setInputValue,
    sendMessage,
    clearChat,
    clearError,
  };
};
