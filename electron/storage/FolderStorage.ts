/**
 * 文件夹存储模块
 * 负责文件夹的 CRUD 操作
 */

import type { StorageContext } from './StorageContext';
import type { Folder } from './types';
import { StorageError, StorageErrorCode } from './errors';
import { generateId, readJsonFile, writeJsonFile } from './utils';
import { FoldersArraySchema } from './schemas';

export class FolderStorage {
  private cache: Folder[] | null = null;
  private context: StorageContext;

  constructor(context: StorageContext) {
    this.context = context;
  }

  /**
   * 列出所有文件夹
   */
  async list(): Promise<Folder[]> {
    if (!this.cache) {
      await this.loadCache();
    }
    return this.cache || [];
  }

  /**
   * 创建文件夹
   */
  async create(name: string): Promise<Folder> {
    const folders = await this.list();

    // 检查名称是否已存在
    if (folders.some((f) => f.name === name)) {
      throw new StorageError(StorageErrorCode.E_ALREADY_EXISTS, `Folder "${name}" already exists`);
    }

    const now = Date.now();
    const newFolder: Folder = {
      id: generateId(),
      name,
      createdAt: now,
      updatedAt: now,
      order: folders.length,
      system: false,
    };

    folders.push(newFolder);
    await this.save(folders);

    return newFolder;
  }

  /**
   * 重命名文件夹
   */
  async rename(id: string, name: string): Promise<Folder> {
    const folders = await this.list();
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

    await this.save(folders);

    return folder;
  }

  /**
   * 删除文件夹
   * @param id 文件夹 ID
   * @param onBeforeDelete 删除前的回调，用于处理文件夹内的便签
   */
  async delete(id: string, onBeforeDelete?: (folderId: string) => Promise<void>): Promise<void> {
    const folders = await this.list();
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

    // 执行删除前回调（如移动便签到默认文件夹）
    if (onBeforeDelete) {
      await onBeforeDelete(id);
    }

    // 删除文件夹
    const index = folders.findIndex((f) => f.id === id);
    folders.splice(index, 1);
    await this.save(folders);
  }

  /**
   * 检查文件夹是否存在
   */
  async exists(id: string): Promise<boolean> {
    const folders = await this.list();
    return folders.some((f) => f.id === id);
  }

  /**
   * 获取单个文件夹
   */
  async get(id: string): Promise<Folder | null> {
    const folders = await this.list();
    return folders.find((f) => f.id === id) || null;
  }

  /**
   * 创建默认文件夹
   */
  async createDefaultFolder(): Promise<void> {
    const defaultFolder: Folder = {
      id: 'default',
      name: '默认文件夹',
      system: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      order: 0,
    };
    await this.save([defaultFolder]);
  }

  /**
   * 加载缓存（使用 Schema 校验）
   */
  async loadCache(): Promise<void> {
    this.cache = await readJsonFile<Folder[]>(this.context.foldersPath, [], FoldersArraySchema);
  }

  /**
   * 清空缓存
   */
  clearCache(): void {
    this.cache = null;
  }

  /**
   * 获取缓存数量（用于统计）
   */
  getCacheCount(): number {
    return this.cache?.length || 0;
  }

  /**
   * 保存文件夹列表
   */
  private async save(folders: Folder[]): Promise<void> {
    await writeJsonFile(this.context.foldersPath, folders);
    this.cache = folders;
  }
}
