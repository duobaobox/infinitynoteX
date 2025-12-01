/**
 * Note Slice - 管理便签数据和选中状态
 */

import type { StateCreator } from 'zustand';
import type { NoteIndex, Note } from '../../services/types';
import type { FolderSlice } from './folderSlice';
import type { UISlice } from './uiSlice';

// 定义 NoteSlice 依赖的其他 slice 类型
type NoteSliceDeps = UISlice & FolderSlice;

export interface NoteSlice {
  // ============ 状态 ============
  notes: NoteIndex[];
  selectedNoteId: string | null;
  refreshListTrigger: number;

  // ============ Actions ============
  setNotes: (notes: NoteIndex[]) => void;
  setSelectedNote: (noteId: string | null) => void;
  loadNotes: (folderId: string) => Promise<void>;
  createNote: (folderId: string) => Promise<Note>;
  deleteNote: (id: string) => Promise<void>;
  triggerListRefresh: () => void;
}

export const createNoteSlice: StateCreator<NoteSlice & NoteSliceDeps, [], [], NoteSlice> = (
  set,
  get,
) => ({
  // 初始状态
  notes: [],
  selectedNoteId: null,
  refreshListTrigger: 0,

  // Actions
  setNotes: (notes) => set({ notes }),

  setSelectedNote: (noteId) =>
    set({
      selectedNoteId: noteId,
      // 选中便签时自动显示编辑器
      showEditor: !!noteId,
    }),

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
      console.error('[NoteSlice] Failed to load notes:', error);
    }
  },

  createNote: async (folderId) => {
    try {
      const note = await window.storage.createNote(folderId, {});
      await get().loadNotes(folderId);
      return note;
    } catch (error) {
      console.error('[NoteSlice] Failed to create note:', error);
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
      console.error('[NoteSlice] Failed to delete note:', error);
      throw error;
    }
  },

  triggerListRefresh: () =>
    set((state) => ({
      refreshListTrigger: state.refreshListTrigger + 1,
    })),
});
