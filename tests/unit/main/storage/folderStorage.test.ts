import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

// ---- IndexCache mock（绕过 better-sqlite3 原生模块版本冲突）----
vi.mock('../../../../electron/storage/core/IndexCache', () => {
  class MockIndexCache {
    private items: Map<string, Record<string, unknown>> = new Map();
    async initialize() {
      /* no-op */
    }
    upsertItem(item: Record<string, unknown>) {
      this.items.set(`${item.module}:${item.id}`, item);
    }
    deleteItem(module: string, id: string) {
      this.items.delete(`${module}:${id}`);
    }
    listItems(module: string): Record<string, unknown>[] {
      return Array.from(this.items.values()).filter((i) => i.module === module);
    }
    getItem(module: string, id: string): Record<string, unknown> | null {
      return this.items.get(`${module}:${id}`) ?? null;
    }
    countItems(module: string): number {
      return Array.from(this.items.values()).filter((i) => i.module === module).length;
    }
    clearModule(module: string) {
      for (const key of Array.from(this.items.keys())) {
        if (key.startsWith(`${module}:`)) this.items.delete(key);
      }
    }
    async rebuildFromFiles(): Promise<{ rebuilt: number; errors: string[] }> {
      return { rebuilt: 0, errors: [] };
    }
    close() {
      /* no-op */
    }
  }
  return { IndexCache: MockIndexCache };
});

import { StorageContext } from '../../../../electron/storage/StorageContext';
import { FolderStorage } from '../../../../electron/storage/FolderStorage';
import { StorageErrorCode } from '../../../../electron/storage/errors';
import { IndexCache } from '../../../../electron/storage/core/IndexCache';

const createTempPath = () => fs.mkdtemp(path.join(os.tmpdir(), 'folder-storage-'));

describe('FolderStorage', () => {
  let tempPath: string;
  let context: StorageContext;
  let folderStorage: FolderStorage;

  beforeEach(async () => {
    tempPath = await createTempPath();
    context = new StorageContext({ dataPath: tempPath, appPath: tempPath });
    await context.ensureBaseDirectories();
    const cache = new IndexCache(path.join(tempPath, 'app.sqlite'));
    await cache.initialize();
    folderStorage = new FolderStorage(context);
    folderStorage.setIndexCache(cache);
    await folderStorage.createDefaultFolder();
  });

  afterEach(async () => {
    await fs.rm(tempPath, { recursive: true, force: true });
  });

  it('creates folder and persists to disk', async () => {
    const folder = await folderStorage.createFolder('Work');

    const list = await folderStorage.list();
    expect(list.map((f) => f.name)).toContain('Work');

    // 验证文件夹 JSON 文件已写入磁盘
    const folderFile = path.join(tempPath, 'folders', `${folder.id}.json`);
    const saved = JSON.parse(await fs.readFile(folderFile, 'utf-8')) as { id: string };
    expect(saved.id).toBe(folder.id);
  });

  it('prevents duplicate folder names', async () => {
    await folderStorage.createFolder('Work');

    await expect(folderStorage.createFolder('Work')).rejects.toMatchObject({
      code: StorageErrorCode.E_ALREADY_EXISTS,
    });
  });

  it('renames folder and updates timestamp', async () => {
    const folder = await folderStorage.createFolder('Work');
    const renamed = await folderStorage.rename(folder.id, 'Renamed Work');

    expect(renamed.name).toBe('Renamed Work');
    expect(renamed.updatedAt).toBeGreaterThanOrEqual(folder.updatedAt);

    const list = await folderStorage.list();
    expect(list.find((f) => f.id === folder.id)?.name).toBe('Renamed Work');
  });

  it('rejects renaming system folder', async () => {
    await expect(folderStorage.rename('default', 'New Name')).rejects.toMatchObject({
      code: StorageErrorCode.E_FOLDER_SYSTEM,
    });
  });

  it('deletes folder and invokes hook', async () => {
    const folder = await folderStorage.createFolder('Projects');
    const onBeforeDelete = vi.fn();

    await folderStorage.deleteFolder(folder.id, onBeforeDelete);

    expect(onBeforeDelete).toHaveBeenCalledWith(folder.id);
    const list = await folderStorage.list();
    expect(list.some((f) => f.id === folder.id)).toBe(false);
  });

  it('rejects deleting system folder', async () => {
    await expect(folderStorage.deleteFolder('default')).rejects.toMatchObject({
      code: StorageErrorCode.E_FOLDER_SYSTEM,
    });
  });
});
