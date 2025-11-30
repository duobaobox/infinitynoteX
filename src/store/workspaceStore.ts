/**
 * Workspace Store - 使用 Zustand 管理工作区状态
 * 替代原有的 Props Drilling 模式
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export type WorkspaceView = 'note' | 'tool';

interface WorkspaceState {
  // ============ UI 状态 ============
  showEditor: boolean;
  showSidebar: boolean;

  // ============ 业务状态 ============
  selectedFolderId: string | null;
  selectedNoteId: string | null;
  selectedToolId: string | null;
  selectedToolItemId: string | null;
  workspaceView: WorkspaceView;

  // 刷新触发器
  refreshListTrigger: number;

  // 首次启动标志
  isFirstLaunch: boolean | null;

  // ============ Actions ============

  // UI 控制
  setShowEditor: (show: boolean) => void;
  setShowSidebar: (show: boolean) => void;
  toggleSidebar: () => void;
  toggleEditor: () => void;

  // 业务逻辑
  setSelectedFolder: (folderId: string | null) => void;
  setSelectedNote: (noteId: string | null) => void;
  setSelectedTool: (toolId: string | null) => void;
  setSelectedToolItem: (itemId: string | null) => void;
  setWorkspaceView: (view: WorkspaceView) => void;

  // 工作区视图切换（带副作用）
  switchToNoteView: (folderId?: string) => void;
  switchToToolView: (toolId?: string) => void;

  // 刷新列表
  triggerListRefresh: () => void;

  // 首次启动
  setIsFirstLaunch: (isFirst: boolean | null) => void;
  completeInitialization: () => void;
}

export const useWorkspaceStore = create<WorkspaceState>()(
  devtools(
    (set) => ({
      // ============ 初始状态 ============
      showEditor: false,
      showSidebar: true,
      selectedFolderId: null,
      selectedNoteId: null,
      selectedToolId: null,
      selectedToolItemId: null,
      workspaceView: 'note',
      refreshListTrigger: 0,
      isFirstLaunch: null,

      // ============ Actions 实现 ============

      // UI 控制
      setShowEditor: (show) => set({ showEditor: show }),
      setShowSidebar: (show) => set({ showSidebar: show }),
      toggleSidebar: () => set((state) => ({ showSidebar: !state.showSidebar })),
      toggleEditor: () => set((state) => ({ showEditor: !state.showEditor })),

      // 业务逻辑
      setSelectedFolder: (folderId) => set({ selectedFolderId: folderId }),

      setSelectedNote: (noteId) =>
        set({
          selectedNoteId: noteId,
          // 选中便签时自动显示编辑器
          showEditor: !!noteId,
        }),

      setSelectedTool: (toolId) => set({ selectedToolId: toolId }),
      setSelectedToolItem: (itemId) => set({ selectedToolItemId: itemId }),
      setWorkspaceView: (view) => set({ workspaceView: view }),

      // 工作区视图切换（带副作用）
      switchToNoteView: (folderId) =>
        set((state) => ({
          workspaceView: 'note',
          selectedFolderId: folderId ?? state.selectedFolderId,
          // 切换到便签视图时，根据是否有选中的便签决定是否显示编辑器
          showEditor: !!state.selectedNoteId,
        })),

      switchToToolView: (toolId) =>
        set((state) => ({
          workspaceView: 'tool',
          selectedToolId: toolId ?? state.selectedToolId,
          // 切换到工具视图时，如果编辑器未显示，则显示
          showEditor: state.showEditor || true,
        })),

      // 刷新列表
      triggerListRefresh: () =>
        set((state) => ({
          refreshListTrigger: state.refreshListTrigger + 1,
        })),

      // 首次启动
      setIsFirstLaunch: (isFirst) => set({ isFirstLaunch: isFirst }),
      completeInitialization: () => set({ isFirstLaunch: false }),
    }),
    {
      name: 'WorkspaceStore',
      enabled: process.env.NODE_ENV === 'development',
    },
  ),
);
