import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  app: {
    getPath: () => '/tmp/infinitynotex-test',
  },
}));

let toolRegistry: typeof import('../../../../electron/ai/toolRegistry');

beforeAll(async () => {
  toolRegistry = await import('../../../../electron/ai/toolRegistry');
});

describe('toolRegistry', () => {
  it('marks write tools as approval-required', () => {
    expect(toolRegistry.isApprovalRequiredTool('saveToNote')).toBe(true);
    expect(toolRegistry.isApprovalRequiredTool('appendToNote')).toBe(true);
    expect(toolRegistry.isApprovalRequiredTool('createManualTask')).toBe(true);
    expect(toolRegistry.isApprovalRequiredTool('searchNotes')).toBe(false);
  });

  it('builds a user-facing approval card for saving a note', async () => {
    const approval = await toolRegistry.buildToolApprovalRequest({
      approvalId: 'approval_1',
      toolCallId: 'tool_1',
      toolName: 'saveToNote',
      input: {
        title: '会议纪要',
        content: '第一段\n\n第二段',
      },
    });

    expect(approval).toMatchObject({
      approvalId: 'approval_1',
      toolCallId: 'tool_1',
      toolName: 'saveToNote',
      status: 'pending',
      targetId: 'default',
      targetLabel: '默认文件夹',
    });
    expect(approval?.title).toContain('会议纪要');
    expect(approval?.preview).toContain('第一段');
  });

  it('formats execution summaries for write tools', () => {
    expect(
      toolRegistry.buildToolExecutionSummary('saveToNote', {
        title: '执行结果',
      }),
    ).toBe('已新建便签《执行结果》');

    expect(
      toolRegistry.buildToolExecutionSummary('createManualTask', {
        listName: '今天',
      }),
    ).toBe('已在 今天 中创建任务');
  });
});
