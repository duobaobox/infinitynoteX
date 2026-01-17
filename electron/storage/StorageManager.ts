/**
 * 存储管理器
 * 组合各子模块，提供统一的存储管理接口
 */

import { shell } from 'electron';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import AdmZip from 'adm-zip';

import { StorageContext } from './StorageContext';
import { FolderStorage } from './FolderStorage';
import { NoteStorage } from './NoteStorage';
import { AIStorage } from './AIStorage';
import { TrashStorage } from './TrashStorage';
import { AttachmentStorage } from './AttachmentStorage';
import { BrowserCardStorage } from './BrowserCardStorage';
import { TodoListStorage } from './TodoListStorage';
import { ManualTaskStorage } from './ManualTaskStorage';
import { DeviceManager } from './core/DeviceManager';
import { IndexCache } from './core/IndexCache';
import type { StorageMeta, HealthCheckResult, StorageStats, SetStoragePathOptions } from './types';
import { StorageError, StorageErrorCode } from './errors';
import {
  generateId,
  readJsonFile,
  writeJsonFile,
  fileExists,
  copyDirectory,
  deleteDirectory,
  calculateDirectorySize,
  validateMigrationPath,
  validateStorageIntegrity,
} from './utils';
import { CURRENT_SCHEMA_VERSION, needsMigration, getPendingMigrations } from './migrations';
import { readAppConfig, writeAppConfig } from '../config';

/**
 * 存储管理器
 * 提供统一的存储管理接口，组合各子模块
 */
export class StorageManager {
  private context: StorageContext;
  private wasCleanExit = false;

  // 核心组件
  readonly device: DeviceManager;
  readonly indexCache: IndexCache;

  // 子模块 - 公开访问，便于直接调用
  readonly folders: FolderStorage;
  readonly notes: NoteStorage;
  readonly ai: AIStorage;
  readonly trash: TrashStorage;
  readonly attachments: AttachmentStorage;
  readonly browserCards: BrowserCardStorage;
  readonly todoLists: TodoListStorage;
  readonly manualTasks: ManualTaskStorage;

  constructor() {
    const initialPath = this.resolveInitialDataPath();
    this.context = new StorageContext(initialPath ? { dataPath: initialPath } : undefined);

    // 核心组件（存储在应用目录）
    this.device = new DeviceManager(this.context.devicePath);
    this.indexCache = new IndexCache(this.context.appDatabasePath);

    // 子模块
    this.folders = new FolderStorage(this.context);
    this.notes = new NoteStorage(this.context, this.folders);
    this.ai = new AIStorage(this.context);
    this.trash = new TrashStorage(this.context);
    this.attachments = new AttachmentStorage(this.context.dataDir);
    this.browserCards = new BrowserCardStorage(this.context);
    this.todoLists = new TodoListStorage(this.context);
    this.manualTasks = new ManualTaskStorage(this.context);

    // 注入 IndexCache 到使用 BaseDirectoryStorage 的模块
    this.folders.setIndexCache(this.indexCache);
    this.notes.setIndexCache(this.indexCache);
    this.ai.setIndexCache(this.indexCache);
    this.browserCards.setIndexCache(this.indexCache);
    this.trash.setIndexCache(this.indexCache);
    this.todoLists.setIndexCache(this.indexCache);
    this.manualTasks.setIndexCache(this.indexCache);
  }

  /**
   * 解析首次启动时的存储路径（来自 app-config.json）
   */
  private resolveInitialDataPath(): string | undefined {
    try {
      const config = readAppConfig();
      const configuredPath = config.storage?.dataPath ?? undefined;

      if (configuredPath && fsSync.existsSync(configuredPath)) {
        return configuredPath;
      }

      if (configuredPath && !fsSync.existsSync(configuredPath)) {
        console.warn(
          `[Storage] Configured data path does not exist, fallback to default: ${configuredPath}`,
        );
      }
    } catch (error) {
      console.error('[Storage] Failed to load configured data path:', error);
    }

    return undefined;
  }

