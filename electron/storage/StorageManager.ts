/**
 * 存储管理器
 *
 * 职责：持有所有领域模块与子管理器的引用，提供统一公共 API，
 * 以及管理存储路径切换与数据迁移。
 * 具体逻辑委托给 StorageInitializer / StorageBackupManager /
 * StorageHealthChecker / AttachmentGC 等子管理器。
 */

import fsSync from 'node:fs';
import path from 'node:path';

import { StorageContext } from './StorageContext';
import { FolderStorage } from './FolderStorage';
import { NoteStorage } from './NoteStorage';
import { AIStorage } from './AIStorage';
import { TrashStorage } from './TrashStorage';
import { AttachmentStorage } from './AttachmentStorage';
import { BrowserCardStorage } from './BrowserCardStorage';
import { TodoListStorage } from './TodoListStorage';
import { ManualTaskStorage } from './ManualTaskStorage';
import { NoteLifecycleService } from './NoteLifecycleService';
import { DeviceManager } from './core/DeviceManager';
import { IndexCache } from './core/IndexCache';
import { StorageInitializer } from './StorageInitializer';
import { StorageBackupManager } from './StorageBackupManager';
import { StorageHealthChecker } from './StorageHealthChecker';
import { AttachmentGC } from './AttachmentGC';
import type { HealthCheckResult, StorageStats, SetStoragePathOptions } from './types';
import { StorageError, StorageErrorCode } from './errors';
import { copyDirectory, validateMigrationPath, validateStorageIntegrity } from './utils';
import { readAppConfig, writeAppConfig } from '../config';

export class StorageManager {
  private context: StorageContext;

  // ============ 核心组件（存储在 appDir）============
  readonly device: DeviceManager;
  readonly indexCache: IndexCache;

  // ============ 领域模块（公开，供 IPC handler 直接调用子方法）============
  readonly folders: FolderStorage;
  readonly notes: NoteStorage;
  readonly ai: AIStorage;
  readonly trash: TrashStorage;
  readonly attachments: AttachmentStorage;
  readonly browserCards: BrowserCardStorage;
  readonly todoLists: TodoListStorage;
  readonly manualTasks: ManualTaskStorage;
  readonly noteLifecycle: NoteLifecycleService;

  // ============ 子管理器（私有，负责具体逻辑）============
  private readonly initializer: StorageInitializer;
  private readonly backup: StorageBackupManager;
  private readonly health: StorageHealthChecker;
  private readonly gc: AttachmentGC;

  constructor() {
    const initialPath = this.resolveInitialDataPath();
    this.context = new StorageContext(initialPath ? { dataPath: initialPath } : undefined);

    // 核心组件
    this.device = new DeviceManager(this.context.devicePath);
    this.indexCache = new IndexCache(this.context.appDatabasePath);

    // 领域模块 – IndexCache 在构造时直接注入，消除半初始化窗口
    this.folders = new FolderStorage(this.context, this.indexCache);
    this.notes = new NoteStorage(this.context, this.folders, this.indexCache);
    this.ai = new AIStorage(this.context, this.indexCache);
    this.trash = new TrashStorage(this.context, this.indexCache);
    this.attachments = new AttachmentStorage(this.context.dataDir);
    this.browserCards = new BrowserCardStorage(this.context, this.indexCache);
    this.todoLists = new TodoListStorage(this.context, this.indexCache);
    this.manualTasks = new ManualTaskStorage(this.context, this.indexCache);
    this.noteLifecycle = new NoteLifecycleService(this.folders, this.notes, this.trash, this.ai);

    // 子管理器
    this.initializer = new StorageInitializer(
      this.context,
      this.folders,
      this.notes,
      this.ai,
      this.trash,
      this.browserCards,
      this.todoLists,
      this.manualTasks,
    );
    this.backup = new StorageBackupManager(
      this.context,
      this.initializer,
      this.folders,
      this.notes,
      this.ai,
      this.trash,
      this.browserCards,
      this.todoLists,
      this.manualTasks,
    );
    this.health = new StorageHealthChecker(
      this.context,
      this.initializer,
      this.folders,
      this.notes,
      this.ai,
    );
    this.gc = new AttachmentGC(this.notes, this.trash, this.attachments);
  }

