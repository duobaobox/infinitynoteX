/**
 * AITab.tsx
 * AI 工作台 - AI 相关功能（基于 Ant Design X 规范）
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import ReactDOMServer from 'react-dom/server';
import type {
  AnchorHTMLAttributes,
  HTMLAttributes,
  Key,
  TableHTMLAttributes,
  KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { Sender, Bubble, ThoughtChain } from '@ant-design/x';
import { generateJSON } from '@tiptap/html';
import { Alert, Button, Space, Tooltip, Divider, Input, Dropdown, message } from 'antd';
import type { MenuProps, GetProp } from 'antd';
import {
  ReloadOutlined,
  DeleteOutlined,
  SettingOutlined,
  RobotOutlined,
  UserOutlined,
  DownOutlined,
  CopyOutlined,
  CheckOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';
import './AITab.css';
import type { AIConfig } from '../../../services/aiConfig';
import type { TipTapJSONContent } from '../../../services/types';
import {
  detectProviderIdFromConfig,
  ensureAIConfigDefaults,
  getProviderBrandColor,
} from '../../../services/aiProviders';
import {
  readStoredProviderConfigs,
  subscribeAIConfigChanged,
} from '../../../services/aiConfigStore';
import { getExtensions } from '../../../components/TipTapEditor/extensions';

interface AITabProps {
  noteId: string | null;
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

const createMarkdownElement = (text: string, className?: string, key?: Key) => {
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

const renderMarkdownBlock = (text: string, className?: string, key?: Key) =>
  createMarkdownElement(text, className, key);

const renderMarkdownToHtml = (text: string, className?: string) => {
  const element = createMarkdownElement(text, className);
  if (!element) return '';
  return ReactDOMServer.renderToStaticMarkup(element);
};

const tiptapSerializerExtensions = getExtensions();

const buildPlainTextDoc = (text: string): TipTapJSONContent => {
  const paragraphs = text
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  if (paragraphs.length === 0) {
    return {
      type: 'doc',
      content: [{ type: 'paragraph' }],
    };
  }

  return {
    type: 'doc',
    content: paragraphs.map((paragraph) => ({
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: paragraph,
        },
      ],
    })),
  };
};

const sanitizeHtmlForTipTap = (html: string): string => {
  if (!html) {
    return '';
  }

  try {
    if (typeof DOMParser === 'undefined') {
      return html;
    }
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const firstElement = doc.body.firstElementChild;
    if (firstElement && firstElement.tagName === 'DIV') {
      return firstElement.innerHTML || '';
    }
    return doc.body.innerHTML || '';
  } catch {
    return html;
  }
};

const convertMarkdownToTipTap = (markdown: string): TipTapJSONContent => {
  if (!markdown?.trim()) {
    return buildPlainTextDoc('');
  }

  const html = renderMarkdownToHtml(markdown);
  const sanitizedHtml = sanitizeHtmlForTipTap(html);

  if (sanitizedHtml) {
    try {
      const json = generateJSON(sanitizedHtml, tiptapSerializerExtensions);
      if (json?.type === 'doc') {
        return json as TipTapJSONContent;
      }
      return {
        type: 'doc',
        content: json ? [json as TipTapJSONContent] : [],
      };
    } catch (error) {
      console.error('Failed to convert markdown to TipTap JSON:', error);
    }
  }

  return buildPlainTextDoc(markdown);
};

const isAIConfigReady = (config?: AIConfig | null) => {
  if (!config) {
    return false;
  }
  return !!config.baseURL?.trim() && !!config.model?.trim() && !!config.apiKey?.trim();
};

type ProviderOption = {
  providerId: string;
  config: AIConfig;
};

export const AITab = ({ noteId }: AITabProps) => {
  const [isConfigured, setIsConfigured] = useState<boolean>(false);
  const [config, setConfig] = useState<AIConfig | null>(null);
  const [providerOptions, setProviderOptions] = useState<ProviderOption[]>([]);
  const [switchingProviderId, setSwitchingProviderId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  // 对话标题相关状态
  const [conversationTitle, setConversationTitle] = useState<string>('AI 对话');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState<string>('');
  const [copiedBubbleKey, setCopiedBubbleKey] = useState<string | null>(null);
  const copyResetTimerRef = useRef<number | null>(null);

  const refreshProviderOptions = useCallback((activeConfig?: AIConfig | null) => {
    const stored = readStoredProviderConfigs();
    const normalized: Record<string, AIConfig> = {};

    Object.entries(stored).forEach(([providerId, cfg]) => {
      normalized[providerId] = ensureAIConfigDefaults({ ...cfg, providerId });
    });

    if (activeConfig) {
      const activeId = detectProviderIdFromConfig(activeConfig);
      normalized[activeId] = ensureAIConfigDefaults({ ...activeConfig, providerId: activeId });
    }

    const readyOptions = Object.entries(normalized)
      .map(([providerId, cfg]) => ({ providerId, config: cfg }))
      .filter(({ config }) => isAIConfigReady(config));

    setProviderOptions(readyOptions);
  }, []);

  // 检查 AI 配置
  useEffect(() => {
    const checkConfig = async () => {
      try {
        const aiConfig = await window.ai.getConfig();
        const normalizedConfig = aiConfig ? ensureAIConfigDefaults(aiConfig) : null;
        setConfig(normalizedConfig);
        setIsConfigured(isAIConfigReady(normalizedConfig));
        refreshProviderOptions(normalizedConfig);
      } catch (err) {
        console.error('Failed to check AI config:', err);
        setIsConfigured(false);
        setConfig(null);
        refreshProviderOptions(null);
      } finally {
        setIsInitializing(false);
      }
    };
    checkConfig();
  }, [refreshProviderOptions]);

  useEffect(() => {
    return () => {
      if (copyResetTimerRef.current) {
        window.clearTimeout(copyResetTimerRef.current);
        copyResetTimerRef.current = null;
      }
    };
  }, []);

  const handleSaveToNote = useCallback(async (content: string) => {
    try {
      const tipTapContent = convertMarkdownToTipTap(content);

      // 生成便签标题（取第一行或前30个字符）
      const firstLine = content.split('\n')[0].trim();
      const title = (firstLine.substring(0, 30) || 'AI 回答').replace(/[#*`]/g, '').trim();

      // 创建便签到默认文件夹
      await window.storage.createNote('default', {
        title,
        content: tipTapContent,
      });

      message.success('已保存到默认文件夹');
    } catch (error) {
      console.error('Failed to save to note:', error);
      message.error('保存失败，请重试');
    }
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeAIConfigChanged((nextConfig) => {
      const normalized = ensureAIConfigDefaults(nextConfig);
      setConfig(normalized);
      setIsConfigured(isAIConfigReady(normalized));
      refreshProviderOptions(normalized);
    });
    return unsubscribe;
  }, [refreshProviderOptions]);

  // 聊天消息本地状态（不依赖 useXChat，确保 role 正确）
  interface ChatItem {
    key: string;
    role: 'user' | 'ai';
    content: string;
    timestamp: number;
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
            const items: ChatItem[] = conversation.messages.map((msg, index) => ({
              key: msg.id ?? `${msg.role}-${msg.timestamp}-${index}`,
              role: msg.role === 'assistant' ? 'ai' : 'user',
              content: msg.content,
              timestamp: msg.timestamp ?? Date.now(),
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
        const messages = items.map((item, index) => ({
          id: item.key || `${item.role}-${item.timestamp}-${index}`,
          role: item.role === 'user' ? ('user' as const) : ('assistant' as const),
          content: item.content,
          timestamp: item.timestamp ?? Date.now(),
          reasoning: item.thoughtChainText || undefined, // 保存思考过程
        }));

        await window.storage.saveAIConversationMessages(noteId, messages);
      } catch (err) {
        console.error('Failed to save conversation history:', err);
      }
    },
    [noteId],
  );

  const handleProviderSwitch = useCallback(
    async (providerId: string) => {
      if (!providerId) {
        return;
      }

      const target = providerOptions.find((option) => option.providerId === providerId);
      if (!target) {
        return;
      }

      const currentProviderId = detectProviderIdFromConfig(config ?? undefined);
      if (providerId === currentProviderId) {
        return;
      }

      try {
        setSwitchingProviderId(providerId);
        const normalized = ensureAIConfigDefaults(target.config);
        await window.ai.setConfig(normalized);
        setConfig(normalized);
        setIsConfigured(true);
        message.success(`已切换到 ${normalized.provider} · ${normalized.model}`);
        refreshProviderOptions(normalized);
      } catch (err) {
        console.error('Failed to switch AI config:', err);
        const errorMsg =
          err instanceof Error ? err.message : typeof err === 'string' ? err : '未知错误';
        message.error(`切换失败：${errorMsg}`);
      } finally {
        setSwitchingProviderId(null);
      }
    },
    [config, providerOptions, refreshProviderOptions],
  );

  const handleMetaTriggerKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.currentTarget.click();
    }
  };

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

  const handleCopyAnswer = useCallback((item: ChatItem) => {
    const textToCopy = item.content?.trim();
    if (!textToCopy) {
      message.info('暂无可复制内容');
      return;
    }

    const htmlToCopy = renderMarkdownToHtml(textToCopy, 'ai-bubble-text');

    const copyWithClipboardItem = async () => {
      if (!htmlToCopy) return false;
      if (typeof ClipboardItem === 'undefined' || !navigator?.clipboard?.write) {
        return false;
      }
      try {
        const itemData: Record<string, Blob> = {
          'text/plain': new Blob([textToCopy], { type: 'text/plain' }),
          'text/html': new Blob([htmlToCopy], { type: 'text/html' }),
        };
        await navigator.clipboard.write([new ClipboardItem(itemData)]);
        return true;
      } catch (error) {
        console.warn('Clipboard HTML copy failed, fallback to text.', error);
        return false;
      }
    };

    const copyWithClipboardText = async () => {
      if (!navigator?.clipboard?.writeText) {
        return false;
      }
      try {
        await navigator.clipboard.writeText(textToCopy);
        return true;
      } catch {
        return false;
      }
    };

    const copyWithDomFallback = () => {
      const tempContainer = document.createElement('div');
      tempContainer.style.position = 'fixed';
      tempContainer.style.opacity = '0';
      tempContainer.style.pointerEvents = 'none';
      tempContainer.innerHTML = htmlToCopy || textToCopy;
      document.body.appendChild(tempContainer);
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(tempContainer);
      selection?.removeAllRanges();
      selection?.addRange(range);
      document.execCommand('copy');
      selection?.removeAllRanges();
      document.body.removeChild(tempContainer);
    };

    const executeCopy = async () => {
      const copiedHtml = await copyWithClipboardItem();
      if (copiedHtml) return;

      const copiedText = await copyWithClipboardText();
      if (copiedText) return;

      copyWithDomFallback();
    };

    executeCopy()
      .then(() => {
        setCopiedBubbleKey(item.key);
        if (copyResetTimerRef.current) {
          window.clearTimeout(copyResetTimerRef.current);
        }
        copyResetTimerRef.current = window.setTimeout(() => {
          setCopiedBubbleKey((current) => (current === item.key ? null : current));
        }, 2000);
        message.success('已复制');
      })
      .catch((err) => {
        console.error('Failed to copy AI response:', err);
        message.error('复制失败，请手动选择文本');
      });
  }, []);

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
    const isCopied = copiedBubbleKey === m.key;

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
      item.footer = (
        <div className="ai-bubble-footer">
          <Tooltip title={isCopied ? '已复制' : '复制回答'}>
            <Button
              type="text"
              size="small"
              icon={isCopied ? <CheckOutlined /> : <CopyOutlined />}
              onClick={(event) => {
                event.stopPropagation();
                void handleCopyAnswer(m);
              }}
            />
          </Tooltip>
          <Tooltip title="保存到便签">
            <Button
              type="text"
              size="small"
              icon={<SaveOutlined />}
              onClick={(event) => {
                event.stopPropagation();
                void handleSaveToNote(m.content);
              }}
            />
          </Tooltip>
        </div>
      );

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

  const currentProviderId = detectProviderIdFromConfig(config ?? undefined);
  const providerColor = config ? getProviderBrandColor(currentProviderId) : '#d9d9d9';
  const providerMenuItems: MenuProps['items'] = providerOptions.map((option) => {
    const isActive = option.providerId === currentProviderId;
    return {
      key: option.providerId,
      label: (
        <div className="ai-meta-option">
          <div className="ai-meta-option__row">
            <span
              className="ai-meta-option__dot"
              style={{ backgroundColor: getProviderBrandColor(option.providerId) }}
            />
            <span className="ai-meta-option__provider">{option.config.provider}</span>
            {isActive && <span className="ai-meta-option__badge">当前</span>}
          </div>
          <div className="ai-meta-option__model">{option.config.model}</div>
        </div>
      ),
    };
  });

  const dropdownMenuProps: MenuProps | undefined = providerMenuItems.length
    ? {
        items: providerMenuItems,
        onClick: ({ key }) => handleProviderSwitch(key as string),
      }
    : undefined;

  const hasProviderConfigs = providerOptions.length > 0;
  const metaTriggerClassName = `ai-tab-meta-trigger${switchingProviderId ? ' is-switching' : ''}`;
  const renderMetaTrigger = (interactive: boolean) => (
    <div
      className={metaTriggerClassName}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : -1}
      onKeyDown={interactive ? handleMetaTriggerKeyDown : undefined}
    >
      <span className="ai-tab-meta-provider">
        <span className="ai-tab-meta-dot" style={{ backgroundColor: providerColor }} />
        {config?.provider ?? '未选择厂商'}
      </span>
      <span className="ai-tab-meta-model">
        {config?.model ?? '未选择模型'}
        <DownOutlined className="ai-tab-meta-icon" />
      </span>
    </div>
  );

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
          {hasProviderConfigs && dropdownMenuProps ? (
            <Dropdown
              menu={dropdownMenuProps}
              trigger={['click']}
              placement="bottomLeft"
              overlayClassName="ai-meta-dropdown"
            >
              {renderMetaTrigger(true)}
            </Dropdown>
          ) : config ? (
            renderMetaTrigger(false)
          ) : (
            <span className="ai-tab-header-meta">未配置</span>
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
