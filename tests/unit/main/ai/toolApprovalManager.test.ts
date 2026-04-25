import { afterEach, describe, expect, it } from 'vitest';
import type { ModelMessage } from 'ai';

import {
  clearPendingToolApprovalsForTest,
  consumePendingToolApprovals,
  getPendingToolApprovalsByIds,
  recordPendingToolApprovalDecision,
  registerPendingToolApproval,
} from '../../../../electron/ai/toolApprovalManager';

const baseEntry = {
  requestId: 'request_1',
  config: {
    provider: 'custom',
    apiKey: 'test-key',
    baseURL: 'https://example.com/v1',
    model: 'test-model',
  },
  allowActiveRetrieval: false,
  baseMessages: [{ role: 'user', content: '创建两个 todo' }] as ModelMessage[],
  responseMessagesPromise: Promise.resolve([] as ModelMessage[]),
  createdAt: Date.now(),
};

describe('toolApprovalManager', () => {
  afterEach(() => {
    clearPendingToolApprovalsForTest();
  });

  it('records approval decisions without consuming sibling pending approvals', () => {
    registerPendingToolApproval({
      ...baseEntry,
      approval: {
        approvalId: 'approval_1',
        toolCallId: 'call_1',
        toolName: 'createManualTask',
        title: '任务 1',
        description: '创建任务 1',
        status: 'pending',
      },
    });
    registerPendingToolApproval({
      ...baseEntry,
      approval: {
        approvalId: 'approval_2',
        toolCallId: 'call_2',
        toolName: 'createManualTask',
        title: '任务 2',
        description: '创建任务 2',
        status: 'pending',
      },
    });

    const decided = recordPendingToolApprovalDecision('approval_1', {
      approved: true,
    });
    const entries = getPendingToolApprovalsByIds(['approval_1', 'approval_2']);

    expect(decided?.decision).toMatchObject({ approved: true });
    expect(entries.map((entry) => entry.approval.approvalId)).toEqual(['approval_1', 'approval_2']);
    expect(entries[1].decision).toBeUndefined();
  });

  it('consumes a completed approval group together', () => {
    for (const approvalId of ['approval_1', 'approval_2']) {
      registerPendingToolApproval({
        ...baseEntry,
        approval: {
          approvalId,
          toolCallId: approvalId.replace('approval', 'call'),
          toolName: 'createManualTask',
          title: approvalId,
          description: approvalId,
          status: 'pending',
        },
      });
      recordPendingToolApprovalDecision(approvalId, {
        approved: approvalId === 'approval_1',
      });
    }

    const consumed = consumePendingToolApprovals(['approval_1', 'approval_2']);

    expect(consumed).toHaveLength(2);
    expect(getPendingToolApprovalsByIds(['approval_1', 'approval_2'])).toEqual([]);
  });
});
