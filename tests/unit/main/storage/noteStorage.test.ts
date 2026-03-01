import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

// ---- IndexCache mock（绕过 better-sqlite3 原生模块版本冲突）----
import { vi } from 'vitest';
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
import { NoteStorage } from '../../../../electron/storage/NoteStorage';
import { StorageErrorCode } from '../../../../electron/storage/errors';
import { IndexCache } from '../../../../electron/storage/core/IndexCache';

const createTempPath = () => fs.mkdtemp(path.join(os.tmpdir(), 'note-storage-'));

const sampleContent = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Hello ' },
        { type: 'text', text: 'World' },
      ],
    },
  ],
};

describe('NoteStorage', () => {
  let tempPath: string;
  let context: StorageContext;
  let folderStorage: FolderStorage;
  let noteStorage: NoteStorage;

  beforeEach(async () => {
    tempPath = await createTempPath();
    context = new StorageContext({ dataPath: tempPath, appPath: tempPath });
    await context.ensureBaseDirectories();

    // Initialize MockIndexCache
    const indexCache = new IndexCache(context.appDatabasePath);
    await indexCache.initialize();

    folderStorage = new FolderStorage(context, indexCache);
    await folderStorage.createDefaultFolder();

    noteStorage = new NoteStorage(context, folderStorage, indexCache);
  });

  afterEach(async () => {
    await fs.rm(tempPath, { recursive: true, force: true });
  });

  const createNote = (title = 'Test Note', folderId = 'default') =>
    noteStorage.createNote(folderId, { title, content: sampleContent });

  it('creates note, writes file, and updates index', async () => {
    const note = await createNote();

    const fileExists = await fs
      .access(context.getNotePath(note.id))
      .then(() => true)
      .catch(() => false);
    expect(fileExists).toBe(true);

    // 通过 noteStorage.list() 验证索引已更新（SQLite 平台，不再使用 notes.index.json）
    const notes = await noteStorage.list();
    const entry = notes.find((n) => n.id === note.id);
    expect(entry).toBeDefined();
    expect(entry?.title).toBe('Test Note');
  });

  it('filters notes by folder when listing', async () => {
    await createNote('Default Note');
    const otherFolder = await folderStorage.create('Work');
    await createNote('Work Note', otherFolder.id);

    const defaultNotes = await noteStorage.list('default');
    expect(defaultNotes.every((n) => n.folderId === 'default')).toBe(true);
    expect(defaultNotes).toHaveLength(1);

    const allNotes = await noteStorage.list();
    expect(allNotes).toHaveLength(2);
  });

  it('moves note to another folder', async () => {
    const note = await createNote();
    const targetFolder = await folderStorage.create('Archive');

    const updated = await noteStorage.moveToFolder(note.id, targetFolder.id);

    expect(updated.folderId).toBe(targetFolder.id);
    const list = await noteStorage.list();
    expect(list.find((n) => n.id === note.id)?.folderId).toBe(targetFolder.id);
  });

  it('throws when creating note under missing folder', async () => {
    await expect(createNote('Missing', 'unknown-folder')).rejects.toMatchObject({
      code: StorageErrorCode.E_NOT_FOUND,
    });
  });
});
