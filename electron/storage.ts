/**
 * 存储管理模块
 * 负责文件系统的读写、文件夹和便签的 CRUD 操作
 */

import { app, shell } from 'electron';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';

// 类型定义
interface Folder {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  order: number;
  system: boolean;
}

interface Note {
  id: string;
  folderId: string;
  title: string;
  content: import('../src/services/types').TipTapJSONContent;
  tags: string[];
  pinned: boolean;
  color?: import('../src/services/types').NoteColor;
  createdAt: number;
  updatedAt: number;
}

interface NoteIndex {
  id: string;
  folderId: string;
  title: string;
  excerpt: string;
  updatedAt: number;
  pinned: boolean;
  tags: string[];
  color?: import('../src/services/types').NoteColor;
}

interface StorageMeta {
  schemaVersion: number;
  storageId: string;
  createdAt: number;
  initialized?: boolean;
}

interface HealthCheckResult {
  ok: boolean;
  details?: string;
}

interface StorageStats {
  folderCount: number;
  noteCount: number;
  dataSize: number;
  lastBackupTime?: number;
}

interface CreateNotePayload {
  title?: string;
  content?: import('../src/services/types').TipTapJSONContent;
}

interface SetStoragePathOptions {
  migrate?: boolean;
}

interface AIConversation {
  id: string;
  title: string;
  excerpt: string;
  messages: Array<{
    id?: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
    reasoning?: string; // AI 思考过程（可选）
  }>;
  createdAt: number;
  updatedAt: number;
  isDefault?: boolean; // 是否是默认对话（系统对话，禁止删除）
}

interface AIConversationIndex {
  id: string;
  title: string;
  excerpt: string;
  createdAt: number;
  updatedAt: number;
  isDefault?: boolean;
}

enum StorageErrorCode {
  E_FOLDER_SYSTEM = 'E_FOLDER_SYSTEM',
  E_IO_READ = 'E_IO_READ',
  E_IO_WRITE = 'E_IO_WRITE',
  E_PATH_INVALID = 'E_PATH_INVALID',
  E_MIGRATE_FAIL = 'E_MIGRATE_FAIL',
  E_NOT_FOUND = 'E_NOT_FOUND',
  E_ALREADY_EXISTS = 'E_ALREADY_EXISTS',
}

class StorageError extends Error {
  constructor(
    public code: StorageErrorCode,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'StorageError';
  }
}

/**
 * 存储管理器
 */
export class StorageManager {
  private currentPath: string;
  private foldersCache: Folder[] | null = null;
  private notesIndexCache: NoteIndex[] | null = null;
  private aiConversationsIndexCache: AIConversationIndex[] | null = null;
  private defaultPath: string;

  constructor() {
    // 默认路径: app.getPath('userData')/data-v1
    this.defaultPath = path.join(app.getPath('userData'), 'data-v1');
    this.currentPath = this.defaultPath;
  }

  /**
   * 初始化存储
   * 应用启动时调用，确保目录结构存在
   */
  async initialize(): Promise<void> {
    try {
      await this.ensureStorageInitialized(this.currentPath);
      await this.recoverFromCrash();
      console.log(`[Storage] Initialized at: ${this.currentPath}`);
    } catch (error) {
      console.error('[Storage] Initialization failed:', error);
      throw new StorageError(StorageErrorCode.E_IO_WRITE, 'Failed to initialize storage', error);
    }
  }

  /**
   * 检查是否首次启动（未初始化）
   */
  async isFirstLaunch(): Promise<boolean> {
    const metaPath = path.join(this.currentPath, 'meta.json');
    const metaExists = await this.fileExists(metaPath);

    if (!metaExists) {
      return true;
    }

    try {
      const meta = await this.readJsonFile<StorageMeta>(metaPath);
      return !meta.initialized;
    } catch {
      return true;
    }
  }

  /**
   * 标记为已初始化
   */
  async markInitialized(): Promise<void> {
    const metaPath = path.join(this.currentPath, 'meta.json');
    const meta = await this.readJsonFile<StorageMeta>(metaPath, {
      schemaVersion: 1,
      storageId: this.generateId(),
      createdAt: Date.now(),
    });

    meta.initialized = true;
    await this.writeJsonFile(metaPath, meta);
  }

