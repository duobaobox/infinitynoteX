/**
 * 回收站存储模块
 * 负责回收站（已删除便签）的管理
 * 使用 SQLite IndexCache 替代 .index.json
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import type { StorageContext } from './StorageContext';
import type { Note, TrashItem, TrashIndex } from './types';
import type { IndexCache, IndexItem } from './core/IndexCache';
import { StorageError, StorageErrorCode } from './errors';
import { generateId, readJsonFile, writeJsonFileAtomic, fileExists } from './utils';
import { TrashItemSchema } from './schemas';

// 回收站保留天数（30天后自动清理）
const TRASH_RETENTION_DAYS = 30;
const MODULE_ID = 'trash';

export class TrashStorage {
  private context: StorageContext;
  private sqliteCache: IndexCache | null = null;

  constructor(context: StorageContext) {
    this.context = context;
  }

  /**
   * 设置 IndexCache
   */
  setIndexCache(cache: IndexCache): void {
    this.sqliteCache = cache;
  }

  /**
   * 获取回收站索引列表
   */
  async list(): Promise<TrashIndex[]> {
    if (!this.sqliteCache) {
      throw new Error('IndexCache not initialized');
    }

    const items = this.sqliteCache.listItems(MODULE_ID, {
      sortBy: 'updated_at',
      sortOrder: 'desc',
    });

    return items.map((item) => this.indexItemToTrashIndex(item));
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
    this.addToIndex(trashItem);

    return trashItem;
  }

  /**
   * 从回收站恢复便签
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
      updatedAt: Date.now(),
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
    this.removeFromIndex(trashItemId);
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
    if (this.sqliteCache) {
      this.sqliteCache.clearModule(MODULE_ID);
    }

    return deletedCount;
  }

  /**
   * 清理过期的回收站项目
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
   * 加载缓存（兼容旧接口）
   */
  async loadCache(): Promise<void> {
    // SQLite 缓存不需要加载
  }

  /**
   * 清空缓存（兼容旧接口）
   */
  clearCache(): void {
    // SQLite 缓存不需要清空内存
  }

  /**
   * 获取缓存数量
   */
  getCacheCount(): number {
    if (!this.sqliteCache) return 0;
    return this.sqliteCache.countItems(MODULE_ID);
  }
  /**
   * 重建索引
   */
  async rebuildIndex(): Promise<{ rebuilt: number; errors: string[] }> {
    if (!this.sqliteCache) {
      return { rebuilt: 0, errors: ['IndexCache not initialized'] };
    }

    const errors: string[] = [];

    try {
      const trashDir = this.context.trashDir;
      const dirExists = await fileExists(trashDir);
      if (!dirExists) {
        console.log('[TrashStorage] Trash directory does not exist, clearing index');
        this.sqliteCache.clearModule(MODULE_ID);
        return { rebuilt: 0, errors: [] };
      }

      const result = await this.sqliteCache.rebuildFromFiles(
        MODULE_ID,
        trashDir,
        async (filePath: string) => {
          try {
            const fileName = path.basename(filePath);
            const id = fileName.replace('.json', '');
            const trashItem = await this.readFile(id);
            return this.toIndexItem(trashItem);
          } catch (err) {
            errors.push(`Failed to parse ${filePath}: ${err}`);
            return null;
          }
        },
      );

      console.log(`[TrashStorage] Index rebuilt: ${result.rebuilt} items`);
      return { rebuilt: result.rebuilt, errors: [...errors, ...result.errors] };
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

  private toIndexItem(trashItem: TrashItem): IndexItem {
    const index = this.toIndex(trashItem);
    return {
      id: trashItem.id,
      module: MODULE_ID,
      title: trashItem.title,
      excerpt: index.excerpt,
      metadata: index as unknown as Record<string, unknown>,
      createdAt: trashItem.createdAt,
      updatedAt: trashItem.deletedAt, // 使用删除时间作为更新时间
    };
  }

  private indexItemToTrashIndex(item: IndexItem): TrashIndex {
    return {
      id: item.id,
      ...item.metadata,
    } as TrashIndex;
  }

  private addToIndex(trashItem: TrashItem): void {
    if (!this.sqliteCache) return;
    this.sqliteCache.upsertItem(this.toIndexItem(trashItem));
  }

  private removeFromIndex(id: string): void {
    if (!this.sqliteCache) return;
    this.sqliteCache.deleteItem(MODULE_ID, id);
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
