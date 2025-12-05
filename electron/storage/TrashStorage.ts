/**
 * 回收站存储模块
 * 负责回收站（已删除便签）的管理
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import type { StorageContext } from './StorageContext';
import type { Note, TrashItem, TrashIndex } from './types';
import { StorageError, StorageErrorCode } from './errors';
import { generateId, readJsonFile, writeJsonFile, writeJsonFileAtomic, fileExists } from './utils';
import { TrashItemSchema, TrashIndexArraySchema } from './schemas';

// 回收站保留天数（30天后自动清理）
const TRASH_RETENTION_DAYS = 30;

export class TrashStorage {
  private indexCache: TrashIndex[] | null = null;
  private context: StorageContext;

  constructor(context: StorageContext) {
    this.context = context;
  }

  /**
   * 获取回收站索引列表
   */
  async list(): Promise<TrashIndex[]> {
    if (!this.indexCache) {
      await this.loadCache();
    }
    return this.indexCache || [];
  }

  /**
   * 将便签移入回收站（软删除）
   */
  async moveToTrash(note: Note): Promise<TrashItem> {
    const now = Date.now();
    const expiresAt = now + TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000;

    const trashItem: TrashItem = {
      id: generateId(),
      originalId: note.id,
      originalFolderId: note.folderId,
      title: note.title,
      content: note.content,
      tags: note.tags,
      pinned: note.pinned,
      color: note.color,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
      deletedAt: now,
      expiresAt,
    };

    // 保存到回收站
    await this.writeFile(trashItem);

    // 更新索引
    const index = await this.list();
    index.push(this.toIndex(trashItem));
    await this.saveIndex(index);

    return trashItem;
  }

  /**
   * 从回收站恢复便签
   * @returns 恢复后的便签数据（需要调用方保存到 notes 目录）
   */
  async restore(trashItemId: string): Promise<Note> {
    const trashItem = await this.readFile(trashItemId);

    // 构建恢复的便签
    const restoredNote: Note = {
      id: trashItem.originalId,
      folderId: trashItem.originalFolderId,
      title: trashItem.title,
      content: trashItem.content,
      tags: trashItem.tags,
      pinned: trashItem.pinned,
      color: trashItem.color,
      createdAt: trashItem.createdAt,
      updatedAt: Date.now(), // 更新时间设为恢复时的时间
    };

    // 从回收站删除
    await this.permanentDelete(trashItemId);

    return restoredNote;
  }

  /**
   * 永久删除回收站中的便签
   */
  async permanentDelete(trashItemId: string): Promise<void> {
    const filePath = this.getTrashItemPath(trashItemId);
    const exists = await fileExists(filePath);

    if (!exists) {
      throw new StorageError(StorageErrorCode.E_NOT_FOUND, `Trash item not found: ${trashItemId}`);
    }

    // 删除文件
    await fs.unlink(filePath);

    // 从索引中移除
    const index = await this.list();
    const itemIndex = index.findIndex((item) => item.id === trashItemId);
    if (itemIndex >= 0) {
      index.splice(itemIndex, 1);
      await this.saveIndex(index);
    }
  }

  /**
   * 清空回收站
   */
  async emptyTrash(): Promise<number> {
    const index = await this.list();
    let deletedCount = 0;

    for (const item of index) {
      try {
        const filePath = this.getTrashItemPath(item.id);
        if (await fileExists(filePath)) {
          await fs.unlink(filePath);
          deletedCount++;
        }
      } catch (error) {
        console.warn(`[TrashStorage] Failed to delete trash item ${item.id}:`, error);
      }
    }

    // 清空索引
    await this.saveIndex([]);

    return deletedCount;
  }

  /**
   * 清理过期的回收站项目
   * 应在应用启动时调用
   */
  async cleanupExpired(): Promise<number> {
    const now = Date.now();
    const index = await this.list();
    const expiredItems = index.filter((item) => item.expiresAt <= now);

    let cleanedCount = 0;
    for (const item of expiredItems) {
      try {
        await this.permanentDelete(item.id);
        cleanedCount++;
      } catch (error) {
        console.warn(`[TrashStorage] Failed to clean expired item ${item.id}:`, error);
      }
    }

    if (cleanedCount > 0) {
      console.log(`[TrashStorage] Cleaned up ${cleanedCount} expired items`);
    }

    return cleanedCount;
  }

  /**
   * 获取单个回收站项目
   */
  async get(id: string): Promise<TrashItem> {
    return await this.readFile(id);
  }

  /**
   * 加载缓存
   */
  async loadCache(): Promise<void> {
    const indexPath = path.join(this.context.trashDir, 'trash.index.json');
    this.indexCache = await readJsonFile<TrashIndex[]>(indexPath, [], TrashIndexArraySchema);
  }

  /**
   * 清空缓存
   */
  clearCache(): void {
    this.indexCache = null;
  }

  /**
   * 获取缓存数量
   */
  getCacheCount(): number {
    return this.indexCache?.length || 0;
  }

  /**
   * 创建空索引文件
   */
  async createEmptyIndex(): Promise<void> {
    const indexPath = path.join(this.context.trashDir, 'trash.index.json');
    const exists = await fileExists(indexPath);
    if (!exists) {
      await writeJsonFile(indexPath, []);
    }
  }

  /**
   * 重建索引
   */
  async rebuildIndex(): Promise<{ rebuilt: number; errors: string[] }> {
    const errors: string[] = [];
    const newIndex: TrashIndex[] = [];

    try {
      const trashDir = this.context.trashDir;
      const dirExists = await fileExists(trashDir);
      if (!dirExists) {
        console.log('[TrashStorage] Trash directory does not exist, creating empty index');
        await this.saveIndex([]);
        return { rebuilt: 0, errors: [] };
      }

      const files = await fs.readdir(trashDir);
      const jsonFiles = files.filter((f) => f.endsWith('.json') && f !== 'trash.index.json');

      console.log(`[TrashStorage] Rebuilding index from ${jsonFiles.length} trash files`);

      for (const fileName of jsonFiles) {
        const id = fileName.replace('.json', '');
        try {
          const trashItem = await this.readFile(id);
          newIndex.push(this.toIndex(trashItem));
        } catch (error) {
          const errorMsg = `Failed to read trash item ${fileName}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          console.error(`[TrashStorage] ${errorMsg}`);
          errors.push(errorMsg);
        }
      }

      // 按删除时间倒序排列
      newIndex.sort((a, b) => b.deletedAt - a.deletedAt);

      await this.saveIndex(newIndex);
      console.log(`[TrashStorage] Index rebuilt successfully: ${newIndex.length} items`);

      return { rebuilt: newIndex.length, errors };
    } catch (error) {
      const errorMsg = `Failed to rebuild index: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(`[TrashStorage] ${errorMsg}`);
      errors.push(errorMsg);
      return { rebuilt: 0, errors };
    }
  }

  // ============ 私有方法 ============

  private getTrashItemPath(id: string): string {
    return path.join(this.context.trashDir, `${id}.json`);
  }

  private async readFile(id: string): Promise<TrashItem> {
    const filePath = this.getTrashItemPath(id);
    const exists = await fileExists(filePath);

    if (!exists) {
      throw new StorageError(StorageErrorCode.E_NOT_FOUND, `Trash item not found: ${id}`);
    }

    return await readJsonFile<TrashItem>(filePath, undefined, TrashItemSchema);
  }

  private async writeFile(trashItem: TrashItem): Promise<void> {
    const filePath = this.getTrashItemPath(trashItem.id);
    await writeJsonFileAtomic(filePath, trashItem, this.context.tempDir);
  }

  private async saveIndex(index: TrashIndex[]): Promise<void> {
    const indexPath = path.join(this.context.trashDir, 'trash.index.json');
    await writeJsonFile(indexPath, index);
    this.indexCache = index;
  }

  private toIndex(trashItem: TrashItem): TrashIndex {
    return {
      id: trashItem.id,
      originalId: trashItem.originalId,
      originalFolderId: trashItem.originalFolderId,
      title: trashItem.title,
      excerpt: this.generateExcerpt(trashItem.content),
      deletedAt: trashItem.deletedAt,
      expiresAt: trashItem.expiresAt,
    };
  }

  private generateExcerpt(content: unknown): string {
    try {
      const isObj = (v: unknown): v is { [k: string]: unknown } =>
        typeof v === 'object' && v !== null;
      if (!isObj(content)) return '';

      type MinimalNode = { type?: string; text?: string; content?: MinimalNode[] };
      const root = content as unknown as MinimalNode;
      if (!Array.isArray(root.content)) return '';

      let text = '';
      const extractText = (node: MinimalNode) => {
        if (node.type === 'text' && typeof node.text === 'string') {
          text += node.text;
        }
        if (node.content && Array.isArray(node.content)) {
          node.content.forEach((n) => extractText(n));
        }
      };

      extractText(root);
      return text.slice(0, 100);
    } catch {
      return '';
    }
  }
}
