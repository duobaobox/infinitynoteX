/**
 * FolderSlice 测试
 * 测试文件夹状态管理逻辑
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createStore } from 'zustand';
import { createFolderSlice } from '../../../../src/store/slices/folderSlice';
import type { FolderSlice } from '../../../../src/store/slices/folderSlice';
import { createMockFolder } from '../../../utils/testHelpers';

const mockStorage = {
  listFolders: vi.fn(),
  createFolder: vi.fn(),
  deleteFolder: vi.fn(),
  renameFolder: vi.fn(),
};

// Mock store setup
interface TestStore extends FolderSlice {}

const createTestStore = (initialState: Partial<TestStore> = {}) => {
  return createStore<TestStore>((set, get, api) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sliceResult = createFolderSlice(set as any, get as any, api as any);
    return {
      // 合并 slice 结果
      ...sliceResult,
      // 覆盖状态（用于测试）
      ...initialState,
    };
  });
};

describe('FolderSlice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(window, { storage: mockStorage });
  });

  describe('setFolders', () => {
    it('should set folders list', () => {
      const store = createTestStore();
      const folders = [createMockFolder({ id: 'f1', name: 'Folder 1' })];

      store.getState().setFolders(folders);

      expect(store.getState().folders).toEqual(folders);
    });
  });

  describe('setSelectedFolder', () => {
    it('should set selected folder', () => {
      const store = createTestStore();
      store.getState().setSelectedFolder('f1');
      expect(store.getState().selectedFolderId).toBe('f1');
    });
  });

  describe('loadFolders', () => {
    it('should load folders from service', async () => {
      const mockFolders = [createMockFolder({ id: 'f1' })];
      mockStorage.listFolders.mockResolvedValue(mockFolders);

      const store = createTestStore();
      await store.getState().loadFolders();

      expect(mockStorage.listFolders).toHaveBeenCalled();
      expect(store.getState().folders).toEqual(mockFolders);
    });
  });

  describe('createFolder', () => {
    it('should create folder and reload list', async () => {
      mockStorage.createFolder.mockResolvedValue(undefined);
      mockStorage.listFolders.mockResolvedValue([]);

      const store = createTestStore();
      await store.getState().createFolder('New Folder');

      expect(mockStorage.createFolder).toHaveBeenCalledWith('New Folder');
      expect(mockStorage.listFolders).toHaveBeenCalled();
    });
  });

  describe('deleteFolder', () => {
    it('should delete folder and reload list', async () => {
      mockStorage.deleteFolder.mockResolvedValue(undefined);
      mockStorage.listFolders.mockResolvedValue([]);

      const store = createTestStore({ selectedFolderId: 'f2' });
      await store.getState().deleteFolder('f1');

      expect(mockStorage.deleteFolder).toHaveBeenCalledWith('f1');
      expect(mockStorage.listFolders).toHaveBeenCalled();
      // Should not change selection if deleted folder is not selected
      expect(store.getState().selectedFolderId).toBe('f2');
    });

    it('should clear selection if deleted folder was selected', async () => {
      mockStorage.deleteFolder.mockResolvedValue(undefined);
      mockStorage.listFolders.mockResolvedValue([]);

      const store = createTestStore({ selectedFolderId: 'f1' });
      await store.getState().deleteFolder('f1');

      expect(store.getState().selectedFolderId).toBeNull();
    });
  });

  describe('renameFolder', () => {
    it('should rename folder and reload list', async () => {
      mockStorage.renameFolder.mockResolvedValue(undefined);
      mockStorage.listFolders.mockResolvedValue([]);

      const store = createTestStore();
      await store.getState().renameFolder('f1', 'Renamed');

      expect(mockStorage.renameFolder).toHaveBeenCalledWith('f1', 'Renamed');
      expect(mockStorage.listFolders).toHaveBeenCalled();
    });
  });
});
