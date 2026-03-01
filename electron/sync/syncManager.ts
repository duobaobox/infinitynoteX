/**
 * 同步管理器
 * 管理 WebDAV 同步的配置和执行
 */

import { WebDAVSyncClient } from './webdavClient';
import { SyncEngine } from './syncEngine';
import { readAppConfig, writeAppConfig } from '../config';
import { app } from 'electron';
import type { WebDAVConfig, SyncConfig, SyncResult, SyncOptions } from './types';

export class SyncManager {
  /** 全局互斥：防止并发同步互相污染共享状态 */
  private isSyncing = false;

  isSyncInProgress(): boolean {
    return this.isSyncing;
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
    const webdavClient = new WebDAVSyncClient();
    return await webdavClient.testConnection(config);
  }

  /**
   * 执行同步
   */
  async sync(
    config: WebDAVConfig,
    storagePath: string,
    options?: SyncOptions,
  ): Promise<SyncResult> {
    // 全局互斥：主进程级防并发
    if (this.isSyncing) {
      throw new Error('同步已在进行中，请等待当前同步完成后再试');
    }
    this.isSyncing = true;
    try {
      console.log('[SyncManager] Starting sync...');

      // 初始化 WebDAV 客户端
      const webdavClient = new WebDAVSyncClient();
      webdavClient.initialize(config);

      // 获取应用目录路径
      const appPath = app.getPath('userData');

      // 创建同步引擎
      const syncEngine = new SyncEngine(webdavClient, storagePath, appPath);

      // 执行同步
      const result = await syncEngine.sync({
        conflictStrategy: options?.conflictStrategy || 'newest',
        onProgress: options?.onProgress,
        dryRun: options?.dryRun,
      });

      console.log('[SyncManager] Sync completed:', result);
      return result;
    } finally {
      this.isSyncing = false;
    }
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
    // 同步进行中不允许预览，避免共享资源被并发改写
    if (this.isSyncing) {
      throw new Error('同步进行中，暂时无法预览，请稍后再试');
    }

    // 初始化 WebDAV 客户端
    const webdavClient = new WebDAVSyncClient();
    webdavClient.initialize(config);

    // 获取应用目录路径
    const appPath = app.getPath('userData');

    // 创建同步引擎
    const syncEngine = new SyncEngine(webdavClient, storagePath, appPath);

    return await syncEngine.preview();
  }

  /**
   * 通用同步接口（保持向后兼容）
   */
  async execute(
    providerId: string,
    config: SyncConfig,
    storagePath: string,
    options?: Pick<SyncOptions, 'onProgress'>,
  ): Promise<SyncResult> {
    switch (providerId) {
      case 'webdav':
        return await this.sync(config, storagePath, {
          conflictStrategy: config.conflictStrategy,
          onProgress: options?.onProgress,
        });
      default:
        throw new Error(`Unknown provider: ${providerId}`);
    }
  }
}
