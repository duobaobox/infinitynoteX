/**
 * 手动任务存储模块
 * 继承 BaseDirectoryStorage，管理 Todo 手动任务数据
 */

import type { StorageContext } from './StorageContext';
import type { ManualTask, ManualTaskIndex } from './schemas';
import { BaseDirectoryStorage } from './core/BaseStorage';
import { getModuleConfig } from './core/moduleRegistry';

// 获取 manual-tasks 模块配置
const manualTasksConfig = getModuleConfig('manual-tasks')!;

export class ManualTaskStorage extends BaseDirectoryStorage<ManualTask, ManualTaskIndex> {
  constructor(context: StorageContext) {
    super(context.dataDir, context.tempDir, manualTasksConfig);
  }

  // ============ 手动任务特有方法 ============

  /**
   * 按清单 ID 过滤任务
   */
  async listByListId(listId: string): Promise<ManualTaskIndex[]> {
    const allTasks = await this.list();
    return allTasks.filter((task) => task.listId === listId).sort((a, b) => a.order - b.order);
  }

  /**
   * 获取清单的所有任务（完整内容）
   */
  async getAllByListId(listId: string): Promise<ManualTask[]> {
    const index = await this.listByListId(listId);
    const tasks = await Promise.all(
      index.map(async (item) => {
        try {
          return await this.get(item.id);
        } catch (error) {
          console.error(`[ManualTaskStorage] Failed to read task ${item.id}:`, error);
          return null;
        }
      }),
    );

    return tasks.filter((item): item is ManualTask => item !== null);
  }

  /**
   * 删除清单的所有任务
   */
  async deleteByListId(listId: string): Promise<void> {
    const tasks = await this.listByListId(listId);
    for (const task of tasks) {
      await this.delete(task.id);
    }
  }

  /**
   * 切换任务完成状态
   */
  async toggleChecked(taskId: string): Promise<void> {
    const task = await this.get(taskId);
    await this.update(taskId, { checked: !task.checked });
  }

  /**
   * 获取清单的下一个可用 order 值
   */
  async getNextOrder(listId: string): Promise<number> {
    const tasks = await this.getAllByListId(listId);
    if (tasks.length === 0) return 0;
    return Math.max(...tasks.map((t) => t.order)) + 1;
  }

  // ============ 实现抽象方法 ============

  /**
   * 将 ManualTask 转换为 ManualTaskIndex
   */
  protected toIndex(task: ManualTask): ManualTaskIndex {
    return {
      id: task.id,
      listId: task.listId,
      text: task.text,
      checked: task.checked,
      order: task.order,
      updatedAt: task.updatedAt,
    };
  }

  /**
   * 创建默认数据
   */
  protected createDefaultData(id: string, now: number, payload: Partial<ManualTask>): ManualTask {
    if (!payload.listId) {
      throw new Error('listId is required for creating ManualTask');
    }

    return {
      id,
      listId: payload.listId,
      text: payload.text || '',
      checked: payload.checked ?? false,
      order: payload.order ?? 0,
      createdAt: now,
      updatedAt: now,
    };
  }
}
