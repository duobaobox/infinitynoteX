/**
 * 同步管理器
 * 管理 WebDAV 同步的配置和执行
 */

import { WebDAVSyncClient } from './webdavClient';
import { SyncEngine } from './syncEngine';
import { readAppConfig, writeAppConfig } from '../config';
import { app } from 'electron';
import type {
  WebDAVConfig,
  SyncConfig,
  SyncResult,
  SyncProgressCallback,
  SyncOptions,
} from './types';

export class SyncManager {
  private webdavClient: WebDAVSyncClient;
  private syncEngine: SyncEngine | null = null;
  private progressCallback: SyncProgressCallback | null = null;

  constructor() {
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
   * 获取 WebDAV 配置（从统一配置读取）
   */
  async getConfig(providerId: string): Promise<SyncConfig | undefined> {
    const appConfig = readAppConfig();
    if (providerId === 'webdav') {
      const webdav = appConfig.sync.providers.webdav;
      if (webdav) {
        return {
          url: webdav.url,
          username: webdav.username,
          password: webdav.password,
          remotePath: webdav.remotePath,
          enabled: appConfig.sync.enabled,
          conflictStrategy: webdav.conflictStrategy,
        };
      }
    }
    return undefined;
  }

  /**
   * 保存 WebDAV 配置（写入统一配置）
   */
  async setConfig(providerId: string, config: SyncConfig): Promise<void> {
    if (providerId === 'webdav') {
      writeAppConfig({
        sync: {
          // 保存启用状态到顶层 sync.enabled
          enabled: config.enabled ?? false,
          providers: {
            webdav: {
              url: config.url || '',
              username: config.username || '',
              password: config.password || '',
              remotePath: config.remotePath || '/InfinityNoteX',
              conflictStrategy: config.conflictStrategy || 'newest',
            },
          },
        },
      });
    }
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

    // 获取应用目录路径
    const appPath = app.getPath('userData');

    // 创建同步引擎
    this.syncEngine = new SyncEngine(this.webdavClient, storagePath, appPath);

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

    // 获取应用目录路径
    const appPath = app.getPath('userData');

    // 创建同步引擎
    this.syncEngine = new SyncEngine(this.webdavClient, storagePath, appPath);

    return await this.syncEngine.preview();
  }

  /**
   * 通用同步接口（保持向后兼容）
   */
  async execute(providerId: string, config: SyncConfig, storagePath: string): Promise<SyncResult> {
    switch (providerId) {
      case 'webdav':
        return await this.sync(config, storagePath, {
          conflictStrategy: config.conflictStrategy,
        });
      default:
        throw new Error(`Unknown provider: ${providerId}`);
    }
  }
}
