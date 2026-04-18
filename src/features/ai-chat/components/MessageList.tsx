import React from 'react';
import { Bubble } from '@ant-design/x';

import { EmptyState } from './EmptyState';
import type { ChatItem } from '../types';
import { buildBubbleItems } from '../model/messageListModel';

interface MessageListProps {
  isLoadingHistory: boolean;
  isInitializing: boolean;
  isConfigured: boolean;
  hasConversationContext: boolean;
  conversationId: string | null;
  items: ChatItem[];
  copiedBubbleKey: string | null;
  onCopyAnswer: (item: ChatItem) => void;
  onSaveToNote: (content: string) => void;
  onRespondToolApproval: (approvalId: string, approved: boolean) => void;
}

export const MessageList: React.FC<MessageListProps> = ({
  isLoadingHistory,
  isInitializing,
  hasConversationContext,
  conversationId,
  items,
  copiedBubbleKey,
  onCopyAnswer,
  onSaveToNote,
  onRespondToolApproval,
}) => {
  const bubbleItems = React.useMemo(
    () =>
      buildBubbleItems({
        items,
        copiedBubbleKey,
        onCopyAnswer,
        onSaveToNote,
        onRespondToolApproval,
      }),
    [items, copiedBubbleKey, onCopyAnswer, onSaveToNote, onRespondToolApproval],
  );

  if (isInitializing) {
    return (
      <div className="ai-chat-messages-empty">
        <div style={{ textAlign: 'center', color: '#999' }}>初始化中...</div>
      </div>
    );
  }

  if (!conversationId && !hasConversationContext) {
    return <EmptyState />;
  }

  return (
    <div className="ai-chat-messages">
      {isLoadingHistory ? (
        <div className="ai-chat-messages-empty">
          <p style={{ fontSize: '12px', color: '#999' }}>加载中...</p>
        </div>
      ) : bubbleItems.length === 0 ? (
        <div className="ai-chat-messages-empty">
          <p style={{ fontSize: '14px' }}>开始对话，与 AI 互动</p>
          <p style={{ fontSize: '12px', color: '#999' }}>输入你的问题，AI 将为你答疑解惑</p>
        </div>
      ) : (
        <Bubble.List items={bubbleItems} />
      )}
    </div>
  );
};

export default MessageList;
