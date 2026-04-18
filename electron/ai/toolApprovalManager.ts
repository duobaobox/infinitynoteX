import type { ModelMessage } from 'ai';

import type { AIConfig } from '../../src/services/aiConfig';
import type { AIToolApproval } from '../../src/services/types';

const APPROVAL_TTL_MS = 30 * 60 * 1000;

interface PendingToolApprovalEntry {
  requestId: string;
  runKey?: string;
  approval: AIToolApproval;
  config: AIConfig;
  allowActiveRetrieval: boolean;
  baseMessages: ModelMessage[];
  responseMessagesPromise: Promise<ModelMessage[]>;
  createdAt: number;
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
