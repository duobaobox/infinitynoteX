import React from 'react';
import { ThoughtChain } from '@ant-design/x';
import { Button, Space, Typography } from 'antd';
import {
  ApiOutlined,
  BulbOutlined,
  CheckOutlined,
  CloseOutlined,
  CodeOutlined,
  ConsoleSqlOutlined,
  EditOutlined,
  FileTextOutlined,
  LoadingOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  ToolOutlined,
} from '@ant-design/icons';
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

function translateToolTitle(title: string): string {
  const lowerTitle = title.toLowerCase();
  if (lowerTitle.includes('run_command') || lowerTitle.includes('bash')) return '执行终端系统命令';
  if (lowerTitle.includes('view_file') || lowerTitle.includes('read_file'))
    return '查看本地文件内容';
  if (lowerTitle.includes('replace_file_content')) return '局部重构并修改文件';
  if (lowerTitle.includes('grep_search') || lowerTitle.includes('search_code'))
    return '在当前工作区全文搜索';
  if (lowerTitle.includes('read_url_content')) return '抓取目标网页分析';
  if (lowerTitle.includes('search_web')) return '检索外部网页资料';
  if (lowerTitle.includes('browser_subagent')) return '唤起浏览器智能体';
  if (lowerTitle.includes('generate_image')) return '生成图像内容';
  if (lowerTitle.includes('list_dir')) return '浏览目录内容';
  if (lowerTitle.includes('write_to_file')) return '创建或覆盖文件';
  if (lowerTitle.includes('ask_question')) return '向用户提问';
  return title;
}

function formatDuration(startedAt?: number, endedAt?: number): string | null {
  if (!startedAt || !endedAt) return null;
  const seconds = (endedAt - startedAt) / 1000;
  return `(${seconds.toFixed(1)}s)`;
}

function getStepIcon(
  title: string = '',
  fallback: React.ReactNode = <EditOutlined />,
): React.ReactNode {
  const lowerTitle = title.toLowerCase();
  if (lowerTitle.includes('web') || lowerTitle.includes('search') || lowerTitle.includes('搜索')) {
    return <SearchOutlined />;
  }
  if (
    lowerTitle.includes('bash') ||
    lowerTitle.includes('command') ||
    lowerTitle.includes('terminal') ||
    lowerTitle.includes('终端')
  ) {
    return <ConsoleSqlOutlined />;
  }
  if (
    lowerTitle.includes('file') ||
    lowerTitle.includes('read') ||
    lowerTitle.includes('write') ||
    lowerTitle.includes('文件')
  ) {
    return <FileTextOutlined />;
  }
  if (lowerTitle.includes('think') || lowerTitle.includes('plan') || lowerTitle.includes('思考')) {
    return <BulbOutlined />;
  }
  if (lowerTitle.includes('code') || lowerTitle.includes('script') || lowerTitle.includes('代码')) {
    return <CodeOutlined />;
  }
  if (lowerTitle.includes('api') || lowerTitle.includes('request') || lowerTitle.includes('请求')) {
    return <ApiOutlined />;
  }
  if (
    lowerTitle.includes('tool') ||
    lowerTitle.includes('skill') ||
    lowerTitle.includes('技能') ||
    lowerTitle.includes('工具')
  ) {
    return <ToolOutlined />;
  }
  return fallback;
}

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

    const translatedTitle = translateToolTitle(step.title);
    const duration = formatDuration(step.startedAt, step.endedAt);
    const displayTitle = duration ? `${translatedTitle} ${duration}` : translatedTitle;

    chainItems.push({
      key: `run_${item.runTrace?.runId}_${step.stepId}`,
      icon: getStepIcon(step.title),
      title: displayTitle,
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
      icon: getStepIcon(draftDisplay.title, <ToolOutlined />),
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
      icon: <SafetyCertificateOutlined />,
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

  const isError = items.some((i) => i.status === 'error' || i.status === 'abort');
  const globalStatus = item.isStreaming ? 'loading' : isError ? 'error' : 'success';
  const rootTitle = item.isStreaming
    ? '正在执行深度思考与操作...'
    : isError
      ? '执行遭遇意外，流程已中断'
      : '已完成工具调度操作';

  const rootItems: ThoughtChainItemType[] = [
    {
      key: 'main_trace',
      icon: <RobotOutlined />,
      title: rootTitle,
      status: globalStatus,
      collapsible: true,
      content: (
        <ThoughtChain
          items={items}
          defaultExpandedKeys={items
            .filter((chainItem) => chainItem.status === 'loading' || chainItem.status === 'error')
            .map((chainItem) => String(chainItem.key))}
        />
      ),
    },
  ];

  return (
    <div style={{ marginBottom: withBottomSpacing ? 12 : 0 }}>
      <ThoughtChain
        items={rootItems}
        defaultExpandedKeys={item.isStreaming || isError ? ['main_trace'] : []}
      />
    </div>
  );
};

export default ToolThoughtChain;
