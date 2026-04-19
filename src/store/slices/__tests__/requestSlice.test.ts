/**
 * Request Slice 单元测试
 * 验证Request状态机的所有状态转移
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { renderHook, act } from '@testing-library/react';
import { create } from 'zustand';
import type { RequestSlice } from '../requestSlice';
import { createRequestSlice } from '../requestSlice';

// 创建测试store
const createTestStore = () => {
  return create<RequestSlice>()((set, get) =>
    createRequestSlice(set as unknown as any, get as unknown as any),
  );
};

describe('RequestSlice - State Machine Tests', () => {
  it('应该正确创建Request，初始状态为GENERATING', () => {
    const store = createTestStore();
    const { result } = renderHook(() => store((state) => state));

    let request: any;
    act(() => {
      request = result.current.createRequest('conv-123');
    });

    expect(request).toBeDefined();
    expect(request.id).toBeDefined();
    expect(request.state).toBe('GENERATING');
    expect(request.conversationId).toBe('conv-123');
    expect(request.toolCallIds).toEqual([]);
    expect(request.messageIds).toEqual([]);
  });

  it('应该支持状态转移：GENERATING → WAITING_APPROVALS', () => {
    const store = createTestStore();
    const { result } = renderHook(() => store((state) => state));

    let request: any;
    act(() => {
      request = result.current.createRequest('conv-123');
    });

    act(() => {
      result.current.transitionRequest(request.id, 'WAITING_APPROVALS');
    });

    const updated = store.getState().getRequest(request.id);
    expect(updated?.state).toBe('WAITING_APPROVALS');
  });

  it('应该支持完整的状态转移链：GENERATING → WAITING_APPROVALS → COMPLETED', () => {
    const store = createTestStore();
    const { result } = renderHook(() => store((state) => state));

    let request: any;
    act(() => {
      request = result.current.createRequest('conv-123');
    });

    // GENERATING → WAITING_APPROVALS
    act(() => {
      result.current.transitionRequest(request.id, 'WAITING_APPROVALS');
    });
    expect(store.getState().getRequest(request.id)?.state).toBe('WAITING_APPROVALS');

    // WAITING_APPROVALS → COMPLETED
    act(() => {
      result.current.transitionRequest(request.id, 'COMPLETED');
    });
    expect(store.getState().getRequest(request.id)?.state).toBe('COMPLETED');
  });

  it('应该能添加ToolCall到Request', () => {
    const store = createTestStore();
    const { result } = renderHook(() => store((state) => state));

    let request: any;
    act(() => {
      request = result.current.createRequest('conv-123');
    });

    act(() => {
      result.current.addToolCallToRequest(request.id, 'tool-call-1');
      result.current.addToolCallToRequest(request.id, 'tool-call-2');
    });

    const updated = store.getState().getRequest(request.id);
    expect(updated?.toolCallIds).toContain('tool-call-1');
    expect(updated?.toolCallIds).toContain('tool-call-2');
    expect(updated?.toolCallIds.length).toBe(2);
  });

  it('应该能添加Message到Request', () => {
    const store = createTestStore();
    const { result } = renderHook(() => store((state) => state));

    let request: any;
    act(() => {
      request = result.current.createRequest('conv-123');
    });

    act(() => {
      result.current.addMessageToRequest(request.id, 'msg-1');
      result.current.addMessageToRequest(request.id, 'msg-2');
    });

    const updated = store.getState().getRequest(request.id);
    expect(updated?.messageIds).toContain('msg-1');
    expect(updated?.messageIds).toContain('msg-2');
  });

  it('应该能设置错误状态并记录错误信息', () => {
    const store = createTestStore();
    const { result } = renderHook(() => store((state) => state));

    let request: any;
    act(() => {
      request = result.current.createRequest('conv-123');
    });

    const errorMsg = 'Network timeout';
    act(() => {
      result.current.setRequestError(request.id, errorMsg);
    });

    const updated = store.getState().getRequest(request.id);
    expect(updated?.error).toBe(errorMsg);
  });

  it('应该能完成Request并记录completedTime', () => {
    const store = createTestStore();
    const { result } = renderHook(() => store((state) => state));

    let request: any;
    act(() => {
      request = result.current.createRequest('conv-123');
    });

    const timeBefore = Date.now();
    act(() => {
      result.current.completeRequest(request.id);
    });
    const timeAfter = Date.now();

    const completed = store.getState().getRequest(request.id);
    expect(completed?.state).toBe('COMPLETED');
    expect(completed?.completedTime).toBeDefined();
    if (completed?.completedTime) {
      expect(completed.completedTime >= timeBefore).toBeTruthy();
      expect(completed.completedTime <= timeAfter).toBeTruthy();
    }
  });

  it('应该能清理已完成的Request', () => {
    const store = createTestStore();
    const { result } = renderHook(() => store((state) => state));

    let request: any;
    act(() => {
      request = result.current.createRequest('conv-123');
    });

    expect(store.getState().getRequest(request.id)).toBeDefined();

    act(() => {
      result.current.clearRequest(request.id);
    });

    expect(store.getState().getRequest(request.id)).toBeUndefined();
  });

  it('应该能处理多个并发的Request', () => {
    const store = createTestStore();
    const { result } = renderHook(() => store((state) => state));

    let req1: any, req2: any, req3: any;
    act(() => {
      req1 = result.current.createRequest('conv-1');
      req2 = result.current.createRequest('conv-2');
      req3 = result.current.createRequest('conv-3');
    });

    act(() => {
      result.current.transitionRequest(req1.id, 'WAITING_APPROVALS');
      result.current.transitionRequest(req2.id, 'EXECUTING_TOOLS');
      result.current.transitionRequest(req3.id, 'COMPLETED');
    });

    expect(store.getState().getRequest(req1.id)?.state).toBe('WAITING_APPROVALS');
    expect(store.getState().getRequest(req2.id)?.state).toBe('EXECUTING_TOOLS');
    expect(store.getState().getRequest(req3.id)?.state).toBe('COMPLETED');
  });

  it('应该支持ERROR状态转移处理错误恢复', () => {
    const store = createTestStore();
    const { result } = renderHook(() => store((state) => state));

    let request: any;
    act(() => {
      request = result.current.createRequest('conv-123');
    });

    act(() => {
      result.current.setRequestError(request.id, 'API Error');
      result.current.transitionRequest(request.id, 'ERROR');
    });

    const errored = store.getState().getRequest(request.id);
    expect(errored?.state).toBe('ERROR');
    expect(errored?.error).toBe('API Error');
  });
});