  /**
   * 将存储路径写入统一配置，确保重启后记住选择
   */
  private persistDataPath(nextPath: string): void {
    try {
      writeAppConfig({ storage: { dataPath: nextPath } });
    } catch (error) {
      console.error('[Storage] Failed to persist storage path:', error);
    }
  }

  // ============ 初始化 ============

  /**
   * 初始化存储
   * 应用启动时调用，确保目录结构存在
   */
  async initialize(): Promise<void> {
    try {
      // 初始化核心组件
      await this.device.initialize();
      await this.indexCache.initialize();

      // 检查上次是否正常退出
      await this.checkLastExitStatus();

      // 初始化存储
      await this.ensureStorageInitialized();
      await this.recoverFromCrash();

      // 标记当前为运行状态
      await this.markAsRunning();

      // 验证 AI 对话数据完整性
      try {
        const result = await this.ai.validateIntegrity();
        if (!result.valid) {
          console.warn('[Storage] AI conversations integrity check found issues:', result.issues);
          console.log('[Storage] Auto-fixed AI conversation source fields');
        }
      } catch (error) {
        console.error('[Storage] AI conversations integrity check failed:', error);
      }

      console.log(`[Storage] Initialized at: ${this.context.dataDir}`);
      console.log(`[Storage] Device ID: ${this.device.getDeviceId()}`);
    } catch (error) {
      console.error('[Storage] Initialization failed:', error);
      throw new StorageError(StorageErrorCode.E_IO_WRITE, 'Failed to initialize storage', error);
    }
  }

  /**
   * 检查是否首次启动（未初始化）
   * 读取本地状态文件（不同步），避免多端冲突
   */
  async isFirstLaunch(): Promise<boolean> {
    // 首先检查数据目录是否存在
    const metaExists = await fileExists(this.context.metaPath);
    if (!metaExists) {
      return true;
    }

    // 检查本地设备是否已完成初始化
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
   * 标记为已初始化
   * 写入本地状态文件（不同步），每个设备独立记录
   */
  async markInitialized(): Promise<void> {
    const localState = await readJsonFile<{ initialized?: boolean; lastSyncAt?: number }>(
      this.context.localStatePath,
      {},
    );

    localState.initialized = true;
    await writeJsonFile(this.context.localStatePath, localState);
  }

  /**
   * 确保存储目录初始化
   */
  private async ensureStorageInitialized(): Promise<void> {
    const metaExists = await fileExists(this.context.metaPath);

    if (metaExists) {
      // 现有存储，检查是否需要迁移
      await this.checkAndApplyMigrations();

      await this.context.ensureBaseDirectories();

      // 重建索引（从目录扫描，确保索引与实际文件一致）
      console.log('[Storage] Rebuilding indexes from directory scan...');
      await this.folders.rebuildIndex();
      await this.notes.rebuildIndex();
      await this.ai.rebuildIndex();
      await this.trash.rebuildIndex();
      await this.browserCards.rebuildIndex();
      await this.todoLists.rebuildIndex();
      await this.manualTasks.rebuildIndex();

      await this.loadAllCaches();

      // 检查并修复孤儿便签（文件夹不存在的便签）
      await this.fixOrphanNotes();

      // 清理过期的回收站项目
      await this.trash.cleanupExpired();

      // 初始化预设浏览器卡片（如果尚未初始化）
      await this.browserCards.initializePresets();

      // 初始化默认 Todo 清单（如果尚未初始化）
      await this.todoLists.initializeDefault();

      return;
    }

    // 首次初始化
    console.log(`[Storage] First-time initialization at: ${this.context.dataDir}`);

    // 创建目录结构
    await this.context.ensureBaseDirectories();

    // 创建 meta.json（使用当前 Schema 版本）
    const meta: StorageMeta = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      storageId: generateId(),
      createdAt: Date.now(),
    };
    await writeJsonFile(this.context.metaPath, meta);

    // 创建默认文件夹
    await this.folders.createDefaultFolder();

    // 初始化预设浏览器卡片
    await this.browserCards.initializePresets();

    // 初始化默认 Todo 清单
    await this.todoLists.initializeDefault();

    // 加载缓存
    await this.loadAllCaches();
  }

