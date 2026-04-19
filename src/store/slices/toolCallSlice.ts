/**
 * ToolCall Slice - 管理工具调用的状态机
 *
 * 工具调用生命周期：
 * DRAFTING → PENDING_APPROVAL → EXECUTING → SUCCESS/ERROR/REJECTED
 */

import type { StateCreator } from 'zustand';

// ============ 类型定义 ============

export type ToolCallStateType =
  | { type: 'DRAFTING'; input: string }
  | { type: 'PENDING_APPROVAL'; input: unknown; preview: string }
  | { type: 'EXECUTING' }
  | { type: 'SUCCESS'; result: unknown }
  | { type: 'ERROR'; error: string }
  | { type: 'REJECTED'; reason?: string };

export interface ToolCall {
  id: string;
  requestId: string;
  toolName: string;
  state: ToolCallStateType;
  createdAt: number;
}

export interface ToolCallSlice {
  // ============ 状态 ============
  toolCalls: Record<string, ToolCall>;

  // ============ Actions ============
  createToolCall: (requestId: string, toolCallId: string, toolName: string) => ToolCall;
  updateToolCallDraft: (toolCallId: string, delta: string) => void;
  completeToolCallDraft: (toolCallId: string, input: unknown, preview: string) => void;
  approveToolCall: (toolCallId: string) => void;
  rejectToolCall: (toolCallId: string, reason?: string) => void;
  completeToolCall: (toolCallId: string, result: unknown) => void;
  failToolCall: (toolCallId: string, error: string) => void;
  getToolCall: (toolCallId: string) => ToolCall | undefined;
}

// ============ Slice 实现 ============

export const createToolCallSlice: StateCreator<ToolCallSlice, [], [], ToolCallSlice> = (
  set,
  get,
) => ({
  // 初始状态
  toolCalls: {},

  // 创建工具调用（初始状态：DRAFTING）
  createToolCall: (requestId, toolCallId, toolName) => {
    const toolCall: ToolCall = {
      id: toolCallId,
      requestId,
      toolName,
      state: { type: 'DRAFTING', input: '' },
      createdAt: Date.now(),
    };

    set((state) => ({
      toolCalls: {
        ...state.toolCalls,
        [toolCallId]: toolCall,
      },
    }));

    return toolCall;
  },

  // 更新工具参数draft（接收流式delta）
  updateToolCallDraft: (toolCallId, delta) => {
    set((state) => {
      const toolCall = state.toolCalls[toolCallId];
      if (!toolCall || toolCall.state.type !== 'DRAFTING') return state;

      return {
        toolCalls: {
          ...state.toolCalls,
          [toolCallId]: {
            ...toolCall,
            state: {
              ...toolCall.state,
              input: toolCall.state.input + delta,
            },
          },
        },
      };
    });
  },

  // 完成工具参数draft（转移到PENDING_APPROVAL）
  completeToolCallDraft: (toolCallId, input, preview) => {
    set((state) => {
      const toolCall = state.toolCalls[toolCallId];
      if (!toolCall || toolCall.state.type !== 'DRAFTING') return state;

      return {
        toolCalls: {
          ...state.toolCalls,
          [toolCallId]: {
            ...toolCall,
            state: {
              type: 'PENDING_APPROVAL' as const,
              input,
              preview,
            },
          },
        },
      };
    });
  },

  // 用户批准工具（转移到EXECUTING）
  approveToolCall: (toolCallId) => {
    set((state) => {
      const toolCall = state.toolCalls[toolCallId];
      if (!toolCall || toolCall.state.type !== 'PENDING_APPROVAL') return state;

      return {
        toolCalls: {
          ...state.toolCalls,
          [toolCallId]: {
            ...toolCall,
            state: {
              type: 'EXECUTING' as const,
            },
          },
        },
      };
    });
  },

  // 用户拒绝工具（转移到REJECTED）
  rejectToolCall: (toolCallId, reason) => {
    set((state) => {
      const toolCall = state.toolCalls[toolCallId];
      if (!toolCall) return state;

      // 允许从DRAFTING或PENDING_APPROVAL状态拒绝
      if (toolCall.state.type !== 'DRAFTING' && toolCall.state.type !== 'PENDING_APPROVAL') {
        return state;
      }

      return {
        toolCalls: {
          ...state.toolCalls,
          [toolCallId]: {
            ...toolCall,
            state: {
              type: 'REJECTED' as const,
              reason,
            },
          },
        },
      };
    });
  },

  // 工具执行成功（转移到SUCCESS）
  completeToolCall: (toolCallId, result) => {
    set((state) => {
      const toolCall = state.toolCalls[toolCallId];
      if (!toolCall || toolCall.state.type !== 'EXECUTING') return state;

      return {
        toolCalls: {
          ...state.toolCalls,
          [toolCallId]: {
            ...toolCall,
            state: {
              type: 'SUCCESS' as const,
              result,
            },
          },
        },
      };
    });
  },

  // 工具执行失败（转移到ERROR）
  failToolCall: (toolCallId, error) => {
    set((state) => {
      const toolCall = state.toolCalls[toolCallId];
      if (!toolCall || toolCall.state.type !== 'EXECUTING') return state;

      return {
        toolCalls: {
          ...state.toolCalls,
          [toolCallId]: {
            ...toolCall,
            state: {
              type: 'ERROR' as const,
              error,
            },
          },
        },
      };
    });
  },

  // 获取工具调用
  getToolCall: (toolCallId) => {
    return get().toolCalls[toolCallId];
  },
});
