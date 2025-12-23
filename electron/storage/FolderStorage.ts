/**
 * 文件夹存储模块
 *
 * 每个文件夹独立存储为一个 JSON 文件，避免多端同步冲突
 * 继承 BaseDirectoryStorage，与便签等模块保持一致
 */

import type { StorageContext } from './StorageContext';
import type { Folder } from './types';
import { StorageError, StorageErrorCode } from './errors';
import { BaseDirectoryStorage } from './core/BaseStorage';
import { getModuleConfig } from './core/moduleRegistry';

// 默认文件夹 ID
export const DEFAULT_FOLDER_ID = 'default';

// 获取 folders 模块配置
const foldersConfig = getModuleConfig('folders')!;

/**
 * 文件夹索引类型（用于列表显示）
 */
export interface FolderIndex {
  id: string;
  name: string;
  system: boolean;
  order: number;
  updatedAt: number;
}

/**
 * 文件夹存储类
 */
export class FolderStorage extends BaseDirectoryStorage<Folder, FolderIndex> {
  constructor(context: StorageContext) {
    super(context.dataDir, context.tempDir, foldersConfig);
  }

  // ============ 文件夹特有方法 ============

  /**
   * 获取所有文件夹（按 order 排序）
   */
  async getAll(): Promise<Folder[]> {
    const index = await this.list();
    const folders = await Promise.all(
      index.map(async (item) => {
        try {
          return await this.get(item.id);
        } catch (error) {
          console.error(`[FolderStorage] Failed to read folder ${item.id}:`, error);
          return null;
        }
      }),
    );
    return folders.filter((f): f is Folder => f !== null).sort((a, b) => a.order - b.order);
  }

  /**
   * 创建文件夹
   */
  async createFolder(name: string): Promise<Folder> {
    // 检查名称是否已存在
    const existing = await this.getAll();
    if (existing.some((f) => f.name === name)) {
      throw new StorageError(StorageErrorCode.E_ALREADY_EXISTS, `Folder "${name}" already exists`);
    }

    const nextOrder = existing.length;
    return await this.create({ name, order: nextOrder, system: false });
  }

  /**
   * 重命名文件夹
   */
  async rename(id: string, name: string): Promise<Folder> {
    const folder = await this.get(id);

    if (folder.system) {
      throw new StorageError(StorageErrorCode.E_FOLDER_SYSTEM, 'Cannot rename system folder');
    }

    // 检查名称是否已存在
    const existing = await this.getAll();
    if (existing.some((f) => f.id !== id && f.name === name)) {
      throw new StorageError(StorageErrorCode.E_ALREADY_EXISTS, `Folder "${name}" already exists`);
    }

    return await this.update(id, { name });
  }

  /**
   * 删除文件夹
   * @param id 文件夹 ID
   * @param onBeforeDelete 删除前的回调，用于处理文件夹内的便签
   */
  async deleteFolder(
    id: string,
    onBeforeDelete?: (folderId: string) => Promise<void>,
  ): Promise<void> {
    const folder = await this.get(id);

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

    await this.delete(id);
  }

  /**
   * 检查文件夹是否存在
   */
  async exists(id: string): Promise<boolean> {
    try {
      await this.get(id);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 创建默认文件夹（首次初始化时调用）
   */
  async createDefaultFolder(): Promise<void> {
    const exists = await this.exists(DEFAULT_FOLDER_ID);
    if (exists) return;

    const now = Date.now();
    const defaultFolder: Folder = {
      id: DEFAULT_FOLDER_ID,
      name: '默认文件夹',
      system: true,
      order: 0,
      createdAt: now,
      updatedAt: now,
    };

    // 直接写入文件
    await this.writeFile(defaultFolder);
    this.addToIndex(defaultFolder);
  }

  /**
   * 获取下一个排序值
   */
  async getNextOrder(): Promise<number> {
    const folders = await this.getAll();
    return folders.length;
  }

  // ============ 抽象方法实现 ============

  /**
   * 将 Folder 转换为 FolderIndex
   */
  protected toIndex(folder: Folder): FolderIndex {
    return {
      id: folder.id,
      name: folder.name,
      system: folder.system,
      order: folder.order,
      updatedAt: folder.updatedAt,
    };
  }

  /**
   * 创建默认数据
   */
  protected createDefaultData(id: string, now: number, payload: Partial<Folder>): Folder {
    return {
      id,
      name: payload.name || '新文件夹',
      system: payload.system ?? false,
      order: payload.order ?? 0,
      createdAt: now,
      updatedAt: now,
    };
  }
}
