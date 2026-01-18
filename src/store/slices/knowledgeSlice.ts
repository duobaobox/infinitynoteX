import { StateCreator } from 'zustand';
import { SettingsState } from '../settingsStore';

export interface KnowledgeSlice {
  // ============ 任务状态 ============
  isIndexing: boolean; // 全量重建中
  isIncrementalUpdating: boolean; // 增量更新中
  reindexingNoteId: string | null; // 正在重建的单个笔记 ID

  // ============ Actions ============
  setIndexing: (status: boolean) => void;
  setIncrementalUpdating: (status: boolean) => void;
  setReindexingNoteId: (noteId: string | null) => void;
}

export const createKnowledgeSlice: StateCreator<SettingsState, [], [], KnowledgeSlice> = (set) => ({
  isIndexing: false,
  isIncrementalUpdating: false,
  reindexingNoteId: null,

  setIndexing: (status) => set({ isIndexing: status }),
  setIncrementalUpdating: (status) => set({ isIncrementalUpdating: status }),
  setReindexingNoteId: (noteId) => set({ reindexingNoteId: noteId }),
});
