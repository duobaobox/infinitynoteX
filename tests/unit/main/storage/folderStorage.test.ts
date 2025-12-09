import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { StorageContext } from '../../../../electron/storage/StorageContext';
import { FolderStorage } from '../../../../electron/storage/FolderStorage';
import { StorageErrorCode } from '../../../../electron/storage/errors';

const createTempPath = () => fs.mkdtemp(path.join(os.tmpdir(), 'folder-storage-'));

describe('FolderStorage', () => {
  let tempPath: string;
  let context: StorageContext;
  let folderStorage: FolderStorage;

  beforeEach(async () => {
    tempPath = await createTempPath();
    context = new StorageContext({ defaultPath: tempPath });
    await context.ensureBaseDirectories();
    folderStorage = new FolderStorage(context);
    await folderStorage.createDefaultFolder();
  });

  afterEach(async () => {
    await fs.rm(tempPath, { recursive: true, force: true });
  });

  it('creates folder and persists to disk', async () => {
    const folder = await folderStorage.create('Work');

    const list = await folderStorage.list();
    expect(list.map((f) => f.name)).toContain('Work');

    const saved = JSON.parse(await fs.readFile(context.foldersPath, 'utf-8')) as Array<{
      id: string;
    }>;
    expect(saved.some((f) => f.id === folder.id)).toBe(true);
  });

  it('prevents duplicate folder names', async () => {
    await folderStorage.create('Work');

    await expect(folderStorage.create('Work')).rejects.toMatchObject({
      code: StorageErrorCode.E_ALREADY_EXISTS,
    });
  });

  it('renames folder and updates timestamp', async () => {
    const folder = await folderStorage.create('Work');
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
    const folder = await folderStorage.create('Projects');
    const onBeforeDelete = vi.fn();

    await folderStorage.delete(folder.id, onBeforeDelete);

    expect(onBeforeDelete).toHaveBeenCalledWith(folder.id);
    const list = await folderStorage.list();
    expect(list.some((f) => f.id === folder.id)).toBe(false);
  });

  it('rejects deleting system folder', async () => {
    await expect(folderStorage.delete('default')).rejects.toMatchObject({
      code: StorageErrorCode.E_FOLDER_SYSTEM,
    });
  });
});
