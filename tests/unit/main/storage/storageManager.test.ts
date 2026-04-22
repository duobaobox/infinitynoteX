import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

let storageRoot: string;
let mockUserDataPath: string;

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
    async rebuildFromFiles(
      module: string,
      directory: string,
      parser: (filePath: string) => Promise<Record<string, unknown> | null>,
    ): Promise<{ rebuilt: number; errors: string[] }> {
      const fs = await import('node:fs/promises');
      const path = await import('node:path');

      this.clearModule(module);

      const errors: string[] = [];
      let rebuilt = 0;

      try {
        const files = await fs.readdir(directory);
        for (const file of files) {
          if (!file.endsWith('.json')) continue;
          const filePath = path.join(directory, file);
          try {
            const item = await parser(filePath);
            if (item) {
              this.upsertItem(item);
              rebuilt += 1;
            }
          } catch (error) {
            errors.push(String(error));
          }
        }
      } catch (error) {
        errors.push(String(error));
      }

      return { rebuilt, errors };
    }
    close() {
      /* no-op */
    }
  }
  return { IndexCache: MockIndexCache };
});

// Mock electron with a factory that creates the mock inline
vi.mock('electron', () => {
  const getPath = vi.fn(() => path.join(os.tmpdir(), 'storage-manager-default'));
  return {
    shell: {
      openExternal: vi.fn(),
      showItemInFolder: vi.fn(),
      openPath: vi.fn(),
    },
    app: {
      getPath,
    },
  };
});

import { StorageManager } from '../../../../electron/storage/StorageManager';
import { CURRENT_SCHEMA_VERSION } from '../../../../electron/storage/migrations';
import {
  DEFAULT_MANUAL_TODO_LIST_ID,
  NOTE_TASKS_LIST_ID,
} from '../../../../src/shared/constants/todoConstants';
import { app } from 'electron';

const ensureDir = (p: string) => fs.stat(p).then((s) => s.isDirectory());

