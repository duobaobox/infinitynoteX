/**
 * StorageService 测试
 * 确保调用正确委托到 window.storage API
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { storageService } from '../../../../src/services/storageService';

const mockStorage = {
  getCurrentPath: vi.fn(),
  getDefaultPath: vi.fn(),
  setStoragePath: vi.fn(),
  openInFinder: vi.fn(),
  isFirstLaunch: vi.fn(),
  markInitialized: vi.fn(),
  createBackup: vi.fn(),
  exportData: vi.fn(),
  healthCheck: vi.fn(),
  getStats: vi.fn(),
};

Object.assign(window, { storage: mockStorage });

describe('storageService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getCurrentPath should proxy to window.storage', async () => {
    mockStorage.getCurrentPath.mockResolvedValue('/tmp/data');
    const result = await storageService.getCurrentPath();
    expect(mockStorage.getCurrentPath).toHaveBeenCalled();
    expect(result).toBe('/tmp/data');
  });

  it('setStoragePath should forward path and options', async () => {
    mockStorage.setStoragePath.mockResolvedValue(undefined);
    const opts = { createIfMissing: true };
    await storageService.setStoragePath('/new/path', opts as never);
    expect(mockStorage.setStoragePath).toHaveBeenCalledWith('/new/path', opts);
  });

  it('isFirstLaunch / markInitialized should proxy calls', async () => {
    mockStorage.isFirstLaunch.mockResolvedValue(true);
    expect(await storageService.isFirstLaunch()).toBe(true);
    await storageService.markInitialized();
    expect(mockStorage.markInitialized).toHaveBeenCalled();
  });

  it('createBackup and exportData should delegate', async () => {
    mockStorage.createBackup.mockResolvedValue('/backup/path');
    const path = await storageService.createBackup();
    expect(path).toBe('/backup/path');

    mockStorage.exportData.mockResolvedValue(undefined);
    await storageService.exportData('/export/path');
    expect(mockStorage.exportData).toHaveBeenCalledWith('/export/path');
  });

  it('healthCheck and getStats should return upstream results', async () => {
    const health = { ok: true };
    const stats = { notes: 10 };
    mockStorage.healthCheck.mockResolvedValue(health);
    mockStorage.getStats.mockResolvedValue(stats);

    expect(await storageService.healthCheck()).toBe(health);
    expect(await storageService.getStats()).toBe(stats);
  });
});
