/**
 * 泛型存储基类
 *
 * 封装目录类型存储模块的通用 CRUD、索引管理、缓存管理
 * 子类只需实现特殊逻辑
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import type { StorageModuleConfig } from './moduleRegistry';
import { readJsonFile, writeJsonFile, writeJsonFileAtomic, fileExists } from '../utils';

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
  protected indexCache: TIndex[] | null = null;
  protected storagePath: string;
  protected tempDir: string;

  constructor(
    storagePath: string,
    tempDir: string,
    protected config: StorageModuleConfig,
  ) {
    this.storagePath = storagePath;
    this.tempDir = tempDir;
  }

  // ============ 路径管理 ============

  /**
   * 获取模块目录路径
   */
  protected get moduleDir(): string {
    return path.join(this.storagePath, this.config.path);
  }

  /**
   * 获取索引文件路径
   */
  protected get indexPath(): string {
    if (!this.config.indexFile) {
      throw new Error(`Module ${this.config.id} does not have index file`);
    }
    return path.join(this.storagePath, this.config.indexFile);
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
    if (!this.indexCache) {
      await this.loadCache();
    }
    return this.indexCache || [];
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

    // 读取文件（不进行 schema 校验，由子类自行处理）
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
    await this.addToIndex(data);

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
    await this.updateIndex(updated);

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
    await this.removeFromIndex(id);
  }

  // ============ 索引管理 ============

  /**
   * 加载缓存
   */
  async loadCache(): Promise<void> {
    if (!this.config.indexArraySchema) {
      this.indexCache = [];
      return;
    }
    // 读取索引（不进行 schema 校验）
    this.indexCache = await readJsonFile<TIndex[]>(this.indexPath, []);
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
    if (!this.config.indexFile) return;
    const exists = await fileExists(this.indexPath);
    if (!exists) {
      await writeJsonFile(this.indexPath, []);
    }
  }

  /**
   * 重建索引
   */
  async rebuildIndex(): Promise<{ rebuilt: number; errors: string[] }> {
    const errors: string[] = [];
    const newIndex: TIndex[] = [];

    try {
      const dirExists = await fileExists(this.moduleDir);
      if (!dirExists) {
        console.log(`[${this.config.id}] Directory does not exist, creating empty index`);
        await this.saveIndex([]);
        return { rebuilt: 0, errors: [] };
      }

      const files = await fs.readdir(this.moduleDir);
      const dataFiles = files.filter(
        (f) => f.endsWith(this.config.extension) && !f.includes('.index'),
      );

      console.log(`[${this.config.id}] Rebuilding index from ${dataFiles.length} files`);

      for (const fileName of dataFiles) {
        const id = fileName.replace(this.config.extension, '');
        try {
          const data = await this.get(id);
          newIndex.push(this.toIndex(data));
        } catch (error) {
          const errorMsg = `Failed to read ${fileName}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          console.error(`[${this.config.id}] ${errorMsg}`);
          errors.push(errorMsg);
        }
      }

      // 按 sortField 排序（升序：从旧到新）
      if (this.config.features.sortField) {
        const sortField = this.config.features.sortField as keyof TIndex;
        newIndex.sort((a, b) => {
          const aVal = a[sortField] as number;
          const bVal = b[sortField] as number;
          return aVal - bVal; // 升序（旧的在前，新的在后）
        });
      }

      await this.saveIndex(newIndex);
      console.log(`[${this.config.id}] Index rebuilt successfully: ${newIndex.length} items`);

      return { rebuilt: newIndex.length, errors };
    } catch (error) {
      const errorMsg = `Failed to rebuild index: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(`[${this.config.id}] ${errorMsg}`);
      errors.push(errorMsg);
      return { rebuilt: 0, errors };
    }
  }

  // ============ 保护方法（子类可重写） ============

  /**
   * 将完整数据转换为索引
   * 子类必须实现
   */
  protected abstract toIndex(data: TData): TIndex;

  /**
   * 创建默认数据
   * 子类必须实现
   */
  protected abstract createDefaultData(id: string, now: number, payload: Partial<TData>): TData;

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
   * 保存索引
   */
  protected async saveIndex(index: TIndex[]): Promise<void> {
    if (!this.config.indexFile) return;
    await writeJsonFile(this.indexPath, index);
    this.indexCache = index;
  }

  /**
   * 添加到索引
   */
  protected async addToIndex(data: TData): Promise<void> {
    const index = await this.list();
    index.push(this.toIndex(data)); // 添加到末尾（新的在后面）
    await this.saveIndex(index);
  }

  /**
   * 更新索引中的项
   */
  protected async updateIndex(data: TData): Promise<void> {
    const index = await this.list();
    const itemIndex = index.findIndex((item) => item.id === data.id);

    if (itemIndex >= 0) {
      index[itemIndex] = this.toIndex(data);
    } else {
      index.push(this.toIndex(data)); // 添加到末尾
    }

    // 重新排序（升序：从旧到新）
    if (this.config.features.sortField) {
      const sortField = this.config.features.sortField as keyof TIndex;
      index.sort((a, b) => {
        const aVal = a[sortField] as number;
        const bVal = b[sortField] as number;
        return aVal - bVal; // 升序
      });
    }

    await this.saveIndex(index);
  }

  /**
   * 从索引移除
   */
  protected async removeFromIndex(id: string): Promise<void> {
    const index = await this.list();
    const itemIndex = index.findIndex((item) => item.id === id);

    if (itemIndex >= 0) {
      index.splice(itemIndex, 1);
      await this.saveIndex(index);
    }
  }
}
