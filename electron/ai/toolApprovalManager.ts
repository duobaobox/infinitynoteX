import type { ModelMessage } from 'ai';

import type { AIConfig } from '../../src/services/aiConfig';
import type { AIToolApproval } from '../../src/services/types';

const APPROVAL_TTL_MS = 30 * 60 * 1000;

export interface PendingToolApprovalDecision {
  approved: boolean;
  reason?: string;
  decidedAt: number;
}

export interface PendingToolApprovalEntry {
  requestId: string;
  runKey?: string;
  approval: AIToolApproval;
  config: AIConfig;
  allowActiveRetrieval: boolean;
  baseMessages: ModelMessage[];
  responseMessagesPromise: Promise<ModelMessage[]>;
  createdAt: number;
  decision?: PendingToolApprovalDecision;
}

const pendingApprovals = new Map<string, PendingToolApprovalEntry>();

function cleanupExpiredApprovals(): void {
  const now = Date.now();

  for (const [approvalId, entry] of pendingApprovals.entries()) {
    if (now - entry.createdAt > APPROVAL_TTL_MS) {
      pendingApprovals.delete(approvalId);
    }
  }
}

export function registerPendingToolApproval(entry: PendingToolApprovalEntry): void {
  cleanupExpiredApprovals();
  pendingApprovals.set(entry.approval.approvalId, entry);
}

export function consumePendingToolApproval(approvalId: string): PendingToolApprovalEntry | null {
  cleanupExpiredApprovals();
  const entry = pendingApprovals.get(approvalId) ?? null;
  if (entry) {
    pendingApprovals.delete(approvalId);
  }
  return entry;
}

export function peekPendingToolApproval(approvalId: string): PendingToolApprovalEntry | null {
  cleanupExpiredApprovals();
  return pendingApprovals.get(approvalId) ?? null;
}

export function recordPendingToolApprovalDecision(
  approvalId: string,
  decision: Omit<PendingToolApprovalDecision, 'decidedAt'>,
): PendingToolApprovalEntry | null {
  cleanupExpiredApprovals();
  const entry = pendingApprovals.get(approvalId) ?? null;
  if (!entry) {
    return null;
  }

  entry.decision = {
    ...decision,
    decidedAt: Date.now(),
  };
  pendingApprovals.set(approvalId, entry);
  return entry;
}

export function getPendingToolApprovalsByIds(approvalIds: string[]): PendingToolApprovalEntry[] {
  cleanupExpiredApprovals();
  const entries: PendingToolApprovalEntry[] = [];

  for (const approvalId of approvalIds) {
    const entry = pendingApprovals.get(approvalId);
    if (entry) {
      entries.push(entry);
    }
  }

  return entries;
}

export function consumePendingToolApprovals(approvalIds: string[]): PendingToolApprovalEntry[] {
  cleanupExpiredApprovals();
  const entries: PendingToolApprovalEntry[] = [];

  for (const approvalId of approvalIds) {
    const entry = pendingApprovals.get(approvalId);
    if (entry) {
      entries.push(entry);
      pendingApprovals.delete(approvalId);
    }
  }

  return entries;
}

export function clearPendingToolApprovalsForTest(): void {
  pendingApprovals.clear();
}