  /**
   * 加载所有缓存（公开方法，用于同步后重新加载）
   */
  async reloadAllCaches(): Promise<void> {
    await this.loadAllCaches();
  }

  /**
   * 加载所有缓存
   */
  private async loadAllCaches(): Promise<void> {
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

  /**
   * 清空所有缓存（公开方法，用于同步后清除缓存）
   */
  clearAllCaches(): void {
    this.folders.clearCache();
    this.notes.clearCache();
    this.ai.clearCache();
    this.trash.clearCache();
    this.browserCards.clearCache();
    this.todoLists.clearCache();
    this.manualTasks.clearCache();
  }

  /**
   * 检查并应用 Schema 迁移
   */
  private async checkAndApplyMigrations(): Promise<void> {
    try {
      const meta = await readJsonFile<StorageMeta>(this.context.metaPath);
      const currentVersion = meta.schemaVersion || 1;

      // 检查是否需要迁移
      if (!needsMigration(currentVersion, CURRENT_SCHEMA_VERSION)) {
        return;
      }

      console.log(
        `[Storage] Schema migration needed: v${currentVersion} -> v${CURRENT_SCHEMA_VERSION}`,
      );

      // 获取待应用的迁移
      const pendingMigrations = getPendingMigrations(currentVersion, CURRENT_SCHEMA_VERSION);
      console.log(`[Storage] Found ${pendingMigrations.length} pending migration(s)`);

      for (const migration of pendingMigrations) {
        console.log(`[Storage] Will apply: v${migration.version} - ${migration.name}`);
      }

      // 执行迁移
      await this.applyAllMigrations();

      // 更新 meta.json 的版本号
      meta.schemaVersion = CURRENT_SCHEMA_VERSION;
      await writeJsonFile(this.context.metaPath, meta);

      console.log(`[Storage] Migration completed successfully`);
    } catch (error) {
      console.error('[Storage] Migration failed:', error);
      throw error;
    }
  }

  /**
   * 应用所有待执行的数据迁移
   */
  private async applyAllMigrations(): Promise<void> {
    // 目前迁移列表为空，这里仅作为框架
    // 未来添加迁移时，在这里遍历所有数据文件并应用迁移
    console.log(`[Storage] No data migrations to apply (framework is ready)`);

    // 示例：迁移所有便签（如果未来需要按版本迁移，可在此实现）
  }

  /**
   * 崩溃恢复
   * 检查并恢复临时文件
   */
  private async recoverFromCrash(): Promise<void> {
    try {
      const tempDir = this.context.tempDir;
      const tempExists = await fileExists(tempDir);

      if (!tempExists) {
        return;
      }

      const tempFiles = await fs.readdir(tempDir);
      let recoveredCount = 0;

      for (const tempFile of tempFiles) {
        if (!tempFile.endsWith('.tmp')) {
          continue;
        }

        const tempPath = path.join(tempDir, tempFile);
        const originalName = tempFile.replace('.tmp', '');

        // 判断目标位置
        let targetPath: string;
        if (originalName.startsWith('note-')) {
          const noteId = originalName.replace('note-', '').replace('.json', '');
          targetPath = this.context.getNotePath(noteId);
        } else if (originalName.startsWith('ai-conversation-')) {
          const fileName = originalName.replace('ai-conversation-', '');
          const conversationId = fileName.replace('.json', '');
          targetPath = this.context.getAIConversationPath(conversationId);
        } else {
          targetPath = path.join(this.context.dataDir, originalName);
        }

        try {
          const content = await fs.readFile(tempPath, 'utf-8');
          JSON.parse(content); // 验证是否为有效 JSON

          await fs.rename(tempPath, targetPath);
          recoveredCount++;
          console.log(`[Storage] Recovered temp file: ${tempFile}`);
        } catch (error) {
          console.warn(`[Storage] Removing corrupted temp file: ${tempFile}`, error);
          await fs.unlink(tempPath);
        }
      }

      if (recoveredCount > 0) {
        console.log(`[Storage] Crash recovery completed: ${recoveredCount} file(s) recovered`);
      }
    } catch (error) {
      console.error('[Storage] Crash recovery failed:', error);
    }
  }

  // ============ 路径管理 ============

  /**
   * 获取默认路径
   */
  getDefaultPath(): string {
    return this.context.defaultDataDir;
  }

  /**
   * 获取当前路径
   */
  getCurrentPath(): string {
    return this.context.dataDir;
  }

  /**
   * 设置存储路径
   */
  async setStoragePath(nextPath: string, options?: SetStoragePathOptions): Promise<void> {
    const migrate = options?.migrate ?? false;

    if (!migrate) {
      this.context.setDataDir(nextPath);
      this.attachments.setStoragePath(nextPath);
      this.clearAllCaches();
      await this.ensureStorageInitialized();
      this.persistDataPath(nextPath);
      return;
    }

    await this.migrateData(this.context.dataDir, nextPath);
  }

  /**
   * 迁移数据
   */
  private async migrateData(fromPath: string, toPath: string): Promise<void> {
    try {
      console.log(`[Storage] Migrating from ${fromPath} to ${toPath}`);

      await validateMigrationPath(toPath);

      const backupPath = path.join(fromPath, 'backups', `backup-${Date.now()}`);
      await copyDirectory(fromPath, backupPath);

      await copyDirectory(fromPath, toPath);

      await validateStorageIntegrity(toPath);

      this.context.setDataDir(toPath);
      this.attachments.setStoragePath(toPath);
      this.clearAllCaches();
      await this.loadAllCaches();
      this.persistDataPath(toPath);

      console.log(`[Storage] Migration completed successfully`);
    } catch (error) {
      console.error('[Storage] Migration failed:', error);
      throw new StorageError(StorageErrorCode.E_MIGRATE_FAIL, 'Data migration failed', error);
    }
  }

  // ============ 健康检查与统计 ============

  /**
   * 健康检查
   */
  async healthCheck(): Promise<HealthCheckResult> {
    try {
      await validateStorageIntegrity(this.context.dataDir);
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        details: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * 在 Finder/Explorer 中打开数据目录
   */
  async openInFinder(): Promise<void> {
    await shell.openPath(this.context.dataDir);
  }

  /**
   * 获取存储统计信息
   */
  async getStats(): Promise<StorageStats> {
    const dataSize = await calculateDirectorySize(this.context.dataDir);

    return {
      folderCount: this.folders.getCacheCount(),
      noteCount: this.notes.getCacheCount(),
      dataSize,
    };
  }

  /**
   * 重建所有索引
   * 扫描目录，从实际文件重建索引
   * 用于同步后确保数据一致性
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

  /**
   * 重建便签索引（保持向后兼容）
   */
  async rebuildNotesIndex(): Promise<{ rebuilt: number; errors: string[] }> {
    return await this.notes.rebuildIndex();
  }

  // ============ 备份与还原 ============

  /**
   * 创建备份（zip 格式）
   */
  async createBackup(): Promise<string> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const backupName = `InfinityNoteX-backup-${timestamp}.zip`;
      const backupPath = path.join(this.context.backupsDir, backupName);

      console.log(`[Storage] Creating backup: ${backupName}`);

      // 确保备份目录存在
      await fs.mkdir(this.context.backupsDir, { recursive: true });

      // 创建 zip 文件
      const zip = new AdmZip();
      zip.addLocalFolder(this.context.dataDir);
      zip.writeZip(backupPath);

      console.log(`[Storage] Backup created successfully: ${backupPath}`);
      return backupPath;
    } catch (error) {
      console.error('[Storage] Backup creation failed:', error);
      throw new StorageError(StorageErrorCode.E_IO_WRITE, 'Failed to create backup', error);
    }
  }
  /**
   * 从备份文件还原数据
   */
  async restoreBackup(backupFilePath: string): Promise<void> {
    try {
      console.log(`[Storage] Restoring from backup: ${backupFilePath}`);

      // 验证文件存在
      const exists = await fileExists(backupFilePath);
      if (!exists) {
        throw new Error('备份文件不存在');
      }

      // 验证是 zip 文件
      if (!backupFilePath.endsWith('.zip')) {
        throw new Error('无效的备份文件格式，请选择 .zip 文件');
      }

      // 解压到临时目录（使用系统临时目录，避免被清空）
      const tempDir = path.join(this.context.tempDir, `restore-${Date.now()}`);
      await fs.mkdir(tempDir, { recursive: true });

      const zip = new AdmZip(backupFilePath);
      zip.extractAllTo(tempDir, true);

      // 备份当前数据（保存到系统目录，以防还原失败需要恢复）
      const preRestoreBackupDir = path.join(this.context.appDir, 'pre-restore-backups');
      await fs.mkdir(preRestoreBackupDir, { recursive: true });
      const currentBackupPath = path.join(preRestoreBackupDir, `pre-restore-${Date.now()}.zip`);
      const currentZip = new AdmZip();
      currentZip.addLocalFolder(this.context.dataDir);
      currentZip.writeZip(currentBackupPath);

      // 清空当前数据目录（跳过 backups 目录，避免删除备份）
      const entries = await fs.readdir(this.context.dataDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name === 'backups') continue; // 跳过 backups 目录
        const fullPath = path.join(this.context.dataDir, entry.name);
        if (entry.isDirectory()) {
          await deleteDirectory(fullPath);
        } else {
          await fs.unlink(fullPath);
        }
      }

      // 复制还原的数据（跳过 backups 目录）
      const restoreEntries = await fs.readdir(tempDir, { withFileTypes: true });
      for (const entry of restoreEntries) {
        if (entry.name === 'backups') continue; // 跳过备份中的 backups 目录
        const srcPath = path.join(tempDir, entry.name);
        const destPath = path.join(this.context.dataDir, entry.name);
        if (entry.isDirectory()) {
          await copyDirectory(srcPath, destPath);
        } else {
          await fs.copyFile(srcPath, destPath);
        }
      }

      // 清理临时目录
      await deleteDirectory(tempDir);

      // 重建所有索引（确保 SQLite 索引与恢复的文件同步）
      console.log('[Storage] Rebuilding indexes after restore...');
      await this.folders.rebuildIndex();
      await this.notes.rebuildIndex();
      await this.ai.rebuildIndex();
      await this.trash.rebuildIndex();
      await this.browserCards.rebuildIndex();
      await this.todoLists.rebuildIndex();
      await this.manualTasks.rebuildIndex();

      // 重新加载所有缓存
      await this.loadAllCaches();

      console.log(`[Storage] Data restored successfully from: ${backupFilePath}`);
    } catch (error) {
      console.error('[Storage] Restore failed:', error);
      throw new StorageError(StorageErrorCode.E_IO_WRITE, 'Failed to restore backup', error);
    }
  }

