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
 * 2. 用户点击对话卡片 → 设置结构化选中项 → 右侧编辑器加载对应对话
 * 3. 新建/删除对话 → 调用 store action → 刷新列表
 *
 * 【使用的共享组件】
 * - ConversationCard: 对话卡片组件
 * - CardListContext: 用于传递选中状态
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Input, Badge, Button, message, Popconfirm, Empty, Tooltip, Segmented } from 'antd';
import {
  AppstoreOutlined,
  PlusOutlined,
  DeleteOutlined,
  SearchOutlined,
  SortAscendingOutlined,
  SortDescendingOutlined,
  GlobalOutlined,
  MessageOutlined,
  FileTextOutlined,
  DeploymentUnitOutlined,
} from '@ant-design/icons';
import ConversationCard, {
  CardListContext,
} from '../../../../components/BaseCard/cards/ConversationCard';
import { useWorkspaceStore } from '../../../../store/workspaceStore';
import { useScrollOverflow } from '../../../../hooks/useScrollOverflow';
import { useThemeColor } from '../../../../hooks/useThemeColor';
import {
  AI_WORKBENCH_SOURCE_ORDER,
  type AIWorkbenchConversationItem,
  type AIWorkbenchConversationFilter,
  buildAIWorkbenchItems,
  getAIWorkbenchSourceLabel,
  matchesAIWorkbenchQuery,
  resolveAIWorkbenchSelection,
} from '../../model/workbenchConversationItems';

const FILTER_META: Record<
  AIWorkbenchConversationFilter,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  all: { label: '全部会话', icon: AppstoreOutlined },
  global: { label: '全局 AI', icon: GlobalOutlined },
  workbench: { label: '工坊对话', icon: MessageOutlined },
  note: { label: '便签对话', icon: FileTextOutlined },
  canvas: { label: '画布 AI', icon: DeploymentUnitOutlined },
};

interface ConversationListViewProps {
  /** 列表容器的 flex 值，由父组件传入 */
  flex: string | number;
}

/**
 * ConversationListView 主组件
 */
