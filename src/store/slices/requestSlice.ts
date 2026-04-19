/**
 * Request Slice - 管理 AI 对话请求的生命周期
 *
 * 一个Request代表从用户输入到AI完整回复的整个过程
 * Request管理：状态转移、关联的工具调用、关联的消息
 */

import type { StateCreator } from 'zustand';

// ============ 类型定义 ============

export type RequestState =
  | 'IDLE'
  | 'GENERATING'
  | 'WAITING_APPROVALS'
  | 'EXECUTING_TOOLS'
  | 'COMPLETED'
  | 'ERROR';

export interface Request {
  id: string;
  conversationId: string;
  state: RequestState;
  toolCallIds: string[]; // 此请求包含的所有工具调用IDs
  messageIds: string[]; // 此请求产生的消息IDs
  startTime: number;
  completedTime?: number;
  error?: string;
}

export interface RequestSlice {
  // ============ 状态 ============
  currentRequest: Request | null;
  requests: Record<string, Request>; // 历史请求，用于调试和恢复

  // ============ Actions ============
  createRequest: (conversationId: string) => Request;
  transitionRequest: (requestId: string, newState: RequestState) => void;
  addToolCallToRequest: (requestId: string, toolCallId: string) => void;
  addMessageToRequest: (requestId: string, messageId: string) => void;
  setRequestError: (requestId: string, error: string) => void;
  completeRequest: (requestId: string) => void;
  clearRequest: (requestId: string) => void;
  getRequest: (requestId: string) => Request | undefined;
  hasPendingApprovals: (requestId: string, toolCallGetter: (id: string) => unknown) => boolean;
}

// ============ Slice 实现 ============

function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export const createRequestSlice: StateCreator<RequestSlice, [], [], RequestSlice> = (set, get) => ({
  // 初始状态
  currentRequest: null,
  requests: {},

  // 创建新请求
  createRequest: (conversationId) => {
    const request: Request = {
      id: generateRequestId(),
      conversationId,
      state: 'GENERATING',
      toolCallIds: [],
      messageIds: [],
      startTime: Date.now(),
    };

    set((state) => ({
      currentRequest: request,
      requests: {
        ...state.requests,
        [request.id]: request,
      },
    }));

    return request;
  },

  // 状态转移
  transitionRequest: (requestId, newState) => {
    set((state) => {
      const request = state.requests[requestId];
      if (!request) return state;

      const updated = { ...request, state: newState };

      // 完成或出错时记录完成时间
      if (newState === 'COMPLETED' || newState === 'ERROR') {
        updated.completedTime = Date.now();
      }

      return {
        requests: {
          ...state.requests,
          [requestId]: updated,
        },
        currentRequest: state.currentRequest?.id === requestId ? updated : state.currentRequest,
      };
    });
  },

  // 添加工具调用到请求
  addToolCallToRequest: (requestId, toolCallId) => {
    set((state) => {
      const request = state.requests[requestId];
      if (!request) return state;

      // 使用Set去重
      const toolCallIds = Array.from(new Set([...request.toolCallIds, toolCallId]));
      const updated = { ...request, toolCallIds };

      return {
        requests: {
          ...state.requests,
          [requestId]: updated,
        },
        currentRequest: state.currentRequest?.id === requestId ? updated : state.currentRequest,
      };
    });
  },

  // 添加消息到请求
  addMessageToRequest: (requestId, messageId) => {
    set((state) => {
      const request = state.requests[requestId];
      if (!request) return state;

      // 使用Set去重
      const messageIds = Array.from(new Set([...request.messageIds, messageId]));
      const updated = { ...request, messageIds };

      return {
        requests: {
          ...state.requests,
          [requestId]: updated,
        },
        currentRequest: state.currentRequest?.id === requestId ? updated : state.currentRequest,
      };
    });
  },

  // 设置请求错误
  setRequestError: (requestId, error) => {
    set((state) => {
      const request = state.requests[requestId];
      if (!request) return state;

      const updated: Request = {
        ...request,
        state: 'ERROR',
        error,
        completedTime: Date.now(),
      };

      return {
        requests: {
          ...state.requests,
          [requestId]: updated,
        },
        currentRequest: state.currentRequest?.id === requestId ? updated : state.currentRequest,
      };
    });
  },

  // 完成请求
  completeRequest: (requestId) => {
    get().transitionRequest(requestId, 'COMPLETED');
  },

  clearRequest: (requestId) => {
    set((state) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [requestId]: _, ...rest } = state.requests;
      return {
        requests: rest,
        currentRequest: state.currentRequest?.id === requestId ? null : state.currentRequest,
      };
    });
  },

  // 获取请求
  getRequest: (requestId) => {
    return get().requests[requestId];
  },

  // 检查是否有待批准的工具
  // 注意：需要传入toolCallGetter因为ToolCallSlice还没有实现
  hasPendingApprovals: (requestId, toolCallGetter) => {
    const request = get().requests[requestId];
    if (!request) return false;

    return request.toolCallIds.some((id) => {
      const toolCall = toolCallGetter(id);
      return toolCall?.state?.type === 'PENDING_APPROVAL';
    });
  },
});