  /**
   * 导出数据到指定路径
   */
  async exportData(targetPath: string): Promise<void> {
    try {
      console.log(`[Storage] Exporting data to: ${targetPath}`);

      await fs.mkdir(targetPath, { recursive: true });
      await copyDirectory(this.context.dataDir, targetPath);

      console.log(`[Storage] Data exported successfully`);
    } catch (error) {
      console.error('[Storage] Data export failed:', error);
      throw new StorageError(StorageErrorCode.E_IO_WRITE, 'Failed to export data', error);
    }
  }

  /**
   * 重置所有数据（清空并重新初始化）
   */
  async resetAllData(): Promise<void> {
    try {
      console.log(`[Storage] Resetting all data at: ${this.context.dataDir}`);

      const entries = await fs.readdir(this.context.dataDir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(this.context.dataDir, entry.name);
        if (entry.isDirectory()) {
          await deleteDirectory(fullPath);
        } else {
          await fs.unlink(fullPath);
        }
      }

      await this.ensureStorageInitialized();

      console.log(`[Storage] Data reset successfully`);
    } catch (error) {
      console.error('[Storage] Data reset failed:', error);
      throw new StorageError(StorageErrorCode.E_IO_WRITE, 'Failed to reset data', error);
    }
  }

  // ============ 孤儿便签修复 ============