  /**
   * 确保存储目录初始化
   */
  private async ensureStorageInitialized(storagePath: string): Promise<void> {
    // 检查 meta.json 是否存在来判断是否已初始化
    const metaPath = path.join(storagePath, 'meta.json');
    const metaExists = await this.fileExists(metaPath);

    if (metaExists) {
      await this.ensureBaseDirectories(storagePath);
      await this.ensureAIConversationIndex(storagePath);
      await this.loadCaches();
      // 仅在既存存储中检查并修复默认对话重复问题
      await this.ensureSingleDefaultAIConversation();
      return;
    }

    // 首次初始化
    console.log(`[Storage] First-time initialization at: ${storagePath}`);

    // 创建目录结构
    await this.ensureBaseDirectories(storagePath);

    // 创建 meta.json
    const meta: StorageMeta = {
      schemaVersion: 1,
      storageId: this.generateId(),
      createdAt: Date.now(),
    };
    await this.writeJsonFile(metaPath, meta);

    // 创建默认文件夹
    const defaultFolder: Folder = {
      id: 'default',
      name: '默认文件夹',
      system: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      order: 0,
    };
    const foldersPath = path.join(storagePath, 'folders.json');
    await this.writeJsonFile(foldersPath, [defaultFolder]);

    // 创建空的 notes.index.json
    const indexPath = path.join(storagePath, 'notes.index.json');
    await this.writeJsonFile(indexPath, []);

    await this.ensureAIConversationIndex(storagePath);

    // 加载缓存（新建时无需 normalization，之后由应用层创建首个默认对话）
    await this.loadCaches();
  }

  /**
   * 加载缓存
   */
  private async loadCaches(): Promise<void> {
    const foldersPath = path.join(this.currentPath, 'folders.json');
    const indexPath = path.join(this.currentPath, 'notes.index.json');
    const aiIndexPath = path.join(this.currentPath, 'ai-conversations.index.json');

    this.foldersCache = await this.readJsonFile<Folder[]>(foldersPath, []);
    this.notesIndexCache = await this.readJsonFile<NoteIndex[]>(indexPath, []);
    this.aiConversationsIndexCache = await this.readJsonFile<AIConversationIndex[]>(
      aiIndexPath,
      [],
    );
  }

  /**
   * 清空缓存
   */
  private clearCaches(): void {
    this.foldersCache = null;
    this.notesIndexCache = null;
    this.aiConversationsIndexCache = null;
  }

  /**
   * 崩溃恢复
   * 检查并恢复临时文件
   */
  private async recoverFromCrash(): Promise<void> {
    try {
      const tempDir = path.join(this.currentPath, 'temp');
      const tempExists = await this.fileExists(tempDir);

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
          // 便签文件恢复到 notes/ 目录
          const noteId = originalName.replace('note-', '').replace('.json', '');
          targetPath = path.join(this.currentPath, 'notes', `${noteId}.json`);
        } else if (originalName.startsWith('ai-conversation-')) {
          const fileName = originalName.replace('ai-conversation-', '');
          targetPath = path.join(this.currentPath, 'ai-conversations', fileName);
        } else {
          // 其他文件恢复到根目录
          targetPath = path.join(this.currentPath, originalName);
        }

        try {
          // 尝试读取临时文件，验证其有效性
          const content = await fs.readFile(tempPath, 'utf-8');
          JSON.parse(content); // 验证是否为有效 JSON

          // 恢复文件
          await fs.rename(tempPath, targetPath);
          recoveredCount++;
          console.log(`[Storage] Recovered temp file: ${tempFile}`);
        } catch (error) {
          // 文件损坏，删除
          console.warn(`[Storage] Removing corrupted temp file: ${tempFile}`, error);
          await fs.unlink(tempPath);
        }
      }

