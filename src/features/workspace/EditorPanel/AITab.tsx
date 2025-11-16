/**
 * AITab.tsx
 * AI 工作台 - AI 相关功能（基于 Ant Design X 规范）
 */

import { useEffect, useState, useCallback } from 'react';
import type { AnchorHTMLAttributes, HTMLAttributes, Key, TableHTMLAttributes } from 'react';
import { Sender, Bubble, ThoughtChain } from '@ant-design/x';
import { Alert, Button, Space, Tooltip, Divider, Input } from 'antd';
import {
  ReloadOutlined,
  DeleteOutlined,
  SettingOutlined,
  RobotOutlined,
  UserOutlined,
} from '@ant-design/icons';
import type { GetProp } from 'antd';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';
import './AITab.css';

interface AITabProps {
  noteId: string | null;
}

interface AIConfig {
  provider?: string;
  model?: string;
  baseURL?: string;
}

interface StreamErrorPayload {
  error?: string;
}

// Bubble.List / ThoughtChain 类型定义
type BubbleListRolesType = GetProp<typeof Bubble.List, 'roles'>;
type ThoughtChainItems = GetProp<typeof ThoughtChain, 'items'>;
type BubbleListItem = NonNullable<GetProp<typeof Bubble.List, 'items'>>[number];

type MarkdownExtraProps = {
  node?: unknown;
};

type MarkdownLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & MarkdownExtraProps;
type MarkdownCodeProps = HTMLAttributes<HTMLElement> &
  MarkdownExtraProps & {
    inline?: boolean;
    className?: string;
  };
type MarkdownTableProps = TableHTMLAttributes<HTMLTableElement> & MarkdownExtraProps;

const markdownComponents: Components = {
  a: (props: MarkdownLinkProps) => <a {...props} target="_blank" rel="noopener noreferrer" />,
  code: ({ inline, className, children, ...props }: MarkdownCodeProps) => {
    if (inline) {
      return (
        <code className={`ai-inline-code ${className || ''}`} {...props}>
          {children}
        </code>
      );
    }
    return (
      <pre className="ai-code-block">
        <code className={className} {...props}>
          {children}
        </code>
      </pre>
    );
  },
  table: (props: MarkdownTableProps) => (
    <div className="ai-table-wrapper">
      <table {...props} />
    </div>
  ),
};

const renderMarkdownBlock = (text: string, className?: string, key?: Key) => {
  if (!text || !text.trim()) {
    return null;
  }
  const classNames = ['ai-markdown'];
  if (className) {
    classNames.push(className);
  }
  return (
    <ReactMarkdown
      key={key}
      className={classNames.join(' ')}
      remarkPlugins={[remarkGfm]}
      components={markdownComponents}
    >
      {text}
    </ReactMarkdown>
  );
};

