/**
 * UI Slice - 管理界面显示/隐藏状态
 */

import type { StateCreator } from 'zustand';

export interface UISlice {
  // ============ 状态 ============
  showEditor: boolean;
  showSidebar: boolean;

  // ============ Actions ============
  setShowEditor: (show: boolean) => void;
  setShowSidebar: (show: boolean) => void;
  toggleSidebar: () => void;
  toggleEditor: () => void;
}

export const createUISlice: StateCreator<UISlice, [], [], UISlice> = (set) => ({
  // 初始状态
  showEditor: false,
  showSidebar: true,

  // Actions
  setShowEditor: (show) => set({ showEditor: show }),
  setShowSidebar: (show) => set({ showSidebar: show }),
  toggleSidebar: () => set((state) => ({ showSidebar: !state.showSidebar })),
  toggleEditor: () => set((state) => ({ showEditor: !state.showEditor })),
});
