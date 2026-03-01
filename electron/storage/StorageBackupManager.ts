/**
 * 存储备份管理器
 *
 * 负责：备份创建、备份还原、数据导出、数据重置
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import AdmZip from 'adm-zip';

import type { StorageContext } from './StorageContext';
import type { FolderStorage } from './FolderStorage';
import type { NoteStorage } from './NoteStorage';
import type { AIStorage } from './AIStorage';
import type { TrashStorage } from './TrashStorage';
import type { BrowserCardStorage } from './BrowserCardStorage';
import type { TodoListStorage } from './TodoListStorage';
import type { ManualTaskStorage } from './ManualTaskStorage';
import type { StorageInitializer } from './StorageInitializer';
import { StorageError, StorageErrorCode } from './errors';
import { fileExists, copyDirectory, deleteDirectory } from './utils';

export class StorageBackupManager {
  constructor(
    private context: StorageContext,
    private initializer: StorageInitializer,
    private folders: FolderStorage,
    private notes: NoteStorage,
    private ai: AIStorage,
    private trash: TrashStorage,
    private browserCards: BrowserCardStorage,
    private todoLists: TodoListStorage,
    private manualTasks: ManualTaskStorage,
  ) {}

  // ============ 备份 ============

  /**
   * 创建 zip 格式备份，返回备份文件路径
   */
  async createBackup(): Promise<string> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const backupName = `InfinityNoteX-backup-${timestamp}.zip`;
      const backupPath = path.join(this.context.backupsDir, backupName);

      console.log(`[StorageBackup] Creating backup: ${backupName}`);
      await fs.mkdir(this.context.backupsDir, { recursive: true });

      const zip = new AdmZip();
      zip.addLocalFolder(this.context.dataDir);
      zip.writeZip(backupPath);

      console.log(`[StorageBackup] Backup created successfully: ${backupPath}`);
      return backupPath;
    } catch (error) {
      console.error('[StorageBackup] Backup creation failed:', error);
      throw new StorageError(StorageErrorCode.E_IO_WRITE, 'Failed to create backup', error);
    }
  }

  /**
   * 从 zip 备份文件还原数据
   */
  async restoreBackup(backupFilePath: string): Promise<void> {
    try {
      console.log(`[StorageBackup] Restoring from backup: ${backupFilePath}`);

      if (!(await fileExists(backupFilePath))) {
        throw new Error('备份文件不存在');
      }
      if (!backupFilePath.endsWith('.zip')) {
        throw new Error('无效的备份文件格式，请选择 .zip 文件');
      }

      // 先备份当前数据（防止还原失败无法恢复）
      const preRestoreBackupDir = path.join(this.context.appDir, 'pre-restore-backups');
      await fs.mkdir(preRestoreBackupDir, { recursive: true });
      const currentBackupPath = path.join(preRestoreBackupDir, `pre-restore-${Date.now()}.zip`);
      const currentZip = new AdmZip();
      currentZip.addLocalFolder(this.context.dataDir);
      currentZip.writeZip(currentBackupPath);

      // 解压到临时目录
      const tempDir = path.join(this.context.tempDir, `restore-${Date.now()}`);
      await fs.mkdir(tempDir, { recursive: true });
      new AdmZip(backupFilePath).extractAllTo(tempDir, true);

      // 清空当前数据目录（保留 backups 目录）
      const entries = await fs.readdir(this.context.dataDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name === 'backups') continue;
        const fullPath = path.join(this.context.dataDir, entry.name);
        entry.isDirectory() ? await deleteDirectory(fullPath) : await fs.unlink(fullPath);
      }

      // 复制还原数据（跳过 backups 目录）
      const restoreEntries = await fs.readdir(tempDir, { withFileTypes: true });
      for (const entry of restoreEntries) {
        if (entry.name === 'backups') continue;
        const srcPath = path.join(tempDir, entry.name);
        const destPath = path.join(this.context.dataDir, entry.name);
        if (entry.isDirectory()) {
          await copyDirectory(srcPath, destPath);
        } else {
          await fs.copyFile(srcPath, destPath);
        }
      }

      await deleteDirectory(tempDir);

      // 重建索引 + 重载缓存
      console.log('[StorageBackup] Rebuilding indexes after restore...');
      await Promise.all([
        this.folders.rebuildIndex(),
        this.notes.rebuildIndex(),
        this.ai.rebuildIndex(),
        this.trash.rebuildIndex(),
        this.browserCards.rebuildIndex(),
        this.todoLists.rebuildIndex(),
        this.manualTasks.rebuildIndex(),
      ]);
      await this.initializer.loadAllCaches();

      console.log(`[StorageBackup] Data restored successfully from: ${backupFilePath}`);
    } catch (error) {
      console.error('[StorageBackup] Restore failed:', error);
      throw new StorageError(StorageErrorCode.E_IO_WRITE, 'Failed to restore backup', error);
    }
  }

  // ============ 导出 & 重置 ============

  /**
   * 将数据复制导出到指定目录
   */
  async exportData(targetPath: string): Promise<void> {
    try {
      console.log(`[StorageBackup] Exporting data to: ${targetPath}`);
      await fs.mkdir(targetPath, { recursive: true });
      await copyDirectory(this.context.dataDir, targetPath);
      console.log(`[StorageBackup] Data exported successfully`);
    } catch (error) {
      console.error('[StorageBackup] Export failed:', error);
      throw new StorageError(StorageErrorCode.E_IO_WRITE, 'Failed to export data', error);
    }
  }

  /**
   * 重置所有数据（清空后重新初始化）
   */
  async resetAllData(): Promise<void> {
    try {
      console.log(`[StorageBackup] Resetting all data at: ${this.context.dataDir}`);

      const entries = await fs.readdir(this.context.dataDir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(this.context.dataDir, entry.name);
        entry.isDirectory() ? await deleteDirectory(fullPath) : await fs.unlink(fullPath);
      }

      await this.initializer.ensureStorageInitialized();
      console.log(`[StorageBackup] Data reset successfully`);
    } catch (error) {
      console.error('[StorageBackup] Data reset failed:', error);
      throw new StorageError(StorageErrorCode.E_IO_WRITE, 'Failed to reset data', error);
    }
  }
}