  /**
   * 修复孤儿便签（所属文件夹不存在的便签）
   * 将它们移动到默认文件夹
   */
  private async fixOrphanNotes(): Promise<void> {
    try {
      const notes = await this.notes.list();
      const folders = await this.folders.list();
      const folderIds = new Set(folders.map((f) => f.id));

      let fixedCount = 0;
      for (const note of notes) {
        if (!folderIds.has(note.folderId)) {
          console.log(
            `[Storage] Found orphan note ${note.id} (folderId: ${note.folderId}), moving to default`,
          );
          await this.notes.moveToFolder(note.id, 'default');
          fixedCount++;
        }
      }

      if (fixedCount > 0) {
        console.log(`[Storage] Fixed ${fixedCount} orphan note(s)`);
      }
    } catch (error) {
      console.error('[Storage] Failed to fix orphan notes:', error);
    }
  }

  //  ============ 数据一致性检查 ============

  /**
   * 启动时执行的完整性检查
   * 检查并修复所有数据不一致问题
   */
  async performStartupChecks(): Promise<void> {
    try {
      console.log('[Storage] Performing startup integrity checks...');

      if (this.wasCleanExit) {
        console.log('[Storage] Clean exit detected, skipping extensive integrity checks.');
        return;
      }

      console.warn(
        '[Storage] Unclean exit detected or first run, performing full integrity checks...',
      );

      // 校验便签索引一致性
      const noteIssues = await this.validateNotesIntegrity();
      if (noteIssues.length > 0) {
        console.warn(`[Storage] Found ${noteIssues.length} note index issues, rebuilding...`);
        await this.notes.rebuildIndex();
      }

      // 校验 AI 对话索引一致性
      const aiIssues = await this.validateAIConversationsIntegrity();
      if (aiIssues.length > 0) {
        console.warn(`[Storage] Found ${aiIssues.length} AI conversation issues, rebuilding...`);
        await this.ai.rebuildIndex();
      }

      console.log('[Storage] Startup checks completed successfully');
    } catch (error) {
      console.error('[Storage] Startup checks failed:', error);
    }
  }

