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
    expandedKeys,
  }: {
    items: Array<Record<string, unknown>>;
    defaultExpandedKeys?: string[];
    expandedKeys?: string[];
  }) => (
    <MockThoughtChain
      items={items}
      defaultExpandedKeys={defaultExpandedKeys}
      expandedKeys={expandedKeys}
    />
  ),
}));

vi.mock('../../../../src/features/ai-chat/components/MarkdownRenderer', () => ({
  MarkdownRenderer: ({ content }: { content: string }) => <div>{content}</div>,
}));

function MockThoughtChain({
  items,
  defaultExpandedKeys,
  expandedKeys,
}: {
  items: Array<Record<string, unknown>>;
  defaultExpandedKeys?: string[];
  expandedKeys?: string[];
}) {
  const [internalExpandedKeys] = React.useState(defaultExpandedKeys ?? []);
  const mergedExpandedKeys = expandedKeys ?? internalExpandedKeys;

  return (
    <div data-testid="thought-chain" data-expanded-keys={mergedExpandedKeys.join(',')}>
      {items.map((item) => (
        <div key={String(item.key)}>
          <div>{item.title as React.ReactNode}</div>
          <div>{item.description as React.ReactNode}</div>
          {item.content as React.ReactNode}
          {item.footer as React.ReactNode}
        </div>
      ))}
    </div>
  );
}

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

  it('renders completed runs as success even when skipped steps are present', () => {
    const item: ChatItem = {
      key: 'ai-run-2',
      role: 'ai',
      content: '',
      timestamp: Date.now(),
      isStreaming: false,
      runTrace: {
        requestId: 'request-2',
        runId: 'run-2',
        status: 'completed',
        input: '什么是羊群效应',
        startedAt: 1,
        endedAt: 2,
        artifacts: [],
        steps: [
          {
            stepId: 'retrieval',
            kind: 'retrieval',
            title: '准备检索上下文',
            status: 'skipped',
            detail: '主动检索已关闭，本轮不会自动扩展知识上下文。',
            startedAt: 1,
            endedAt: 2,
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

    expect(screen.getByText('已完成工具调度操作')).toBeInTheDocument();
    expect(screen.queryByText('执行遭遇意外，流程已中断')).not.toBeInTheDocument();
  });

  it('collapses the root thought chain when a running response completes', () => {
    const runningItem: ChatItem = {
      key: 'ai-run-3',
      role: 'ai',
      content: '',
      timestamp: Date.now(),
      isStreaming: true,
      runTrace: {
        requestId: 'request-3',
        runId: 'run-3',
        status: 'running',
        steps: [
          {
            stepId: 'step-1',
            kind: 'tool',
            title: '生成回答',
            detail: '正在生成回答。',
            status: 'running',
            startedAt: 1,
          },
        ],
      },
    };

    const completedItem: ChatItem = {
      ...runningItem,
      isStreaming: false,
      runTrace: {
        ...runningItem.runTrace!,
        status: 'completed',
        steps: [
          {
            stepId: 'step-1',
            kind: 'tool',
            title: '生成回答',
            detail: '回答生成完成。',
            status: 'completed',
            startedAt: 1,
            endedAt: 2,
          },
        ],
      },
    };

    const { rerender } = render(
      <ToolThoughtChain
        item={runningItem}
        onRespondToolApproval={() => undefined}
        withBottomSpacing={false}
      />,
    );

    expect(screen.getAllByTestId('thought-chain')[0]).toHaveAttribute(
      'data-expanded-keys',
      'main_trace',
    );

    rerender(
      <ToolThoughtChain
        item={completedItem}
        onRespondToolApproval={() => undefined}
        withBottomSpacing={false}
      />,
    );

    expect(screen.getAllByTestId('thought-chain')[0]).toHaveAttribute('data-expanded-keys', '');
  });

  it('treats a completed run trace as final even if the request streaming flag is stale', () => {
    const item: ChatItem = {
      key: 'ai-run-4',
      role: 'ai',
      content: '已完成',
      timestamp: Date.now(),
      isStreaming: true,
      runTrace: {
        requestId: 'request-4',
        runId: 'run-4',
        status: 'completed',
        input: '生成任务',
        startedAt: 1,
        endedAt: 2,
        artifacts: [],
        steps: [
          {
            stepId: 'generation',
            kind: 'generation',
            title: '生成回答',
            detail: '回答生成完成。',
            status: 'completed',
            startedAt: 1,
            endedAt: 2,
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

    expect(screen.getByText('已完成工具调度操作')).toBeInTheDocument();
    expect(screen.queryByText('正在执行深度思考与操作...')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('thought-chain')[0]).toHaveAttribute('data-expanded-keys', '');
  });

  it('derives completion when a stale running trace only contains finished work', () => {
    const item: ChatItem = {
      key: 'ai-run-5',
      role: 'ai',
      content: '已为你创建待办任务',
      timestamp: Date.now(),
      isStreaming: false,
      runTrace: {
        requestId: 'request-5',
        runId: 'run-5',
        status: 'running',
        input: '创建任务',
        startedAt: 1,
        artifacts: [],
        steps: [
          {
            stepId: 'planning',
            kind: 'planning',
            title: '分析请求并规划执行',
            detail: '工具调用可用。',
            status: 'completed',
            startedAt: 1,
            endedAt: 2,
          },
          {
            stepId: 'retrieval',
            kind: 'retrieval',
            title: '准备检索上下文',
            detail: '主动检索已关闭。',
            status: 'skipped',
            startedAt: 1,
            endedAt: 2,
          },
        ],
      },
      toolApprovals: [
        {
          approvalId: 'approval-1',
          toolCallId: 'tool-1',
          toolName: 'createManualTask',
          title: '建议创建任务“测试审批后 UI 收尾”',
          description: 'AI 想把当前结论落成待办。',
          status: 'executed',
          resultSummary: '已创建到 默认任务清单',
        },
      ],
    };

    render(
      <ToolThoughtChain
        item={item}
        onRespondToolApproval={() => undefined}
        withBottomSpacing={false}
      />,
    );

    expect(screen.getByText('已完成工具调度操作')).toBeInTheDocument();
    expect(screen.queryByText('正在执行深度思考与操作...')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('thought-chain')[0]).toHaveAttribute('data-expanded-keys', '');
  });
});
