/**
 * FolderService 测试
 * 测试 folderService 对 window.storage 的调用
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { folderService } from '../../../../src/services/folderService';
import { createMockFolder } from '../../../utils/testHelpers';

// Mock window.storage
const mockStorage = {
  listFolders: vi.fn(),
  createFolder: vi.fn(),
  deleteFolder: vi.fn(),
  renameFolder: vi.fn(),
};

Object.assign(window, { storage: mockStorage });

describe('FolderService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('listFolders should call window.storage.listFolders', async () => {
    const folders = [createMockFolder({ id: 'f1' })];
    mockStorage.listFolders.mockResolvedValue(folders);

    const result = await folderService.listFolders();
    expect(mockStorage.listFolders).toHaveBeenCalled();
    expect(result).toEqual(folders);
  });

  it('createFolder should call window.storage.createFolder', async () => {
    mockStorage.createFolder.mockResolvedValue(undefined);

    await folderService.createFolder('New Folder');
    expect(mockStorage.createFolder).toHaveBeenCalledWith('New Folder');
  });

  it('deleteFolder should call window.storage.deleteFolder', async () => {
    mockStorage.deleteFolder.mockResolvedValue(undefined);

    await folderService.deleteFolder('f1');
    expect(mockStorage.deleteFolder).toHaveBeenCalledWith('f1');
  });

  it('renameFolder should call window.storage.renameFolder', async () => {
    mockStorage.renameFolder.mockResolvedValue(undefined);

    await folderService.renameFolder('f1', 'Renamed');
    expect(mockStorage.renameFolder).toHaveBeenCalledWith('f1', 'Renamed');
  });
});
