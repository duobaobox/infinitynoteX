/**
 * 存储上下文
 * 提供共享的路径管理和基础配置
 */

import { app } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';

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
   * 获取便签目录路径
   */
  get notesDir(): string {
    return path.join(this._currentPath, 'notes');
  }

  /**
   * 获取 AI 对话目录路径
   */
  get aiConversationsDir(): string {
    return path.join(this._currentPath, 'ai-conversations');
  }

  /**
   * 获取元数据文件路径
   */
  get metaPath(): string {
    return path.join(this._currentPath, 'meta.json');
  }

  /**
   * 获取文件夹索引文件路径
   */
  get foldersPath(): string {
    return path.join(this._currentPath, 'folders.json');
  }

  /**
   * 获取便签索引文件路径
   */
  get notesIndexPath(): string {
    return path.join(this._currentPath, 'notes.index.json');
  }

  /**
   * 获取 AI 对话索引文件路径
   */
  get aiConversationsIndexPath(): string {
    return path.join(this._currentPath, 'ai-conversations.index.json');
  }

  /**
   * 确保基础目录结构存在
   */
  async ensureBaseDirectories(): Promise<void> {
    await fs.mkdir(this._currentPath, { recursive: true });
    const subDirs = ['notes', 'temp', 'backups', 'ai-conversations'];
    for (const dir of subDirs) {
      await fs.mkdir(path.join(this._currentPath, dir), { recursive: true });
    }
  }

  /**
   * 获取便签文件路径
   */
  getNotePath(noteId: string): string {
    return path.join(this.notesDir, `${noteId}.json`);
  }

  /**
   * 获取 AI 对话文件路径
   */
  getAIConversationPath(conversationId: string): string {
    return path.join(this.aiConversationsDir, `${conversationId}.json`);
  }
}