  /**
   * 校验便签索引完整性
   * 返回发现的问题列表
   */
  private async validateNotesIntegrity(): Promise<string[]> {
    const issues: string[] = [];
    const index = await this.notes.list();

    for (const item of index) {
      try {
        const note = await this.notes.get(item.id);

        // 检查标题
        if (note.title !== item.title) {
          issues.push(`Note ${item.id}: title mismatch`);
        }

        // 检查更新时间
        if (note.updatedAt !== item.updatedAt) {
          issues.push(`Note ${item.id}: timestamp mismatch`);
        }

        // 检查 pinned 状态
        if (note.pinned !== item.pinned) {
          issues.push(`Note ${item.id}: pinned mismatch`);
        }
      } catch (error) {
        issues.push(`Note ${item.id}: file missing or corrupted`);
      }
    }

    return issues;
  }

  /**
   * 校验 AI 对话索引完整性
   */
  private async validateAIConversationsIntegrity(): Promise<string[]> {
    const issues: string[] = [];
    const index = await this.ai.getIndex();

    for (const item of index) {
      try {
        const conversation = await this.ai.get(item.id);

        // 检查标题
        if (conversation.title !== item.title) {
          issues.push(`Conversation ${item.id}: title mismatch`);
        }

        // 检查更新时间
        if (conversation.updatedAt !== item.updatedAt) {
          issues.push(`Conversation ${item.id}: timestamp mismatch`);
        }
      } catch (error) {
        issues.push(`Conversation ${item.id}: file missing or corrupted`);
      }
    }

    return issues;
  }

  // ============ 附件垃圾回收 ============

