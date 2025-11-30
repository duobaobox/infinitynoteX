/**
 * Workspace Store - 使用 Zustand 管理工作区状态
 * 替代原有的 Props Drilling 模式
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { Folder, NoteIndex } from '../services/types';
import type { AIConversationPreview } from '../constants/tools';

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

  // ============ 数据状态 ============
  folders: Folder[];
  currentFolderName: string;
  notes: NoteIndex[];
  aiConversations: AIConversationPreview[];

  // 刷新触发器
  refreshListTrigger: number;
  refreshAIConversationsTrigger: number;

  // Tab 重置触发器（用于重置编辑器/对话面板的 tab 到第一个）
  resetEditorTabTrigger: number;

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
  triggerAIConversationsRefresh: () => void;

  // 重置编辑器 tab
  resetEditorTab: () => void;

  // 首次启动
  setIsFirstLaunch: (isFirst: boolean | null) => void;
  completeInitialization: () => void;

  // ============ 数据管理 Actions ============

  // Folders
  setFolders: (folders: Folder[]) => void;
  loadFolders: () => Promise<void>;
  createFolder: (name: string) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;
  renameFolder: (id: string, name: string) => Promise<void>;

  // Notes
  setNotes: (notes: NoteIndex[]) => void;
  loadNotes: (folderId: string) => Promise<void>;
  createNote: (folderId: string) => Promise<NoteIndex>;
  deleteNote: (id: string) => Promise<void>;

  // AI Conversations
  setAIConversations: (conversations: AIConversationPreview[]) => void;
  loadAIConversations: () => Promise<void>;
  createAIConversation: () => Promise<void>;
  deleteAIConversation: (id: string) => Promise<void>;
}

export const useWorkspaceStore = create<WorkspaceState>()(
  devtools(
    (set, get) => ({
      // ============ 初始状态 ============
      showEditor: false,
      showSidebar: true,
      selectedFolderId: null,
      selectedNoteId: null,
      selectedToolId: null,
      selectedToolItemId: null,
      workspaceView: 'note',

      // 数据状态
      folders: [],
      currentFolderName: '未选择',
      notes: [],
      aiConversations: [],

      refreshListTrigger: 0,
      refreshAIConversationsTrigger: 0,
      resetEditorTabTrigger: 0,
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

      triggerAIConversationsRefresh: () =>
        set((state) => ({
          refreshAIConversationsTrigger: state.refreshAIConversationsTrigger + 1,
        })),

      // 重置编辑器 tab
      resetEditorTab: () =>
        set((state) => ({
          resetEditorTabTrigger: state.resetEditorTabTrigger + 1,
        })),

      // 首次启动
      setIsFirstLaunch: (isFirst) => set({ isFirstLaunch: isFirst }),
      completeInitialization: () => set({ isFirstLaunch: false }),

      // ============ 数据管理 Actions 实现 ============

      // Folders
      setFolders: (folders) => set({ folders }),

      loadFolders: async () => {
        try {
          const folders = await window.storage.listFolders();
          set({ folders });
        } catch (error) {
          console.error('[workspaceStore] Failed to load folders:', error);
        }
      },

      createFolder: async (name) => {
        try {
          await window.storage.createFolder(name);
          await get().loadFolders();
        } catch (error) {
          console.error('[workspaceStore] Failed to create folder:', error);
          throw error;
        }
      },

      deleteFolder: async (id) => {
        try {
          await window.storage.deleteFolder(id);
          await get().loadFolders();
          // 如果删除的是当前选中的文件夹，清空选中状态
          if (get().selectedFolderId === id) {
            set({ selectedFolderId: null, selectedNoteId: null, notes: [] });
          }
        } catch (error) {
          console.error('[workspaceStore] Failed to delete folder:', error);
          throw error;
        }
      },

      renameFolder: async (id, name) => {
        try {
          await window.storage.renameFolder(id, name);
          await get().loadFolders();
        } catch (error) {
          console.error('[workspaceStore] Failed to rename folder:', error);
          throw error;
        }
      },

      // Notes
      setNotes: (notes) => set({ notes }),

      loadNotes: async (folderId) => {
        try {
          const notes = await window.storage.listNotes(folderId);
          // 获取文件夹名称
          const folder = get().folders.find((f) => f.id === folderId);
          set({
            notes,
            currentFolderName: folder?.name || '未选择',
          });
        } catch (error) {
          console.error('[workspaceStore] Failed to load notes:', error);
        }
      },

      createNote: async (folderId) => {
        try {
          const note = await window.storage.createNote(folderId, {});
          await get().loadNotes(folderId);
          return note;
        } catch (error) {
          console.error('[workspaceStore] Failed to create note:', error);
          throw error;
        }
      },

      deleteNote: async (id) => {
        try {
          await window.storage.deleteNote(id);
          const { selectedFolderId } = get();
          if (selectedFolderId) {
            await get().loadNotes(selectedFolderId);
          }
          // 如果删除的是当前选中的便签，清空选中状态
          if (get().selectedNoteId === id) {
            set({ selectedNoteId: null, showEditor: false });
          }
        } catch (error) {
          console.error('[workspaceStore] Failed to delete note:', error);
          throw error;
        }
      },

      // AI Conversations
      setAIConversations: (conversations) => set({ aiConversations: conversations }),

      loadAIConversations: async () => {
        try {
          const conversations = await window.storage.getAIConversations();
          set({ aiConversations: conversations });
        } catch (error) {
          console.error('[workspaceStore] Failed to load AI conversations:', error);
        }
      },

      createAIConversation: async () => {
        try {
          await window.storage.createAIConversation();
          await get().loadAIConversations();
        } catch (error) {
          console.error('[workspaceStore] Failed to create AI conversation:', error);
          throw error;
        }
      },

      deleteAIConversation: async (id) => {
        try {
          await window.storage.deleteAIConversation(id);
          await get().loadAIConversations();
          // 如果删除的是当前选中的对话，清空选中状态
          if (get().selectedToolItemId === id) {
            set({ selectedToolItemId: null });
          }
        } catch (error) {
          console.error('[workspaceStore] Failed to delete AI conversation:', error);
          throw error;
        }
      },
    }),
    {
      name: 'WorkspaceStore',
      enabled: process.env.NODE_ENV === 'development',
    },
  ),
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
