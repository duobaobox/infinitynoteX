import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { message, Segmented, Spin } from 'antd';
import type { MenuProps } from 'antd';
import { useSettingsStore } from '../../store/settingsStore';
import { useAIConfig, useAIChat } from './hooks';
import {
  renderMarkdownToHtml,
  convertMarkdownToTipTap,
  copyToClipboard,
  stripThinkBlocks,
  extractTipTapText,
  truncateTitle,
} from './utils';
import { loadFolderNoteGroups } from '../../shared/utils/noteLoader';
import { EXTERNAL_AI_WEBVIEW_PARTITION } from '../../shared/utils/webviewSafety';
import { getProviderCapabilities } from '../../services/aiProviders';
import type { ChatItem, AIChatPanelProps, NoteReference } from './types';
import { resolveAIRetrievalPolicy } from './retrievalPolicy';
import './styles/AIChat.css';

// 引入子组件
import { ChatHeader } from './components/ChatHeader';
import { MessageList } from './components/MessageList';
import { ChatInput } from './components/ChatInput';
import { EmptyState, UnconfiguredState } from './components/EmptyState';

/**
 * AI 对话面板组件
 */
export const AIChatPanel = ({
  conversationId,
  conversationBinding = null,
  title: externalTitle,
  onTitleChange,
  showTitleEditor = true,
  className = '',
  source = 'workbench',
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

  // 从 store 读取知识库功能是否启用（响应式）、外部AI页面URL以及AI模式
  const { knowledgeBaseEnabled, loadKnowledgeBaseConfig, externalAiUrl, aiMode, setAiMode } =
    useSettingsStore();

  // 便签列表（用于引用下拉菜单）
  const [noteItems, setNoteItems] = useState<MenuProps['items']>([]);
  // 已选中的便签引用
  const [selectedNotes, setSelectedNotes] = useState<
    Array<{ id: string; title: string; content: string; color?: string }>
  >([]);

  // 加载便签列表
  useEffect(() => {
    const loadNotes = async () => {
      try {
        const groups = await loadFolderNoteGroups();
        const items: MenuProps['items'] = groups.map((group) => ({
          key: `folder-${group.folderId}`,
          type: 'group',
          label: group.folderName,
          children: group.notes.map((note) => ({
            key: note.id,
            label: truncateTitle(note.title) || '无标题',
          })),
        }));
        setNoteItems(items);
      } catch (err) {
        console.error('[AIChatPanel] Failed to load notes:', err);
      }
    };
    loadNotes();
  }, []);

  // 处理便签选择 - 切换选中状态
  const handleNoteSelect: MenuProps['onClick'] = useCallback(
    async ({ key }: { key: string }) => {
      // 检查是否已选择
      const isSelected = selectedNotes.some((n) => n.id === key);
      if (isSelected) {
        // 如果已选择，则移除
        setSelectedNotes((prev) => prev.filter((n) => n.id !== key));
        return;
      }

      try {
        const note = await window.storage.getNote(key);
        const textContent = extractTipTapText(note.content);
        setSelectedNotes((prev) => [
          ...prev,
          { id: key, title: note.title || '无标题', content: textContent, color: note.color },
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
  const conversationBindingKey = conversationBinding
    ? `${conversationBinding.source}:${conversationBinding.entityId}`
    : null;

  useEffect(() => {
    setConversationTitle(externalTitle || 'AI 对话');
    setSelectedNotes([]);
  }, [conversationBindingKey, conversationId, externalTitle]);

  // 知识库开关状态（本次对话是否使用知识库）
  const [useKnowledgeBase, setUseKnowledgeBase] = useState(false);

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

  const retrievalPolicy = useMemo(
    () =>
      resolveAIRetrievalPolicy({
        useKnowledgeBase,
        supportsToolCalling: getProviderCapabilities(config).toolCalling,
      }),
    [config, useKnowledgeBase],
  );

  // 处理标题变更
  const handleTitleChangeCallback = useCallback((newTitle: string) => {
    setConversationTitle(newTitle);
  }, []);

  // AI 对话
  const {
    activeConversationId,
    chatItems,
    isLoading,
    isResolvingConversation,
    isLoadingHistory,
    error,
    sendMessage,
    abort,
    clearChat,
    clearError,
    respondToToolApproval,
  } = useAIChat({
    conversationId,
    conversationBinding,
    isConfigured,
    allowActiveRetrieval: retrievalPolicy.allowActiveRetrieval,
    useFallbackRag: retrievalPolicy.useFallbackRag,
    onTitleChange: handleTitleChangeCallback,
    source,
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
      const exported = stripThinkBlocks(content);
      const tipTapContent = convertMarkdownToTipTap(exported);
      // 标题从"回答正文"提取
      const titleSource = exported;
      const firstLine = (titleSource.split('\n').find((l) => l.trim().length > 0) || '').trim();
      const title = (firstLine.substring(0, 30) || 'AI 回答').replace(/[#*`]/g, '').trim();

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

  // 复制回答
  const handleCopyAnswer = useCallback(
    (item: ChatItem) => {
      const textToCopy = stripThinkBlocks(item.content || '');
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
    if (!activeConversationId || !tempTitle.trim()) {
      setIsEditingTitle(false);
      return;
    }

    try {
      await window.storage.updateAIConversationTitle(activeConversationId, tempTitle.trim());
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

  // 消息发送处理
  const handleSend = useCallback(
    (value: string, attachments?: NoteReference[]) => {
      sendMessage(value, attachments);
      // 清空已选便签
      setSelectedNotes([]);
    },
    [sendMessage],
  );

  // 没有选中对话，显示空状态（屏蔽整个页面）
  if (!conversationId && !conversationBinding && !isResolvingConversation) {
    return (
      <div className={`ai-chat-container ${className}`}>
        <EmptyState />
      </div>
    );
  }

  if (isResolvingConversation) {
    return (
      <div className={`ai-chat-container ${className}`}>
        <div className="ai-chat-messages-empty">
          <Spin size="small" />
          <p style={{ marginTop: 8, fontSize: '12px', color: '#999' }}>正在恢复对话上下文...</p>
        </div>
      </div>
    );
  }

  // UnconfiguredState 可以在这里直接使用，也可以作为组件返回
  if (!isInitializing && !isConfigured) {
    return <UnconfiguredState className={className} />;
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
            <ChatHeader
              title={conversationTitle}
              isEditing={isEditingTitle}
              tempTitle={tempTitle}
              error={error}
              hasMessages={chatItems.length > 0}
              onEditStart={startEditingTitle}
              onEditSave={saveTitle}
              onEditCancel={cancelEditingTitle}
              onTitleChange={setTempTitle}
              onKeyDown={handleTitleKeyDown}
              onClearError={clearError}
              onClearChat={clearChat}
            />
          )}

          {/* 消息列表 */}
          <MessageList
            isLoadingHistory={isLoadingHistory}
            isInitializing={isInitializing}
            isConfigured={isConfigured}
            hasConversationContext={!!conversationBinding || !!conversationId}
            conversationId={activeConversationId}
            items={chatItems}
            copiedBubbleKey={copiedBubbleKey}
            onCopyAnswer={handleCopyAnswer}
            onSaveToNote={handleSaveToNote}
            onRespondToolApproval={respondToToolApproval}
          />

          {/* 输入框 */}
          <ChatInput
            isLoading={isLoading}
            onSend={handleSend}
            onAbort={abort}
            selectedNotes={selectedNotes}
            onRemoveNote={handleRemoveNote}
            providerConfig={{
              config,
              options: providerOptions,
              currentId: currentProviderId,
              isSwitching,
              onSwitch: switchProvider,
            }}
            knowledgeBase={{
              enabled: knowledgeBaseEnabled,
              inUse: useKnowledgeBase,
              onToggle: setUseKnowledgeBase,
            }}
            noteReference={{
              items: noteItems,
              onSelect: handleNoteSelect,
            }}
          />
        </>
      ) : (
        /* 三方 AI - 外部页面 webview */
        <webview
          src={externalAiUrl}
          partition={EXTERNAL_AI_WEBVIEW_PARTITION}
          className="ai-third-party-webview"
          {...({ autosize: 'on' } as React.HTMLAttributes<HTMLElement>)}
        />
      )}
    </div>
  );
};

export default AIChatPanel;
