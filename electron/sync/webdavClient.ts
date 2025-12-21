/**
 * WebDAV 客户端
 * 提供 WebDAV 服务器的文件操作封装
 */

import { createClient, type WebDAVClient, type FileStat } from 'webdav';
import type { WebDAVConfig, RemoteSyncManifest } from './types';
import {
  SYNC_META_DIR,
  MANIFEST_FILE,
  hashJsonContent,
  md5Binary,
  toRemotePath,
} from './syncUtils';
import { STORAGE_MODULES } from '../storage/core/moduleRegistry';

type ManifestReadResult = {
  manifest: RemoteSyncManifest | null;
  etag?: string;
};

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
   * 自动为所有注册的目录类型模块创建远程目录
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

    // 自动为所有注册的目录类型同步模块创建远程目录
    for (const mod of STORAGE_MODULES) {
      if (mod.sync.type === 'directory' && mod.sync.enabled) {
        const dir = `${config.remotePath}/${mod.path}`;
        if (!(await client.exists(dir))) {
          await client.createDirectory(dir, { recursive: true });
          console.log(`[WebDAV] Created remote directory: ${mod.path}`);
        }
      }
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
  async uploadFile(
    remotePath: string,
    content: string | Buffer,
    options?: { ifMatch?: string; ifNoneMatch?: boolean },
  ): Promise<void> {
    const client = this.ensureClient();
    const headers: Record<string, string> = {};

    if (options?.ifMatch) {
      headers['If-Match'] = options.ifMatch;
    }
    if (options?.ifNoneMatch) {
      headers['If-None-Match'] = '*';
    }

    await client.putFileContents(remotePath, content, { headers } as unknown as object);
  }

  /**
   * 下载文件（文本）
   */
  async downloadFile(remotePath: string): Promise<string> {
    const client = this.ensureClient();
    const result = await client.getFileContents(remotePath, { format: 'text' });
    return result as string;
  }

  /**
   * 下载文件（二进制）
   */
  async downloadFileBinary(remotePath: string): Promise<Buffer> {
    const client = this.ensureClient();
    const result = await client.getFileContents(remotePath, { format: 'binary' });
    return Buffer.from(result as ArrayBuffer);
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
   * 读取远程清单 + ETag（用于并发写保护）
   */
  async readManifestWithEtag(): Promise<ManifestReadResult> {
    const config = this.config!;
    const manifestPath = `${config.remotePath}/${SYNC_META_DIR}/${MANIFEST_FILE}`;

    try {
      const exists = await this.exists(manifestPath);
      if (!exists) {
        return { manifest: null };
      }

      const stat = await this.stat(manifestPath);
      const etag = (stat as unknown as Record<string, unknown>)?.etag as string | undefined;

      const content = await this.downloadFile(manifestPath);
      return { manifest: JSON.parse(content) as RemoteSyncManifest, etag };
    } catch (error) {
      console.error('[WebDAV] Failed to read manifest with etag:', error);
      return { manifest: null };
    }
  }

  /**
   * 写入远程同步清单
   */
  async writeManifest(
    manifest: RemoteSyncManifest,
    options?: { ifMatch?: string; ifNoneMatch?: boolean },
  ): Promise<void> {
    const config = this.config!;
    const manifestPath = `${config.remotePath}/${SYNC_META_DIR}/${MANIFEST_FILE}`;

    const body = JSON.stringify(manifest, null, 2);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json; charset=utf-8',
    };
    if (options?.ifMatch) {
      headers['If-Match'] = options.ifMatch;
    }
    if (options?.ifNoneMatch) {
      headers['If-None-Match'] = '*';
    }

    const client = this.ensureClient() as {
      customRequest?: (path: string, options: unknown) => Promise<unknown>;
    };
    if (typeof client.customRequest === 'function') {
      await client.customRequest(manifestPath, {
        method: 'PUT',
        data: body,
        headers,
      });
      return;
    }

    // 即使是使用 putFileContents，我们也尝试通过 options传递 header
    // webdav 库的 putFileContents 第三个参数是 options
    await this.uploadFile(manifestPath, body, options);
  }

  /**
   * 列出远程所有数据文件（相对路径）
   * 覆盖所有启用同步的模块（file + directory）。
   */
  async listAllDataFiles(): Promise<string[]> {
    const config = this.config!;
    const files: string[] = [];

    for (const mod of STORAGE_MODULES) {
      if (!mod.sync.enabled) continue;

      if (mod.sync.type === 'file') {
        const full = toRemotePath(config.remotePath, mod.path);
        if (await this.exists(full)) {
          files.push(mod.path);
        }
        continue;
      }

      const dirFull = toRemotePath(config.remotePath, mod.path);
      if (!(await this.exists(dirFull))) continue;

      const contents = await this.listDirectory(dirFull);
      for (const item of contents) {
        if (item.type !== 'file') continue;
        const base = item.basename;
        if (!base) continue;

        if (mod.extension && !base.endsWith(mod.extension)) continue;
        files.push(`${mod.path}/${base}`);
      }
    }

    return Array.from(new Set(files));
  }

  /**
   * 获取远程文件元数据（用于 manifest 自愈：为缺失条目补全 hash/modifiedAt/size）
   */
  async computeRemoteFileMeta(
    relativePath: string,
  ): Promise<{ hash: string; modifiedAt: number; size: number }> {
    const config = this.config!;
    const remotePath = toRemotePath(config.remotePath, relativePath);

    const stat = await this.stat(remotePath);
    if (!stat) {
      throw new Error(`Remote file not found: ${relativePath}`);
    }

    const lastmod = (stat as unknown as Record<string, unknown>)?.lastmod as string | undefined;
    const modifiedAt = lastmod ? Date.parse(lastmod) : Date.now();
    const statRecord = stat as unknown as Record<string, unknown>;
    const size = statRecord?.size ? Number(statRecord.size) : 0;

    if (relativePath.endsWith('.json')) {
      const content = await this.downloadFile(remotePath);
      return {
        hash: hashJsonContent(content),
        modifiedAt: Number.isFinite(modifiedAt) ? modifiedAt : Date.now(),
        size: size || Buffer.byteLength(content, 'utf-8'),
      };
    }

    const buffer = await this.downloadFileBinary(remotePath);
    return {
      hash: md5Binary(buffer),
      modifiedAt: Number.isFinite(modifiedAt) ? modifiedAt : Date.now(),
      size: size || buffer.length,
    };
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
   * 上传二进制数据文件（如图片）
   */
  async uploadDataFileBinary(relativePath: string, buffer: Buffer): Promise<void> {
    const config = this.config!;
    const remotePath = toRemotePath(config.remotePath, relativePath);

    // 确保目录存在
    const dir = remotePath.substring(0, remotePath.lastIndexOf('/'));
    if (!(await this.exists(dir))) {
      await this.createDirectory(dir);
    }

    await this.uploadFile(remotePath, buffer);
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
   * 下载二进制数据文件（如图片）
   */
  async downloadDataFileBinary(relativePath: string): Promise<Buffer> {
    const config = this.config!;
    const remotePath = toRemotePath(config.remotePath, relativePath);
    return await this.downloadFileBinary(remotePath);
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
