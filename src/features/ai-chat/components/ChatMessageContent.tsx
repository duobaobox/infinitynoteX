import React from 'react';
import { FileCard } from '@ant-design/x';

import type { ChatItem, NoteReference } from '../types';
import { stripThinkBlocks } from '../../../shared/utils/tiptapMarkdown';
import { isApprovalPlaceholderContent } from '../approvalFlow';

const MarkdownRenderer = React.lazy(() =>
  import('./MarkdownRenderer').then((module) => ({
    default: module.MarkdownRenderer,
  })),
);

function getVisibleUserMessageContent(content: string): string {
  return content.replace(/\n\n以下是用户引用的便签内容，请结合这些内容回答：[\s\S]*/g, '').trim();
}

interface ChatMessageContentProps {
  item: ChatItem;
}

export const ChatMessageContent: React.FC<ChatMessageContentProps> = ({ item }) => {
  if (item.role === 'user') {
    const visibleContent = getVisibleUserMessageContent(item.content);

    return (
      <>
        {visibleContent ? (
          <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{visibleContent}</div>
        ) : null}

        {item.references && item.references.length > 0 ? (
          <div
            className="ai-chat-reference-cards"
            style={{ marginTop: 8, maxWidth: '100%', overflow: 'hidden' }}
          >
            {item.references.map((ref: NoteReference) => (
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
        ) : null}
      </>
    );
  }

  const aiDisplayContent = item.content;
  const aiFallbackContent = stripThinkBlocks(aiDisplayContent);
  const shouldRenderMarkdown =
    aiDisplayContent.trim().length > 0 &&
    !isApprovalPlaceholderContent(aiDisplayContent, item.toolApprovals);

  if (!shouldRenderMarkdown) {
    return null;
  }

  return (
    <React.Suspense fallback={<div style={{ whiteSpace: 'pre-wrap' }}>{aiFallbackContent}</div>}>
      <MarkdownRenderer
        content={aiDisplayContent}
        streaming={item.isStreaming ? { hasNextChunk: true, enableAnimation: true } : undefined}
        sources={item.ragSources}
      />
    </React.Suspense>
  );
};

export default ChatMessageContent;
