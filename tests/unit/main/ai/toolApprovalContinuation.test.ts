import { describe, expect, it } from 'vitest';
import type { ModelMessage } from 'ai';

import {
  buildApprovalContinuationMessages,
  collectApprovalIdsFromResponseMessages,
} from '../../../../electron/ai/toolApprovalContinuation';

const responseMessages: ModelMessage[] = [
  {
    role: 'assistant',
    content: [
      {
        type: 'tool-call',
        toolCallId: 'call_1',
        toolName: 'createManualTask',
        input: { text: '阅读第三章' },
      },
      {
        type: 'tool-approval-request',
        approvalId: 'approval_1',
        toolCallId: 'call_1',
      },
      {
        type: 'tool-call',
        toolCallId: 'call_2',
        toolName: 'createManualTask',
        input: { text: '整理笔记' },
      },
      {
        type: 'tool-approval-request',
        approvalId: 'approval_2',
        toolCallId: 'call_2',
      },
    ],
  },
];

describe('toolApprovalContinuation', () => {
  it('collects every approval id from a model response in order', () => {
    expect(collectApprovalIdsFromResponseMessages(responseMessages)).toEqual([
      'approval_1',
      'approval_2',
    ]);
  });

  it('waits for all sibling approval decisions before building continuation messages', () => {
    const result = buildApprovalContinuationMessages({
      baseMessages: [{ role: 'user', content: '随机生成 2 个 todo' }],
      responseMessages,
      decisions: [
        {
          approvalId: 'approval_1',
          approved: true,
        },
      ],
    });

    expect(result.ready).toBe(false);
    expect(result.pendingApprovalIds).toEqual(['approval_2']);
  });

  it('builds one tool message containing all approval responses once every decision is known', () => {
    const result = buildApprovalContinuationMessages({
      baseMessages: [{ role: 'user', content: '随机生成 2 个 todo' }],
      responseMessages,
      decisions: [
        {
          approvalId: 'approval_1',
          approved: true,
        },
        {
          approvalId: 'approval_2',
          approved: false,
          reason: '用户暂不需要',
        },
      ],
    });

    expect(result.ready).toBe(true);
    expect(result.messages.at(-1)).toEqual({
      role: 'tool',
      content: [
        {
          type: 'tool-approval-response',
          approvalId: 'approval_1',
          approved: true,
        },
        {
          type: 'tool-approval-response',
          approvalId: 'approval_2',
          approved: false,
          reason: '用户暂不需要',
        },
      ],
    });
  });
});
