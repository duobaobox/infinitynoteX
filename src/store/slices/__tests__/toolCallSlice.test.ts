/**
 * ToolCall Slice 单元测试
 * 验证ToolCall状态机的所有状态转移
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { renderHook, act } from '@testing-library/react';
import { create } from 'zustand';
import type { ToolCallSlice } from '../toolCallSlice';
import { createToolCallSlice } from '../toolCallSlice';

const createTestStore = () => {
  return create<ToolCallSlice>()((set, get) => createToolCallSlice(set as any, get as any));
};

describe('ToolCallSlice - State Machine Tests', () => {
  it('应该正确创建ToolCall，初始状态为DRAFTING', () => {
    const store = createTestStore();
    const { result } = renderHook(() => store((state) => state));

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let _toolCall: any;
    act(() => {
      _toolCall = result.current.createToolCall('req-123', 'tool-call-1', 'execute_command');
    });

    const toolCall = store.getState().getToolCall('tool-call-1');
    expect(toolCall).toBeDefined();
    expect(toolCall?.id).toBe('tool-call-1');
    expect(toolCall?.requestId).toBe('req-123');
    expect(toolCall?.toolName).toBe('execute_command');
    expect(toolCall?.state.type).toBe('DRAFTING');
    expect(toolCall?.state.input).toBe('');
  });

  it('应该能在DRAFTING状态下更新参数草稿', () => {
    const store = createTestStore();
    const { result } = renderHook(() => store((state) => state));

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let _toolCall: any;
    act(() => {
      _toolCall = result.current.createToolCall('req-123', 'tool-call-1', 'execute_command');
    });

    act(() => {
      result.current.updateToolCallDraft('tool-call-1', 'param');
      result.current.updateToolCallDraft('tool-call-1', '1');
    });

    const updated = store.getState().getToolCall('tool-call-1');
    expect(updated?.state.type).toBe('DRAFTING');
    expect(updated?.state.input).toBe('param1');
  });

  it('应该能完成工具参数草稿，转移到PENDING_APPROVAL', () => {
    const store = createTestStore();
    const { result } = renderHook(() => store((state) => state));

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let _toolCall: any;
    act(() => {
      _toolCall = result.current.createToolCall('req-123', 'tool-call-1', 'execute_command');
    });

    const parsedInput = { command: 'ls', args: ['-la'] };
    const preview = JSON.stringify(parsedInput);

    act(() => {
      result.current.completeToolCallDraft('tool-call-1', parsedInput, preview);
    });

    const completed = store.getState().getToolCall('tool-call-1');
    expect(completed?.state.type).toBe('PENDING_APPROVAL');
    expect(completed?.state.input).toEqual(parsedInput);
    expect(completed?.state.preview).toBe(preview);
  });

  it('应该支持状态转移：PENDING_APPROVAL → EXECUTING', () => {
    const store = createTestStore();
    const { result } = renderHook(() => store((state) => state));

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let _toolCall: any;
    act(() => {
      _toolCall = result.current.createToolCall('req-123', 'tool-call-1', 'execute_command');
      const input = { command: 'ls' };
      result.current.completeToolCallDraft('tool-call-1', input, JSON.stringify(input));
    });

    act(() => {
      result.current.approveToolCall('tool-call-1');
    });

    const approved = store.getState().getToolCall('tool-call-1');
    expect(approved?.state.type).toBe('EXECUTING');
  });

  it('应该支持状态转移：PENDING_APPROVAL → REJECTED', () => {
    const store = createTestStore();
    const { result } = renderHook(() => store((state) => state));

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let _toolCall: any;
    act(() => {
      _toolCall = result.current.createToolCall('req-123', 'tool-call-1', 'execute_command');
      const input = { command: 'ls' };
      result.current.completeToolCallDraft('tool-call-1', input, JSON.stringify(input));
    });

    act(() => {
      result.current.rejectToolCall('tool-call-1', 'User rejected');
    });

    const rejected = store.getState().getToolCall('tool-call-1');
    expect(rejected?.state.type).toBe('REJECTED');
    expect(rejected?.state.reason).toBe('User rejected');
  });

  it('应该支持状态转移：EXECUTING → SUCCESS', () => {
    const store = createTestStore();
    const { result } = renderHook(() => store((state) => state));

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let _toolCall: any;
    act(() => {
      _toolCall = result.current.createToolCall('req-123', 'tool-call-1', 'execute_command');
      const input = { command: 'ls' };
      result.current.completeToolCallDraft('tool-call-1', input, JSON.stringify(input));
      result.current.approveToolCall('tool-call-1');
    });

    const result_data = { stdout: 'file1.txt\nfile2.txt', exitCode: 0 };
    act(() => {
      result.current.completeToolCall('tool-call-1', result_data);
    });

    const completed = store.getState().getToolCall('tool-call-1');
    expect(completed?.state.type).toBe('SUCCESS');
    expect(completed?.state.result).toEqual(result_data);
  });

  it('应该支持状态转移：EXECUTING → ERROR', () => {
    const store = createTestStore();
    const { result } = renderHook(() => store((state) => state));

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let _toolCall: any;
    act(() => {
      _toolCall = result.current.createToolCall('req-123', 'tool-call-1', 'execute_command');
      const input = { command: 'ls' };
      result.current.completeToolCallDraft('tool-call-1', input, JSON.stringify(input));
      result.current.approveToolCall('tool-call-1');
    });

    const errorMsg = 'Command not found';
    act(() => {
      result.current.failToolCall('tool-call-1', errorMsg);
    });

    const failed = store.getState().getToolCall('tool-call-1');
    expect(failed?.state.type).toBe('ERROR');
    expect(failed?.state.error).toBe(errorMsg);
  });

  it('应该支持完整的状态转移链：DRAFTING → PENDING_APPROVAL → EXECUTING → SUCCESS', () => {
    const store = createTestStore();
    const { result } = renderHook(() => store((state) => state));

    act(() => {
      result.current.createToolCall('req-123', 'tool-call-1', 'execute_command');
    });

    // DRAFTING
    act(() => {
      result.current.updateToolCallDraft('tool-call-1', '{"cmd":"ls"}');
    });
    expect(store.getState().getToolCall('tool-call-1')?.state.type).toBe('DRAFTING');

    // DRAFTING → PENDING_APPROVAL
    const input = { cmd: 'ls' };
    act(() => {
      result.current.completeToolCallDraft('tool-call-1', input, JSON.stringify(input));
    });
    expect(store.getState().getToolCall('tool-call-1')?.state.type).toBe('PENDING_APPROVAL');

    // PENDING_APPROVAL → EXECUTING
    act(() => {
      result.current.approveToolCall('tool-call-1');
    });
    expect(store.getState().getToolCall('tool-call-1')?.state.type).toBe('EXECUTING');

    // EXECUTING → SUCCESS
    const result_data = { output: 'success' };
    act(() => {
      result.current.completeToolCall('tool-call-1', result_data);
    });
    const final = store.getState().getToolCall('tool-call-1');
    expect(final?.state.type).toBe('SUCCESS');
    expect(final?.state.result).toEqual(result_data);
  });

  it('应该能处理多个并发的ToolCall', () => {
    const store = createTestStore();
    const { result } = renderHook(() => store((state) => state));

    act(() => {
      result.current.createToolCall('req-123', 'tool-1', 'cmd1');
      result.current.createToolCall('req-123', 'tool-2', 'cmd2');
      result.current.createToolCall('req-123', 'tool-3', 'cmd3');
    });

    // 不同的状态转移
    act(() => {
      result.current.updateToolCallDraft('tool-1', '{}');
      const input = { test: true };
      result.current.completeToolCallDraft('tool-2', input, JSON.stringify(input));
      result.current.rejectToolCall('tool-3', 'User rejected');
    });

    expect(store.getState().getToolCall('tool-1')?.state.type).toBe('DRAFTING');
    expect(store.getState().getToolCall('tool-2')?.state.type).toBe('PENDING_APPROVAL');
    expect(store.getState().getToolCall('tool-3')?.state.type).toBe('REJECTED');
  });

  it('应该为每个ToolCall记录创建时间', () => {
    const store = createTestStore();
    const { result } = renderHook(() => store((state) => state));

    const timeBefore = Date.now();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let toolCall: any;
    act(() => {
      toolCall = result.current.createToolCall('req-123', 'tool-call-1', 'cmd');
    });
    const timeAfter = Date.now();

    const created = store.getState().getToolCall('tool-call-1');
    expect(created?.createdAt >= timeBefore).toBeTruthy();
    expect(created?.createdAt <= timeAfter).toBeTruthy();
  });

  it('应该保持ToolCall的requestId链接', () => {
    const store = createTestStore();
    const { result } = renderHook(() => store((state) => state));

    act(() => {
      result.current.createToolCall('req-123', 'tool-1', 'cmd1');
      result.current.createToolCall('req-456', 'tool-2', 'cmd2');
    });

    const tool1 = store.getState().getToolCall('tool-1');
    const tool2 = store.getState().getToolCall('tool-2');

    expect(tool1?.requestId).toBe('req-123');
    expect(tool2?.requestId).toBe('req-456');
  });
});