  // ============ 初始化（主进程启动时调用）============

  async initialize(): Promise<void> {
    try {
      await this.device.initialize();
      await this.indexCache.initialize();
      await this.initializer.checkLastExitStatus();
      await this.initializer.ensureStorageInitialized();
      await this.initializer.recoverFromCrash();
      await this.initializer.markAsRunning();

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

  // ============ 路径管理 ============

  getDefaultPath(): string {
    return this.context.defaultDataDir;
  }

  getCurrentPath(): string {
    return this.context.dataDir;
  }

  async setStoragePath(nextPath: string, options?: SetStoragePathOptions): Promise<void> {
    const migrate = options?.migrate ?? false;

    if (!migrate) {
      this.context.setDataDir(nextPath);
      this.attachments.setStoragePath(nextPath);
      this.initializer.clearAllCaches();
      await this.initializer.ensureStorageInitialized();
      this.persistDataPath(nextPath);
      return;
    }

    await this.migrateData(this.context.dataDir, nextPath);
  }

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
      this.initializer.clearAllCaches();
      await this.initializer.loadAllCaches();
      this.persistDataPath(toPath);

      console.log(`[Storage] Migration completed successfully`);
    } catch (error) {
      console.error('[Storage] Migration failed:', error);
      throw new StorageError(StorageErrorCode.E_MIGRATE_FAIL, 'Data migration failed', error);
    }
  }

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

  private persistDataPath(nextPath: string): void {
    try {
      writeAppConfig({ storage: { dataPath: nextPath } });
    } catch (error) {
      console.error('[Storage] Failed to persist storage path:', error);
    }
  }

  // ============ 委托方法（对外保持相同 API，IPC handler 无需改动）============

  async isFirstLaunch(): Promise<boolean> {
    return this.initializer.isFirstLaunch();
  }

  async markInitialized(): Promise<void> {
    return this.initializer.markInitialized();
  }

  async reloadAllCaches(): Promise<void> {
    return this.initializer.reloadAllCaches();
  }

  clearAllCaches(): void {
    this.initializer.clearAllCaches();
  }

  async rebuildAllIndexes(): Promise<{
    folders: { rebuilt: number; errors: string[] };
    notes: { rebuilt: number; errors: string[] };
    conversations: { rebuilt: number; errors: string[] };
    trash: { rebuilt: number; errors: string[] };
    browserCards: { rebuilt: number; errors: string[] };
    todoLists: { rebuilt: number; errors: string[] };
    manualTasks: { rebuilt: number; errors: string[] };
  }> {
    return this.initializer.rebuildAllIndexes();
  }

  async rebuildNotesIndex(): Promise<{ rebuilt: number; errors: string[] }> {
    return this.initializer.rebuildNotesIndex();
  }

  async handleShutdown(): Promise<void> {
    return this.initializer.handleShutdown();
  }

  async healthCheck(): Promise<HealthCheckResult> {
    return this.health.healthCheck();
  }

  async openInFinder(): Promise<void> {
    return this.health.openInFinder();
  }

  async getStats(): Promise<StorageStats> {
    return this.health.getStats();
  }

  async performStartupChecks(): Promise<void> {
    return this.health.performStartupChecks();
  }

  async createBackup(): Promise<string> {
    return this.backup.createBackup();
  }

  async restoreBackup(backupFilePath: string): Promise<void> {
    return this.backup.restoreBackup(backupFilePath);
  }

  async exportData(targetPath: string): Promise<void> {
    return this.backup.exportData(targetPath);
  }

  async resetAllData(): Promise<void> {
    return this.backup.resetAllData();
  }

  async cleanupOrphanedAttachments(): Promise<{
    deleted: number;
    freedBytes: number;
    errors: string[];
  }> {
    return this.gc.cleanupOrphanedAttachments();
  }
}

// 导出单例
export const storageManager = new StorageManager();
