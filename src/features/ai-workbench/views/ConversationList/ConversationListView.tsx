/**
 * ConversationListView - AI 对话列表视图组件
 *
 * 【组件职责】
 * - 展示 AI 对话列表
 * - 支持新建、删除、搜索对话
 * - 作为 AI Workbench 的左侧列表区
 *
 * 【数据流】
 * 1. 从 workspaceStore 获取对话列表 (aiConversations)
 * 2. 用户点击对话卡片 → 设置 selectedToolItemId → 右侧编辑器加载对应对话
 * 3. 新建/删除对话 → 调用 store action → 刷新列表
 *
 * 【使用的共享组件】
 * - ConversationCard: 对话卡片组件
 * - CardListContext: 用于传递选中状态
 */

import React, { useEffect } from 'react';
import { Input, Badge, Button, message, Modal, Empty } from 'antd';
import { PlusOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons';
import ConversationCard, {
  CardListContext,
} from '../../../../components/BaseCard/cards/ConversationCard';
import { useWorkspaceStore } from '../../../../store/workspaceStore';
import { useScrollOverflow } from '../../../../hooks/useScrollOverflow';
import { useThemeColor } from '../../../../hooks/useThemeColor';

interface ConversationListViewProps {
  /** 列表容器的 flex 值，由父组件传入 */
  flex: string | number;
}

/**
 * ConversationListView 主组件
 */
export const ConversationListView: React.FC<ConversationListViewProps> = ({ flex }) => {
  // ============ Store 状态 ============
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

  // ============ Hooks ============
  const themeColor = useThemeColor();
  const { scrollableRef, containerRef } = useScrollOverflow();
  const [searchQuery, setSearchQuery] = React.useState('');

  // ============ 副作用 ============

  // 初始化加载 AI 对话列表
  useEffect(() => {
    loadAIConversations();
  }, [loadAIConversations]);

  // 监听刷新触发器（标题变更等场景）
  useEffect(() => {
    loadAIConversations();
  }, [refreshAIConversationsTrigger, loadAIConversations]);

  // ============ 事件处理 ============

  /** 创建新对话 */
  const handleCreateAIConversation = async () => {
    try {
      await createAIConversation();
      message.success('新建对话成功');
      // 创建后自动选中新对话（按 createdAt 最新的）
      const conversations = await window.storage.getAIConversations();
      if (conversations.length > 0) {
        // 找到 createdAt 最新的对话
        const newestConversation = conversations.reduce((newest, current) =>
          (current.createdAt || 0) > (newest.createdAt || 0) ? current : newest,
        );
        setSelectedToolItem(newestConversation.id);
      }
    } catch (error) {
      console.error('Failed to create AI conversation:', error);
      message.error('创建对话失败');
    }
  };

  /** 删除对话 */
  const handleDeleteAIConversation = async (id: string, title: string) => {
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

  // ============ 派生数据 ============

  // 根据搜索关键词过滤对话列表
  const filteredAiConversations = aiConversations.filter((item) =>
    item.title.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // ============ 主渲染 ============

  return (
    <div className="layout-panel list-container" style={{ flex }}>
      {/* 头部区域：标题 + 操作按钮 */}
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
        {/* 搜索框 */}
        <Input
          allowClear
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="搜索AI对话"
          prefix={<SearchOutlined style={{ color: '#bfbfbf', fontSize: 16 }} />}
          style={{ width: '100%' }}
        />
      </div>

      {/* 列表区域 */}
      <div className="flex-vertical-equal" ref={containerRef}>
        <CardListContext.Provider value={{ selectedId: selectedToolItemId ?? undefined }}>
          <div className="scrollable-list" ref={scrollableRef}>
            {filteredAiConversations.length === 0 ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={searchQuery ? '没有找到匹配的对话' : '点击 + 开始新对话'}
                style={{ marginTop: 40 }}
              />
            ) : (
              filteredAiConversations.map((session) => (
                <ConversationCard
                  key={session.id}
                  title={session.title}
                  content={session.excerpt}
                  onClick={() => {
                    setSelectedToolItem(session.id);
                    resetEditorTab(); // 切换对话时重置 Tab 到默认
                  }}
                  actions={
                    <Button
                      type="text"
                      size="small"
                      icon={<DeleteOutlined />}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteAIConversation(session.id, session.title);
                      }}
                    />
                  }
                  id={session.id}
                />
              ))
            )}
          </div>
        </CardListContext.Provider>
      </div>
    </div>
  );
};
