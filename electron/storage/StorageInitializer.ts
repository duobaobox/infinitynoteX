/**
 * 存储初始化器
 *
 * 负责：生命周期管理（进程锁）、目录初始化、Schema 迁移、
 * 崩溃恢复、缓存加载、索引重建、孤儿便签修复
 */

import fs from 'node:fs/promises';
import path from 'node:path';

import type { StorageContext } from './StorageContext';
import type { FolderStorage } from './FolderStorage';
import { DEFAULT_FOLDER_ID } from './FolderStorage';
import type { NoteStorage } from './NoteStorage';
import type { AIStorage } from './AIStorage';
import type { TrashStorage } from './TrashStorage';
import type { BrowserCardStorage } from './BrowserCardStorage';
import type { TodoListStorage } from './TodoListStorage';
import type { ManualTaskStorage } from './ManualTaskStorage';
import type { StorageMeta } from './types';
import { readJsonFile, writeJsonFile, fileExists, generateId } from './utils';
import { CURRENT_SCHEMA_VERSION, needsMigration, getPendingMigrations } from './migrations';

export class StorageInitializer {
  /** 上次是否正常退出（由 checkLastExitStatus 设置，供 HealthChecker 读取） */
  wasCleanExit = false;

  constructor(
    private context: StorageContext,
    private folders: FolderStorage,
    private notes: NoteStorage,
    private ai: AIStorage,
    private trash: TrashStorage,
    private browserCards: BrowserCardStorage,
    private todoLists: TodoListStorage,
    private manualTasks: ManualTaskStorage,
  ) {}

  // ============ 进程生命周期 ============

  /**
   * 检查上次是否正常退出（读取锁文件）
   */
  async checkLastExitStatus(): Promise<void> {
    try {
      const runningPath = this.context.appRunningPath;
      const exists = await fileExists(runningPath);
      this.wasCleanExit = !exists;
    } catch (error) {
      console.warn('[StorageInitializer] Failed to check last exit status:', error);
      this.wasCleanExit = false;
    }
  }

  /**
   * 标记为运行状态（创建锁文件，写入当前 PID）
   */
  async markAsRunning(): Promise<void> {
    try {
      await fs.writeFile(this.context.appRunningPath, process.pid.toString(), 'utf-8');
    } catch (error) {
      console.error('[StorageInitializer] Failed to mark as running:', error);
    }
  }

  /**
   * 处理正常关闭（删除锁文件）
   */
  async handleShutdown(): Promise<void> {
    try {
      const runningPath = this.context.appRunningPath;
      if (await fileExists(runningPath)) {
        await fs.unlink(runningPath);
        console.log('[StorageInitializer] Shutdown handled, running flag cleared');
      }
    } catch (error) {
      console.error('[StorageInitializer] Failed to handle shutdown:', error);
    }
  }

  // ============ 首次启动状态 ============

  /**
   * 检查是否首次启动（读取本地状态文件，不同步）
   */
  async isFirstLaunch(): Promise<boolean> {
    if (!(await fileExists(this.context.metaPath))) return true;

    try {
      const localState = await readJsonFile<{ initialized?: boolean }>(
        this.context.localStatePath,
        { initialized: false },
      );
      return !localState.initialized;
    } catch {
      return true;
    }
  }

  /**
   * 标记为已初始化（每台设备独立记录，不同步）
   */
  async markInitialized(): Promise<void> {
    const localState = await readJsonFile<{ initialized?: boolean; lastSyncAt?: number }>(
      this.context.localStatePath,
      {},
    );
    localState.initialized = true;
    await writeJsonFile(this.context.localStatePath, localState);
  }

  // ============ 目录初始化 ============

  /**
   * 确保存储目录初始化（首次或已有数据两条路径）
   */
  async ensureStorageInitialized(): Promise<void> {
    if (await fileExists(this.context.metaPath)) {
      await this.initializeExisting();
    } else {
      await this.initializeNew();
    }
  }

  private async initializeExisting(): Promise<void> {
    await this.checkAndApplyMigrations();
    await this.context.ensureBaseDirectories();

    console.log('[StorageInitializer] Rebuilding indexes from directory scan...');
    await Promise.all([
      this.folders.rebuildIndex(),
      this.notes.rebuildIndex(),
      this.ai.rebuildIndex(),
      this.trash.rebuildIndex(),
      this.browserCards.rebuildIndex(),
      this.todoLists.rebuildIndex(),
      this.manualTasks.rebuildIndex(),
    ]);

    await this.loadAllCaches();
    await this.fixOrphanNotes();
    const expiredNoteIds = await this.trash.cleanupExpired();
    for (const noteId of expiredNoteIds) {
      await this.ai.deleteBySourceEntity('note', noteId);
    }
    await this.browserCards.initializePresets();
    await this.todoLists.initializeDefault();
    await this.migrateDefaultTodoList();
  }

