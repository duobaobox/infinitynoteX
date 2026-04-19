/**
 * Retrieval Slice - 管理 RAG 检索的状态
 *
 * 检索状态：禁用 → 搜索中 → 完成 / 取消
 */

import type { StateCreator } from 'zustand';

// ============ 类型定义 ============

export type RetrievalStrategy = 'disabled' | 'tool-only' | 'prefetch' | 'hybrid';

export type RagSource = {
  key: number;
  title: string;
  description?: string;
  noteId?: string;
};

export interface RetrievalContext {
  query: string;
  strategy: RetrievalStrategy;
  sources: RagSource[];
  completed: boolean;
}

export interface RetrievalSlice {
  // ============ 状态 ============
  currentContext: RetrievalContext | null;
  isSearching: boolean;

  // ============ Actions ============
  startRetrieval: (query: string, strategy: RetrievalStrategy) => void;
  completeRetrieval: (sources: RagSource[]) => void;
  cancelRetrieval: () => void;
  clearRetrievalContext: () => void;
}

// ============ Slice 实现 ============

export const createRetrievalSlice: StateCreator<RetrievalSlice, [], [], RetrievalSlice> = (
  set,
) => ({
  // 初始状态
  currentContext: null,
  isSearching: false,

  // 开始检索
  startRetrieval: (query, strategy) => {
    set({
      currentContext: {
        query,
        strategy,
        sources: [],
        completed: false,
      },
      isSearching: true,
    });
  },

  // 完成检索
  completeRetrieval: (sources) => {
    set((state) => {
      if (!state.currentContext) return state;

      return {
        currentContext: {
          ...state.currentContext,
          sources,
          completed: true,
        },
        isSearching: false,
      };
    });
  },

  // 取消检索
  cancelRetrieval: () => {
    set({
      currentContext: null,
      isSearching: false,
    });
  },

  // 清理检索上下文
  clearRetrievalContext: () => {
    set({
      currentContext: null,
    });
  },
});
