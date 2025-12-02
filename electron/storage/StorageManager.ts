/**
 * 存储管理器
 * 组合各子模块，提供统一的存储管理接口
 */

import { shell } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';

import { StorageContext } from './StorageContext';
import { FolderStorage } from './FolderStorage';
import { NoteStorage } from './NoteStorage';
import { AIStorage } from './AIStorage';
import type {
  StorageMeta,
  HealthCheckResult,
  StorageStats,
  SetStoragePathOptions,
  Note,
} from './types';
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

/**
 * 存储管理器
 * 提供统一的存储管理接口，组合各子模块
 */
export class StorageManager {
  private context: StorageContext;

  // 子模块 - 公开访问，便于直接调用
  readonly folders: FolderStorage;
  readonly notes: NoteStorage;
  readonly ai: AIStorage;

  constructor() {
    this.context = new StorageContext();
    this.folders = new FolderStorage(this.context);
    this.notes = new NoteStorage(this.context, this.folders);
    this.ai = new AIStorage(this.context);
  }

  // ============ 初始化 ============

  /**
   * 初始化存储
   * 应用启动时调用，确保目录结构存在
   */
  async initialize(): Promise<void> {
    try {
      await this.ensureStorageInitialized();
      await this.recoverFromCrash();
      console.log(`[Storage] Initialized at: ${this.context.currentPath}`);
    } catch (error) {
      console.error('[Storage] Initialization failed:', error);
      throw new StorageError(StorageErrorCode.E_IO_WRITE, 'Failed to initialize storage', error);
    }
  }

  /**
   * 检查是否首次启动（未初始化）
   */
  async isFirstLaunch(): Promise<boolean> {
    const metaExists = await fileExists(this.context.metaPath);

    if (!metaExists) {
      return true;
    }

    try {
      const meta = await readJsonFile<StorageMeta>(this.context.metaPath);
      return !meta.initialized;
    } catch {
      return true;
    }
  }

  /**
   * 标记为已初始化
   */
  async markInitialized(): Promise<void> {
    const meta = await readJsonFile<StorageMeta>(this.context.metaPath, {
      schemaVersion: 1,
      storageId: generateId(),
      createdAt: Date.now(),
    });

    meta.initialized = true;
    await writeJsonFile(this.context.metaPath, meta);
  }

  /**
   * 确保存储目录初始化
   */
  private async ensureStorageInitialized(): Promise<void> {
    const metaExists = await fileExists(this.context.metaPath);

    if (metaExists) {
      await this.context.ensureBaseDirectories();
      await this.ai.createEmptyIndex();
      await this.loadAllCaches();
      // 仅在既存存储中检查并修复默认对话重复问题
      await this.ai.ensureSingleDefault();
      return;
    }

    // 首次初始化
    console.log(`[Storage] First-time initialization at: ${this.context.currentPath}`);

    // 创建目录结构
    await this.context.ensureBaseDirectories();

    // 创建 meta.json
    const meta: StorageMeta = {
      schemaVersion: 1,
      storageId: generateId(),
      createdAt: Date.now(),
    };
    await writeJsonFile(this.context.metaPath, meta);

    // 创建默认文件夹
    await this.folders.createDefaultFolder();

    // 创建空的索引文件
    await this.notes.createEmptyIndex();
    await this.ai.createEmptyIndex();

    // 加载缓存
    await this.loadAllCaches();
  }

  /**
   * 加载所有缓存
   */
  private async loadAllCaches(): Promise<void> {
    await Promise.all([this.folders.loadCache(), this.notes.loadCache(), this.ai.loadCache()]);
  }

  /**
   * 清空所有缓存
   */
  private clearAllCaches(): void {
    this.folders.clearCache();
    this.notes.clearCache();
    this.ai.clearCache();
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
          targetPath = path.join(this.context.currentPath, originalName);
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
    return this.context.defaultPath;
  }

  /**
   * 获取当前路径
   */
  getCurrentPath(): string {
    return this.context.currentPath;
  }

  /**
   * 设置存储路径
   */
  async setStoragePath(nextPath: string, options?: SetStoragePathOptions): Promise<void> {
    const migrate = options?.migrate ?? false;

    if (!migrate) {
      this.context.setCurrentPath(nextPath);
      this.clearAllCaches();
      await this.ensureStorageInitialized();
      return;
    }

    await this.migrateData(this.context.currentPath, nextPath);
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

      this.context.setCurrentPath(toPath);
      this.clearAllCaches();
      await this.loadAllCaches();

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
      await validateStorageIntegrity(this.context.currentPath);
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
    await shell.openPath(this.context.currentPath);
  }

  /**
   * 获取存储统计信息
   */
  async getStats(): Promise<StorageStats> {
    const dataSize = await calculateDirectorySize(this.context.currentPath);

    return {
      folderCount: this.folders.getCacheCount(),
      noteCount: this.notes.getCacheCount(),
      dataSize,
    };
  }

  // ============ 备份与导出 ============

  /**
   * 创建备份
   */
  async createBackup(): Promise<string> {
    try {
      const timestamp = Date.now();
      const backupName = `backup-${timestamp}`;
      const backupPath = path.join(this.context.backupsDir, backupName);

      console.log(`[Storage] Creating backup: ${backupName}`);

      await copyDirectory(this.context.currentPath, backupPath);

      console.log(`[Storage] Backup created successfully: ${backupPath}`);
      return backupPath;
    } catch (error) {
      console.error('[Storage] Backup creation failed:', error);
      throw new StorageError(StorageErrorCode.E_IO_WRITE, 'Failed to create backup', error);
    }
  }

  /**
   * 导出数据到指定路径
   */
  async exportData(targetPath: string): Promise<void> {
    try {
      console.log(`[Storage] Exporting data to: ${targetPath}`);

      await fs.mkdir(targetPath, { recursive: true });
      await copyDirectory(this.context.currentPath, targetPath);

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
      console.log(`[Storage] Resetting all data at: ${this.context.currentPath}`);

      const entries = await fs.readdir(this.context.currentPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(this.context.currentPath, entry.name);
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

  // ============ 向后兼容的代理方法 ============
  // 以下方法保持原有 API 的兼容性

  async listFolders() {
    return this.folders.list();
  }

  async createFolder(name: string) {
    return this.folders.create(name);
  }

  async renameFolder(id: string, name: string) {
    return this.folders.rename(id, name);
  }

  async deleteFolder(id: string) {
    return this.folders.delete(id, async (folderId) => {
      const notes = await this.notes.list(folderId);
      for (const note of notes) {
        await this.notes.moveToFolder(note.id, 'default');
      }
    });
  }

  async listNotes(folderId?: string) {
    return this.notes.list(folderId);
  }

  async createNote(folderId: string, payload?: { title?: string; content?: Note['content'] }) {
    return this.notes.create(folderId, payload);
  }

  async getNote(id: string) {
    return this.notes.get(id);
  }

  async updateNote(id: string, patch: Partial<Note>) {
    return this.notes.update(id, patch);
  }

  async deleteNote(id: string) {
    return this.notes.delete(id);
  }

  async getAIConversations() {
    return this.ai.getAll();
  }

  async createAIConversation(title?: string) {
    return this.ai.create(title);
  }

  async deleteAIConversation(id: string) {
    return this.ai.delete(id);
  }

  async saveAIConversationMessages(
    id: string,
    messages: Parameters<typeof this.ai.saveMessages>[1],
  ) {
    return this.ai.saveMessages(id, messages);
  }

  async updateAIConversationTitle(id: string, title: string) {
    return this.ai.updateTitle(id, title);
  }
}

// 导出单例
export const storageManager = new StorageManager();
