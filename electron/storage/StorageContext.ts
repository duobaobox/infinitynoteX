/**
 * 存储上下文
 * 提供共享的路径管理和基础配置
 */

import { app } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { getAllDirectories, getModuleConfig } from './core/moduleRegistry';

export interface StorageContextConfig {
  defaultPath?: string;
}

/**
 * 存储上下文类
 * 管理存储路径和目录结构
 */
export class StorageContext {
  private _currentPath: string;
  private _defaultPath: string;

  constructor(config?: StorageContextConfig) {
    this._defaultPath = config?.defaultPath || path.join(app.getPath('userData'), 'data-v1');
    this._currentPath = this._defaultPath;
  }

  /**
   * 获取默认路径
   */
  get defaultPath(): string {
    return this._defaultPath;
  }

  /**
   * 获取当前路径
   */
  get currentPath(): string {
    return this._currentPath;
  }

  /**
   * 设置当前路径
   */
  setCurrentPath(newPath: string): void {
    this._currentPath = newPath;
  }

  /**
   * 获取临时目录路径
   */
  get tempDir(): string {
    return path.join(this._currentPath, 'temp');
  }

  /**
   * 获取备份目录路径
   */
  get backupsDir(): string {
    return path.join(this._currentPath, 'backups');
  }

  /**
   * 获取元数据文件路径
   */
  get metaPath(): string {
    return path.join(this._currentPath, 'meta.json');
  }

  /**
   * 获取文件夹配置文件路径
   */
  get foldersPath(): string {
    return path.join(this._currentPath, 'folders.json');
  }

  // ============ 动态路径获取 ============

  /**
   * 获取模块目录路径
   */
  getModuleDir(moduleId: string): string {
    const config = getModuleConfig(moduleId);
    if (!config || config.sync.type !== 'directory') {
      throw new Error(`Module ${moduleId} is not a directory module`);
    }
    return path.join(this._currentPath, config.path);
  }

  /**
   * 获取模块索引文件路径
   */
  getModuleIndexPath(moduleId: string): string {
    const config = getModuleConfig(moduleId);
    if (!config?.indexFile) {
      throw new Error(`Module ${moduleId} does not have index file`);
    }
    return path.join(this._currentPath, config.indexFile);
  }

  /**
   * 获取模块内单个文件的路径
   */
  getModuleFilePath(moduleId: string, fileId: string): string {
    const config = getModuleConfig(moduleId);
    if (!config || config.sync.type !== 'directory') {
      throw new Error(`Module ${moduleId} is not a directory module`);
    }
    return path.join(this._currentPath, config.path, `${fileId}${config.extension}`);
  }

  // ============ 向后兼容的快捷属性 ============

  get notesDir(): string {
    return this.getModuleDir('notes');
  }

  get aiConversationsDir(): string {
    return this.getModuleDir('ai-conversations');
  }

  get trashDir(): string {
    return this.getModuleDir('trash');
  }

  get notesIndexPath(): string {
    return this.getModuleIndexPath('notes');
  }

  get aiConversationsIndexPath(): string {
    return this.getModuleIndexPath('ai-conversations');
  }

  getNotePath(noteId: string): string {
    return this.getModuleFilePath('notes', noteId);
  }

  getAIConversationPath(conversationId: string): string {
    return this.getModuleFilePath('ai-conversations', conversationId);
  }

  // ============ 目录管理 ============

  /**
   * 确保所有目录结构存在
   * 自动根据注册表创建所需目录
   */
  async ensureBaseDirectories(): Promise<void> {
    await fs.mkdir(this._currentPath, { recursive: true });

    // 从注册表获取所有目录并创建
    const directories = getAllDirectories();
    for (const dir of directories) {
      await fs.mkdir(path.join(this._currentPath, dir), { recursive: true });
    }
  }
}
