/**
 * AITab - AI 对话 Tab 页
 *
 * 统一承接 AI 工坊里的所有会话类型：
 * - workbench: 工坊独立对话
 * - note: 便签绑定对话
 * - global: 全局 AI 对话入口
 * - canvas: 当前只展示统一入口说明
 */

import { useCallback } from 'react';
import { Empty } from 'antd';
import { AIChatPanel } from '../../../../ai-chat';
import { useWorkspaceStore } from '../../../../../store/workspaceStore';
import type { AIWorkbenchConversationItem } from '../../../model/workbenchConversationItems';

interface AITabProps {
  selectedItem: AIWorkbenchConversationItem | null;
}

const CanvasOverview = () => (
  <div className="ai-tab-wrapper">
    <Empty
      image={Empty.PRESENTED_IMAGE_SIMPLE}
      description="画布 AI 当前仍在画布页内使用，这里先统一展示它的入口语义，不单独维护历史列表。"
      style={{ marginTop: 80 }}
    />
  </div>
);

export const AITab = ({ selectedItem }: AITabProps) => {
  const { triggerAIConversationsRefresh } = useWorkspaceStore();

  // 标题变更时刷新对话列表
  const handleTitleChange = useCallback(() => {
    triggerAIConversationsRefresh();
  }, [triggerAIConversationsRefresh]);

  if (!selectedItem) {
    return (
      <div className="ai-tab-wrapper">
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="从左侧选择一个 AI 会话入口" />
      </div>
    );
  }

  if (
    selectedItem.source === 'canvas' &&
    selectedItem.isSystemEntry &&
    !selectedItem.conversationId
  ) {
    return <CanvasOverview />;
  }

  return (
    <AIChatPanel
      conversationId={selectedItem.conversationId}
      conversationBinding={selectedItem.binding}
      title={selectedItem.title}
      onTitleChange={handleTitleChange}
      showTitleEditor={selectedItem.source !== 'canvas'}
      className="ai-tab-wrapper"
      source={selectedItem.source}
    />
  );
};

export default AITab;
