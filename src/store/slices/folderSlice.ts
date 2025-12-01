/**
 * Folder Slice - 管理文件夹数据和选中状态
 */

import type { StateCreator } from 'zustand';
import type { Folder } from '../../services/types';
import { folderService } from '../../services';

export interface FolderSlice {
  // ============ 状态 ============
  folders: Folder[];
  selectedFolderId: string | null;
  currentFolderName: string;

  // ============ Actions ============
  setFolders: (folders: Folder[]) => void;
  setSelectedFolder: (folderId: string | null) => void;
  loadFolders: () => Promise<void>;
  createFolder: (name: string) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;
  renameFolder: (id: string, name: string) => Promise<void>;
}

export const createFolderSlice: StateCreator<FolderSlice, [], [], FolderSlice> = (set, get) => ({
  // 初始状态
  folders: [],
  selectedFolderId: null,
  currentFolderName: '未选择',

  // Actions
  setFolders: (folders) => set({ folders }),
  setSelectedFolder: (folderId) => set({ selectedFolderId: folderId }),

  loadFolders: async () => {
    try {
      const folders = await folderService.listFolders();
      set({ folders });
    } catch (error) {
      console.error('[FolderSlice] Failed to load folders:', error);
    }
  },

  createFolder: async (name) => {
    try {
      await folderService.createFolder(name);
      await get().loadFolders();
    } catch (error) {
      console.error('[FolderSlice] Failed to create folder:', error);
      throw error;
    }
  },

  deleteFolder: async (id) => {
    try {
      await folderService.deleteFolder(id);
      await get().loadFolders();
      // 如果删除的是当前选中的文件夹，清空选中状态
      if (get().selectedFolderId === id) {
        set({ selectedFolderId: null });
      }
    } catch (error) {
      console.error('[FolderSlice] Failed to delete folder:', error);
      throw error;
    }
  },

  renameFolder: async (id, name) => {
    try {
      await folderService.renameFolder(id, name);
      await get().loadFolders();
    } catch (error) {
      console.error('[FolderSlice] Failed to rename folder:', error);
      throw error;
    }
  },
});
