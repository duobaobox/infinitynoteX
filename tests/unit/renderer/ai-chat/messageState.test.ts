import { describe, expect, it } from 'vitest';

import type { AIToolApproval, AIRunTrace } from '../../../../src/services/types';
import { mergeApprovalsIntoInfos } from '../../../../src/features/ai-chat/messageState';

const requestA = 'request-a';
const requestB = 'request-b';

function createRunTrace(requestId: string): AIRunTrace {
  return {
    runId: `run-${requestId}`,
    requestId,
    status: 'waiting_approval',
    input: 'input',
    startedAt: Date.now(),
    steps: [],
    artifacts: [],
  };
}

function createApproval(approvalId: string, toolCallId: string): AIToolApproval {
  return {
    approvalId,
    toolCallId,
    toolName: 'saveToNote',
    title: `建议新建便签《${approvalId}》`,
    description: 'AI 想把当前内容保存为便签。',
    status: 'pending',
  };
}

describe('messageState', () => {
  it('merges approval updates into the message that owns the same requestId', () => {
    const infos = [
      {
        id: 'ai-old',
        status: 'success' as const,
        message: {
          role: 'ai' as const,
          content: '',
          timestamp: Date.now(),
          runTrace: createRunTrace(requestA),
          toolApprovals: [createApproval('approval-old', 'tool-old')],
        },
      },
      {
        id: 'ai-new',
        status: 'success' as const,
        message: {
          role: 'ai' as const,
          content: '新的回复',
          timestamp: Date.now(),
          runTrace: createRunTrace(requestB),
        },
      },
    ];

    const merged = mergeApprovalsIntoInfos(
      infos,
      [
        {
          ...createApproval('approval-old', 'tool-old'),
          status: 'executed',
          resultSummary: '已执行',
        },
      ],
      { requestId: requestA },
    );

    expect(merged[0]?.message.toolApprovals?.[0]?.status).toBe('executed');
    expect(merged[1]?.message.toolApprovals).toBeUndefined();
  });
});
