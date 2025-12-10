/**
 * AIChatPanel - AI 对话面板组件
 *
 * 纯 UI 组件，展示 AI 对话界面，包含：
 * - 消息气泡列表
 * - 输入框
 * - Provider 切换
 * - 标题编辑
 */

import { useState, useCallback, useRef, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Sender, Bubble, Actions } from '@ant-design/x';
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
} from 'antd';
import type { MenuProps, GetProp } from 'antd';
import {
  ReloadOutlined,
  DeleteOutlined,
  SettingOutlined,
  RobotOutlined,
  UserOutlined,
  DownOutlined,
  CopyOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import { MarkdownRenderer } from '../components/MarkdownRenderer';
import { getProviderBrandColor } from '../../../services/aiProviders';
import { noteService } from '../../../services';
import { useAIConfig, useAIChat } from '../hooks';
import { renderMarkdownToHtml, convertMarkdownToTipTap, copyToClipboard } from '../utils';
import type { ChatItem, AIChatPanelProps } from '../types';
import '../styles/AIChat.css';

// Bubble.List 类型
type BubbleListItem = NonNullable<GetProp<typeof Bubble.List, 'items'>>[number];

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

  // 对话标题
  const [conversationTitle, setConversationTitle] = useState<string>(externalTitle || 'AI 对话');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState<string>('');

  // 处理标题变更
  const handleTitleChange = useCallback((newTitle: string) => {
    setConversationTitle(newTitle);
  }, []);

  // AI 对话
  const {
    chatItems,
    isLoading,
    error,
    inputValue,
    setInputValue,
    sendMessage,
    clearChat,
    clearError,
  } = useAIChat({
    conversationId,
    isConfigured,
    onTitleChange: handleTitleChange,
  });

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

  // Provider 下拉菜单
  const handleMetaTriggerKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.currentTarget.click();
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
      contentRender: (content) => (
        <MarkdownRenderer
          content={content}
          streaming={m.isStreaming ? { hasNextChunk: true, enableAnimation: true } : undefined}
        />
      ),
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

  // Provider 菜单
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
        onClick: ({ key }) => switchProvider(key as string),
      }
    : undefined;

  const hasProviderConfigs = providerOptions.length > 0;
  const metaTriggerClassName = `ai-chat-meta-trigger${isSwitching ? ' is-switching' : ''}`;

  const renderMetaTrigger = (interactive: boolean) => (
    <div
      className={metaTriggerClassName}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : -1}
      onKeyDown={interactive ? handleMetaTriggerKeyDown : undefined}
    >
      <span className="ai-chat-meta-provider">
        <span className="ai-chat-meta-dot" style={{ backgroundColor: providerColor }} />
        {config?.provider ?? '未选择厂商'}
      </span>
      <span className="ai-chat-meta-model">
        {config?.model ?? '未选择模型'}
        <DownOutlined className="ai-chat-meta-icon" />
      </span>
    </div>
  );

  return (
    <div className={`ai-chat-container ${className}`}>
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
            <Divider orientation="vertical" style={{ margin: '0' }} />
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
        {bubbleItems.length === 0 ? (
          <div className="ai-chat-messages-empty">
            <p style={{ fontSize: '14px' }}>开始对话，与 AI 互动</p>
            <p style={{ fontSize: '12px', color: '#999' }}>输入你的问题，AI 将为你答疑解惑</p>
          </div>
        ) : (
          <Bubble.List items={bubbleItems} />
        )}
      </div>

      {/* 输入框 */}
      <div className="ai-chat-input">
        <Sender
          loading={isLoading}
          disabled={isLoading || !isConfigured}
          onSubmit={sendMessage}
          placeholder="请输入问题...（Shift+Enter 换行，Enter 发送）"
          value={inputValue}
          onChange={setInputValue}
          footer={
            <Flex justify="space-between" align="center">
              <Flex align="center" gap="small">
                {hasProviderConfigs && dropdownMenuProps ? (
                  <Dropdown
                    menu={dropdownMenuProps}
                    trigger={['click']}
                    placement="topLeft"
                    classNames={{ root: 'ai-meta-dropdown' }}
                  >
                    {renderMetaTrigger(true)}
                  </Dropdown>
                ) : config ? (
                  renderMetaTrigger(false)
                ) : null}
              </Flex>
              <Flex align="center">
                <Button
                  type="primary"
                  shape="circle"
                  icon={<RobotOutlined style={{ fontSize: 18 }} />}
                  onClick={() => inputValue.trim() && sendMessage(inputValue)}
                  disabled={isLoading || !isConfigured || !inputValue.trim()}
                />
              </Flex>
            </Flex>
          }
        />
      </div>
    </div>
  );
};

export default AIChatPanel;