export const AITab = ({ noteId }: AITabProps) => {
  const [isConfigured, setIsConfigured] = useState<boolean>(false);
  const [config, setConfig] = useState<AIConfig | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  // 对话标题相关状态
  const [conversationTitle, setConversationTitle] = useState<string>('AI 对话');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState<string>('');

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

  // 加载对话历史
  useEffect(() => {
    const loadConversationHistory = async () => {
      if (!noteId) {
        // 未选中对话时清空消息
        setChatItems([]);
        setConversationTitle('AI 对话');
        return;
      }

      try {
        const conversations = await window.storage.getAIConversations();
        const conversation = conversations.find((c) => c.id === noteId);

        if (conversation) {
          // 设置对话标题
          setConversationTitle(conversation.title || 'AI 对话');

          if (conversation.messages && conversation.messages.length > 0) {
            // 转换存储格式到 ChatItem 格式
            const items: ChatItem[] = conversation.messages.map((msg) => ({
              key: `${msg.role}-${msg.timestamp}`,
              role: msg.role === 'assistant' ? 'ai' : 'user',
              content: msg.content,
              thoughtChainText: msg.reasoning || undefined, // 恢复思考过程
            }));
            setChatItems(items);
          } else {
            // 对话存在但没有消息，清空
            setChatItems([]);
          }
        }
      } catch (err) {
        console.error('Failed to load conversation history:', err);
        setChatItems([]);
        setConversationTitle('AI 对话');
      }
    };

    loadConversationHistory();
  }, [noteId]);

  // 保存对话历史
  const saveConversationHistory = useCallback(
    async (items: ChatItem[]) => {
      if (!noteId) return;

      try {
        const messages = items.map((item) => ({
          role: item.role === 'user' ? ('user' as const) : ('assistant' as const),
          content: item.content,
          timestamp: Date.now(),
          reasoning: item.thoughtChainText || undefined, // 保存思考过程
        }));

        await window.storage.saveAIConversationMessages(noteId, messages);
      } catch (err) {
        console.error('Failed to save conversation history:', err);
      }
    },
    [noteId],
  );

  // 开始编辑标题
  const startEditingTitle = () => {
    setTempTitle(conversationTitle);
    setIsEditingTitle(true);
  };

  // 保存标题
  const saveTitle = async () => {
    if (!noteId || !tempTitle.trim()) {
      setIsEditingTitle(false);
      return;
    }

    try {
      await window.storage.updateAIConversationTitle(noteId, tempTitle.trim());
      setConversationTitle(tempTitle.trim());
      setIsEditingTitle(false);

      // 触发自定义事件通知列表刷新
      window.dispatchEvent(new CustomEvent('ai-conversation-updated'));
    } catch (err) {
      console.error('Failed to update conversation title:', err);
      setIsEditingTitle(false);
    }
  };

  // 取消编辑
  const cancelEditingTitle = () => {
    setIsEditingTitle(false);
    setTempTitle('');
  };

  // 处理标题输入的键盘事件
  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveTitle();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEditingTitle();
    }
  };

  const splitParagraphs = (text: string): string[] =>
    text
      .split(/\n{2,}/)
      .map((segment) => segment.trimEnd())
      .filter((segment) => segment.trim().length > 0);

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

  // 发送用户消息并调用流式后端
  const sendUserMessage = async (text: string) => {
    if (!text.trim()) return;
    const userItem: ChatItem = {
      key: `u-${Date.now()}-${Math.random()}`,
      role: 'user',
      content: text,
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
      isStreaming: true,
    };
    const updatedChatItems = [...newChatItems, aiItem];
    setChatItems(updatedChatItems);
    setStreamingKey(aiKey);

    // 调用流式 API
    try {
      const payload = {
        message: text,
        messages: newChatItems.map((m) => ({
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
    const hasReasoning = reasoningParagraphs.length > 0;
    const hasAnswerText = item.content.trim().length > 0;
    const isPlaceholder = options?.showAnswerPlaceholder && !hasAnswerText;

    if (!hasReasoning) {
      if (isPlaceholder) {
        return <span className="ai-placeholder-text">AI 正在组织回答…</span>;
      }
      return renderMarkdownBlock(item.content, 'ai-bubble-text');
    }

    const mergedItem: ThoughtChainItems = [
      {
        key: `${item.key}-reasoning`,
        title: '思考过程',
        content: (
          <div className="ai-thought-chain-content">
            {reasoningParagraphs.map((paragraph, index) => (
              <div key={index} className="ai-thought-chain-block">
                {renderMarkdownBlock(paragraph)}
              </div>
            ))}
          </div>
        ),
      },
    ];

    return (
      <div className="ai-bubble-with-thought-chain">
        <div className="ai-thought-chain-wrapper">
          <ThoughtChain items={mergedItem} size="small" collapsible />
        </div>
        {isPlaceholder ? (
          <span className="ai-placeholder-text">AI 正在组织回答…</span>
        ) : (
          renderMarkdownBlock(item.content, 'ai-bubble-text')
        )}
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

    const item: BubbleListItem = {
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
          {isEditingTitle ? (
            <Input
              value={tempTitle}
              onChange={(e) => setTempTitle(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={handleTitleKeyDown}
              autoFocus
              size="small"
              style={{
                width: '200px',
                fontSize: '13px',
                fontWeight: 500,
              }}
              placeholder="输入对话标题"
            />
          ) : (
            <span
              className="ai-tab-header-title"
              onDoubleClick={startEditingTitle}
              style={{ cursor: 'pointer' }}
              title="双击编辑标题"
            >
              {conversationTitle}
            </span>
          )}
          <span className="ai-tab-header-meta">
            {config?.provider && config?.model ? `${config.provider} • ${config.model}` : '未配置'}
          </span>
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
                saveConversationHistory([]);
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