export const ConversationListView: React.FC<ConversationListViewProps> = ({ flex }) => {
  // ============ Store 状态 ============
  const aiConversations = useWorkspaceStore((state) => state.aiConversations);
  const selectedAIWorkbenchItem = useWorkspaceStore((state) => state.selectedAIWorkbenchItem);
  const refreshAIConversationsTrigger = useWorkspaceStore(
    (state) => state.refreshAIConversationsTrigger,
  );
  const createAIConversation = useWorkspaceStore((state) => state.createAIConversation);
  const deleteAIConversation = useWorkspaceStore((state) => state.deleteAIConversation);
  const loadAIConversations = useWorkspaceStore((state) => state.loadAIConversations);
  const setSelectedAIWorkbenchItem = useWorkspaceStore((state) => state.setSelectedAIWorkbenchItem);
  const resetEditorTab = useWorkspaceStore((state) => state.resetEditorTab);

  // ============ Hooks ============
  const themeColor = useThemeColor();
  const { scrollableRef, containerRef } = useScrollOverflow();
  const [searchQuery, setSearchQuery] = useState('');
  const FILTER_STORAGE_KEY = 'ai_list_source_filter';
  const [sourceFilter, setSourceFilter] = useState<AIWorkbenchConversationFilter>(() => {
    return (localStorage.getItem(FILTER_STORAGE_KEY) as AIWorkbenchConversationFilter) || 'all';
  });

  const STORAGE_KEY = 'ai_list_sort_order';
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(() => {
    return (localStorage.getItem(STORAGE_KEY) as 'asc' | 'desc') || 'asc';
  });

  const toggleSort = () => {
    setSortOrder((prev) => {
      const next = prev === 'asc' ? 'desc' : 'asc';
      localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  };

  const handleSourceFilterChange = (value: string | number) => {
    const nextFilter = value as AIWorkbenchConversationFilter;
    setSourceFilter(nextFilter);
    localStorage.setItem(FILTER_STORAGE_KEY, nextFilter);
  };

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
      const conversations = await window.storage.listAIConversationPreviews();
      if (conversations.length > 0) {
        const newestWorkbenchConversation = [...conversations]
          .filter((conversation) => !conversation.source || conversation.source === 'workbench')
          .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0];

        if (newestWorkbenchConversation) {
          const selectedItem = resolveAIWorkbenchSelection(
            newestWorkbenchConversation.id,
            conversations,
          );
          if (selectedItem) {
            setSelectedAIWorkbenchItem(selectedItem);
          }
          resetEditorTab();
        }
      }
    } catch (error) {
      console.error('Failed to create AI conversation:', error);
      message.error('创建对话失败');
    }
  };

  /** 删除对话或系统入口对应的历史 */
  const handleDeleteAIConversation = async (item: AIWorkbenchConversationItem) => {
    try {
      if (item.source === 'global' && item.isSystemEntry) {
        const globalConversationIds = aiConversations
          .filter((conversation) => conversation.source === 'global')
          .map((conversation) => conversation.id);

        await Promise.all(globalConversationIds.map((id) => deleteAIConversation(id)));
        return;
      }

      if (!item.conversationId) {
        return;
      }

      await deleteAIConversation(item.conversationId);
    } catch (error) {
      console.error('Failed to delete AI conversation:', error);
      message.error('删除对话失败');
    }
  };

  // ============ 派生数据 ============

  const workbenchItems = useMemo(
    () => buildAIWorkbenchItems(aiConversations, sortOrder),
    [aiConversations, sortOrder],
  );

  const visibleItems = useMemo(
    () =>
      workbenchItems.filter((item) => {
        if (sourceFilter !== 'all' && item.source !== sourceFilter) {
          return false;
        }

        return matchesAIWorkbenchQuery(item, searchQuery);
      }),
    [searchQuery, sourceFilter, workbenchItems],
  );

  const sourceSections = useMemo(
    () =>
      AI_WORKBENCH_SOURCE_ORDER.map((source) => ({
        source,
        label: getAIWorkbenchSourceLabel(source),
        items: visibleItems.filter((item) => item.source === source),
      })).filter((section) => section.items.length > 0),
    [visibleItems],
  );

  const sourceCounts = useMemo(() => {
    return AI_WORKBENCH_SOURCE_ORDER.reduce<Record<string, number>>(
      (acc, source) => {
        acc[source] = workbenchItems.filter((item) => item.source === source).length;
        return acc;
      },
      { all: workbenchItems.length },
    );
  }, [workbenchItems]);

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
            AI会话
          </span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Badge count={visibleItems.length} showZero style={{ backgroundColor: themeColor }} />
            <Tooltip title={sortOrder === 'asc' ? '当前：旧→新' : '当前：新→旧'}>
              <Button
                type="text"
                size="small"
                icon={sortOrder === 'asc' ? <SortAscendingOutlined /> : <SortDescendingOutlined />}
                onClick={toggleSort}
              />
            </Tooltip>
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
        <Segmented
          block
          size="small"
          className="ai-workbench-icon-segmented"
          value={sourceFilter}
          onChange={handleSourceFilterChange}
          options={(['all', ...AI_WORKBENCH_SOURCE_ORDER] as AIWorkbenchConversationFilter[]).map(
            (key) => {
              const { label, icon: Icon } = FILTER_META[key];

              return {
                value: key,
                label: (
                  <Tooltip title={`${label} · ${sourceCounts[key] ?? 0}`}>
                    <span className="ai-workbench-segmented-icon" aria-label={label}>
                      <Icon />
                    </span>
                  </Tooltip>
                ),
              };
            },
          )}
        />
      </div>

      {/* 列表区域 */}
      <div className="flex-vertical-equal" ref={containerRef}>
        <CardListContext.Provider value={{ selectedId: selectedAIWorkbenchItem?.id ?? undefined }}>
          <div className="scrollable-list ai-workbench-list" ref={scrollableRef}>
            {sourceSections.length === 0 ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  searchQuery
                    ? '没有找到匹配的会话入口'
                    : sourceFilter === 'canvas'
                      ? '画布 AI 当前只保留统一入口，没有独立历史列表'
                      : '点击 + 开始新对话'
                }
                style={{ marginTop: 40 }}
              />
            ) : (
              sourceSections.map((section) => (
                <React.Fragment key={section.source}>
                  <div className="ai-workbench-section-label">
                    <span>{section.label}</span>
                    <span>{section.items.length}</span>
                  </div>
                  {section.items.map((session) => (
                    <ConversationCard
                      key={session.id}
                      title={session.title}
                      content={session.excerpt}
                      source={session.source}
                      onClick={() => {
                        setSelectedAIWorkbenchItem(session);
                        resetEditorTab();
                      }}
                      actions={
                        session.deletable && session.conversationId ? (
                          <Popconfirm
                            title={session.source === 'global' ? '清空全局对话历史' : '删除对话'}
                            description={
                              session.source === 'global'
                                ? '删除后会保留全局入口，下次发消息会自动重新创建会话。'
                                : `确定删除“${session.title}”吗？`
                            }
                            onConfirm={(e) => {
                              e?.stopPropagation();
                              handleDeleteAIConversation(session);
                            }}
                            okText="删除"
                            cancelText="取消"
                            placement="right"
                          >
                            <Button
                              type="text"
                              size="small"
                              icon={<DeleteOutlined />}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </Popconfirm>
                        ) : null
                      }
                      id={session.id}
                    />
                  ))}
                </React.Fragment>
              ))
            )}
          </div>
        </CardListContext.Provider>
      </div>
    </div>
  );
};
