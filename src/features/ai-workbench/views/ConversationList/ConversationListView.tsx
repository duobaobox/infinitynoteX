import React, { useEffect } from 'react';
import { Input, Badge, Button, message, Modal } from 'antd';
import { PlusOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons';
import ConversationCard, {
  CardListContext,
} from '../../../../../components/BaseCard/cards/ConversationCard';
import { useWorkspaceStore } from '../../../../../store/workspaceStore';
import { useScrollOverflow } from '../../../../../hooks/useScrollOverflow';
import { useThemeColor } from '../../../../../hooks/useThemeColor';

interface ConversationListViewProps {
  flex: string | number;
}

/**
 * ConversationListView - AI对话列表视图组件
 * 专门负责展示和管理AI对话列表
 */
export const ConversationListView: React.FC<ConversationListViewProps> = ({ flex }) => {
  // Store 状态（优化：使用 selector）
  const selectedToolItemId = useWorkspaceStore((state) => state.selectedToolItemId);
  const aiConversations = useWorkspaceStore((state) => state.aiConversations);
  const refreshAIConversationsTrigger = useWorkspaceStore(
    (state) => state.refreshAIConversationsTrigger,
  );
  const createAIConversation = useWorkspaceStore((state) => state.createAIConversation);
  const deleteAIConversation = useWorkspaceStore((state) => state.deleteAIConversation);
  const loadAIConversations = useWorkspaceStore((state) => state.loadAIConversations);
  const setSelectedToolItem = useWorkspaceStore((state) => state.setSelectedToolItem);
  const resetEditorTab = useWorkspaceStore((state) => state.resetEditorTab);

  // 使用公共 hooks
  const themeColor = useThemeColor();
  const { scrollableRef, containerRef } = useScrollOverflow();
  const [searchQuery, setSearchQuery] = React.useState('');

  // 初始化加载 AI 对话
  useEffect(() => {
    loadAIConversations();
  }, [loadAIConversations]);

  // 监听刷新触发器
  useEffect(() => {
    loadAIConversations();
  }, [refreshAIConversationsTrigger, loadAIConversations]);

  // 创建 AI 对话
  const handleCreateAIConversation = async () => {
    try {
      await createAIConversation();
      message.success('新建对话成功');
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
          await deleteAIConversation(id);
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
      <div className="flex-vertical-equal" ref={containerRef}>
        <CardListContext.Provider value={{ selectedId: selectedToolItemId ?? undefined }}>
          <div className="scrollable-list" ref={scrollableRef}>
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
