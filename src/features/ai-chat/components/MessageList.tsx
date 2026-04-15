import React from 'react';
import { Bubble, Actions, FileCard } from '@ant-design/x';
import { Avatar } from 'antd';
import { RobotOutlined, UserOutlined, CopyOutlined, SaveOutlined } from '@ant-design/icons';
import type { GetProp } from 'antd';
import { EmptyState } from './EmptyState';
import type { ChatItem, NoteReference } from '../types';

const MarkdownRenderer = React.lazy(() =>
  import('./MarkdownRenderer').then((module) => ({
    default: module.MarkdownRenderer,
  })),
);

// Bubble.List 类型
type BubbleListItem = NonNullable<GetProp<typeof Bubble.List, 'items'>>[number];

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
}) => {
  // 转换为 Bubble.List items - 必须在所有条件返回之前调用
  const bubbleItems = React.useMemo(() => {
    return items.map((m) => {
      const isCopied = copiedBubbleKey === m.key;

      // AI 消息的操作按钮
      const actionItems =
        m.role === 'ai'
          ? [
              {
                key: 'copy',
                icon: <CopyOutlined />,
                label: isCopied ? '已复制' : '复制',
              },
              {
                key: 'save',
                icon: <SaveOutlined />,
                label: '保存到便签',
              },
            ]
          : [];

      const item: BubbleListItem = {
        key: m.key,
        role: m.role,
        content: m.content,
        placement: m.role === 'ai' ? 'start' : 'end', // AI在左，用户在右
        contentRender: (content) => {
          // 用户消息：过滤掉便签上下文，只显示用户输入
          const displayContent =
            m.role === 'user'
              ? (content as string)
                  .replace(/\n\n以下是用户引用的便签内容，请结合这些内容回答：[\s\S]*/g, '')
                  .trim()
              : content;

          // AI 消息：传递 ragSources 用于引用展示
          const sources = m.role === 'ai' && m.ragSources ? m.ragSources : undefined;

          const isUser = m.role === 'user';

          return (
            <>
              {isUser ? (
                <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {displayContent}
                </div>
              ) : (
                <React.Suspense
                  fallback={<div style={{ whiteSpace: 'pre-wrap' }}>{displayContent}</div>}
                >
                  <MarkdownRenderer
                    content={displayContent as string}
                    streaming={
                      m.isStreaming ? { hasNextChunk: true, enableAnimation: true } : undefined
                    }
                    sources={sources}
                  />
                </React.Suspense>
              )}

              {/* 用户消息显示引用的便签 FileCard */}
              {isUser && m.references && m.references.length > 0 && (
                <div
                  className="ai-chat-reference-cards"
                  style={{ marginTop: 8, maxWidth: '100%', overflow: 'hidden' }}
                >
                  {m.references.map((ref: NoteReference) => (
                    <FileCard
                      key={ref.id}
                      name={`${ref.title}.md`}
                      byte={ref.byteLength}
                      icon="markdown"
                      size="small"
                      style={{ width: '100%' }}
                    />
                  ))}
                </div>
              )}
            </>
          );
        },
        avatar:
          m.role === 'ai' ? (
            <Avatar icon={<RobotOutlined />} style={{ backgroundColor: '#1890ff' }} />
          ) : (
            <Avatar icon={<UserOutlined />} style={{ backgroundColor: '#52c41a' }} />
          ),
      };

      if (m.role === 'ai') {
        item.footer = (content) => (
          <Actions
            items={actionItems}
            onClick={({ key }) => {
              if (key === 'copy') {
                onCopyAnswer(m);
              } else if (key === 'save') {
                onSaveToNote(content as string);
              }
            }}
          />
        );

        // Actions 按钮位置配置
        item.footerPlacement = 'outer-end';

        if (!m.content.trim() && m.isStreaming) {
          item.loading = true;
        } else if (m.isStreaming && m.content.trim()) {
          item.typing = { effect: 'typing', step: 5, interval: 50 };
        }
      }

      return item;
    });
  }, [items, copiedBubbleKey, onCopyAnswer, onSaveToNote]);

  // 初始化中
  if (isInitializing) {
    return (
      <div className="ai-chat-messages-empty">
        <div style={{ textAlign: 'center', color: '#999' }}>初始化中...</div>
      </div>
    );
  }

  // 没有选中对话，显示空状态
  if (!conversationId && !hasConversationContext) {
    return <EmptyState />;
  }

  return (
    <div className="ai-chat-messages">
      {isLoadingHistory ? (
        // 加载历史时显示简单的 loading 状态（不显示空状态，避免闪烁）
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
