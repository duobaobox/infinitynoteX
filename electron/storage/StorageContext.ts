/**
 * 存储上下文
 * 提供共享的路径管理和基础配置
 *
 * 架构说明：
 * - appDir: 应用目录，固定位置，存储系统数据（缓存、临时文件、备份）
 * - dataDir: 数据目录，用户可自定义，存储用户数据
 */

import { app } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { getAllDirectories, getModuleConfig } from './core/moduleRegistry';

export interface StorageContextConfig {
  dataPath?: string;
}

/**
 * 存储上下文类
 * 管理存储路径和目录结构
 */
export class StorageContext {
  /** 数据目录版本 */
  static readonly DATA_VERSION = 'data-v2';

  /** 应用目录（固定，不可更改） */
  private readonly _appDir: string;

  /** 数据目录（可自定义） */
  private _dataDir: string;

  /** 默认数据目录 */
  private readonly _defaultDataDir: string;

  constructor(config?: StorageContextConfig) {
    this._appDir = app.getPath('userData');
    this._defaultDataDir = path.join(this._appDir, StorageContext.DATA_VERSION);
    this._dataDir = config?.dataPath || this._defaultDataDir;
  }

  // ============ 应用目录路径（固定位置） ============

  /**
   * 获取应用目录
   * 存储系统数据，不随用户数据迁移
   */
  get appDir(): string {
    return this._appDir;
  }

  /**
   * 获取临时目录路径（在应用目录）
   */
  get tempDir(): string {
    return path.join(this._appDir, 'temp');
  }

  /**
   * 获取备份目录路径（在应用目录）
   */
  get backupsDir(): string {
    return path.join(this._appDir, 'backups');
  }

  /**
   * 获取日志目录路径（在应用目录）
   */
  get logsDir(): string {
    return path.join(this._appDir, 'logs');
  }

  /**
   * 获取 SQLite 缓存路径（在应用目录）
   */
  get cachePath(): string {
    return path.join(this._appDir, 'cache.sqlite');
  }

  /**
   * 获取设备标识文件路径（在应用目录）
   */
  get devicePath(): string {
    return path.join(this._appDir, 'device.json');
  }

  // ============ 数据目录路径（可自定义） ============

  /**
   * 获取默认数据目录
   */
  get defaultDataDir(): string {
    return this._defaultDataDir;
  }

  /**
   * 获取当前数据目录
   */
  get dataDir(): string {
    return this._dataDir;
  }

  /**
   * 设置数据目录
   */
  setDataDir(newPath: string): void {
    this._dataDir = newPath;
  }

  /**
   * 获取元数据文件路径（在数据目录）
   */
  get metaPath(): string {
    return path.join(this._dataDir, 'meta.json');
  }

  /**
   * 获取文件夹配置文件路径（在数据目录）
   */
  get foldersPath(): string {
    return path.join(this._dataDir, 'folders.json');
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
    return path.join(this._dataDir, config.path);
  }

  /**
   * 获取模块内单个文件的路径
   */
  getModuleFilePath(moduleId: string, fileId: string): string {
    const config = getModuleConfig(moduleId);
    if (!config || config.sync.type !== 'directory') {
      throw new Error(`Module ${moduleId} is not a directory module`);
    }
    return path.join(this._dataDir, config.path, `${fileId}${config.extension}`);
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

  getNotePath(noteId: string): string {
    return this.getModuleFilePath('notes', noteId);
  }

  getAIConversationPath(conversationId: string): string {
    return this.getModuleFilePath('ai-conversations', conversationId);
  }

  // ============ 目录管理 ============

  /**
   * 确保应用目录结构存在
   */
  async ensureAppDirectories(): Promise<void> {
    await fs.mkdir(this.tempDir, { recursive: true });
    await fs.mkdir(this.backupsDir, { recursive: true });
    await fs.mkdir(this.logsDir, { recursive: true });
  }

  /**
   * 确保数据目录结构存在
   * 自动根据注册表创建所需目录
   */
  async ensureDataDirectories(): Promise<void> {
    await fs.mkdir(this._dataDir, { recursive: true });

    // 从注册表获取所有目录并创建
    const directories = getAllDirectories();
    for (const dir of directories) {
      await fs.mkdir(path.join(this._dataDir, dir), { recursive: true });
    }
  }

  /**
   * 确保所有目录结构存在
   */
  async ensureBaseDirectories(): Promise<void> {
    await this.ensureAppDirectories();
    await this.ensureDataDirectories();
  }
}
