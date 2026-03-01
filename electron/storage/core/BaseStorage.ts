/**
 * 泛型存储基类
 *
 * 封装目录类型存储模块的通用 CRUD、索引管理、缓存管理
 * 使用 SQLite IndexCache 替代 .index.json 文件
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import type { StorageModuleConfig } from './moduleRegistry';
import type { IndexCache, IndexItem } from './IndexCache';
import { readJsonFile, writeJsonFileAtomic, fileExists } from '../utils';

/**
 * 基础数据接口（所有数据必须有 id）
 */
export interface BaseData {
  id: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * 基础索引接口
 */
export interface BaseIndex {
  id: string;
  updatedAt: number;
}

/**
 * 目录类型存储基类
 *
 * @template TData 完整数据类型
 * @template TIndex 索引类型
 */
export abstract class BaseDirectoryStorage<TData extends BaseData, TIndex extends BaseIndex> {
  protected storagePath: string;
  protected tempDir: string;
  protected indexCache: IndexCache;

  constructor(
    storagePath: string,
    tempDir: string,
    protected config: StorageModuleConfig,
    indexCache: IndexCache,
  ) {
    this.storagePath = storagePath;
    this.tempDir = tempDir;
    this.indexCache = indexCache;
  }

  // ============ 路径管理 ============

  /**
   * 获取模块目录路径
   */
  protected get moduleDir(): string {
    return path.join(this.storagePath, this.config.path);
  }

  /**
   * 获取单个数据文件路径
   */
  protected getFilePath(id: string): string {
    return path.join(this.moduleDir, `${id}${this.config.extension}`);
  }

  // ============ 列表操作 ============

  /**
   * 获取索引列表
   */
  async list(): Promise<TIndex[]> {
    const items = this.indexCache.listItems(this.config.id, {
      sortBy: this.config.features.sortField === 'createdAt' ? 'created_at' : 'updated_at',
      sortOrder: 'asc',
    });

    return items.map((item) => this.indexItemToTIndex(item));
  }

  // ============ CRUD 操作 ============

  /**
   * 获取单个数据
   */
  async get(id: string): Promise<TData> {
    const filePath = this.getFilePath(id);
    const exists = await fileExists(filePath);

    if (!exists) {
      throw new Error(`${this.config.name} not found: ${id}`);
    }

    return await readJsonFile<TData>(filePath);
  }

  /**
   * 创建数据
   */
  async create(payload: Partial<TData>): Promise<TData> {
    const now = Date.now();
    const id = uuidv4();

    const data = this.createDefaultData(id, now, payload);

    // 保存文件
    await this.writeFile(data);

    // 更新索引
    this.addToIndex(data);

    return data;
  }

  /**
   * 更新数据
   */
  async update(id: string, patch: Partial<TData>): Promise<TData> {
    const existing = await this.get(id);
    const updated: TData = {
      ...existing,
      ...patch,
      id, // 确保 id 不被覆盖
      updatedAt: Date.now(),
    };

    // 保存文件
    await this.writeFile(updated);

    // 更新索引
    this.updateIndexItem(updated);

    return updated;
  }

  /**
   * 删除数据
   */
  async delete(id: string): Promise<void> {
    const filePath = this.getFilePath(id);
    const exists = await fileExists(filePath);

    if (!exists) {
      throw new Error(`${this.config.name} not found: ${id}`);
    }

    // 删除文件
    await fs.unlink(filePath);

    // 从索引移除
    this.removeFromIndex(id);
  }

  // ============ 索引管理 ============

  /**
   * 加载缓存（从文件重建索引到 SQLite）
   * 应用启动时调用
   */
  async loadCache(): Promise<void> {
    // SQLite IndexCache 不需要单独加载缓存
    // 索引已经在 SQLite 中持久化
  }

  /**
   * 清空缓存
   */
  clearCache(): void {
    // SQLite 缓存不需要清空内存
  }

  /**
   * 获取缓存数量
   */
  getCacheCount(): number {
    return this.indexCache.countItems(this.config.id);
  }
  /**
   * 重建索引
   * 扫描目录文件，同步到 SQLite
   */
  async rebuildIndex(): Promise<{ rebuilt: number; errors: string[] }> {
    const errors: string[] = [];

    try {
      const dirExists = await fileExists(this.moduleDir);
      if (!dirExists) {
        console.log(`[${this.config.id}] Directory does not exist, clearing index`);
        this.indexCache.clearModule(this.config.id);
        return { rebuilt: 0, errors: [] };
      }

      const result = await this.indexCache.rebuildFromFiles(
        this.config.id,
        this.moduleDir,
        async (filePath: string) => {
          try {
            const fileName = path.basename(filePath);
            const id = fileName.replace(this.config.extension, '');
            const data = await this.get(id);
            return this.toIndexItem(data);
          } catch (err) {
            errors.push(`Failed to parse ${filePath}: ${err}`);
            return null;
          }
        },
      );

      console.log(`[${this.config.id}] Index rebuilt: ${result.rebuilt} items`);
      return { rebuilt: result.rebuilt, errors: [...errors, ...result.errors] };
    } catch (error) {
      const errorMsg = `Failed to rebuild index: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(`[${this.config.id}] ${errorMsg}`);
      errors.push(errorMsg);
      return { rebuilt: 0, errors };
    }
  }

  // ============ 抽象方法（子类必须实现） ============

  /**
   * 将完整数据转换为索引
   */
  protected abstract toIndex(data: TData): TIndex;

  /**
   * 创建默认数据
   */
  protected abstract createDefaultData(id: string, now: number, payload: Partial<TData>): TData;

  // ============ 索引转换方法 ============

  /**
   * 将 TData 转换为 IndexItem（用于存储到 SQLite）
   */
  protected toIndexItem(data: TData): IndexItem {
    const tIndex = this.toIndex(data);
    return {
      id: data.id,
      module: this.config.id,
      title: (tIndex as unknown as { title?: string }).title || '',
      excerpt: (tIndex as unknown as { excerpt?: string }).excerpt || '',
      metadata: tIndex as unknown as Record<string, unknown>,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  }

  /**
   * 将 IndexItem 转换为 TIndex
   */
  protected indexItemToTIndex(item: IndexItem): TIndex {
    // metadata 中存储了完整的 TIndex 数据
    return {
      id: item.id,
      ...item.metadata,
      updatedAt: item.updatedAt,
    } as TIndex;
  }

  // ============ 生成摘要 ============

  /**
   * 生成摘要（如果启用）
   */
  protected generateExcerpt(content: unknown): string {
    if (!this.config.features.generateExcerpt) return '';

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

  // ============ 私有方法 ============

  /**
   * 写入数据文件
   */
  protected async writeFile(data: TData): Promise<void> {
    const filePath = this.getFilePath(data.id);
    await writeJsonFileAtomic(filePath, data, this.tempDir);
  }

  /**
   * 添加到索引
   */
  protected addToIndex(data: TData): void {
    this.indexCache.upsertItem(this.toIndexItem(data));
  }

  /**
   * 更新索引中的项
   */
  protected updateIndexItem(data: TData): void {
    this.indexCache.upsertItem(this.toIndexItem(data));
  }

  /**
   * 从索引移除
   */
  protected removeFromIndex(id: string): void {
    this.indexCache.deleteItem(this.config.id, id);
  }
}
