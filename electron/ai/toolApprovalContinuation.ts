import type { ModelMessage } from 'ai';

export interface ToolApprovalDecision {
  approvalId: string;
  approved: boolean;
  reason?: string;
}

interface ToolApprovalRequestPart {
  type: 'tool-approval-request';
  approvalId: string;
}

export type ApprovalContinuationPlan =
  | {
      ready: false;
      approvalIds: string[];
      pendingApprovalIds: string[];
    }
  | {
      ready: true;
      approvalIds: string[];
      pendingApprovalIds: [];
      messages: ModelMessage[];
    };

function isToolApprovalRequestPart(part: unknown): part is ToolApprovalRequestPart {
  return (
    typeof part === 'object' &&
    part !== null &&
    'type' in part &&
    part.type === 'tool-approval-request' &&
    'approvalId' in part &&
    typeof part.approvalId === 'string'
  );
}

export function collectApprovalIdsFromResponseMessages(responseMessages: ModelMessage[]): string[] {
  const approvalIds: string[] = [];
  const seen = new Set<string>();

  for (const message of responseMessages) {
    if (message.role !== 'assistant' || typeof message.content === 'string') {
      continue;
    }

    for (const part of message.content) {
      if (!isToolApprovalRequestPart(part) || seen.has(part.approvalId)) {
        continue;
      }

      seen.add(part.approvalId);
      approvalIds.push(part.approvalId);
    }
  }

  return approvalIds;
}

export function buildApprovalContinuationMessages(args: {
  baseMessages: ModelMessage[];
  responseMessages: ModelMessage[];
  decisions: ToolApprovalDecision[];
}): ApprovalContinuationPlan {
  const approvalIds = collectApprovalIdsFromResponseMessages(args.responseMessages);
  const decisionsById = new Map(args.decisions.map((decision) => [decision.approvalId, decision]));
  const pendingApprovalIds = approvalIds.filter((approvalId) => !decisionsById.has(approvalId));

  if (pendingApprovalIds.length > 0) {
    return {
      ready: false,
      approvalIds,
      pendingApprovalIds,
    };
  }

  return {
    ready: true,
    approvalIds,
    pendingApprovalIds: [],
    messages: [
      ...args.baseMessages,
      ...args.responseMessages,
      {
        role: 'tool',
        content: approvalIds.map((approvalId) => {
          const decision = decisionsById.get(approvalId);
          if (!decision) {
            throw new Error(`Missing approval decision: ${approvalId}`);
          }

          return {
            type: 'tool-approval-response' as const,
            approvalId,
            approved: decision.approved,
            ...(decision.reason ? { reason: decision.reason } : {}),
          };
        }),
      },
    ],
  };
}
