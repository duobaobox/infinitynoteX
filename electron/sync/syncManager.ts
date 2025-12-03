/**
 * 同步管理器
 * 管理 WebDAV 同步的配置和执行
 */

import fs from 'fs/promises';
import path from 'path';
import { app } from 'electron';
import { WebDAVSyncClient } from './webdavClient';
import { SyncEngine } from './syncEngine';
import type {
  WebDAVConfig,
  SyncConfig,
  SyncResult,
  SyncProgressCallback,
  SyncOptions,
} from './types';

interface StoredSyncConfig {
  webdav?: SyncConfig;
}

export class SyncManager {
  private configPath: string;
  private webdavClient: WebDAVSyncClient;
  private syncEngine: SyncEngine | null = null;
  private progressCallback: SyncProgressCallback | null = null;

  constructor() {
    this.configPath = path.join(app.getPath('userData'), 'sync-config.json');
    this.webdavClient = new WebDAVSyncClient();
  }

  /**
   * 设置进度回调
   */
  setProgressCallback(callback: SyncProgressCallback | null): void {
    this.progressCallback = callback;
    if (this.syncEngine) {
      this.syncEngine.setProgressCallback(callback || (() => {}));
    }
  }

  /**
   * 读取配置文件
   */
  private async readConfigs(): Promise<StoredSyncConfig> {
    try {
      const data = await fs.readFile(this.configPath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return {};
    }
  }

  /**
   * 写入配置文件
   */
  private async writeConfigs(configs: StoredSyncConfig): Promise<void> {
    await fs.writeFile(this.configPath, JSON.stringify(configs, null, 2), 'utf-8');
  }

  /**
   * 获取 WebDAV 配置
   */
  async getConfig(providerId: string): Promise<SyncConfig | undefined> {
    const configs = await this.readConfigs();
    return configs[providerId as keyof StoredSyncConfig] as SyncConfig | undefined;
  }

  /**
   * 保存 WebDAV 配置
   */
  async setConfig(providerId: string, config: SyncConfig): Promise<void> {
    const configs = await this.readConfigs();
    configs[providerId as keyof StoredSyncConfig] = config;
    await this.writeConfigs(configs);
  }

  /**
   * 测试 WebDAV 连接
   */
  async testWebDAVConnection(config: WebDAVConfig): Promise<{ ok: boolean; message: string }> {
    return await this.webdavClient.testConnection(config);
  }

  /**
   * 执行同步
   */
  async sync(
    config: WebDAVConfig,
    storagePath: string,
    options?: SyncOptions,
  ): Promise<SyncResult> {
    console.log('[SyncManager] Starting sync...');

    // 初始化 WebDAV 客户端
    this.webdavClient.initialize(config);

    // 创建同步引擎
    this.syncEngine = new SyncEngine(this.webdavClient, storagePath);

    // 设置进度回调
    if (this.progressCallback) {
      this.syncEngine.setProgressCallback(this.progressCallback);
    }

    // 执行同步
    const result = await this.syncEngine.sync({
      conflictStrategy: options?.conflictStrategy || 'newest',
      onProgress: options?.onProgress || this.progressCallback || undefined,
      dryRun: options?.dryRun,
    });

    console.log('[SyncManager] Sync completed:', result);
    return result;
  }

  /**
   * 获取同步预览
   */
  async preview(
    config: WebDAVConfig,
    storagePath: string,
  ): Promise<{
    toUpload: string[];
    toDownload: string[];
    toDeleteRemote: string[];
    toDeleteLocal: string[];
    conflicts: string[];
    unchanged: number;
  }> {
    // 初始化 WebDAV 客户端
    this.webdavClient.initialize(config);

    // 创建同步引擎
    this.syncEngine = new SyncEngine(this.webdavClient, storagePath);

    return await this.syncEngine.preview();
  }

  /**
   * 通用同步接口（保持向后兼容）
   */
  async execute(
    providerId: string,
    config: WebDAVConfig,
    storagePath: string,
  ): Promise<SyncResult> {
    switch (providerId) {
      case 'webdav':
        return await this.sync(config, storagePath);
      default:
        throw new Error(`Unknown provider: ${providerId}`);
    }
  }
}
