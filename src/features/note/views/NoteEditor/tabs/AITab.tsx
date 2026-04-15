/**
 * AITab - AI 对话 Tab 页
 *
 * 【组件职责】
 * 仅作为 AI 对话面板的轻量包装器
 * 用于在 NoteEditor 右侧显示 AI 对话
 *
 * 【布局说明】
 * 当 AI Tab 激活时，NoteEditor 会切换到左右分栏布局：
 * - 左侧：编辑器 (EditTab)
 * - 右侧：本组件 (AITab)
 */

import React, { useCallback } from 'react';
import { RobotOutlined } from '@ant-design/icons';
import { AIChatPanel } from '../../../../ai-chat';
import { useWorkspaceStore } from '../../../../../store/workspaceStore';
import './EmptyState.css';

/**
 * 空状态组件 - 当没有便签选中时显示
 */
const EmptyState: React.FC = () => (
  <div className="editor-empty-state">
    <RobotOutlined className="editor-empty-icon" />
    <p className="editor-empty-text">选择一个便签后可以与 AI 对话</p>
  </div>
);

interface AITabProps {
  noteId: string | null;
}

export const AITab: React.FC<AITabProps> = ({ noteId }) => {
  // Hooks 必须在任何条件返回之前调用
  const { triggerAIConversationsRefresh } = useWorkspaceStore();

  // 标题变更时刷新对话列表
  const handleTitleChange = useCallback(() => {
    triggerAIConversationsRefresh();
  }, [triggerAIConversationsRefresh]);

  // 没有选中便签时，显示空状态
  if (!noteId) {
    return <EmptyState />;
  }

  return (
    <AIChatPanel
      conversationId={null}
      conversationBinding={{ source: 'note', entityId: noteId }}
      onTitleChange={handleTitleChange}
      showTitleEditor={false}
      className="ai-tab-panel"
      source="note"
    />
  );
};

export default AITab;
