import type { AIToolApproval } from '../../services/types';
import type { AIToolDraft } from './types';

function normalize(text: string | undefined): string {
  return (text || '').replace(/\s+/g, ' ').trim();
}

export function mergeToolApprovals(
  existing: AIToolApproval[] | undefined,
  updates: AIToolApproval[],
): AIToolApproval[] {
  const merged = [...(existing ?? [])];

  for (const approval of updates) {
    const index = merged.findIndex((item) => item.approvalId === approval.approvalId);
    if (index >= 0) {
      merged[index] = approval;
    } else {
      merged.push(approval);
    }
  }

  return merged;
}

export function mergeToolDrafts(
  existing: AIToolDraft[] | undefined,
  updates: AIToolDraft[],
): AIToolDraft[] {
  const merged = [...(existing ?? [])];

  for (const draft of updates) {
    const index = merged.findIndex((item) => item.toolCallId === draft.toolCallId);
    if (index >= 0) {
      merged[index] = draft;
    } else {
      merged.push(draft);
    }
  }

  return merged;
}

export function removeToolDraft(
  existing: AIToolDraft[] | undefined,
  toolCallId: string,
): AIToolDraft[] | undefined {
  if (!existing?.length) {
    return existing;
  }

  const next = existing.filter((item) => item.toolCallId !== toolCallId);
  return next.length > 0 ? next : undefined;
}

export function stripToolDrafts<T extends { message: { toolDrafts?: AIToolDraft[] } }>(
  infos: T[],
): T[] {
  let changed = false;
  const next = infos.map((info) => {
    if (!info.message.toolDrafts?.length) {
      return info;
    }

    changed = true;
    return {
      ...info,
      message: {
        ...info.message,
        toolDrafts: undefined,
      },
    };
  });

  return changed ? next : infos;
}

export function getToolDraftDisplay(draft: AIToolDraft): {
  title: string;
  description: string;
  footerLabel: string;
} {
  switch (draft.toolName) {
    case 'saveToNote':
      return {
        title: '正在准备新建便签',
        description: 'AI 正在整理待确认的便签内容。',
        footerLabel: '正在整理待确认内容…',
      };
    case 'appendToNote':
      return {
        title: '正在准备追加到便签',
        description: 'AI 正在整理要追加到现有便签的内容。',
        footerLabel: '正在整理待确认内容…',
      };
    case 'createManualTask':
      return {
        title: '正在准备创建任务',
        description: 'AI 正在整理待办任务内容。',
        footerLabel: '正在整理待确认内容…',
      };
    default:
      return {
        title: draft.title || '正在准备工具调用',
        description: 'AI 正在整理待确认内容。',
        footerLabel: '正在整理待确认内容…',
      };
  }
}

export function isApprovalPlaceholderContent(
  content: string | undefined,
  approvals: AIToolApproval[] | undefined,
): boolean {
  const normalizedContent = normalize(content);
  if (!normalizedContent || !approvals?.length) {
    return false;
  }

  return approvals.some((approval) => normalize(approval.title) === normalizedContent);
}

function isLikelyActionOnlyAck(content: string, latestApproval: AIToolApproval): boolean {
  const normalized = normalize(content);
  if (!normalized) {
    return false;
  }

  if (
    normalized.includes('下一步') ||
    normalized.includes('建议') ||
    normalized.includes('可以继续') ||
    normalized.includes('\n')
  ) {
    return false;
  }

  if (normalized.length > 120) {
    return false;
  }

  const actionKeywords =
    latestApproval.toolName === 'appendToNote'
      ? ['追加', '便签']
      : latestApproval.toolName === 'createManualTask'
        ? ['任务', '创建']
        : ['便签', '保存', '创建'];

  const hasActionKeyword = actionKeywords.some((keyword) => normalized.includes(keyword));
  const hasCompletionVerb =
    normalized.includes('已') ||
    normalized.includes('已经') ||
    normalized.includes('成功') ||
    normalized.includes('完成');

  return hasActionKeyword && hasCompletionVerb;
}

export function resolveApprovalContinuationContent(args: {
  currentContent: string | undefined;
  existingApprovals: AIToolApproval[] | undefined;
  latestApproval: AIToolApproval;
  continuationContent?: string;
}): string {
  const rawCurrent = args.currentContent?.trim() ?? '';
  const rawContinuation = args.continuationContent?.trim() ?? '';
  const normalizedCurrent = normalize(rawCurrent);
  const normalizedContinuation = normalize(rawContinuation);
  const currentIsPlaceholder = isApprovalPlaceholderContent(rawCurrent, args.existingApprovals);
  const currentMeaningful = normalizedCurrent && !currentIsPlaceholder ? normalizedCurrent : '';

  if (!normalizedContinuation) {
    return currentIsPlaceholder ? '' : rawCurrent;
  }

  if (isLikelyActionOnlyAck(normalizedContinuation, args.latestApproval)) {
    return currentIsPlaceholder ? '' : rawCurrent;
  }

  if (!currentMeaningful) {
    return rawContinuation;
  }

  if (normalizedContinuation === currentMeaningful) {
    return rawCurrent;
  }

  return `${rawCurrent}\n\n${rawContinuation}`;
}
