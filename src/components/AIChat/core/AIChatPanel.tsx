/**
 * AIChatPanel - AI 对话面板组件
 *
 * 纯 UI 组件，展示 AI 对话界面，包含：
 * - 消息气泡列表
 * - 输入框
 * - Provider 切换
 * - 标题编辑
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { Sender, Bubble, Actions, Suggestion, FileCard } from '@ant-design/x';
import {
  Alert,
  Avatar,
  Button,
  Tooltip,
  Space,
  Divider,
  Input,
  Dropdown,
  message,
  Flex,
  Tag,
  Segmented,
} from 'antd';
import type { GetProp, GetRef, MenuProps } from 'antd';
import {
  ReloadOutlined,
  DeleteOutlined,
  SettingOutlined,
  RobotOutlined,
  UserOutlined,
  DownOutlined,
  CopyOutlined,
  SaveOutlined,
  BookOutlined,
  EditOutlined,
  FileTextOutlined,
  TranslationOutlined,
  BulbOutlined,
} from '@ant-design/icons';
import { MarkdownRenderer } from '../components/MarkdownRenderer';
import { SourceCard } from '../components/SourceCard';
import { getProviderBrandColor } from '../../../services/aiProviders';
import { noteService, folderService } from '../../../services';
import { useSettingsStore } from '../../../store/settingsStore';
import { useAIConfig, useAIChat } from '../hooks';
import { renderMarkdownToHtml, convertMarkdownToTipTap, copyToClipboard } from '../utils';
import type { ChatItem, AIChatPanelProps } from '../types';
import '../styles/AIChat.css';

// Bubble.List 类型
type BubbleListItem = NonNullable<GetProp<typeof Bubble.List, 'items'>>[number];

// Suggestion 类型
type SuggestionItems = Exclude<GetProp<typeof Suggestion, 'items'>, () => void>;

// 快捷指令配置
const QUICK_COMMANDS: SuggestionItems = [
  {
    label: '摘要总结',
    value: 'summarize',
    icon: <FileTextOutlined />,
  },
  {
    label: '翻译',
    value: 'translate',
    icon: <TranslationOutlined />,
    children: [
      { label: '翻译成中文', value: 'translate_zh' },
      { label: '翻译成英文', value: 'translate_en' },
      { label: '翻译成日文', value: 'translate_ja' },
    ],
  },
  {
    label: '改写优化',
    value: 'rewrite',
    icon: <EditOutlined />,
    children: [
      { label: '语气更正式', value: 'rewrite_formal' },
      { label: '语气更口语化', value: 'rewrite_casual' },
      { label: '精简压缩', value: 'rewrite_concise' },
    ],
  },
  {
    label: '灵感建议',
    value: 'inspire',
    icon: <BulbOutlined />,
  },
];

/**
 * AI 对话面板组件
 */
