import React from 'react';
import { ThoughtChain } from '@ant-design/x';
import { Button, Space, Typography } from 'antd';
import { CheckOutlined, CloseOutlined, EditOutlined, LoadingOutlined } from '@ant-design/icons';
import type { ThoughtChainItemType } from '@ant-design/x';

import type { ChatItem } from '../types';
import type { AIStepStatus, AIToolApproval } from '../../../services/types';
import { getToolDraftDisplay } from '../approvalFlow';

const MarkdownRenderer = React.lazy(() =>
  import('./MarkdownRenderer').then((module) => ({
    default: module.MarkdownRenderer,
  })),
);

const { Text } = Typography;

function getRunStepStatusMeta(status: AIStepStatus): {
  status: 'loading' | 'success' | 'error' | 'abort';
  label: string;
  blink?: boolean;
} {
  switch (status) {
    case 'pending':
      return { status: 'loading', label: '待执行' };
    case 'running':
      return { status: 'loading', label: '执行中', blink: true };
    case 'waiting':
      return { status: 'loading', label: '等待处理', blink: true };
    case 'completed':
      return { status: 'success', label: '已完成' };
    case 'failed':
      return { status: 'error', label: '执行失败' };
    case 'skipped':
      return { status: 'abort', label: '已跳过' };
    default:
      return { status: 'abort', label: status };
  }
}

function getApprovalStatusMeta(status: AIToolApproval['status']): {
  status: 'loading' | 'success' | 'error' | 'abort';
  label: string;
  blink?: boolean;
} {
  switch (status) {
    case 'pending':
      return { status: 'loading', label: '等待确认', blink: true };
    case 'processing':
      return { status: 'loading', label: '执行中', blink: true };
    case 'executed':
      return { status: 'success', label: '已执行' };
    case 'denied':
      return { status: 'abort', label: '已拒绝' };
    case 'failed':
      return { status: 'error', label: '执行失败' };
    default:
      return { status: 'abort', label: status };
  }
}

function buildThoughtChainItems(args: {
  item: ChatItem;
  onRespondToolApproval: (approvalId: string, approved: boolean) => void;
}): ThoughtChainItemType[] {
  const { item, onRespondToolApproval } = args;
  const chainItems: ThoughtChainItemType[] = [];

  for (const step of item.runTrace?.steps ?? []) {
    if (step.kind === 'approval') {
      continue;
    }

    const meta = getRunStepStatusMeta(step.status);
    const artifactSummary = step.artifacts
      ?.map((artifact) => artifact.summary || artifact.title)
      .filter((artifact): artifact is string => Boolean(artifact));

    chainItems.push({
      key: `run_${item.runTrace?.runId}_${step.stepId}`,
      icon: <EditOutlined />,
      title: step.title,
      description: step.detail,
      status: meta.status,
      blink: meta.blink,
      collapsible: Boolean(artifactSummary?.length),
      content:
        artifactSummary && artifactSummary.length > 0 ? (
          <Space direction="vertical" size={4}>
            {artifactSummary.map((summary, index) => (
              <Text key={`${step.stepId}_artifact_${index}`} type="secondary">
                {summary}
              </Text>
            ))}
          </Space>
        ) : undefined,
      footer: (
        <Space wrap size={8}>
          <Text type="secondary">{meta.label}</Text>
        </Space>
      ),
    });
  }

  for (const draft of item.toolDrafts ?? []) {
    const draftDisplay = getToolDraftDisplay(draft);

    chainItems.push({
      key: draft.toolCallId,
      icon: <EditOutlined />,
      title: draftDisplay.title,
      description: draftDisplay.description,
      status: 'loading',
      blink: true,
      footer: (
        <Space wrap size={8}>
          <Text type="secondary">{draftDisplay.footerLabel}</Text>
        </Space>
      ),
    });
  }

  for (const approval of item.toolApprovals ?? []) {
    const meta = getApprovalStatusMeta(approval.status);

    chainItems.push({
      key: approval.toolCallId || approval.approvalId,
      icon: <EditOutlined />,
      title: approval.title,
      description: `${approval.description}${approval.targetLabel ? ` · 目标：${approval.targetLabel}` : ''}`,
      status: meta.status,
      blink: meta.blink,
      collapsible: Boolean(approval.preview || approval.resultSummary || approval.error),
      content: approval.preview ? (
        <React.Suspense
          fallback={
            <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {approval.preview}
            </div>
          }
        >
          <MarkdownRenderer
            content={approval.preview}
            streaming={
              item.isStreaming &&
              (approval.status === 'pending' || approval.status === 'processing')
                ? { hasNextChunk: true, enableAnimation: true }
                : undefined
            }
          />
        </React.Suspense>
      ) : undefined,
      footer: (
        <Space wrap size={8}>
          <Text type="secondary">{meta.label}</Text>
          {approval.resultSummary ? <Text type="secondary">{approval.resultSummary}</Text> : null}
          {approval.error ? <Text type="danger">{approval.error}</Text> : null}
          {approval.status === 'pending' ? (
            <>
              <Button
                type="primary"
                size="small"
                icon={<CheckOutlined />}
                onClick={() => onRespondToolApproval(approval.approvalId, true)}
              >
                批准执行
              </Button>
              <Button
                size="small"
                icon={<CloseOutlined />}
                onClick={() => onRespondToolApproval(approval.approvalId, false)}
              >
                拒绝
              </Button>
            </>
          ) : null}
          {approval.status === 'processing' ? (
            <>
              <LoadingOutlined />
              <Text type="secondary">正在等待 AI 完成这一步…</Text>
            </>
          ) : null}
        </Space>
      ),
    });
  }

  return chainItems;
}

interface ToolThoughtChainProps {
  item: ChatItem;
  onRespondToolApproval: (approvalId: string, approved: boolean) => void;
  withBottomSpacing?: boolean;
}

export const ToolThoughtChain: React.FC<ToolThoughtChainProps> = ({
  item,
  onRespondToolApproval,
  withBottomSpacing = false,
}) => {
  const items = React.useMemo(
    () => buildThoughtChainItems({ item, onRespondToolApproval }),
    [item, onRespondToolApproval],
  );

  if (!items.length) {
    return null;
  }

  return (
    <div style={{ marginBottom: withBottomSpacing ? 12 : 0 }}>
      <ThoughtChain
        items={items}
        defaultExpandedKeys={items
          .filter((chainItem) => chainItem.status === 'loading')
          .map((chainItem) => String(chainItem.key))}
      />
    </div>
  );
};

export default ToolThoughtChain;