  private async initializeNew(): Promise<void> {
    console.log(`[StorageInitializer] First-time initialization at: ${this.context.dataDir}`);
    await this.context.ensureBaseDirectories();

    const meta: StorageMeta = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      storageId: generateId(),
      createdAt: Date.now(),
    };
    await writeJsonFile(this.context.metaPath, meta);

    await this.folders.createDefaultFolder();
    await this.browserCards.initializePresets();
    await this.todoLists.initializeDefault();
    await this.migrateDefaultTodoList();
    await this.loadAllCaches();
  }

  /**
   * 按 2026-04-19 设计进行默认清单剥离：
   * 将旧的 default-note-tasks 中的手动任务迁移到 default-manual-tasks
   */
  private async migrateDefaultTodoList(): Promise<void> {
    const NOTE_TASKS_LIST_ID = 'default-note-tasks';
    const DEFAULT_MANUAL_TODO_LIST_ID = 'default-manual-tasks';

    try {
      // 检查是否有旧的 default-note-tasks 持久化清单
      try {
        await this.todoLists.get(NOTE_TASKS_LIST_ID);
        console.log('[StorageInitializer] Found legacy note tasks list, migrating manual tasks...');

        // 迁移旗下的手动任务
        const legacyTasks = await this.manualTasks.listByTodoList(NOTE_TASKS_LIST_ID);
        for (const task of legacyTasks) {
          const fullTask = await this.manualTasks.get(task.id);
          if (fullTask) {
            fullTask.todoListId = DEFAULT_MANUAL_TODO_LIST_ID;
            fullTask.updatedAt = Date.now();
            await this.manualTasks.writeFile(fullTask);
            console.log(`[StorageInitializer] Migrated task ${task.id} to new default list`);
          }
        }

        // 确保内存缓存/索引一致性
        await this.manualTasks.rebuildIndex();

        // 删除旧的遗留清单文件和索引
        await this.todoLists.delete(NOTE_TASKS_LIST_ID);
        console.log('[StorageInitializer] Deleted legacy note tasks list');
      } catch {
        // 没有遗留文件，无需迁移
      }
    } catch (err) {
      console.error('[StorageInitializer] Error during default todo list migration:', err);
    }
  }

  // ============ 缓存管理 ============

  async loadAllCaches(): Promise<void> {
    await Promise.all([
      this.folders.loadCache(),
      this.notes.loadCache(),
      this.ai.loadCache(),
      this.trash.loadCache(),
      this.browserCards.loadCache(),
      this.todoLists.loadCache(),
      this.manualTasks.loadCache(),
    ]);
  }

  clearAllCaches(): void {
    this.folders.clearCache();
    this.notes.clearCache();
    this.ai.clearCache();
    this.trash.clearCache();
    this.browserCards.clearCache();
    this.todoLists.clearCache();
    this.manualTasks.clearCache();
  }

  async reloadAllCaches(): Promise<void> {
    await this.loadAllCaches();
  }

  // ============ 索引重建 ============

  /**
   * 重建所有索引（同步后调用，确保索引与文件一致）
   */
  async rebuildAllIndexes(): Promise<{
    folders: { rebuilt: number; errors: string[] };
    notes: { rebuilt: number; errors: string[] };
    conversations: { rebuilt: number; errors: string[] };
    trash: { rebuilt: number; errors: string[] };
    browserCards: { rebuilt: number; errors: string[] };
    todoLists: { rebuilt: number; errors: string[] };
    manualTasks: { rebuilt: number; errors: string[] };
  }> {
    const [
      foldersResult,
      notesResult,
      conversationsResult,
      trashResult,
      browserCardsResult,
      todoListsResult,
      manualTasksResult,
    ] = await Promise.all([
      this.folders.rebuildIndex(),
      this.notes.rebuildIndex(),
      this.ai.rebuildIndex(),
      this.trash.rebuildIndex(),
      this.browserCards.rebuildIndex(),
      this.todoLists.rebuildIndex(),
      this.manualTasks.rebuildIndex(),
    ]);

    return {
      folders: foldersResult,
      notes: notesResult,
      conversations: conversationsResult,
      trash: trashResult,
      browserCards: browserCardsResult,
      todoLists: todoListsResult,
      manualTasks: manualTasksResult,
    };
  }

  /** 重建便签索引（保持向后兼容） */
  async rebuildNotesIndex(): Promise<{ rebuilt: number; errors: string[] }> {
    return await this.notes.rebuildIndex();
  }

  // ============ Schema 迁移 ============

  private async checkAndApplyMigrations(): Promise<void> {
    try {
      const meta = await readJsonFile<StorageMeta>(this.context.metaPath);
      const currentVersion = meta.schemaVersion || 1;

      if (!needsMigration(currentVersion, CURRENT_SCHEMA_VERSION)) return;

      console.log(
        `[StorageInitializer] Schema migration needed: v${currentVersion} -> v${CURRENT_SCHEMA_VERSION}`,
      );

      const pendingMigrations = getPendingMigrations(currentVersion, CURRENT_SCHEMA_VERSION);
      console.log(`[StorageInitializer] Found ${pendingMigrations.length} pending migration(s)`);
      for (const migration of pendingMigrations) {
        console.log(`[StorageInitializer] Will apply: v${migration.version} - ${migration.name}`);
      }

      await this.applyAllMigrations();

      meta.schemaVersion = CURRENT_SCHEMA_VERSION;
      await writeJsonFile(this.context.metaPath, meta);
      console.log(`[StorageInitializer] Migration completed successfully`);
    } catch (error) {
      console.error('[StorageInitializer] Migration failed:', error);
      throw error;
    }
  }

  private async applyAllMigrations(): Promise<void> {
    // 目前迁移列表为空，框架预留
    console.log(`[StorageInitializer] No data migrations to apply (framework is ready)`);
  }

  // ============ 崩溃恢复 ============

  /**
   * 崩溃恢复：扫描临时文件，将有效文件移回目标路径
   */
  async recoverFromCrash(): Promise<void> {
    try {
      const tempDir = this.context.tempDir;
      if (!(await fileExists(tempDir))) return;

      const tempFiles = await fs.readdir(tempDir);
      let recoveredCount = 0;

      for (const tempFile of tempFiles) {
        if (!tempFile.endsWith('.tmp')) continue;

        const tempPath = path.join(tempDir, tempFile);
        const originalName = tempFile.replace('.tmp', '');
        const targetPath = this.resolveTempTarget(originalName);

        try {
          const content = await fs.readFile(tempPath, 'utf-8');
          JSON.parse(content); // 验证 JSON 有效性
          await fs.rename(tempPath, targetPath);
          recoveredCount++;
          console.log(`[StorageInitializer] Recovered temp file: ${tempFile}`);
        } catch (error) {
          console.warn(`[StorageInitializer] Removing corrupted temp file: ${tempFile}`, error);
          await fs.unlink(tempPath);
        }
      }

      if (recoveredCount > 0) {
        console.log(
          `[StorageInitializer] Crash recovery completed: ${recoveredCount} file(s) recovered`,
        );
      }
    } catch (error) {
      console.error('[StorageInitializer] Crash recovery failed:', error);
    }
  }

  /**
   * 根据临时文件原始名推断目标路径
   *
   * 每个 Storage 子类知道自己的文件命名规则，未来可改为让子类自己实现
   * resolveRecoveryPath() 以符合开闭原则；当前以前缀约定覆盖即有模块。
   */
  private resolveTempTarget(originalName: string): string {
    if (originalName.startsWith('note-')) {
      const noteId = originalName.replace('note-', '').replace('.json', '');
      return this.context.getNotePath(noteId);
    }
    if (originalName.startsWith('ai-conversation-')) {
      const conversationId = originalName.replace('ai-conversation-', '').replace('.json', '');
      return this.context.getAIConversationPath(conversationId);
    }
    return path.join(this.context.dataDir, originalName);
  }

  // ============ 数据一致性 ============

  /**
   * 修复孤儿便签：将所属文件夹已不存在的便签移回默认文件夹
   */
  async fixOrphanNotes(): Promise<void> {
    try {
      const notes = await this.notes.list();
      const folders = await this.folders.list();
      const folderIds = new Set(folders.map((f) => f.id));

      let fixedCount = 0;
      for (const note of notes) {
        if (!folderIds.has(note.folderId)) {
          console.log(
            `[StorageInitializer] Found orphan note ${note.id} (folderId: ${note.folderId}), moving to default`,
          );
          await this.notes.moveToFolder(note.id, DEFAULT_FOLDER_ID);
          fixedCount++;
        }
      }

      if (fixedCount > 0) {
        console.log(`[StorageInitializer] Fixed ${fixedCount} orphan note(s)`);
      }
    } catch (error) {
      console.error('[StorageInitializer] Failed to fix orphan notes:', error);
    }
  }
}