export const AIChatPanel = ({
  conversationId,
  title: externalTitle,
  onTitleChange,
  showTitleEditor = true,
  className = '',
}: AIChatPanelProps) => {
  // AI 配置
  const {
    isConfigured,
    isInitializing,
    config,
    providerOptions,
    currentProviderId,
    switchProvider,
    isSwitching,
  } = useAIConfig();

  // AI 模式：默认 / 外部
  const [aiMode, setAiMode] = useState<'default' | 'external'>('default');

  // 便签列表（用于引用下拉菜单）
  const [noteItems, setNoteItems] = useState<MenuProps['items']>([]);
  // 已选中的便签引用
  const [selectedNotes, setSelectedNotes] = useState<
    Array<{ id: string; title: string; content: string }>
  >([]);

  // 加载便签列表
  useEffect(() => {
    const loadNotes = async () => {
      try {
        const folders = await folderService.listFolders();
        const items: MenuProps['items'] = [];
        for (const folder of folders) {
          const notes = await noteService.listNotes(folder.id);
          notes.forEach((note) => {
            items.push({
              key: note.id,
              icon: <FileTextOutlined />,
              label: note.title || '无标题',
            });
          });
        }
        setNoteItems(items);
      } catch (err) {
        console.error('[AIChatPanel] Failed to load notes:', err);
      }
    };
    loadNotes();
  }, []);

  // 处理便签选择 - 添加到已选列表
  const handleNoteSelect: MenuProps['onClick'] = useCallback(
    async ({ key }: { key: string }) => {
      // 检查是否已选择
      if (selectedNotes.some((n) => n.id === key)) {
        message.info('该便签已引用');
        return;
      }
      try {
        const note = await noteService.getNote(key);
        // 提取纯文本内容
        const extractText = (content: unknown): string => {
          if (!content || typeof content !== 'object') return '';
          const node = content as { text?: string; content?: unknown[] };
          let text = node.text || '';
          if (node.content && Array.isArray(node.content)) {
            for (const child of node.content) {
              text += extractText(child);
              const childNode = child as { type?: string };
              if (childNode.type === 'paragraph' || childNode.type === 'heading') {
                text += '\n';
              }
            }
          }
          return text;
        };
        const textContent = extractText(note.content);
        setSelectedNotes((prev) => [
          ...prev,
          { id: key, title: note.title || '无标题', content: textContent },
        ]);
      } catch (err) {
        console.error('[AIChatPanel] Failed to load note:', err);
        message.error('加载便签失败');
      }
    },
    [selectedNotes],
  );

  // 移除便签引用
  const handleRemoveNote = useCallback((noteId: string) => {
    setSelectedNotes((prev) => prev.filter((n) => n.id !== noteId));
  }, []);

  // 对话标题
  const [conversationTitle, setConversationTitle] = useState<string>(externalTitle || 'AI 对话');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState<string>('');

  // 知识库开关状态（本次对话是否使用知识库）
  const [useKnowledgeBase, setUseKnowledgeBase] = useState(false);

  // 从 store 读取知识库功能是否启用（响应式）
  const { knowledgeBaseEnabled, loadKnowledgeBaseConfig } = useSettingsStore();

  // 组件挂载时加载知识库配置
  useEffect(() => {
    loadKnowledgeBaseConfig();
  }, [loadKnowledgeBaseConfig]);

  // 如果知识库被禁用，同时关闭使用知识库
  useEffect(() => {
    if (!knowledgeBaseEnabled) {
      setUseKnowledgeBase(false);
    }
  }, [knowledgeBaseEnabled]);

  // 处理标题变更
  const handleTitleChange = useCallback((newTitle: string) => {
    setConversationTitle(newTitle);
  }, []);

  // AI 对话
  const {
    chatItems,
    isLoading,
    isLoadingHistory,
    error,
    sendMessage,
    abort,
    clearChat,
    clearError,
  } = useAIChat({
    conversationId,
    isConfigured,
    useKnowledgeBase,
    onTitleChange: handleTitleChange,
  });

  // Sender ref
  const senderRef = useRef<GetRef<typeof Sender>>(null);

  // 复制状态
  const [copiedBubbleKey, setCopiedBubbleKey] = useState<string | null>(null);
  const copyResetTimerRef = useRef<number | null>(null);

  // 清理复制状态定时器
  const clearCopyTimer = useCallback(() => {
    if (copyResetTimerRef.current) {
      window.clearTimeout(copyResetTimerRef.current);
      copyResetTimerRef.current = null;
    }
  }, []);

  // 保存到便签
  const handleSaveToNote = useCallback(async (content: string) => {
    try {
      const tipTapContent = convertMarkdownToTipTap(content);
      const firstLine = content.split('\n')[0].trim();
      const title = (firstLine.substring(0, 30) || 'AI 回答').replace(/[#*`]/g, '').trim();

      await noteService.createNote('default', {
        title,
        content: tipTapContent,
      });

      message.success('已保存到默认文件夹');
    } catch (error) {
      console.error('Failed to save to note:', error);
      message.error('保存失败，请重试');
    }
  }, []);

  // 复制回答
  const handleCopyAnswer = useCallback(
    (item: ChatItem) => {
      const textToCopy = item.content?.trim();
      if (!textToCopy) {
        message.info('暂无可复制内容');
        return;
      }

      const htmlToCopy = renderMarkdownToHtml(textToCopy);

      copyToClipboard(textToCopy, htmlToCopy)
        .then(() => {
          setCopiedBubbleKey(item.key);
          clearCopyTimer();
          copyResetTimerRef.current = window.setTimeout(() => {
            setCopiedBubbleKey((current) => (current === item.key ? null : current));
          }, 2000);
          message.success('已复制');
        })
        .catch((err) => {
          console.error('Failed to copy AI response:', err);
          message.error('复制失败，请手动选择文本');
        });
    },
    [clearCopyTimer],
  );

  // 标题编辑
  const startEditingTitle = () => {
    setTempTitle(conversationTitle);
    setIsEditingTitle(true);
  };

  const saveTitle = async () => {
    if (!conversationId || !tempTitle.trim()) {
      setIsEditingTitle(false);
      return;
    }

    try {
      const { aiConversationService } = await import('../../../services');
      await aiConversationService.updateTitle(conversationId, tempTitle.trim());
      setConversationTitle(tempTitle.trim());
      setIsEditingTitle(false);
      onTitleChange?.(tempTitle.trim());
    } catch (err) {
      console.error('Failed to update conversation title:', err);
      setIsEditingTitle(false);
    }
  };

  const cancelEditingTitle = () => {
    setIsEditingTitle(false);
    setTempTitle('');
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveTitle();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEditingTitle();
    }
  };

  // 转换为 Bubble.List items
  const bubbleItems = chatItems.map((m) => {
    const isCopied = copiedBubbleKey === m.key;

    // AI 消息的操作按钮
    const actionItems =
      m.role === 'ai'
        ? [
            {
              key: 'copy',
              icon: <CopyOutlined />,
              label: isCopied ? '已复制' : '复制',
            },
            {
              key: 'save',
              icon: <SaveOutlined />,
              label: '保存到便签',
            },
          ]
        : [];

    const item: BubbleListItem = {
      key: m.key,
      role: m.role,
      content: m.content,
      placement: m.role === 'ai' ? 'start' : 'end', // AI在左，用户在右
      contentRender: (content) => {
        // 用户消息：过滤掉便签上下文，只显示用户输入
        const displayContent =
          m.role === 'user'
            ? (content as string)
                .replace(/\n\n以下是用户引用的便签内容，请结合这些内容回答：[\s\S]*/g, '')
                .trim()
            : content;

        return (
          <>
            <MarkdownRenderer
              content={displayContent as string}
              streaming={m.isStreaming ? { hasNextChunk: true, enableAnimation: true } : undefined}
            />
            {/* 用户消息显示引用的便签 FileCard */}
            {m.role === 'user' && m.references && m.references.length > 0 && (
              <div className="ai-chat-reference-cards">
                {m.references.map((ref) => (
                  <FileCard
                    key={ref.id}
                    name={`${ref.title}.md`}
                    byte={ref.byteLength}
                    icon="markdown"
                    size="small"
                  />
                ))}
              </div>
            )}
            {/* AI 消息显示知识库来源 */}
            {m.role === 'ai' && m.sources && m.sources.length > 0 && !m.isStreaming && (
              <SourceCard
                sources={m.sources}
                onSourceClick={(noteId) => {
                  // TODO: 跳转到笔记
                  message.info(`跳转到笔记: ${noteId}`);
                }}
              />
            )}
          </>
        );
      },
      avatar:
        m.role === 'ai' ? (
          <Avatar icon={<RobotOutlined />} style={{ backgroundColor: '#1890ff' }} />
        ) : (
          <Avatar icon={<UserOutlined />} style={{ backgroundColor: '#52c41a' }} />
        ),
    };

    if (m.role === 'ai') {
      item.footer = (content) => (
        <Actions
          items={actionItems}
          onClick={({ key }) => {
            if (key === 'copy') {
              handleCopyAnswer(m);
            } else if (key === 'save') {
              handleSaveToNote(content as string);
            }
          }}
        />
      );

      // Actions 按钮位置配置
      item.footerPlacement = 'outer-end';

      if (!m.content.trim() && m.isStreaming) {
        item.loading = true;
      } else if (m.isStreaming && m.content.trim()) {
        item.typing = { effect: 'typing', step: 5, interval: 50 };
      }
    }

    return item;
  });

  // 初始化中
  if (isInitializing) {
    return (
      <div className={`ai-chat-container ${className}`}>
        <div className="ai-chat-messages-empty">
          <div style={{ textAlign: 'center', color: '#999' }}>初始化中...</div>
        </div>
      </div>
    );
  }

  // 未配置
  if (!isConfigured) {
    return (
      <div className={`ai-chat-container ${className}`}>
        <div className="ai-chat-messages-empty">
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
    <div className={`ai-chat-container ${className}`}>
      {/* 分段控制器 */}
      <div className="ai-mode-switcher">
        <Segmented
          size="small"
          options={[
            { label: '默认', value: 'default' },
            { label: '外部', value: 'external' },
          ]}
          value={aiMode}
          onChange={(value) => setAiMode(value as 'default' | 'external')}
        />
      </div>

      {aiMode === 'default' ? (
        <>
          {/* 顶部状态栏 */}
          {showTitleEditor && (
            <div className="ai-chat-header">
              <div className="ai-chat-header-left">
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
                    className="ai-chat-header-title"
                    onDoubleClick={startEditingTitle}
                    style={{ cursor: 'pointer' }}
                    title="双击编辑标题"
                  >
                    {conversationTitle}
                  </span>
                )}
              </div>

              <Space size="small">
                <Tooltip title="清除错误">
                  <Button
                    type="text"
                    size="small"
                    icon={<ReloadOutlined />}
                    onClick={clearError}
                    disabled={!error}
                  />
                </Tooltip>
                <Tooltip title="清空对话">
                  <Button
                    type="text"
                    size="small"
                    icon={<DeleteOutlined />}
                    onClick={clearChat}
                    disabled={chatItems.length === 0}
                  />
                </Tooltip>
                <Divider type="vertical" style={{ margin: '0', height: 'auto' }} />
                <Tooltip title="打开设置">
                  <Button
                    type="text"
                    size="small"
                    icon={<SettingOutlined />}
                    onClick={() => {
                      // TODO: 触发打开设置页面
                    }}
                  />
                </Tooltip>
              </Space>
            </div>
          )}

          {/* 错误提示 */}
          {error && (
            <Alert
              message="出错"
              description={error}
              type="error"
              showIcon
              closable
              onClose={clearError}
              className="ai-chat-alert"
            />
          )}

          {/* 消息列表 */}
          <div className="ai-chat-messages">
            {isLoadingHistory ? (
              // 加载历史时显示简单的 loading 状态（不显示空状态，避免闪烁）
              <div className="ai-chat-messages-empty">
                <p style={{ fontSize: '12px', color: '#999' }}>加载中...</p>
              </div>
            ) : bubbleItems.length === 0 ? (
              <div className="ai-chat-messages-empty">
                <p style={{ fontSize: '14px' }}>开始对话，与 AI 互动</p>
                <p style={{ fontSize: '12px', color: '#999' }}>输入你的问题，AI 将为你答疑解惑</p>
              </div>
            ) : (
              <Bubble.List items={bubbleItems} />
            )}
          </div>

          {/* 已选便签展示 */}
          {selectedNotes.length > 0 && (
            <div className="ai-chat-selected-notes">
              {selectedNotes.map((note) => (
                <Tag
                  key={note.id}
                  closable
                  onClose={() => handleRemoveNote(note.id)}
                  icon={<FileTextOutlined />}
                >
                  {note.title}
                </Tag>
              ))}
            </div>
          )}

          {/* 输入框 */}
          <div className="ai-chat-input">
            <Suggestion
              items={QUICK_COMMANDS}
              onSelect={(value) => {
                // TODO: 后续实现快捷指令具体功能
                message.info(`选择了快捷指令: ${value}`);
              }}
            >
              {({ onTrigger, onKeyDown: suggestionKeyDown }) => (
                <Sender
                  ref={senderRef}
                  loading={isLoading}
                  placeholder="输入消息，输入 @ 唤起快捷指令"
                  onKeyDown={(e) => {
                    // 监听 @ 键唤起快捷指令
                    if (e.key === '@') {
                      onTrigger();
                    } else {
                      onTrigger(false);
                    }
                    // 传递给 Suggestion 的 onKeyDown
                    suggestionKeyDown?.(e);
                  }}
                  onSubmit={async (value) => {
                    if (value.trim()) {
                      // 将 selectedNotes 转换为 NoteReference 格式
                      const references = selectedNotes.map((note) => ({
                        id: note.id,
                        title: note.title,
                        byteLength: new TextEncoder().encode(note.content).length,
                        content: note.content,
                      }));

                      // 构建便签上下文（作为隐藏上下文发送给 AI）
                      let noteContext = '';
                      if (selectedNotes.length > 0) {
                        noteContext = '\n\n以下是用户引用的便签内容，请结合这些内容回答：\n\n';
                        selectedNotes.forEach((note, i) => {
                          noteContext += `[引用 ${i + 1}: ${note.title}]\n${note.content}\n\n`;
                        });
                      }

                      // 发送消息，传递 references
                      sendMessage(
                        value + noteContext,
                        references.length > 0 ? references : undefined,
                      );
                      senderRef.current?.clear?.();
                      // 清空已选便签
                      setSelectedNotes([]);
                    }
                  }}
                  onCancel={() => {
                    // 取消按钮 = 中止当前流式请求
                    if (isLoading) {
                      abort();
                    }
                    senderRef.current?.clear?.();
                    message.info(isLoading ? '已中止生成' : '已取消发送');
                  }}
                  footer={(_, { components }) => {
                    const { SendButton, LoadingButton } = components;

                    // Provider 切换菜单
                    const providerColor = config
                      ? getProviderBrandColor(currentProviderId)
                      : '#d9d9d9';
                    const providerMenuItems: MenuProps['items'] = providerOptions.map((option) => {
                      const isActive = option.providerId === currentProviderId;
                      return {
                        key: option.providerId,
                        label: (
                          <div className="ai-meta-option">
                            <div className="ai-meta-option__row">
                              <span
                                className="ai-meta-option__dot"
                                style={{
                                  backgroundColor: getProviderBrandColor(option.providerId),
                                }}
                              />
                              <span className="ai-meta-option__provider">
                                {option.config.provider}
                              </span>
                              {isActive && <span className="ai-meta-option__badge">当前</span>}
                            </div>
                            <div className="ai-meta-option__model">{option.config.model}</div>
                          </div>
                        ),
                      };
                    });

                    const hasProviderConfigs = providerOptions.length > 0;

                    return (
                      <Flex justify="space-between" align="center">
                        <Flex gap="small" align="center">
                          {/* AI Provider 切换器 */}
                          {hasProviderConfigs && config ? (
                            <Dropdown
                              menu={{
                                items: providerMenuItems,
                                onClick: ({ key }) => switchProvider(key as string),
                              }}
                              trigger={['click']}
                              placement="topLeft"
                            >
                              <Button
                                size="small"
                                loading={isSwitching}
                                className="ai-model-switcher"
                              >
                                <span
                                  className="ai-chat-meta-dot"
                                  style={{ backgroundColor: providerColor }}
                                />
                                <span style={{ marginLeft: 6 }}>{config.model}</span>
                                <DownOutlined
                                  style={{ fontSize: 10, marginLeft: 4, color: '#8c8c8c' }}
                                />
                              </Button>
                            </Dropdown>
                          ) : null}
                          {/* 便签引用 - 圆形背景 icon */}
                          {noteItems && noteItems.length > 0 && (
                            <Dropdown
                              menu={{
                                items: noteItems,
                                onClick: handleNoteSelect,
                              }}
                              trigger={['click']}
                              placement="topLeft"
                            >
                              <Tooltip title="引用便签">
                                <span className="ai-icon-btn">
                                  <FileTextOutlined style={{ fontSize: 14 }} />
                                </span>
                              </Tooltip>
                            </Dropdown>
                          )}
                          {/* 知识库开关 */}
                          {knowledgeBaseEnabled && (
                            <Tooltip
                              title={useKnowledgeBase ? '已开启知识库增强' : '点击开启知识库问答'}
                            >
                              <span
                                className={`ai-icon-btn ${useKnowledgeBase ? 'ai-icon-btn--active' : ''}`}
                                onClick={() => setUseKnowledgeBase(!useKnowledgeBase)}
                              >
                                <BookOutlined style={{ fontSize: 14 }} />
                              </span>
                            </Tooltip>
                          )}
                        </Flex>
                        <Flex align="center">
                          {isLoading ? <LoadingButton /> : <SendButton type="primary" />}
                        </Flex>
                      </Flex>
                    );
                  }}
                  suffix={false}
                  autoSize={{ minRows: 2, maxRows: 6 }}
                />
              )}
            </Suggestion>
          </div>
        </>
      ) : (
        /* 三方 AI - 豆包 webview */
        <webview
          src="https://www.doubao.com/chat/"
          partition="persist:browser"
          className="ai-third-party-webview"
          // @ts-expect-error webview 属性 TypeScript 不识别
          allowpopups="true"
        />
      )}
    </div>
  );
};

export default AIChatPanel;
