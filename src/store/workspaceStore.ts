/**
 * Workspace Store - 使用 Zustand Slices 模式管理工作区状态
 *
 * 架构说明：
 * - 状态按领域拆分为独立的 slices（UI、Folder、Note、AIConversation、WorkspaceView）
 * - 每个 slice 负责自己领域的状态和 actions
 * - 主 store 组合所有 slices，提供统一的访问入口
 * - 使用 selectors 进行性能优化的状态订阅
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import {
  UISlice,
  createUISlice,
  FolderSlice,
  createFolderSlice,
  NoteSlice,
  createNoteSlice,
  AIConversationSlice,
  createAIConversationSlice,
  BrowserCardsSlice,
  createBrowserCardsSlice,
  TodoSlice,
  createTodoSlice,
  WorkspaceViewSlice,
  createWorkspaceViewSlice,
} from './slices';

// ============ 组合所有 Slices 的完整状态类型 ============
export type WorkspaceState = UISlice &
  FolderSlice &
  NoteSlice &
  AIConversationSlice &
  BrowserCardsSlice &
  TodoSlice &
  WorkspaceViewSlice;

// 为了向后兼容，保留 WorkspaceView 类型导出
export type { WorkspaceView } from './slices/workspaceViewSlice';

// ============ 创建组合 Store ============
import { StateCreator } from 'zustand';

const createStoreSlice: StateCreator<WorkspaceState> = (...a) => ({
  ...createUISlice(...a),
  ...createFolderSlice(...a),
  ...createNoteSlice(...a),
  ...createAIConversationSlice(...a),
  ...createBrowserCardsSlice(...a),
  ...createTodoSlice(...a),
  ...createWorkspaceViewSlice(...a),
});

export const useWorkspaceStore = create<WorkspaceState>()(
  (process.env.NODE_ENV === 'development'
    ? devtools(createStoreSlice, { name: 'WorkspaceStore' })
    : createStoreSlice) as StateCreator<WorkspaceState>,
);

// ============ 数据同步副作用 ============

/**
 * 监听 selectedFolderId 变化，自动加载对应的 notes
 */
export const setupFolderNotesSync = () => {
  let prevFolderId = useWorkspaceStore.getState().selectedFolderId;

  return useWorkspaceStore.subscribe((state) => {
    if (state.selectedFolderId !== prevFolderId) {
      prevFolderId = state.selectedFolderId;
      if (prevFolderId) {
        state.loadNotes(prevFolderId);
      } else {
        // 如果没有选中文件夹，清空 notes
        useWorkspaceStore.setState({ notes: [], currentFolderName: '未选择' });
      }
    }
  });
};

// ============ 导出 Selectors ============
export * from './selectors';
