/**
 * Todo 清单存储模块
 * 继承 BaseDirectoryStorage，管理 Todo 清单数据
 */

import type { StorageContext } from './StorageContext';
import type { TodoList, TodoListIndex } from './schemas';
import type { IndexCache } from './core/IndexCache';
import { BaseDirectoryStorage } from './core/BaseStorage';
import { getModuleConfig } from './core/moduleRegistry';
import { DEFAULT_MANUAL_TODO_LIST_ID } from '../../src/shared/constants/todoConstants';

// 获取 todo-lists 模块配置
const todoListsConfig = getModuleConfig('todo-lists')!;

export class TodoListStorage extends BaseDirectoryStorage<TodoList, TodoListIndex> {
  constructor(context: StorageContext, indexCache: IndexCache) {
    super(context.dataDir, context.tempDir, todoListsConfig, indexCache);
  }

  // ============ Todo 清单特有方法 ============

  /**
   * 获取所有清单（按 order 排序）
   */
  async getAll(): Promise<TodoList[]> {
    const index = await this.list();
    const lists = await Promise.all(
      index.map(async (item) => {
        try {
          return await this.get(item.id);
        } catch (error) {
          console.error(`[TodoListStorage] Failed to read list ${item.id}:`, error);
          return null;
        }
      }),
    );

    return lists
      .filter((item): item is TodoList => item !== null)
      .sort((a, b) => a.order - b.order);
  }

  /**
   * 初始化默认清单（默认任务清单）
   */
  async initializeDefault(): Promise<void> {
    try {
      // 尝试获取默认清单
      await this.get(DEFAULT_MANUAL_TODO_LIST_ID);
      // 已存在，不再创建
      return;
    } catch {
      // 不存在，创建默认清单
      await this.createDefault();
      console.log('[TodoListStorage] Initialized default manual todo list');
    }
  }

  /**
   * 创建默认清单
   */
  async createDefault(): Promise<TodoList> {
    const now = Date.now();
    const defaultList: TodoList = {
      id: DEFAULT_MANUAL_TODO_LIST_ID,
      name: '默认任务清单',
      isDefault: true,
      createdAt: now,
      updatedAt: now,
      order: 0,
    };

    // 直接写入文件和索引
    await this.writeFile(defaultList);
    this.addToIndex(this.toIndex(defaultList));

    return defaultList;
  }

  /**
   * 防止删除默认清单
   */
  async delete(id: string): Promise<void> {
    if (id === DEFAULT_MANUAL_TODO_LIST_ID) {
      throw new Error('Cannot delete default manual todo list');
    }
    await super.delete(id);
  }

  /**
   * 获取下一个可用的 order 值
   */
  async getNextOrder(): Promise<number> {
    const lists = await this.getAll();
    if (lists.length === 0) return 0;
    return Math.max(...lists.map((l) => l.order)) + 1;
  }

  // ============ 实现抽象方法 ============

  /**
   * 将 TodoList 转换为 TodoListIndex
   */
  protected toIndex(list: TodoList): TodoListIndex {
    return {
      id: list.id,
      name: list.name,
      isDefault: list.isDefault,
      order: list.order,
      updatedAt: list.updatedAt,
    };
  }

  /**
   * 创建默认数据
   */
  protected createDefaultData(id: string, now: number, payload: Partial<TodoList>): TodoList {
    return {
      id,
      name: payload.name || '新清单',
      color: payload.color,
      isDefault: payload.isDefault ?? false,
      order: payload.order ?? 0,
      createdAt: now,
      updatedAt: now,
    };
  }
}
