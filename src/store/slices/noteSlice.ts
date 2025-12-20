/**
 * Note Slice - 管理便签数据和选中状态
 */

import type { StateCreator } from 'zustand';
import type { NoteIndex, Note } from '../../services/types';
import { noteService } from '../../services';
import type { FolderSlice } from './folderSlice';
import type { UISlice } from './uiSlice';

// 定义 NoteSlice 依赖的其他 slice 类型
type NoteSliceDeps = UISlice & FolderSlice;

export interface NoteSlice {
  // ============ 状态 ============
  notes: NoteIndex[];
  selectedNoteId: string | null;
  refreshListTrigger: number;
  /** 任务路径定位参数（用于 Todo 跳转时定位到特定任务） */
  noteTaskPath: number[] | null;

  // ============ Actions ============
  setNotes: (notes: NoteIndex[]) => void;
  setSelectedNote: (noteId: string | null, taskPath?: number[] | null) => void;
  loadNotes: (folderId: string) => Promise<void>;
  createNote: (folderId: string) => Promise<Note>;
  deleteNote: (id: string) => Promise<void>;
  triggerListRefresh: () => void;
  clearNoteTaskPath: () => void;
}

export const createNoteSlice: StateCreator<NoteSlice & NoteSliceDeps, [], [], NoteSlice> = (
  set,
  get,
) => ({
  // 初始状态
  notes: [],
  selectedNoteId: null,
  refreshListTrigger: 0,
  noteTaskPath: null,

  // Actions
  setNotes: (notes) => set({ notes }),

  setSelectedNote: (noteId, taskPath = null) =>
    // 使用函数式更新，确保即使 ID 相同也能更新 showEditor
    set((state) => ({
      selectedNoteId: noteId,
      noteTaskPath: taskPath,
      // 强制设为 true（解决折叠后点击无法展开的问题）
      showEditor: noteId ? true : state.showEditor,
    })),

  clearNoteTaskPath: () => set({ noteTaskPath: null }),

  loadNotes: async (folderId) => {
    try {
      const notes = await noteService.listNotes(folderId);
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
      const note = await noteService.createNote(folderId, {});
      await get().loadNotes(folderId);
      return note;
    } catch (error) {
      console.error('[NoteSlice] Failed to create note:', error);
      throw error;
    }
  },

  deleteNote: async (id) => {
    try {
      await noteService.deleteNote(id);
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
