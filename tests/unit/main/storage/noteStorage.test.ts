import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
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
    context = new StorageContext({ dataPath: tempPath });
    await context.ensureBaseDirectories();

    // Initialize IndexCache
    const indexCache = new IndexCache(context.cachePath);
    await indexCache.initialize();

    folderStorage = new FolderStorage(context);
    folderStorage.setIndexCache(indexCache);
    await folderStorage.createDefaultFolder();

    noteStorage = new NoteStorage(context, folderStorage);
    noteStorage.setIndexCache(indexCache);
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

    const index = JSON.parse(
      await fs.readFile(path.join(tempPath, 'notes.index.json'), 'utf-8'),
    ) as Array<{ id: string; excerpt: string }>;
    const entry = index.find((i) => i.id === note.id);
    expect(entry).toBeDefined();
    expect(entry?.excerpt).toBe('Hello World');
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
