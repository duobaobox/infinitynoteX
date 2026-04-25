import type { AIRunStatus, AIStepStatus, AIToolApprovalStatus } from '../../../services/types';
import type { ChatItem } from '../types';

const TERMINAL_RUN_STATUSES: ReadonlySet<AIRunStatus> = new Set([
  'completed',
  'failed',
  'cancelled',
]);
const FINISHED_STEP_STATUSES: ReadonlySet<AIStepStatus> = new Set(['completed', 'skipped']);
const FINISHED_APPROVAL_STATUSES: ReadonlySet<AIToolApprovalStatus> = new Set([
  'executed',
  'denied',
  'failed',
]);

export function isTerminalRunStatus(status: AIRunStatus | undefined): boolean {
  return Boolean(status && TERMINAL_RUN_STATUSES.has(status));
}

export function getEffectiveRunStatus(
  item: Pick<ChatItem, 'content' | 'isStreaming' | 'runTrace' | 'toolApprovals' | 'toolDrafts'>,
): AIRunStatus | undefined {
  if (isTerminalRunStatus(item.runTrace?.status)) {
    return item.runTrace?.status;
  }

  const hasFailedStep = item.runTrace?.steps?.some((step) => step.status === 'failed') ?? false;
  const hasFailedApproval =
    item.toolApprovals?.some((approval) => approval.status === 'failed') ?? false;
  if (hasFailedStep || hasFailedApproval) {
    return 'failed';
  }

  const hasActiveStep =
    item.runTrace?.steps?.some((step) => !FINISHED_STEP_STATUSES.has(step.status)) ?? false;
  const hasActiveApproval =
    item.toolApprovals?.some((approval) => !FINISHED_APPROVAL_STATUSES.has(approval.status)) ??
    false;
  const hasDraft = Boolean(item.toolDrafts?.length);
  const hasResult = Boolean(item.content.trim() || item.toolApprovals?.length);

  if (!item.isStreaming && !hasActiveStep && !hasActiveApproval && !hasDraft && hasResult) {
    return 'completed';
  }

  return item.runTrace?.status;
}

export function isChatItemEffectivelyStreaming(
  item: Pick<ChatItem, 'content' | 'isStreaming' | 'runTrace' | 'toolApprovals' | 'toolDrafts'>,
) {
  if (isTerminalRunStatus(getEffectiveRunStatus(item))) {
    return false;
  }

  return Boolean(item.isStreaming);
}
