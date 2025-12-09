/**
 * NoteSlice 测试
 * 测试便签状态管理逻辑
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createStore } from 'zustand';
import { createNoteSlice } from '../../../../src/store/slices/noteSlice';
import { noteService } from '../../../../src/services';
import type { NoteSlice } from '../../../../src/store/slices/noteSlice';
import type { FolderSlice } from '../../../../src/store/slices/folderSlice';
import type { UISlice } from '../../../../src/store/slices/uiSlice';
import { createMockNote } from '../../../utils/testHelpers';

// Mock noteService
vi.mock('../../../../src/services', () => ({
  noteService: {
    listNotes: vi.fn(),
    createNote: vi.fn(),
    deleteNote: vi.fn(),
  },
}));

// Mock store setup
interface TestStore extends NoteSlice, FolderSlice, UISlice {}

const createTestStore = (initialState: Partial<TestStore> = {}) => {
  return createStore<TestStore>((set, get, api) => {
    // 简单的 mock 实现其他 slice 的部分状态
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sliceResult = createNoteSlice(set as any, get as any, api as any);

    return {
      // 默认状态
      folders: [],
      selectedFolderId: null,
      currentFolderName: '未选择',
      showEditor: false,
      ...sliceResult,
      // 覆盖状态
      ...initialState,
    } as TestStore;
  });
};

describe('NoteSlice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('setNotes', () => {
    it('should set notes list', () => {
      const store = createTestStore();
      const notes = [
        {
          id: '1',
          title: 'Note 1',
          folderId: 'f1',
          excerpt: '',
          createdAt: 0,
          updatedAt: 0,
          pinned: false,
          tags: [],
        },
      ];

      store.getState().setNotes(notes);

      expect(store.getState().notes).toEqual(notes);
    });
  });

  describe('setSelectedNote', () => {
    it('should set selected note id and show editor', () => {
      const store = createTestStore();

      store.getState().setSelectedNote('note-1');

      expect(store.getState().selectedNoteId).toBe('note-1');
      expect(store.getState().showEditor).toBe(true);
    });

    it('should clear selected note id and hide editor if null passed', () => {
      const store = createTestStore({ selectedNoteId: 'note-1', showEditor: true });

      store.getState().setSelectedNote(null);

      expect(store.getState().selectedNoteId).toBe(null);
      expect(store.getState().showEditor).toBe(false); // Note: implementation sets showEditor: !!noteId
    });
  });

  describe('loadNotes', () => {
    it('should load notes and updated folder name', async () => {
      const mockNotes = [
        {
          id: '1',
          title: 'Note 1',
          folderId: 'f1',
          excerpt: '',
          createdAt: 0,
          updatedAt: 0,
          pinned: false,
          tags: [],
        },
      ];
      vi.mocked(noteService.listNotes).mockResolvedValue(mockNotes);

      const store = createTestStore({
        folders: [
          { id: 'f1', name: 'Folder 1', createdAt: 0, updatedAt: 0, order: 0, system: false },
        ],
      });

      await store.getState().loadNotes('f1');

      expect(noteService.listNotes).toHaveBeenCalledWith('f1');
      expect(store.getState().notes).toEqual(mockNotes);
      expect(store.getState().currentFolderName).toBe('Folder 1');
    });

    it('should set folder name to default if not found', async () => {
      vi.mocked(noteService.listNotes).mockResolvedValue([]);
      const store = createTestStore({ folders: [] });

      await store.getState().loadNotes('f1');

      expect(store.getState().currentFolderName).toBe('未选择');
    });
  });

  describe('createNote', () => {
    it('should create note and reload list', async () => {
      const newNote = createMockNote({ id: 'new-note', folderId: 'f1' });
      vi.mocked(noteService.createNote).mockResolvedValue(newNote);
      vi.mocked(noteService.listNotes).mockResolvedValue([]); // for loadNotes

      const store = createTestStore({
        folders: [
          { id: 'f1', name: 'Folder 1', createdAt: 0, updatedAt: 0, order: 0, system: false },
        ],
      });

      const result = await store.getState().createNote('f1');

      expect(noteService.createNote).toHaveBeenCalledWith('f1', {});
      expect(noteService.listNotes).toHaveBeenCalledWith('f1'); // createNote calls loadNotes
      expect(result).toEqual(newNote);
    });
  });

  describe('deleteNote', () => {
    it('should delete note and reload list', async () => {
      vi.mocked(noteService.deleteNote).mockResolvedValue(undefined);
      vi.mocked(noteService.listNotes).mockResolvedValue([]);

      const store = createTestStore({
        selectedFolderId: 'f1',
        folders: [
          { id: 'f1', name: 'Folder 1', createdAt: 0, updatedAt: 0, order: 0, system: false },
        ],
      });

      await store.getState().deleteNote('note-1');

      expect(noteService.deleteNote).toHaveBeenCalledWith('note-1');
      expect(noteService.listNotes).toHaveBeenCalledWith('f1');
    });

    it('should clear selection if deleted note was selected', async () => {
      vi.mocked(noteService.deleteNote).mockResolvedValue(undefined);

      const store = createTestStore({
        selectedNoteId: 'note-1',
        selectedFolderId: 'f1',
        showEditor: true,
      });

      await store.getState().deleteNote('note-1');

      expect(store.getState().selectedNoteId).toBeNull();
      expect(store.getState().showEditor).toBe(false);
    });

    it('should NOT clear selection if deleted note was NOT selected', async () => {
      vi.mocked(noteService.deleteNote).mockResolvedValue(undefined);

      const store = createTestStore({
        selectedNoteId: 'other-note',
        selectedFolderId: 'f1',
        showEditor: true,
      });

      await store.getState().deleteNote('note-1');

      expect(store.getState().selectedNoteId).toBe('other-note');
      expect(store.getState().showEditor).toBe(true);
    });
  });
});
