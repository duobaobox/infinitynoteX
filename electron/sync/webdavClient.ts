/**
 * WebDAV 客户端
 * 提供 WebDAV 服务器的文件操作封装
 */

import { createClient, type WebDAVClient, type FileStat } from 'webdav';
import type { WebDAVConfig, RemoteSyncManifest } from './types';
import { SYNC_META_DIR, MANIFEST_FILE, toRemotePath } from './syncUtils';

export class WebDAVSyncClient {
  private client: WebDAVClient | null = null;
  private config: WebDAVConfig | null = null;

  /**
   * 初始化客户端
   */
  initialize(config: WebDAVConfig): void {
    this.config = config;
    this.client = createClient(config.url, {
      username: config.username,
      password: config.password,
    });
  }

  /**
   * 获取配置
   */
  getConfig(): WebDAVConfig | null {
    return this.config;
  }

  /**
   * 检查客户端是否已初始化
   */
  private ensureClient(): WebDAVClient {
    if (!this.client) {
      throw new Error('WebDAV client not initialized');
    }
    return this.client;
  }

  /**
   * 测试 WebDAV 连接
   */
  /**
   * 测试 WebDAV 连接
   */
  async testConnection(config: WebDAVConfig): Promise<{ ok: boolean; message: string }> {
    try {
      console.log('[WebDAV] testConnection called');
      console.log('[WebDAV] Config type:', typeof config);
      console.log('[WebDAV] Config keys:', config ? Object.keys(config) : 'null');
      console.log('[WebDAV] Config values:', { ...config, password: '***' });

      if (!config) {
        return { ok: false, message: '配置对象为空' };
      }

      if (!config.url) {
        return { ok: false, message: '服务器地址不能为空' };
      }

      if (typeof config.url !== 'string') {
        return { ok: false, message: `服务器地址类型错误: ${typeof config.url}` };
      }

      const remotePath = config.remotePath || '/InfinityNoteX';
      console.log('[WebDAV] remotePath:', remotePath);

      const clientOptions = {
        username: config.username || '',
        password: config.password || '',
      };
      console.log('[WebDAV] Creating client with options:', { ...clientOptions, password: '***' });

      const client = createClient(config.url, clientOptions);
      console.log('[WebDAV] Client created');

      // 尝试访问远程路径
      console.log('[WebDAV] Checking existence of:', remotePath);
      const exists = await client.exists(remotePath);
      console.log('[WebDAV] Exists result:', exists);

      if (!exists) {
        // 如果路径不存在，尝试创建
        try {
          console.log('[WebDAV] Creating directory:', remotePath);
          await client.createDirectory(remotePath, { recursive: true });
          return { ok: true, message: 'WebDAV 连接成功，已创建远程目录' };
        } catch (createError) {
          console.error('[WebDAV] Create directory failed:', createError);
          return {
            ok: false,
            message: `远程路径不存在且无法创建: ${createError instanceof Error ? createError.message : '未知错误'}`,
          };
        }
      }

      return { ok: true, message: 'WebDAV 连接成功' };
    } catch (error) {
      console.error('[WebDAV] Connection test failed:', error);
      // 打印完整的错误堆栈
      if (error instanceof Error) {
        console.error('[WebDAV] Stack:', error.stack);
      }
      return {
        ok: false,
        message: `连接失败: ${error instanceof Error ? error.message : '未知错误'}`,
      };
    }
  }

  /**
   * 确保远程目录结构存在
   */
  async ensureRemoteDirectories(): Promise<void> {
    const client = this.ensureClient();
    const config = this.config!;

    // 确保根目录存在
    if (!(await client.exists(config.remotePath))) {
      await client.createDirectory(config.remotePath, { recursive: true });
    }

    // 确保 .sync 目录存在
    const syncDir = `${config.remotePath}/${SYNC_META_DIR}`;
    if (!(await client.exists(syncDir))) {
      await client.createDirectory(syncDir, { recursive: true });
    }

    // 确保 notes 目录存在
    const notesDir = `${config.remotePath}/notes`;
    if (!(await client.exists(notesDir))) {
      await client.createDirectory(notesDir, { recursive: true });
    }
  }

  /**
   * 检查文件是否存在
   */
  async exists(remotePath: string): Promise<boolean> {
    const client = this.ensureClient();
    return await client.exists(remotePath);
  }

