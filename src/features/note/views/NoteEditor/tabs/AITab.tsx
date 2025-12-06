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
import { AIChatPanel } from '../../../../../components/AIChat';
import { useWorkspaceStore } from '../../../../../store/workspaceStore';

interface AITabProps {
  noteId: string | null;
}

export const AITab: React.FC<AITabProps> = ({ noteId }) => {
  const { triggerAIConversationsRefresh } = useWorkspaceStore();

  // 标题变更时刷新对话列表
  const handleTitleChange = useCallback(() => {
    triggerAIConversationsRefresh();
  }, [triggerAIConversationsRefresh]);

  return (
    <AIChatPanel
      conversationId={noteId}
      onTitleChange={handleTitleChange}
      showTitleEditor={false}
      className="ai-tab-panel"
    />
  );
};

export default AITab;
