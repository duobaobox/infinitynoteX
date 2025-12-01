/**
 * Workspace View Slice - 管理工作区视图切换和相关状态
 */

import type { StateCreator } from 'zustand';
import type { UISlice } from './uiSlice';
import type { FolderSlice } from './folderSlice';
import type { NoteSlice } from './noteSlice';
import type { AIConversationSlice } from './aiConversationSlice';

export type WorkspaceView = 'note' | 'tool';

// 定义依赖的其他 slice 类型（switchToNoteView 需要访问 FolderSlice.selectedFolderId）
type WorkspaceViewSliceDeps = UISlice & FolderSlice & NoteSlice & AIConversationSlice;

export interface WorkspaceViewSlice {
  // ============ 状态 ============
  workspaceView: WorkspaceView;
  resetEditorTabTrigger: number;
  isFirstLaunch: boolean | null;

  // ============ Actions ============
  setWorkspaceView: (view: WorkspaceView) => void;
  switchToNoteView: (folderId?: string) => void;
  switchToToolView: (toolId?: string) => void;
  resetEditorTab: () => void;
  setIsFirstLaunch: (isFirst: boolean | null) => void;
  completeInitialization: () => void;
}

export const createWorkspaceViewSlice: StateCreator<
  WorkspaceViewSlice & WorkspaceViewSliceDeps,
  [],
  [],
  WorkspaceViewSlice
> = (set) => ({
  // 初始状态
  workspaceView: 'note',
  resetEditorTabTrigger: 0,
  isFirstLaunch: null,

  // Actions
  setWorkspaceView: (view) => set({ workspaceView: view }),

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

  resetEditorTab: () =>
    set((state) => ({
      resetEditorTabTrigger: state.resetEditorTabTrigger + 1,
    })),

  setIsFirstLaunch: (isFirst) => set({ isFirstLaunch: isFirst }),
  completeInitialization: () => set({ isFirstLaunch: false }),
});
