/**
 * AITab.tsx
 * AI 工作台 - AI 相关功能（基于 Ant Design X 规范）
 */

import { useEffect, useState } from 'react';
import { Sender, Bubble, ThoughtChain } from '@ant-design/x';
import { Alert, Button, Space, Tooltip, Divider } from 'antd';
import {
  ReloadOutlined,
  DeleteOutlined,
  SettingOutlined,
  RobotOutlined,
  UserOutlined,
} from '@ant-design/icons';
import type { GetProp } from 'antd';
import './AITab.css';

interface AITabProps {
  noteId: string | null;
}

interface AIConfig {
  provider?: string;
  model?: string;
  baseURL?: string;
}

// Bubble.List / ThoughtChain 类型定义
type BubbleListRolesType = GetProp<typeof Bubble.List, 'roles'>;
type ThoughtChainItems = GetProp<typeof ThoughtChain, 'items'>;

export const AITab = ({ noteId }: AITabProps) => {
  const [isConfigured, setIsConfigured] = useState<boolean>(false);
  const [config, setConfig] = useState<AIConfig | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  // 检查 AI 配置
  useEffect(() => {
    const checkConfig = async () => {
      try {
        const aiConfig = await window.ai.getConfig();
        setConfig(aiConfig);
        setIsConfigured(!!aiConfig && !!aiConfig.apiKey && !!aiConfig.model && !!aiConfig.baseURL);
      } catch (err) {
        console.error('Failed to check AI config:', err);
        setIsConfigured(false);
      } finally {
        setIsInitializing(false);
      }
    };
    checkConfig();
  }, []);

  // 聊天消息本地状态（不依赖 useXChat，确保 role 正确）
  interface ChatItem {
    key: string;
    role: 'user' | 'ai';
    content: string;
    thoughtChain?: ThoughtChainItems;
    isStreaming?: boolean;
    thoughtChainText?: string; // 流式思维链原始文本增量累积
  }
  const [chatItems, setChatItems] = useState<ChatItem[]>([]);
  const [streamingKey, setStreamingKey] = useState<string | null>(null);

  const splitParagraphs = (text: string): string[] =>
    text
      .split(/\n{2,}/)
      .map((segment) => segment.trim())
      .filter(Boolean);

  const getReasoningParagraphs = (item: ChatItem): string[] => {
    if (item.thoughtChain && item.thoughtChain.length > 0) {
      return item.thoughtChain
        .map((node) => (typeof node.content === 'string' ? node.content : ''))
        .flatMap((content) => splitParagraphs(content))
        .filter(Boolean);
    }
    if (item.thoughtChainText && item.thoughtChainText.length > 0) {
      return splitParagraphs(item.thoughtChainText);
    }
    return [];
  };

  // 监听 IPC 流式事件
  useEffect(() => {
    const unsubscribeChunk = window.ai?.onStreamChunk?.(
      (data: { delta: string; reasoningDelta?: string }) => {
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
      },
    );

    const unsubscribeDone = window.ai?.onStreamDone?.(() => {
      if (streamingKey) {
        setChatItems((prev) =>
          prev.map((item) => (item.key === streamingKey ? { ...item, isStreaming: false } : item)),
        );
      }
      setStreamingKey(null);
      setIsLoading(false);
    });

    const unsubscribeError = window.ai?.onStreamError?.((data: any) => {
      setError(data.error || '流式传输出错');
      setStreamingKey(null);
      setIsLoading(false);
    });

    return () => {
      unsubscribeChunk?.();
      unsubscribeDone?.();
      unsubscribeError?.();
    };
  }, [streamingKey]);

  // 发送用户消息并调用流式后端
  const sendUserMessage = async (text: string) => {
    if (!text.trim()) return;
    const userItem: ChatItem = {
      key: `u-${Date.now()}-${Math.random()}`,
      role: 'user',
      content: text,
    };
    setChatItems((prev) => [...prev, userItem]);
    setError(null);
    setIsLoading(true);

    // 创建 AI 气泡占位符
    const aiKey = `a-${Date.now()}-${Math.random()}`;
    const aiItem: ChatItem = {
      key: aiKey,
      role: 'ai',
      content: '',
      isStreaming: true,
    };
    setChatItems((prev) => [...prev, aiItem]);
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
      // 使用流式 API
      const result = await window.ai.chatStream(payload);
      if (!result?.success) {
        throw new Error(result?.error || '流式请求失败');
      }
      // 流式内容通过 IPC 事件逐步更新，等待 ai:stream:done 事件
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      // 移除失败的 AI 气泡
      setChatItems((prev) => prev.filter((item) => item.key !== aiKey));
      setStreamingKey(null);
      setIsLoading(false);
    }
  };

  // 定义 Bubble.List 的 roles 配置（严格按官方规范）
  const bubbleRoles: BubbleListRolesType = {
    // AI 角色：左对齐（start）
    ai: {
      placement: 'start',
      avatar: {
        icon: <RobotOutlined />,
        style: {
          background: '#e6f7ff',
          color: '#1890ff',
        },
      },
      typing: { step: 5, interval: 50 },
    },
    // User 角色：右对齐（end）
    user: {
      placement: 'end',
      avatar: {
        icon: <UserOutlined />,
        style: {
          background: '#f6ffed',
          color: '#52c41a',
        },
      },
    },
  };

  // 转换为 Bubble.List items
  const renderBubbleContent = (
    item: ChatItem,
    options?: { reasoningParagraphs?: string[]; showAnswerPlaceholder?: boolean },
  ) => {
    if (item.role !== 'ai') {
      return item.content;
    }

    const reasoningParagraphs = options?.reasoningParagraphs ?? getReasoningParagraphs(item);
    if (reasoningParagraphs.length === 0) {
      if (options?.showAnswerPlaceholder) {
        return <span className="ai-placeholder-text">AI 正在组织回答…</span>;
      }
      return item.content;
    }

    const isPlaceholder = options?.showAnswerPlaceholder && item.content.length === 0;
    const answerText = isPlaceholder ? 'AI 正在组织回答…' : item.content;

    const mergedItem: ThoughtChainItems = [
      {
        key: `${item.key}-reasoning`,
        title: '思考过程',
        content: (
          <div className="ai-thought-chain-content">
            {reasoningParagraphs.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
        ),
      },
    ];

    return (
      <div className="ai-bubble-with-thought-chain">
        {answerText && (
          <div className={`ai-bubble-text${isPlaceholder ? ' ai-placeholder-text' : ''}`}>
            {answerText}
          </div>
        )}
        <div className="ai-thought-chain-wrapper">
          <ThoughtChain items={mergedItem} size="small" collapsible />
        </div>
      </div>
    );
  };

  const bubbleItems = chatItems.map((m) => {
    const reasoningParagraphs = m.role === 'ai' ? getReasoningParagraphs(m) : [];
    const hasReasoning = reasoningParagraphs.length > 0;
    const hasAnswerText = m.content.length > 0;
    const showAnswerPlaceholder =
      m.role === 'ai' && m.isStreaming && !hasAnswerText && hasReasoning;

    const baseContent = renderBubbleContent(m, {
      reasoningParagraphs,
      showAnswerPlaceholder,
    });

    const item: any = {
      key: m.key,
      role: m.role,
      content: baseContent,
    };

    if (m.role === 'ai') {
      if (!hasAnswerText && !hasReasoning && m.isStreaming) {
        item.loading = true;
        item.content = 'AI 正在思考中...';
      } else if (m.isStreaming && hasAnswerText) {
        item.typing = { step: 5, interval: 50 };
      }
    }

    return item;
  });

  if (isInitializing) {
    return (
      <div className="ai-tab-container">
        <div className="ai-tab-messages-empty">
          <div style={{ textAlign: 'center', color: '#999' }}>初始化中...</div>
        </div>
      </div>
    );
  }

  // 未配置时的提示
  if (!isConfigured) {
    return (
      <div className="ai-tab-container">
        <div className="ai-tab-messages-empty">
          <Alert
            message="未配置 AI 模型"
            description="请先在设置页面中配置 AI 模型信息（设置 > AI 管理）以开始对话"
            type="warning"
            showIcon
            style={{ maxWidth: '500px', marginBottom: '16px' }}
          />
          <div style={{ color: '#666', fontSize: '13px', maxWidth: '500px', textAlign: 'center' }}>
            <p style={{ marginBottom: '8px' }}>支持以下模型：</p>
            <ul style={{ textAlign: 'left', display: 'inline-block' }}>
              <li>OpenAI: gpt-4o, gpt-3.5-turbo</li>
              <li>本地 Ollama: mistral, llama2 等</li>
              <li>其他 OpenAI 兼容服务</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ai-tab-container">
      {/* 顶部状态栏 */}
      <div className="ai-tab-header">
        <div className="ai-tab-header-left">
          <span className="ai-tab-header-title">AI 助手</span>
          <span className="ai-tab-header-meta">
            {config?.provider && config?.model ? `${config.provider} • ${config.model}` : '未配置'}
          </span>
          {noteId && (
            <span style={{ fontSize: '11px', color: '#ccc' }}>
              • 便签 ID: {noteId.slice(0, 6)}...
            </span>
          )}
        </div>

        <Space size="small">
          <Tooltip title="清除错误">
            <Button
              type="text"
              size="small"
              icon={<ReloadOutlined />}
              onClick={() => setError(null)}
              disabled={!error}
            />
          </Tooltip>
          <Tooltip title="清空对话">
            <Button
              type="text"
              size="small"
              icon={<DeleteOutlined />}
              onClick={() => {
                setChatItems([]);
                setError(null);
              }}
              disabled={chatItems.length === 0}
            />
          </Tooltip>
          <Divider type="vertical" style={{ margin: '0' }} />
          <Tooltip title="打开设置">
            <Button
              type="text"
              size="small"
              icon={<SettingOutlined />}
              onClick={() => {
                // TODO: 触发打开设置页面的事件
              }}
            />
          </Tooltip>
        </Space>
      </div>

      {/* 错误提示 */}
      {error && (
        <Alert
          message="出错"
          description={error}
          type="error"
          showIcon
          closable
          onClose={() => setError(null)}
          className="ai-tab-alert"
        />
      )}

      {/* 消息列表 */}
      <div className="ai-tab-messages">
        {bubbleItems.length === 0 ? (
          <div className="ai-tab-messages-empty">
            <p style={{ fontSize: '14px' }}>开始对话，与 AI 互动</p>
            <p style={{ fontSize: '12px', color: '#999' }}>输入你的问题，AI 将为你答疑解惑</p>
          </div>
        ) : (
          <Bubble.List items={bubbleItems} roles={bubbleRoles} />
        )}
      </div>

      {/* 输入框 */}
      <div className="ai-tab-input">
        <Sender
          loading={isLoading}
          disabled={isLoading || !isConfigured}
          onSubmit={sendUserMessage}
          placeholder="输入问题...（Shift+Enter 换行，Enter 发送）"
        />
      </div>
    </div>
  );
};

export default AITab;
