import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Input, Badge, Button, message, Modal } from 'antd';
import { PlusOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons';
import ConversationCard from '../../../../components/ConversationCard/ConversationCard';
import { NoteCardListContext } from '../../../../components/CardContext/CardContext';
import { getThemeColor } from '../../../../theme/theme';
import type { AIConversationPreview } from '../../../../constants/tools';
import { useWorkspaceStore } from '../../../../store/workspaceStore';

interface ConversationListViewProps {
  flex: string | number;
}

/**
 * ConversationListView - AI对话列表视图组件
 * 专门负责展示和管理AI对话列表
 */
export const ConversationListView: React.FC<ConversationListViewProps> = ({ flex }) => {
  // Store 状态
  const { selectedToolItemId, setSelectedToolItem, resetEditorTab } = useWorkspaceStore();

  // 本地状态
  const [themeColor, setThemeColor] = useState(getThemeColor());
  const scrollableListRef = useRef<HTMLDivElement>(null);
  const flexVerticalEqualRef = useRef<HTMLDivElement>(null);
  const [isOverflow, setIsOverflow] = useState(false);
  const [aiConversations, setAiConversations] = useState<AIConversationPreview[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // 监听主题色变化
  useEffect(() => {
    const handler = (e: Event) => {
      const color = (e as unknown as CustomEvent<string>).detail;
      if (typeof color === 'string' && color) setThemeColor(color);
    };
    window.addEventListener('theme-color-change', handler as EventListener);
    return () => window.removeEventListener('theme-color-change', handler as EventListener);
  }, []);

  // 加载 AI 对话列表
  const loadAiConversations = useCallback(async () => {
    try {
      const conversations = await window.storage.getAIConversations();
      setAiConversations(
        conversations.map((c) => ({
          id: c.id,
          title: c.title,
          excerpt: c.excerpt,
          updatedAt: c.updatedAt,
          color: 'd6e4ff',
        })),
      );
    } catch (error) {
      console.error('Failed to load AI conversations:', error);
    }
  }, []);

  // 初始化加载
  useEffect(() => {
    loadAiConversations();
  }, [loadAiConversations]);

  // 监听 AI 对话更新事件
  useEffect(() => {
    const handleConversationUpdate = () => {
      loadAiConversations();
    };

    window.addEventListener('ai-conversation-updated', handleConversationUpdate);
    return () => window.removeEventListener('ai-conversation-updated', handleConversationUpdate);
  }, [loadAiConversations]);

  // 创建 AI 对话
  const handleCreateAIConversation = async () => {
    try {
      const newConversation = await window.storage.createAIConversation();
      await loadAiConversations();
      setSelectedToolItem(newConversation.id);
      message.success('新建对话成功');
    } catch (error) {
      console.error('Failed to create AI conversation:', error);
      message.error('创建对话失败');
    }
  };

  // 删除 AI 对话
  const handleDeleteAIConversation = async (id: string, title: string) => {
    // 检查是否为默认对话
    if (title === '默认对话') {
      message.warning('默认对话无法删除');
      return;
    }

    Modal.confirm({
      title: '删除对话',
      content: `确定删除对话"${title}"吗？`,
      okText: '删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      async onOk() {
        try {
          await window.storage.deleteAIConversation(id);

          // 如果删除的是当前选中的对话，自动切换到第一个对话
          if (selectedToolItemId === id) {
            const updatedConversations = await window.storage.getAIConversations();
            if (updatedConversations.length > 0) {
              setSelectedToolItem(updatedConversations[0].id);
            } else {
              setSelectedToolItem('');
            }
          }

          await loadAiConversations();
        } catch (error) {
          console.error('Failed to delete AI conversation:', error);
          message.error('删除对话失败');
          throw error;
        }
      },
    });
  };

  // 筛选 AI 对话
  const filteredAiConversations = aiConversations.filter((item) =>
    item.title.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // 检测滚动条
  useEffect(() => {
    const scrollableElement = scrollableListRef.current;
    if (!scrollableElement) return;

    const resizeObserver = new ResizeObserver(() => {
      const hasVerticalScroll = scrollableElement.scrollHeight > scrollableElement.clientHeight;
      setIsOverflow(hasVerticalScroll);
    });

    resizeObserver.observe(scrollableElement);

    const mutationObserver = new MutationObserver(() => {
      const hasVerticalScroll = scrollableElement.scrollHeight > scrollableElement.clientHeight;
      setIsOverflow(hasVerticalScroll);
    });

    mutationObserver.observe(scrollableElement, {
      childList: true,
      subtree: true,
    });

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, []);

  // 动态更新 padding
  useEffect(() => {
    if (flexVerticalEqualRef.current) {
      if (isOverflow) {
        flexVerticalEqualRef.current.style.paddingRight = '0px';
      } else {
        flexVerticalEqualRef.current.style.paddingRight = '10px';
      }
    }
  }, [isOverflow]);

  return (
    <div className="layout-panel list-container" style={{ flex }}>
      <div className="flex-vertical-auto">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span className="folder-name" title="AI对话">
            AI对话
          </span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Badge
              count={filteredAiConversations.length}
              showZero
              style={{ backgroundColor: themeColor }}
            />
            <Button
              type="text"
              size="small"
              icon={<PlusOutlined />}
              onClick={handleCreateAIConversation}
              title="新建AI对话"
            />
          </div>
        </div>
        <Input
          allowClear
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="搜索AI对话"
          prefix={<SearchOutlined style={{ color: '#bfbfbf', fontSize: 16 }} />}
          style={{ width: '100%' }}
        />
      </div>
      <div className="flex-vertical-equal" ref={flexVerticalEqualRef}>
        <NoteCardListContext.Provider value={{ selectedId: selectedToolItemId ?? undefined }}>
          <div className="scrollable-list" ref={scrollableListRef}>
            {filteredAiConversations.map((session) => (
              <ConversationCard
                key={session.id}
                title={session.title}
                content={session.excerpt}
                onClick={() => {
                  setSelectedToolItem(session.id);
                  resetEditorTab();
                }}
                actions={
                  session.title !== '默认对话' ? (
                    <Button
                      type="text"
                      size="small"
                      icon={<DeleteOutlined />}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteAIConversation(session.id, session.title);
                      }}
                    />
                  ) : null
                }
                id={session.id}
              />
            ))}
          </div>
        </NoteCardListContext.Provider>
      </div>
    </div>
  );
};
