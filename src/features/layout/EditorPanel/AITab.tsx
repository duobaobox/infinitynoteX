/**
 * AITab - AI 工作台 Tab 页
 *
 * 使用 AIChatPanel 组件渲染 AI 对话界面。
 * 负责从 Store 获取对话 ID 并传递给 AIChatPanel。
 */

import { useCallback } from 'react';
import { AIChatPanel } from '../../../components/AIChat';
import { useWorkspaceStore } from '../../../store/workspaceStore';
import './AITab.css';

interface AITabProps {
  noteId: string | null;
}

export const AITab = ({ noteId }: AITabProps) => {
  const { triggerAIConversationsRefresh } = useWorkspaceStore();

  // 标题变更时刷新对话列表
  const handleTitleChange = useCallback(() => {
    triggerAIConversationsRefresh();
  }, [triggerAIConversationsRefresh]);

  return (
    <AIChatPanel
      conversationId={noteId}
      onTitleChange={handleTitleChange}
      showTitleEditor={true}
      className="ai-tab-wrapper"
    />
  );
};

export default AITab;
