import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  todoListGetMock,
  todoListCreateDefaultMock,
  manualTaskGetNextOrderMock,
  manualTaskCreateMock,
} = vi.hoisted(() => ({
  todoListGetMock: vi.fn(),
  todoListCreateDefaultMock: vi.fn(),
  manualTaskGetNextOrderMock: vi.fn(),
  manualTaskCreateMock: vi.fn(),
}));

vi.mock('electron', () => ({
  app: {
    getPath: () => '/tmp/infinitynotex-test',
  },
}));

vi.mock('../../../../electron/storage', () => ({
  storageManager: {
    todoLists: {
      get: todoListGetMock,
      createDefault: todoListCreateDefaultMock,
      getAll: vi.fn(async () => []),
    },
    notes: {
      get: vi.fn(),
    },
    manualTasks: {
      getNextOrder: manualTaskGetNextOrderMock,
      create: manualTaskCreateMock,
      getAllByListId: vi.fn(async () => []),
    },
  },
}));

let toolRegistry: typeof import('../../../../electron/ai/toolRegistry');

beforeAll(async () => {
  toolRegistry = await import('../../../../electron/ai/toolRegistry');
});

describe('toolRegistry', () => {
  beforeEach(() => {
    todoListGetMock.mockReset();
    todoListCreateDefaultMock.mockReset();
    manualTaskGetNextOrderMock.mockReset();
    manualTaskCreateMock.mockReset();

    todoListGetMock.mockImplementation(async (id: string) => {
      if (id === 'default-manual-tasks') {
        return {
          id: 'default-manual-tasks',
          name: '默认任务清单',
          isDefault: true,
          order: 0,
          createdAt: 1,
          updatedAt: 1,
        };
      }

      throw new Error('list not found');
    });

    todoListCreateDefaultMock.mockResolvedValue({
      id: 'default-manual-tasks',
      name: '默认任务清单',
      isDefault: true,
      order: 0,
      createdAt: 1,
      updatedAt: 1,
    });
    manualTaskGetNextOrderMock.mockResolvedValue(0);
    manualTaskCreateMock.mockResolvedValue({
      id: 'task-id-1',
      listId: 'default-manual-tasks',
      text: '整理会议纪要',
      checked: false,
      order: 0,
      createdAt: 1,
      updatedAt: 1,
    });
  });

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
    ).toBe('已创建到 今天');
  });

  it('defaults createManualTask approval target to 默认任务清单 when listId is omitted', async () => {
    const approval = await toolRegistry.buildToolApprovalRequest({
      approvalId: 'approval_2',
      toolCallId: 'tool_2',
      toolName: 'createManualTask',
      input: {
        text: '整理会议纪要',
      },
    });

    expect(todoListGetMock).toHaveBeenCalledWith('default-manual-tasks');
    expect(approval?.targetId).toBe('default-manual-tasks');
    expect(approval?.targetLabel).toBe('默认任务清单');
  });

  it('falls back to 默认任务清单 when createManualTask receives an invalid listId', async () => {
    const approval = await toolRegistry.buildToolApprovalRequest({
      approvalId: 'approval_3',
      toolCallId: 'tool_3',
      toolName: 'createManualTask',
      input: {
        listId: 'unknown-list',
        text: '清理下载目录',
      },
    });

    expect(todoListGetMock).toHaveBeenCalledWith('unknown-list');
    expect(todoListGetMock).toHaveBeenCalledWith('default-manual-tasks');
    expect(approval?.targetId).toBe('default-manual-tasks');
    expect(approval?.targetLabel).toBe('默认任务清单');
  });

  it('returns user-facing manual task output without internal ids', async () => {
    const tools = toolRegistry.createAgentTools({ allowActiveRetrieval: false });
    const createManualTask = tools.createManualTask as {
      execute: (input: { text: string }) => Promise<unknown>;
    };
    const result = await createManualTask.execute({
      text: '整理会议纪要',
    });

    expect(result).toEqual({
      listName: '默认任务清单',
      text: '整理会议纪要',
    });
  });
});