describe('StorageManager', () => {
  beforeEach(async () => {
    mockUserDataPath = await fs.mkdtemp(path.join(os.tmpdir(), 'storage-manager-'));
    vi.mocked(app.getPath).mockReturnValue(mockUserDataPath);
    storageRoot = path.join(mockUserDataPath, 'data-v2');
  });

  afterEach(async () => {
    await fs.rm(mockUserDataPath, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  it('returns true for first launch when meta is missing', async () => {
    const manager = new StorageManager();
    const first = await manager.isFirstLaunch();
    expect(first).toBe(true);
  });

  it('marks initialized and flips first-launch flag', async () => {
    const manager = new StorageManager();
    // 创建 metaPath，使 isFirstLaunch 能进入第二阶段检查 localStatePath
    await fs.mkdir(storageRoot, { recursive: true });
    await fs.writeFile(path.join(storageRoot, 'meta.json'), '{}');

    await manager.markInitialized();

    // markInitialized 写入 localStatePath（appDir/local-state.json），不是 dataDir/meta.json
    const state = JSON.parse(
      await fs.readFile(path.join(mockUserDataPath, 'local-state.json'), 'utf-8'),
    ) as { initialized?: boolean };
    expect(state.initialized).toBe(true);
    expect(await manager.isFirstLaunch()).toBe(false);
  });

  it('initializes storage structure on first initialize()', async () => {
    const manager = new StorageManager();

    await manager.initialize();

    await expect(ensureDir(path.join(storageRoot, 'notes'))).resolves.toBe(true);
    await expect(ensureDir(path.join(storageRoot, 'ai-conversations'))).resolves.toBe(true);
    await expect(ensureDir(path.join(storageRoot, 'trash'))).resolves.toBe(true);
    await expect(fs.readFile(path.join(storageRoot, 'meta.json'), 'utf-8')).resolves.toBeTruthy();
  });

  it('creates the persisted default manual todo list on fresh initialize', async () => {
    const manager = new StorageManager();

    await manager.initialize();

    const lists = await manager.todoLists.getAll();

    expect(lists.map((list) => list.id)).toContain(DEFAULT_MANUAL_TODO_LIST_ID);
    expect(lists.map((list) => list.id)).not.toContain(NOTE_TASKS_LIST_ID);
    expect(lists.find((list) => list.id === DEFAULT_MANUAL_TODO_LIST_ID)).toMatchObject({
      id: DEFAULT_MANUAL_TODO_LIST_ID,
      name: '默认任务清单',
      isDefault: true,
    });
  });

  it('migrates legacy default-note-tasks data into the default manual todo list', async () => {
    await fs.mkdir(path.join(storageRoot, 'todo-lists'), { recursive: true });
    await fs.mkdir(path.join(storageRoot, 'manual-tasks'), { recursive: true });
    await fs.writeFile(
      path.join(storageRoot, 'meta.json'),
      JSON.stringify(
        {
          schemaVersion: CURRENT_SCHEMA_VERSION,
          storageId: 'storage-test',
          createdAt: 1,
        },
        null,
        2,
      ),
      'utf-8',
    );

    await fs.writeFile(
      path.join(storageRoot, 'todo-lists', `${NOTE_TASKS_LIST_ID}.json`),
      JSON.stringify(
        {
          id: NOTE_TASKS_LIST_ID,
          name: '便签任务',
          isDefault: true,
          createdAt: 1,
          updatedAt: 1,
          order: 0,
        },
        null,
        2,
      ),
      'utf-8',
    );
    await fs.writeFile(
      path.join(storageRoot, 'manual-tasks', 'legacy-task-1.json'),
      JSON.stringify(
        {
          id: 'legacy-task-1',
          listId: NOTE_TASKS_LIST_ID,
          text: '迁移前手动任务',
          checked: false,
          createdAt: 1,
          updatedAt: 1,
          order: 0,
        },
        null,
        2,
      ),
      'utf-8',
    );

    const manager = new StorageManager();

    await manager.initialize();

    const lists = await manager.todoLists.getAll();
    const migratedTasks = await manager.manualTasks.getAllByListId(DEFAULT_MANUAL_TODO_LIST_ID);

    expect(lists.map((list) => list.id)).toContain(DEFAULT_MANUAL_TODO_LIST_ID);
    expect(lists.map((list) => list.id)).not.toContain(NOTE_TASKS_LIST_ID);
    expect(migratedTasks).toHaveLength(1);
    expect(migratedTasks[0]).toMatchObject({
      id: 'legacy-task-1',
      listId: DEFAULT_MANUAL_TODO_LIST_ID,
      text: '迁移前手动任务',
    });
    await expect(
      fs.access(path.join(storageRoot, 'todo-lists', `${NOTE_TASKS_LIST_ID}.json`)),
    ).rejects.toThrow();
  });

  it('also migrates orphaned note-task manual tasks when the legacy list file is already gone', async () => {
    await fs.mkdir(path.join(storageRoot, 'manual-tasks'), { recursive: true });
    await fs.writeFile(
      path.join(storageRoot, 'meta.json'),
      JSON.stringify(
        {
          schemaVersion: CURRENT_SCHEMA_VERSION,
          storageId: 'storage-test',
          createdAt: 1,
        },
        null,
        2,
      ),
      'utf-8',
    );
    await fs.writeFile(
      path.join(storageRoot, 'manual-tasks', 'orphan-task-1.json'),
      JSON.stringify(
        {
          id: 'orphan-task-1',
          listId: NOTE_TASKS_LIST_ID,
          text: '孤儿任务',
          checked: false,
          createdAt: 1,
          updatedAt: 1,
          order: 0,
        },
        null,
        2,
      ),
      'utf-8',
    );

    const manager = new StorageManager();

    await manager.initialize();

    const migratedTasks = await manager.manualTasks.getAllByListId(DEFAULT_MANUAL_TODO_LIST_ID);

    expect(migratedTasks).toHaveLength(1);
    expect(migratedTasks[0]).toMatchObject({
      id: 'orphan-task-1',
      listId: DEFAULT_MANUAL_TODO_LIST_ID,
      text: '孤儿任务',
    });
  });

  it('resolves a global AI conversation by binding instead of fixed conversation id', async () => {
    const manager = new StorageManager();

    await manager.initialize();

    const created = await manager.ai.resolveBinding('global', 'default', { autoCreate: true });
    const resolved = await manager.ai.resolveBinding('global', 'default', { autoCreate: false });

    expect(created).not.toBeNull();
    expect(created?.source).toBe('global');
    expect(created?.sourceEntityId).toBe('default');
    expect(resolved?.id).toBe(created?.id);
  });

  it('rebinds note conversations to a restored note id and supports cleanup by source entity', async () => {
    const manager = new StorageManager();

    await manager.initialize();

    const conversation = await manager.ai.createConversation('旧便签对话', {
      source: 'note',
      sourceEntityId: 'note-old',
    });

    const reboundCount = await manager.ai.rebindSourceEntity('note', 'note-old', 'note-new');
    const reboundConversation = await manager.ai.resolveBinding('note', 'note-new', {
      autoCreate: false,
    });
    const deletedCount = await manager.ai.deleteBySourceEntity('note', 'note-new');
    const deletedConversation = await manager.ai.resolveBinding('note', 'note-new', {
      autoCreate: false,
    });

    expect(reboundCount).toBe(1);
    expect(reboundConversation?.id).toBe(conversation.id);
    expect(reboundConversation?.sourceEntityId).toBe('note-new');
    expect(deletedCount).toBe(1);
    expect(deletedConversation).toBeNull();
  });

  it('moves note conversations through delete and restore lifecycle', async () => {
    const manager = new StorageManager();

    await manager.initialize();

    const note = await manager.notes.createNote('default', {
      title: '生命周期便签',
      content: { type: 'doc', content: [] },
    });
    const conversation = await manager.ai.createConversation('便签对话', {
      source: 'note',
      sourceEntityId: note.id,
    });

    await manager.noteLifecycle.deleteNote(note.id);

    const trashItems = await manager.trash.list();
    const deletedConversation = await manager.ai.resolveBinding('note', note.id, {
      autoCreate: false,
    });
    const restoredNote = await manager.noteLifecycle.restoreNote(trashItems[0].id);
    const restoredConversation = await manager.ai.resolveBinding('note', restoredNote.id, {
      autoCreate: false,
    });

    await expect(manager.notes.get(note.id)).rejects.toThrow();
    expect(trashItems).toHaveLength(1);
    expect(deletedConversation?.id).toBe(conversation.id);
    expect(restoredNote.id).not.toBe(note.id);
    expect(restoredConversation?.id).toBe(conversation.id);
    expect(restoredConversation?.sourceEntityId).toBe(restoredNote.id);
  });
});
