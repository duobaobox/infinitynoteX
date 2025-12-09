/**
 * NoteService 测试
 * 测试 noteService 对 window.storage 的调用
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { noteService } from '../../../../src/services/noteService';
import { createMockNote } from '../../../utils/testHelpers';

// Mock window.storage
const mockStorage = {
  listNotes: vi.fn(),
  getNote: vi.fn(),
  createNote: vi.fn(),
  updateNote: vi.fn(),
  deleteNote: vi.fn(),
};

Object.assign(window, { storage: mockStorage });

describe('NoteService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('listNotes should call window.storage.listNotes', async () => {
    const notes = [createMockNote({ id: '1' })];
    mockStorage.listNotes.mockResolvedValue(notes);

    const result = await noteService.listNotes('f1');
    expect(mockStorage.listNotes).toHaveBeenCalledWith('f1');
    expect(result).toEqual(notes);
  });

  it('getNote should call window.storage.getNote', async () => {
    const note = createMockNote({ id: '1' });
    mockStorage.getNote.mockResolvedValue(note);

    const result = await noteService.getNote('1');
    expect(mockStorage.getNote).toHaveBeenCalledWith('1');
    expect(result).toEqual(note);
  });

  it('createNote should call window.storage.createNote', async () => {
    const note = createMockNote({ id: '1' });
    mockStorage.createNote.mockResolvedValue(note);
    const payload = { title: 'New Note' };

    const result = await noteService.createNote('f1', payload);
    expect(mockStorage.createNote).toHaveBeenCalledWith('f1', payload);
    expect(result).toEqual(note);
  });

  it('updateNote should call window.storage.updateNote', async () => {
    mockStorage.updateNote.mockResolvedValue(undefined);
    const payload = { title: 'Updated' };

    await noteService.updateNote('1', payload);
    expect(mockStorage.updateNote).toHaveBeenCalledWith('1', payload);
  });

  it('deleteNote should call window.storage.deleteNote', async () => {
    mockStorage.deleteNote.mockResolvedValue(undefined);

    await noteService.deleteNote('1');
    expect(mockStorage.deleteNote).toHaveBeenCalledWith('1');
  });
});
