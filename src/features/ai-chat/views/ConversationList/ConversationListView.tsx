import React, { useState, useEffect, useRef } from 'react';
import { Input, Badge, Button, message, Modal } from 'antd';
import { PlusOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons';
import { ConversationCard, CardListContext } from '../../../../components/BaseCard';
import { getThemeColor } from '../../../../theme/theme';
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
  const {
    selectedToolItemId,
    aiConversations, // 从 Store 获取 aiConversations
    refreshAIConversationsTrigger, // 监听刷新触发器
    createAIConversation, // 从 Store 获取 createAIConversation
    deleteAIConversation, // 从 Store 获取 deleteAIConversation
    loadAIConversations, // 从 Store 获取 loadAIConversations
    setSelectedToolItem,
    resetEditorTab,
  } = useWorkspaceStore();

  // 本地状态（仅 UI 状态）
  const [themeColor, setThemeColor] = useState(getThemeColor());
  const scrollableListRef = useRef<HTMLDivElement>(null);
  const flexVerticalEqualRef = useRef<HTMLDivElement>(null);
  const [isOverflow, setIsOverflow] = useState(false);
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

  // 初始化加载 AI 对话
  useEffect(() => {
    loadAIConversations();
  }, [loadAIConversations]);

  // 监听刷新触发器，自动重新加载 AI 对话（统一使用 Zustand 触发器模式）
  useEffect(() => {
    loadAIConversations();
  }, [refreshAIConversationsTrigger, loadAIConversations]);

  // 创建 AI 对话
  const handleCreateAIConversation = async () => {
    try {
      await createAIConversation(); // 使用 Store Action
      message.success('新建对话成功');
      // 选中最新创建的对话（需要重新加载后选中）
      const conversations = await window.storage.getAIConversations();
      if (conversations.length > 0) {
        setSelectedToolItem(conversations[0].id);
      }
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
          await deleteAIConversation(id); // 使用 Store Action
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
        <CardListContext.Provider value={{ selectedId: selectedToolItemId ?? undefined }}>
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
        </CardListContext.Provider>
      </div>
    </div>
  );
};