      if (recoveredCount > 0) {
        console.log(`[Storage] Crash recovery completed: ${recoveredCount} file(s) recovered`);
      }
    } catch (error) {
      console.error('[Storage] Crash recovery failed:', error);
      // 不抛出错误，允许应用继续启动
    }
  }

  private async ensureBaseDirectories(storagePath: string): Promise<void> {
    await fs.mkdir(storagePath, { recursive: true });
    const subDirs = ['notes', 'temp', 'backups', 'ai-conversations'];
    for (const dir of subDirs) {
      await fs.mkdir(path.join(storagePath, dir), { recursive: true });
    }
  }

  private async ensureAIConversationIndex(storagePath: string): Promise<void> {
    const indexPath = path.join(storagePath, 'ai-conversations.index.json');
    const exists = await this.fileExists(indexPath);
    if (!exists) {
      await this.writeJsonFile(indexPath, []);
    }
  }

  private async ensureSingleDefaultAIConversation(): Promise<void> {
    const index = await this.getAIConversationIndex();
    const defaultEntries = index.filter((item) => item.isDefault);

    if (defaultEntries.length <= 1) {
      return;
    }

    // 按创建时间排序，保留最早的默认对话
    const sortedDefaults = [...defaultEntries].sort((a, b) => a.createdAt - b.createdAt);
    const keeperId = sortedDefaults[0].id;
    const demotedIds = sortedDefaults.slice(1).map((item) => item.id);

    for (const id of demotedIds) {
      try {
        const conversation = await this.readAIConversationFile(id);
        let updatedTitle = conversation.title;
        if (updatedTitle === '默认对话') {
          updatedTitle = this.generateConversationTitle(conversation.createdAt);
        }

        conversation.isDefault = false;
        conversation.title = updatedTitle;
        conversation.updatedAt = Date.now();

        await this.writeAIConversationFile(conversation);

        const meta = index.find((item) => item.id === id);
        if (meta) {
          meta.isDefault = false;
          meta.title = updatedTitle;
          meta.updatedAt = conversation.updatedAt;
          meta.excerpt = conversation.excerpt;
        }
      } catch (error) {
        console.warn(`[Storage] Failed to normalize default AI conversation ${id}:`, error);
      }
    }

    // 确保保留的默认对话标记正确
    const keeper = index.find((item) => item.id === keeperId);
    if (keeper && !keeper.isDefault) {
      keeper.isDefault = true;
    }

    await this.saveAIConversationIndex(index);
  }

  // ============ 路径管理 ============

  /**
   * 获取默认路径
   */
  getDefaultPath(): string {
    return this.defaultPath;
  }

  /**
   * 获取当前路径
   */
  getCurrentPath(): string {
    return this.currentPath;
  }

  /**
   * 设置存储路径
   */
  async setStoragePath(nextPath: string, options?: SetStoragePathOptions): Promise<void> {
    const migrate = options?.migrate ?? false;

    if (!migrate) {
      // 不迁移，仅切换路径
      this.currentPath = nextPath;
      this.clearCaches();
      await this.ensureStorageInitialized(nextPath);
      return;
    }

    // 迁移数据
    await this.migrateData(this.currentPath, nextPath);
  }

  /**
   * 迁移数据
   */
  private async migrateData(fromPath: string, toPath: string): Promise<void> {
    try {
      console.log(`[Storage] Migrating from ${fromPath} to ${toPath}`);

      // 1. 校验目标路径
      await this.validateMigrationPath(toPath);

      // 2. 创建备份
      const backupPath = path.join(fromPath, 'backups', `backup-${Date.now()}`);
      await this.copyDirectory(fromPath, backupPath);

      // 3. 拷贝到新路径
      await this.copyDirectory(fromPath, toPath);

      // 4. 校验完整性
      await this.validateStorageIntegrity(toPath);

      // 5. 切换路径
      this.currentPath = toPath;
      this.clearCaches();
      await this.loadCaches();

      console.log(`[Storage] Migration completed successfully`);
    } catch (error) {
      console.error('[Storage] Migration failed:', error);
      throw new StorageError(StorageErrorCode.E_MIGRATE_FAIL, 'Data migration failed', error);
    }
  }

  /**
   * 校验迁移路径
   */
  private async validateMigrationPath(targetPath: string): Promise<void> {
    try {
      // 检查目录是否存在
      const exists = await this.fileExists(targetPath);
      if (exists) {
        // 检查是否为空目录
        const files = await fs.readdir(targetPath);
        if (files.length > 0) {
          throw new Error('Target directory is not empty');
        }
      } else {
        // 创建目录
        await fs.mkdir(targetPath, { recursive: true });
      }

      // 检查是否可写
      await fs.access(targetPath, fsSync.constants.W_OK);
    } catch (error) {
      throw new StorageError(StorageErrorCode.E_PATH_INVALID, 'Invalid migration path', error);
    }
  }

  /**
   * 校验存储完整性
   */
  private async validateStorageIntegrity(storagePath: string): Promise<void> {
    const requiredFiles = [
      'meta.json',
      'folders.json',
      'notes.index.json',
      'ai-conversations.index.json',
    ];
    for (const file of requiredFiles) {
      const filePath = path.join(storagePath, file);
      const exists = await this.fileExists(filePath);
      if (!exists) {
        throw new Error(`Missing required file: ${file}`);
      }
    }
  }

  /**
   * 拷贝目录
   */
  private async copyDirectory(src: string, dest: string): Promise<void> {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        // 跳过 temp 和 backups 目录
        if (entry.name === 'temp' || entry.name === 'backups') {
          continue;
        }
        await this.copyDirectory(srcPath, destPath);
      } else {
        await fs.copyFile(srcPath, destPath);
      }
    }
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<HealthCheckResult> {
    try {
      await this.validateStorageIntegrity(this.currentPath);
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
    await shell.openPath(this.currentPath);
  }

  /**
   * 获取存储统计信息
   */
  async getStats(): Promise<StorageStats> {
    const folders = this.foldersCache || [];
    const notes = this.notesIndexCache || [];
    const dataSize = await this.calculateDirectorySize(this.currentPath);

    return {
      folderCount: folders.length,
      noteCount: notes.length,
      dataSize,
    };
  }

  /**
   * 创建备份
   */
  async createBackup(): Promise<string> {
    try {
      const timestamp = Date.now();
      const backupName = `backup-${timestamp}`;
      const backupPath = path.join(this.currentPath, 'backups', backupName);

      console.log(`[Storage] Creating backup: ${backupName}`);

      // 拷贝所有数据到备份目录
      await this.copyDirectory(this.currentPath, backupPath);

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

      // 确保目标目录存在
      await fs.mkdir(targetPath, { recursive: true });

      // 拷贝所有数据（排除 temp 和 backups）
      await this.copyDirectory(this.currentPath, targetPath);

      console.log(`[Storage] Data exported successfully`);
    } catch (error) {
      console.error('[Storage] Data export failed:', error);
      throw new StorageError(StorageErrorCode.E_IO_WRITE, 'Failed to export data', error);
    }
  }

  /**
   * 重置所有数据（清空并重新初始化）
   * 用于开发环境或完全重置
   */
  async resetAllData(): Promise<void> {
    try {
      console.log(`[Storage] Resetting all data at: ${this.currentPath}`);

      // 删除当前存储路径下的所有内容
      const entries = await fs.readdir(this.currentPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(this.currentPath, entry.name);
        if (entry.isDirectory()) {
          await this.deleteDirectory(fullPath);
        } else {
          await fs.unlink(fullPath);
        }
      }

      // 重新初始化存储
      await this.ensureStorageInitialized(this.currentPath);

      console.log(`[Storage] Data reset successfully`);
    } catch (error) {
      console.error('[Storage] Data reset failed:', error);
      throw new StorageError(StorageErrorCode.E_IO_WRITE, 'Failed to reset data', error);
    }
  }

  /**
   * 递归删除目录
   */
  private async deleteDirectory(dirPath: string): Promise<void> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
          await this.deleteDirectory(fullPath);
        } else {
          await fs.unlink(fullPath);
        }
      }

      await fs.rmdir(dirPath);
    } catch (error) {
      console.error(`[Storage] Failed to delete directory ${dirPath}:`, error);
      throw error;
    }
  }

  /**
   * 计算目录大小
   */
  private async calculateDirectorySize(dirPath: string): Promise<number> {
    let totalSize = 0;
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const entryPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
          totalSize += await this.calculateDirectorySize(entryPath);
        } else {
          const stats = await fs.stat(entryPath);
          totalSize += stats.size;
        }
      }
    } catch (error) {
      console.error(`[Storage] Error calculating size for ${dirPath}:`, error);
    }
    return totalSize;
  }

  // ============ 文件夹操作 ============

  /**
   * 列出所有文件夹
   */
  async listFolders(): Promise<Folder[]> {
    if (!this.foldersCache) {
      await this.loadCaches();
    }
    return this.foldersCache || [];
  }

  /**
   * 创建文件夹
   */
  async createFolder(name: string): Promise<Folder> {
    const folders = await this.listFolders();

    // 检查名称是否已存在
    if (folders.some((f) => f.name === name)) {
      throw new StorageError(StorageErrorCode.E_ALREADY_EXISTS, `Folder "${name}" already exists`);
    }

    const now = Date.now();
    const newFolder: Folder = {
      id: this.generateId(),
      name,
      createdAt: now,
      updatedAt: now,
      order: folders.length,
      system: false,
    };

    folders.push(newFolder);
    await this.saveFolders(folders);

    return newFolder;
  }

  /**
   * 重命名文件夹
   */
  async renameFolder(id: string, name: string): Promise<Folder> {
    const folders = await this.listFolders();
    const folder = folders.find((f) => f.id === id);

    if (!folder) {
      throw new StorageError(StorageErrorCode.E_NOT_FOUND, `Folder not found: ${id}`);
    }

    if (folder.system) {
      throw new StorageError(StorageErrorCode.E_FOLDER_SYSTEM, 'Cannot rename system folder');
    }

    // 检查名称是否已存在
    if (folders.some((f) => f.id !== id && f.name === name)) {
      throw new StorageError(StorageErrorCode.E_ALREADY_EXISTS, `Folder "${name}" already exists`);
    }

    folder.name = name;
    folder.updatedAt = Date.now();

    await this.saveFolders(folders);

    return folder;
  }

  /**
   * 删除文件夹
   */
  async deleteFolder(id: string): Promise<void> {
    const folders = await this.listFolders();
    const folder = folders.find((f) => f.id === id);

    if (!folder) {
      throw new StorageError(StorageErrorCode.E_NOT_FOUND, `Folder not found: ${id}`);
    }

    if (folder.system) {
      throw new StorageError(
        StorageErrorCode.E_FOLDER_SYSTEM,
        'Cannot delete system default folder',
      );
    }

    // 将该文件夹下的所有便签移动到默认文件夹
    const notes = await this.listNotes(id);
    for (const note of notes) {
      const fullNote = await this.getNote(note.id);
      fullNote.folderId = 'default';
      fullNote.updatedAt = Date.now();
      await this.saveNote(fullNote);
    }

    // 删除文件夹
    const index = folders.findIndex((f) => f.id === id);
    folders.splice(index, 1);
    await this.saveFolders(folders);
  }

  /**
   * 保存文件夹列表
   */
  private async saveFolders(folders: Folder[]): Promise<void> {
    const foldersPath = path.join(this.currentPath, 'folders.json');
    await this.writeJsonFile(foldersPath, folders);
    this.foldersCache = folders;
  }

  // ============ 便签操作 ============

  /**
   * 列出便签索引
   */
  async listNotes(folderId?: string): Promise<NoteIndex[]> {
    if (!this.notesIndexCache) {
      await this.loadCaches();
    }

    const allNotes = this.notesIndexCache || [];

    if (folderId) {
      return allNotes.filter((n) => n.folderId === folderId);
    }

    return allNotes;
  }

  /**
   * 创建便签
   */
  async createNote(folderId: string, payload?: CreateNotePayload): Promise<Note> {
    // 验证文件夹存在
    const folders = await this.listFolders();
    if (!folders.some((f) => f.id === folderId)) {
      throw new StorageError(StorageErrorCode.E_NOT_FOUND, `Folder not found: ${folderId}`);
    }

    const now = Date.now();
    const newNote: Note = {
      id: this.generateId(),
      folderId,
      title: payload?.title || '无标题',
      content: payload?.content || { type: 'doc', content: [] },
      tags: [],
      pinned: false,
      color: 'ffffff',
      createdAt: now,
      updatedAt: now,
    };

    // 保存完整便签
    await this.saveNote(newNote);

    return newNote;
  }

  /**
   * 获取便签完整内容
   */
  async getNote(id: string): Promise<Note> {
    const notePath = path.join(this.currentPath, 'notes', `${id}.json`);
    const exists = await this.fileExists(notePath);

    if (!exists) {
      throw new StorageError(StorageErrorCode.E_NOT_FOUND, `Note not found: ${id}`);
    }

    return await this.readJsonFile<Note>(notePath);
  }

  /**
   * 更新便签
   */
  async updateNote(id: string, patch: Partial<Note>): Promise<Note> {
    const note = await this.getNote(id);

    // 更新字段
    Object.assign(note, patch);
    note.updatedAt = Date.now();

    // 保存
    await this.saveNote(note);

    return note;
  }

  /**
   * 删除便签
   */
  async deleteNote(id: string): Promise<void> {
    const notePath = path.join(this.currentPath, 'notes', `${id}.json`);
    const exists = await this.fileExists(notePath);

    if (!exists) {
      throw new StorageError(StorageErrorCode.E_NOT_FOUND, `Note not found: ${id}`);
    }

    // 删除文件
    await fs.unlink(notePath);

    // 从索引中移除
    const index = this.notesIndexCache || [];
    const noteIndex = index.findIndex((n) => n.id === id);
    if (noteIndex >= 0) {
      index.splice(noteIndex, 1);
      await this.saveNotesIndex(index);
    }
  }

  /**
   * 保存便签
   * 先写正文，再更新索引
   */
  private async saveNote(note: Note): Promise<void> {
    // 1. 保存完整便签（原子写入）
    const notePath = path.join(this.currentPath, 'notes', `${note.id}.json`);
    await this.writeJsonFileAtomic(notePath, note);

    // 2. 更新索引
    const index = this.notesIndexCache || [];
    const existingIndex = index.findIndex((n) => n.id === note.id);

    const noteIndex: NoteIndex = {
      id: note.id,
      folderId: note.folderId,
      title: note.title,
      excerpt: this.generateExcerpt(note.content),
      updatedAt: note.updatedAt,
      pinned: note.pinned,
      tags: note.tags,
      color: note.color ?? 'ffffff',
    };

    if (existingIndex >= 0) {
      index[existingIndex] = noteIndex;
    } else {
      index.push(noteIndex);
    }

    await this.saveNotesIndex(index);
  }

  /**
   * 保存便签索引
   */
  private async saveNotesIndex(index: NoteIndex[]): Promise<void> {
    const indexPath = path.join(this.currentPath, 'notes.index.json');
    await this.writeJsonFile(indexPath, index);
    this.notesIndexCache = index;
  }

  /**
   * 生成摘要
   */
  private generateExcerpt(content: unknown): string {
    try {
      const isObj = (v: unknown): v is { [k: string]: unknown } =>
        typeof v === 'object' && v !== null;
      if (!isObj(content)) return '';

      const root = content as import('../src/services/types').TipTapJSONContent;
      if (!Array.isArray(root.content)) return '';

      let text = '';
      const extractText = (node: import('../src/services/types').TipTapJSONContent) => {
        if (node.type === 'text' && typeof node.text === 'string') {
          text += node.text;
        }
        if (node.content && Array.isArray(node.content)) {
          node.content.forEach(extractText);
        }
      };

      extractText(root);
      return text.slice(0, 100);
    } catch {
      return '';
    }
  }

  private generateConversationTitle(timestamp: number): string {
    const date = new Date(timestamp || Date.now());
    const pad = (value: number) => value.toString().padStart(2, '0');
    return `对话${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
  }

  // ============ AI 对话操作 ============

  /**
   * 获取所有 AI 对话
   */
  async getAIConversations(): Promise<AIConversation[]> {
    const index = await this.getAIConversationIndex();
    const conversations = await Promise.all(
      index.map(async (item) => {
        try {
          return await this.readAIConversationFile(item.id);
        } catch (error) {
          console.error(`[Storage] Failed to read AI conversation ${item.id}:`, error);
          return null;
        }
      }),
    );

    return conversations.filter((item): item is AIConversation => item !== null);
  }

  /**
   * 创建 AI 对话
   */
  async createAIConversation(title?: string): Promise<AIConversation> {
    const now = Date.now();
    const index = await this.getAIConversationIndex();
    const isDefaultConversation = index.length === 0; // 如果没有对话，这是第一个（默认对话）

    // 生成默认标题格式：对话YYYYMMDD
    const dateStr = new Date().toLocaleDateString('zh-CN').replace(/\//g, '');
    const defaultTitle = `对话${dateStr}`;

    const newConversation: AIConversation = {
      id: this.generateId(),
      title: isDefaultConversation ? '默认对话' : title || defaultTitle,
      excerpt: '开始对话',
      messages: [],
      createdAt: now,
      updatedAt: now,
      isDefault: isDefaultConversation, // 标记为默认对话
    };

    await this.writeAIConversationFile(newConversation);

    index.push(this.toConversationIndex(newConversation));
    await this.saveAIConversationIndex(index);

    return newConversation;
  }

  /**
   * 删除 AI 对话
   */
  async deleteAIConversation(id: string): Promise<void> {
    const index = await this.getAIConversationIndex();
    const metaIndex = index.findIndex((c) => c.id === id);

    if (metaIndex < 0) {
      throw new StorageError(StorageErrorCode.E_NOT_FOUND, `Conversation not found: ${id}`);
    }

    // 禁止删除默认对话
    if (index[metaIndex].isDefault) {
      throw new StorageError(StorageErrorCode.E_FOLDER_SYSTEM, '无法删除默认对话');
    }

    const filePath = this.getAIConversationFilePath(id);
    if (await this.fileExists(filePath)) {
      await fs.unlink(filePath);
    }

    index.splice(metaIndex, 1);
    await this.saveAIConversationIndex(index);
  }

  /**
   * 保存 AI 对话消息
   */
  async saveAIConversationMessages(
    id: string,
    messages: AIConversation['messages'],
  ): Promise<AIConversation> {
    const conversation = await this.readAIConversationFile(id);

    conversation.messages = messages.map((message, index) => ({
      ...message,
      id: message.id ?? `${message.role}-${message.timestamp}-${index}`,
    }));
    conversation.updatedAt = Date.now();

    // 更新摘要（使用最后一条用户消息）
    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');
    if (lastUserMessage) {
      conversation.excerpt = lastUserMessage.content.slice(0, 100);
    }

    await this.writeAIConversationFile(conversation);

    await this.updateAIConversationIndexEntry(conversation);

    return conversation;
  }

  /**
   * 更新 AI 对话标题
   */
  async updateAIConversationTitle(id: string, title: string): Promise<AIConversation> {
    const conversation = await this.readAIConversationFile(id);

    conversation.title = title;
    conversation.updatedAt = Date.now();
    await this.writeAIConversationFile(conversation);

    await this.updateAIConversationIndexEntry(conversation);

    return conversation;
  }

  private async getAIConversationIndex(): Promise<AIConversationIndex[]> {
    if (!this.aiConversationsIndexCache) {
      const indexPath = path.join(this.currentPath, 'ai-conversations.index.json');
      this.aiConversationsIndexCache = await this.readJsonFile<AIConversationIndex[]>(
        indexPath,
        [],
      );
    }
    return this.aiConversationsIndexCache;
  }

  private async saveAIConversationIndex(index: AIConversationIndex[]): Promise<void> {
    const indexPath = path.join(this.currentPath, 'ai-conversations.index.json');
    await this.writeJsonFile(indexPath, index);
    this.aiConversationsIndexCache = index;
  }

  private toConversationIndex(conversation: AIConversation): AIConversationIndex {
    return {
      id: conversation.id,
      title: conversation.title,
      excerpt: conversation.excerpt,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      isDefault: conversation.isDefault,
    };
  }

  private getAIConversationFilePath(id: string, basePath?: string): string {
    const root = basePath ?? this.currentPath;
    return path.join(root, 'ai-conversations', `${id}.json`);
  }

  private async readAIConversationFile(id: string): Promise<AIConversation> {
    const filePath = this.getAIConversationFilePath(id);
    const exists = await this.fileExists(filePath);

    if (!exists) {
      throw new StorageError(StorageErrorCode.E_NOT_FOUND, `Conversation not found: ${id}`);
    }

    return await this.readJsonFile<AIConversation>(filePath);
  }

  private async writeAIConversationFile(conversation: AIConversation): Promise<void> {
    const filePath = this.getAIConversationFilePath(conversation.id);
    await this.writeJsonFileAtomic(filePath, conversation);
  }

  private async updateAIConversationIndexEntry(conversation: AIConversation): Promise<void> {
    const index = await this.getAIConversationIndex();
    const meta = this.toConversationIndex(conversation);
    const existingIndex = index.findIndex((item) => item.id === conversation.id);

    if (existingIndex >= 0) {
      index[existingIndex] = meta;
    } else {
      index.push(meta);
    }

    await this.saveAIConversationIndex(index);
  }

  // ============ 工具方法 ============

  /**
   * 生成唯一 ID
   */
  private generateId(): string {
    return randomBytes(8).toString('hex');
  }

  /**
   * 检查文件是否存在
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 读取 JSON 文件
   */
  private async readJsonFile<T>(filePath: string, defaultValue?: T): Promise<T> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      if (defaultValue !== undefined) {
        return defaultValue;
      }
      throw new StorageError(StorageErrorCode.E_IO_READ, `Failed to read file: ${filePath}`, error);
    }
  }

  /**
   * 写入 JSON 文件
   */
  private async writeJsonFile(filePath: string, data: unknown): Promise<void> {
    try {
      const content = JSON.stringify(data, null, 2);
      await fs.writeFile(filePath, content, 'utf-8');
    } catch (error) {
      throw new StorageError(
        StorageErrorCode.E_IO_WRITE,
        `Failed to write file: ${filePath}`,
        error,
      );
    }
  }

  /**
   * 原子写入 JSON 文件
   * 先写临时文件，再重命名
   */
  private async writeJsonFileAtomic(filePath: string, data: unknown): Promise<void> {
    // 为便签文件添加特殊前缀，便于崩溃恢复时识别
    const normalizedPath = filePath.split(path.sep).join('/');
    const isNoteFile = normalizedPath.includes('/notes/');
    const isAIConversationFile = normalizedPath.includes('/ai-conversations/');
    const baseName = path.basename(filePath);
    let tempFileName = `${baseName}.tmp`;
    if (isNoteFile) {
      tempFileName = `note-${baseName}.tmp`;
    } else if (isAIConversationFile) {
      tempFileName = `ai-conversation-${baseName}.tmp`;
    }
    const tempPath = path.join(this.currentPath, 'temp', tempFileName);

    try {
      // 写入临时文件
      const content = JSON.stringify(data, null, 2);
      await fs.writeFile(tempPath, content, 'utf-8');

      // 原子重命名
      await fs.rename(tempPath, filePath);
    } catch (error) {
      // 清理临时文件
      try {
        await fs.unlink(tempPath);
      } catch {}

      throw new StorageError(
        StorageErrorCode.E_IO_WRITE,
        `Failed to write file atomically: ${filePath}`,
        error,
      );
    }
  }
}

// 导出单例
export const storageManager = new StorageManager();
