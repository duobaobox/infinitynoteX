/**
 * AITab - AI 对话 Tab 页
 *
 * 轻量级包装器，引用共享的 AIChatPanel 组件
 */

import { useCallback } from 'react';
import { AIChatPanel } from '../../../../components/AIChat';
import { useWorkspaceStore } from '../../../../store/workspaceStore';

interface AITabProps {
  conversationId: string | null;
}

export const AITab = ({ conversationId }: AITabProps) => {
  const { triggerAIConversationsRefresh } = useWorkspaceStore();

  // 标题变更时刷新对话列表
  const handleTitleChange = useCallback(() => {
    triggerAIConversationsRefresh();
  }, [triggerAIConversationsRefresh]);

  return (
    <AIChatPanel
      conversationId={conversationId}
      onTitleChange={handleTitleChange}
      showTitleEditor={true}
      className="ai-tab-wrapper"
    />
  );
};

export default AITab;
