import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ToolThoughtChain } from '../../../../src/features/ai-chat/components/ToolThoughtChain';
import type { ChatItem } from '../../../../src/features/ai-chat/types';

vi.mock('antd', () => ({
  Button: ({ children, onClick }: { children?: React.ReactNode; onClick?: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
  Space: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Typography: {
    Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
  },
}));

vi.mock('@ant-design/x', () => ({
  ThoughtChain: ({
    items,
    defaultExpandedKeys,
  }: {
    items: Array<Record<string, unknown>>;
    defaultExpandedKeys?: string[];
  }) => (
    <div data-testid="thought-chain" data-expanded-keys={defaultExpandedKeys?.join(',') ?? ''}>
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
  MarkdownRenderer: ({ content }: { content: string }) => <div>{content}</div>,
}));

describe('ToolThoughtChain', () => {
  it('renders run steps without crashing when command-like tools are present', () => {
    const item: ChatItem = {
      key: 'ai-run-1',
      role: 'ai',
      content: '',
      timestamp: Date.now(),
      isStreaming: false,
      runTrace: {
        requestId: 'request-1',
        runId: 'run-1',
        steps: [
          {
            stepId: 'step-1',
            kind: 'tool',
            title: 'run_command',
            detail: '执行终端命令',
            status: 'completed',
            startedAt: 1,
            endedAt: 1200,
          },
        ],
      },
    };

    render(
      <ToolThoughtChain
        item={item}
        onRespondToolApproval={() => undefined}
        withBottomSpacing={false}
      />,
    );

    expect(screen.getAllByTestId('thought-chain')).toHaveLength(2);
    expect(screen.getByText('已完成工具调度操作')).toBeInTheDocument();
    expect(screen.getByText('执行终端系统命令 (1.2s)')).toBeInTheDocument();
  });
});