  /**
   * 清理孤立附件
   * 扫描所有便签和回收站中的 attachment:// 引用，删除未被引用的附件文件
   * @returns 删除统计
   */
  async cleanupOrphanedAttachments(): Promise<{
    deleted: number;
    freedBytes: number;
    errors: string[];
  }> {
    console.log('[Storage] Starting attachment garbage collection...');
    const errors: string[] = [];

    try {
      // 1. 收集所有被引用的附件 ID
      const usedAttachmentIds = new Set<string>();

      // 扫描便签
      const notes = await this.notes.list();
      for (const noteIndex of notes) {
        try {
          const note = await this.notes.get(noteIndex.id);
          this.extractAttachmentIds(note.content, usedAttachmentIds);
        } catch (error) {
          errors.push(`Failed to scan note ${noteIndex.id}`);
        }
      }

      // 扫描回收站
      const trashItems = await this.trash.list();
      for (const trashIndex of trashItems) {
        try {
          const item = await this.trash.get(trashIndex.id);
          this.extractAttachmentIds(item.content, usedAttachmentIds);
        } catch (error) {
          errors.push(`Failed to scan trash item ${trashIndex.id}`);
        }
      }

      console.log(`[Storage] Found ${usedAttachmentIds.size} referenced attachments`);

      // 2. 获取所有附件
      const allAttachments = await this.attachments.list();
      console.log(`[Storage] Found ${allAttachments.length} total attachments`);

      // 3. 找出孤立附件
      const orphanedAttachments = allAttachments.filter((att) => !usedAttachmentIds.has(att.id));

      if (orphanedAttachments.length === 0) {
        console.log('[Storage] No orphaned attachments found');
        return { deleted: 0, freedBytes: 0, errors };
      }

      // 4. 删除孤立附件
      let deleted = 0;
      let freedBytes = 0;

      for (const attachment of orphanedAttachments) {
        try {
          await this.attachments.delete(attachment.id);
          deleted++;
          freedBytes += attachment.size;
          console.log(`[Storage] Deleted orphaned attachment: ${attachment.id}`);
        } catch (error) {
          errors.push(`Failed to delete attachment ${attachment.id}`);
        }
      }

      console.log(
        `[Storage] Garbage collection completed: ${deleted} files deleted, ${(freedBytes / 1024 / 1024).toFixed(2)} MB freed`,
      );

      return { deleted, freedBytes, errors };
    } catch (error) {
      console.error('[Storage] Garbage collection failed:', error);
      errors.push(`Fatal error: ${error instanceof Error ? error.message : 'Unknown'}`);
      return { deleted: 0, freedBytes: 0, errors };
    }
  }

  /**
   * 从 TipTap 内容中提取 attachment:// 引用
   */
  private extractAttachmentIds(content: unknown, ids: Set<string>): void {
    if (!content || typeof content !== 'object') return;

    const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

    const traverse = (node: unknown) => {
      if (!isObj(node)) return;

      // 检查图片节点的 src 属性
      if (node.type === 'image' && typeof node.attrs === 'object' && node.attrs) {
        const attrs = node.attrs as Record<string, unknown>;
        if (typeof attrs.src === 'string' && attrs.src.startsWith('attachment://')) {
          const id = attrs.src.replace('attachment://', '');
          ids.add(id);
        }
      }

      // 递归遍历子节点
      if (Array.isArray(node.content)) {
        for (const child of node.content) {
          traverse(child);
        }
      }
    };

    traverse(content);
  }

  // ============ 运行状态管理 ============

  /**
   * 检查上次是否正常退出
   */
  private async checkLastExitStatus(): Promise<void> {
    try {
      const runningPath = this.context.appRunningPath;
      const exists = await fileExists(runningPath);
      this.wasCleanExit = !exists;
    } catch (error) {
      console.warn('[Storage] Failed to check last exit status:', error);
      // 如果检查失败，假设为非正常退出，以策安全
      this.wasCleanExit = false;
    }
  }

  /**
   * 标记为运行状态（创建锁文件）
   */
  private async markAsRunning(): Promise<void> {
    try {
      const runningPath = this.context.appRunningPath;
      // 写入当前 PID，方便后续调试
      await fs.writeFile(runningPath, process.pid.toString(), 'utf-8');
    } catch (error) {
      console.error('[Storage] Failed to mark as running:', error);
    }
  }

  /**
   * 处理正常关闭（删除锁文件）
   */
  async handleShutdown(): Promise<void> {
    try {
      const runningPath = this.context.appRunningPath;
      const exists = await fileExists(runningPath);
      if (exists) {
        await fs.unlink(runningPath);
        console.log('[Storage] Shutdown handled, running flag cleared');
      }
    } catch (error) {
      console.error('[Storage] Failed to handle shutdown:', error);
    }
  }
}

// 导出单例
export const storageManager = new StorageManager();
