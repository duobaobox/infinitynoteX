import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { MessageList } from '../../../../src/features/ai-chat/components/MessageList';
import type { ChatItem } from '../../../../src/features/ai-chat/types';

vi.mock('antd', () => ({
  Avatar: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Button: ({ children, onClick }: { children?: React.ReactNode; onClick?: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
  Space: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Typography: {
    Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
  },
}));

vi.mock('@ant-design/x', () => ({
  Bubble: {
    List: ({
      items,
      autoScroll,
      rootClassName,
      classNames,
    }: {
      items: Array<Record<string, unknown>>;
      autoScroll?: boolean;
      rootClassName?: string;
      classNames?: { scroll?: string };
    }) => (
      <div
        data-testid="bubble-list"
        data-auto-scroll={String(Boolean(autoScroll))}
        data-root-class={rootClassName ?? ''}
        data-scroll-class={classNames?.scroll ?? ''}
      >
        {items.map((item) => (
          <div key={String(item.key)}>
            {typeof item.contentRender === 'function'
              ? item.contentRender(item.content)
              : item.content}
          </div>
        ))}
      </div>
    ),
  },
  Actions: () => null,
  FileCard: () => null,
  ThoughtChain: ({ items }: { items: Array<Record<string, unknown>> }) => (
    <div>
      {items.map((item) => (
        <div key={String(item.key)}>
          <div>{item.title as React.ReactNode}</div>
          <div>{item.description as React.ReactNode}</div>
          {item.content as React.ReactNode}
          {item.footer as React.ReactNode}
        </div>
      ))}
    </div>
  ),
}));

vi.mock('../../../../src/features/ai-chat/components/MarkdownRenderer', () => ({
  MarkdownRenderer: ({
    content,
    streaming,
  }: {
    content: string;
    streaming?: { hasNextChunk?: boolean; enableAnimation?: boolean };
  }) => (
    <div
      data-testid="markdown-renderer"
      data-content={content}
      data-streaming={streaming ? 'true' : 'false'}
    >
      {content}
    </div>
  ),
}));

describe('MessageList', () => {
  it('shows a loading thought-chain item while the approval-required tool input is still being prepared', () => {
    const items: ChatItem[] = [
      {
        key: 'ai-draft-1',
        role: 'ai',
        content: '',
        timestamp: Date.now(),
        isStreaming: true,
        toolDrafts: [
          {
            toolCallId: 'tool-call-draft-1',
            toolName: 'saveToNote',
            inputText: '{"title":"产品规划"',
          },
        ],
      },
    ];

    render(
      <MessageList
        isLoadingHistory={false}
        isInitializing={false}
        isConfigured={true}
        hasConversationContext={true}
        conversationId="conversation-draft-1"
        items={items}
        copiedBubbleKey={null}
        onCopyAnswer={() => undefined}
        onSaveToNote={() => undefined}
        onRespondToolApproval={() => undefined}
      />,
    );

    expect(screen.getByText('正在准备新建便签')).toBeInTheDocument();
    expect(screen.getByText('正在整理待确认内容…')).toBeInTheDocument();
  });

  it('renders tool approval preview with MarkdownRenderer and forwards streaming state', async () => {
    const items: ChatItem[] = [
      {
        key: 'ai-1',
        role: 'ai',
        content: '',
        timestamp: Date.now(),
        isStreaming: true,
        toolApprovals: [
          {
            approvalId: 'approval-1',
            toolCallId: 'tool-call-1',
            toolName: 'saveToNote',
            title: '建议新建便签《测试》',
            description: 'AI 想把当前内容保存成便签。',
            status: 'pending',
            preview: '# 标题\n\n- 列表项',
          },
        ],
      },
    ];

    render(
      <MessageList
        isLoadingHistory={false}
        isInitializing={false}
        isConfigured={true}
        hasConversationContext={true}
        conversationId="conversation-1"
        items={items}
        copiedBubbleKey={null}
        onCopyAnswer={() => undefined}
        onSaveToNote={() => undefined}
        onRespondToolApproval={() => undefined}
      />,
    );

    const preview = await screen.findByTestId('markdown-renderer');
    expect(preview).toHaveAttribute('data-content', '# 标题\n\n- 列表项');
    expect(preview).toHaveAttribute('data-streaming', 'true');
  });

  it('does not keep markdown in streaming mode after the run trace is completed', async () => {
    const items: ChatItem[] = [
      {
        key: 'ai-completed-1',
        role: 'ai',
        content: '最终回答',
        timestamp: Date.now(),
        isStreaming: true,
        runTrace: {
          requestId: 'request-completed-1',
          runId: 'run-completed-1',
          status: 'completed',
          input: '生成回答',
          startedAt: 1,
          endedAt: 2,
          artifacts: [],
          steps: [],
        },
      },
    ];

    render(
      <MessageList
        isLoadingHistory={false}
        isInitializing={false}
        isConfigured={true}
        hasConversationContext={true}
        conversationId="conversation-completed-1"
        items={items}
        copiedBubbleKey={null}
        onCopyAnswer={() => undefined}
        onSaveToNote={() => undefined}
        onRespondToolApproval={() => undefined}
      />,
    );

    const markdown = await screen.findByTestId('markdown-renderer');
    expect(markdown).toHaveAttribute('data-content', '最终回答');
    expect(markdown).toHaveAttribute('data-streaming', 'false');
  });

  it('passes Bubble.List auto-scroll classes to the internal scroll container', () => {
    const items: ChatItem[] = [
      {
        key: 'user-1',
        role: 'user',
        content: '最新提问',
        timestamp: Date.now(),
      },
    ];

    render(
      <MessageList
        isLoadingHistory={false}
        isInitializing={false}
        isConfigured={true}
        hasConversationContext={true}
        conversationId="conversation-2"
        items={items}
        copiedBubbleKey={null}
        onCopyAnswer={() => undefined}
        onSaveToNote={() => undefined}
        onRespondToolApproval={() => undefined}
      />,
    );

    const bubbleList = screen.getByTestId('bubble-list');
    expect(bubbleList).toHaveAttribute('data-auto-scroll', 'true');
    expect(bubbleList).toHaveAttribute('data-root-class', 'ai-chat-bubble-list');
    expect(bubbleList).toHaveAttribute('data-scroll-class', 'ai-chat-bubble-list-scroll');
  });
});