  /**
   * 创建目录
   */
  async createDirectory(remotePath: string): Promise<void> {
    const client = this.ensureClient();
    await client.createDirectory(remotePath, { recursive: true });
  }

  /**
   * 上传文件
   */
  async uploadFile(remotePath: string, content: string | Buffer): Promise<void> {
    const client = this.ensureClient();
    await client.putFileContents(remotePath, content);
  }

  /**
   * 下载文件
   */
  async downloadFile(remotePath: string): Promise<string> {
    const client = this.ensureClient();
    const result = await client.getFileContents(remotePath, { format: 'text' });
    return result as string;
  }

  /**
   * 删除文件
   */
  async deleteFile(remotePath: string): Promise<void> {
    const client = this.ensureClient();
    try {
      await client.deleteFile(remotePath);
    } catch (error) {
      // 忽略文件不存在的错误
      if ((error as Error).message?.includes('404')) {
        return;
      }
      throw error;
    }
  }

  /**
   * 获取文件信息
   */
  async stat(remotePath: string): Promise<FileStat | null> {
    const client = this.ensureClient();
    try {
      const stat = await client.stat(remotePath);
      return stat as FileStat;
    } catch {
      return null;
    }
  }

  /**
   * 列出目录内容
   */
  async listDirectory(remotePath: string): Promise<FileStat[]> {
    const client = this.ensureClient();
    try {
      const contents = await client.getDirectoryContents(remotePath);
      return contents as FileStat[];
    } catch {
      return [];
    }
  }

  /**
   * 读取远程同步清单
   */
  async readManifest(): Promise<RemoteSyncManifest | null> {
    const config = this.config!;
    const manifestPath = `${config.remotePath}/${SYNC_META_DIR}/${MANIFEST_FILE}`;

    try {
      const exists = await this.exists(manifestPath);
      if (!exists) {
        return null;
      }
      const content = await this.downloadFile(manifestPath);
      return JSON.parse(content) as RemoteSyncManifest;
    } catch (error) {
      console.error('[WebDAV] Failed to read manifest:', error);
      return null;
    }
  }

  /**
   * 写入远程同步清单
   */
  async writeManifest(manifest: RemoteSyncManifest): Promise<void> {
    const config = this.config!;
    const manifestPath = `${config.remotePath}/${SYNC_META_DIR}/${MANIFEST_FILE}`;
    await this.uploadFile(manifestPath, JSON.stringify(manifest, null, 2));
  }

  /**
   * 上传数据文件
   */
  async uploadDataFile(relativePath: string, content: string): Promise<void> {
    const config = this.config!;
    const remotePath = toRemotePath(config.remotePath, relativePath);

    // 确保目录存在
    const dir = remotePath.substring(0, remotePath.lastIndexOf('/'));
    if (!(await this.exists(dir))) {
      await this.createDirectory(dir);
    }

    await this.uploadFile(remotePath, content);
  }

  /**
   * 下载数据文件
   */
  async downloadDataFile(relativePath: string): Promise<string> {
    const config = this.config!;
    const remotePath = toRemotePath(config.remotePath, relativePath);
    return await this.downloadFile(remotePath);
  }

  /**
   * 检查数据文件是否存在
   */
  async existsDataFile(relativePath: string): Promise<boolean> {
    const config = this.config!;
    const remotePath = toRemotePath(config.remotePath, relativePath);
    return await this.exists(remotePath);
  }

  /**
   * 删除数据文件
   */
  async deleteDataFile(relativePath: string): Promise<void> {
    const config = this.config!;
    const remotePath = toRemotePath(config.remotePath, relativePath);
    await this.deleteFile(remotePath);
  }

  /**
   * 列出远程数据文件
   * 返回相对路径列表
   */
  async listRemoteFiles(): Promise<string[]> {
    const config = this.config!;
    const files: string[] = [];

    // 列出根目录下的 JSON 文件
    const rootContents = await this.listDirectory(config.remotePath);
    for (const item of rootContents) {
      if (item.type === 'file' && item.basename.endsWith('.json')) {
        files.push(item.basename);
      }
    }

    // 列出 notes 目录
    const notesDir = `${config.remotePath}/notes`;
    if (await this.exists(notesDir)) {
      const notesContents = await this.listDirectory(notesDir);
      for (const item of notesContents) {
        if (item.type === 'file' && item.basename.endsWith('.json')) {
          files.push(`notes/${item.basename}`);
        }
      }
    }

    return files;
  }
}
