/**
 * 同步管理器
 * 管理所有同步provider的配置和执行
 */

import fs from 'fs/promises';
import path from 'path';
import { app } from 'electron';
import { WebDAVSyncClient, type WebDAVConfig } from './webdavClient';

interface SyncConfigs {
  webdav?: WebDAVConfig;
  // 其他provider配置预留
}

export class SyncManager {
  private configPath: string;
  private webdavClient: WebDAVSyncClient;

  constructor() {
    this.configPath = path.join(app.getPath('userData'), 'sync-configs.json');
    this.webdavClient = new WebDAVSyncClient();
  }

  /**
   * 读取配置文件
   */
  private async readConfigs(): Promise<SyncConfigs> {
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
  private async writeConfigs(configs: SyncConfigs): Promise<void> {
    await fs.writeFile(this.configPath, JSON.stringify(configs, null, 2), 'utf-8');
  }

  /**
   * 获取同步配置
   */
  async getConfig(providerId: string): Promise<any> {
    const configs = await this.readConfigs();
    return configs[providerId as keyof SyncConfigs];
  }

  /**
   * 保存同步配置
   */
  async setConfig(providerId: string, config: any): Promise<void> {
    const configs = await this.readConfigs();
    configs[providerId as keyof SyncConfigs] = config;
    await this.writeConfigs(configs);
  }

  /**
   * 测试WebDAV连接
   */
  async testWebDAVConnection(config: WebDAVConfig): Promise<{ ok: boolean; message: string }> {
    return await this.webdavClient.testConnection(config);
  }

  /**
   * 执行WebDAV同步
   */
  async syncWebDAV(config: WebDAVConfig, storagePath: string): Promise<any> {
    this.webdavClient.initialize(config);
    return await this.webdavClient.syncToRemote(storagePath);
  }

  /**
   * 通用同步接口
   */
  async sync(providerId: string, config: any, storagePath: string): Promise<any> {
    switch (providerId) {
      case 'webdav':
        return await this.syncWebDAV(config, storagePath);
      default:
        throw new Error(`Unknown provider: ${providerId}`);
    }
  }
}
