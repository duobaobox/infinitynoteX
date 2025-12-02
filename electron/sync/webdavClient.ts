/**
 * WebDAV同步客户端
 * 负责与WebDAV服务器通信，实现文件上传和下载
 */

import { createClient, FileStat, WebDAVClient } from 'webdav';

export interface WebDAVConfig {
  url: string;
  username: string;
  password: string;
  remotePath: string;
}

export interface SyncResult {
  success: boolean;
  message: string;
  filesUploaded: number;
  filesDownloaded: number;
  conflicts: number;
}

export class WebDAVSyncClient {
  private client: WebDAVClient | null = null;
  private config: WebDAVConfig | null = null;

  /**
   * 初始化客户端
   */
  initialize(config: WebDAVConfig) {
    this.config = config;
    this.client = createClient(config.url, {
      username: config.username,
      password: config.password,
    });
  }

  /**
   * 测试WebDAV连接
   */
  async testConnection(config: WebDAVConfig): Promise<{ ok: boolean; message: string }> {
    try {
      console.log('Testing WebDAV connection with config:', { ...config, password: '***' });

      if (!config.url) {
        return { ok: false, message: '服务器地址不能为空' };
      }

      // 确保 remotePath 有值
      const remotePath = config.remotePath || '/InfinityNoteX';

      const client = createClient(config.url, {
        username: config.username || '',
        password: config.password || '',
      });

      // 尝试访问远程路径
      const exists = await client.exists(remotePath);

      if (!exists) {
        // 如果路径不存在，尝试创建
        try {
          await client.createDirectory(remotePath);
          return { ok: true, message: 'WebDAV连接成功，已创建远程目录' };
        } catch (createError) {
          return {
            ok: false,
            message: `远程路径不存在且无法创建: ${createError instanceof Error ? createError.message : '未知错误'}`,
          };
        }
      }

      return { ok: true, message: 'WebDAV连接成功' };
    } catch (error) {
      console.error('WebDAV connection test failed:', error);
      return {
        ok: false,
        message: `连接失败: ${error instanceof Error ? error.message : '未知错误'}`,
      };
    }
  }

  /**
   * 上传文件到WebDAV
   */
  async uploadFile(
    _localPath: string,
    remotePath: string,
    content: Buffer | string,
  ): Promise<void> {
    if (!this.client) {
      throw new Error('WebDAV client not initialized');
    }

    await this.client.putFileContents(remotePath, content);
  }

  /**
   * 从WebDAV下载文件
   */
  async downloadFile(remotePath: string): Promise<Buffer | string> {
    if (!this.client) {
      throw new Error('WebDAV client not initialized');
    }

    const result = await this.client.getFileContents(remotePath);
    if (result instanceof ArrayBuffer) {
      return Buffer.from(result);
    }
    return result as Buffer | string;
  }

  /**
   * 列出远程目录内容
   */
  async listDirectory(remotePath: string): Promise<FileStat[]> {
    if (!this.client) {
      throw new Error('WebDAV client not initialized');
    }

    const contents = await this.client.getDirectoryContents(remotePath);
    return contents as FileStat[];
  }

  /**
   * 检查文件是否存在
   */
  async exists(remotePath: string): Promise<boolean> {
    if (!this.client) {
      throw new Error('WebDAV client not initialized');
    }

    return await this.client.exists(remotePath);
  }

  /**
   * 创建目录
   */
  async createDirectory(remotePath: string): Promise<void> {
    if (!this.client) {
      throw new Error('WebDAV client not initialized');
    }

    await this.client.createDirectory(remotePath);
  }

  /**
   * 同步本地数据到WebDAV
   * 简化版：上传所有JSON文件
   */
  async syncToRemote(localDataPath: string): Promise<SyncResult> {
    if (!this.client || !this.config) {
      throw new Error('WebDAV client not initialized');
    }

    const fs = await import('fs/promises');
    const path = await import('path');

    let filesUploaded = 0;

    try {
      // 确保远程目录存在
      const remoteExists = await this.exists(this.config.remotePath);
      if (!remoteExists) {
        await this.createDirectory(this.config.remotePath);
      }

      // 上传folders.json
      const foldersPath = path.join(localDataPath, 'folders.json');
      const foldersContent = await fs.readFile(foldersPath, 'utf-8');
      await this.uploadFile(foldersPath, `${this.config.remotePath}/folders.json`, foldersContent);
      filesUploaded++;

      // 上传notes-index.json
      const notesIndexPath = path.join(localDataPath, 'notes-index.json');
      const notesIndexContent = await fs.readFile(notesIndexPath, 'utf-8');
      await this.uploadFile(
        notesIndexPath,
        `${this.config.remotePath}/notes-index.json`,
        notesIndexContent,
      );
      filesUploaded++;

      // 上传meta.json
      const metaPath = path.join(localDataPath, 'meta.json');
      const metaContent = await fs.readFile(metaPath, 'utf-8');
      await this.uploadFile(metaPath, `${this.config.remotePath}/meta.json`, metaContent);
      filesUploaded++;

      // TODO: 上传notes目录下的所有便签文件
      // TODO: 上传ai-conversations目录

      return {
        success: true,
        message: `成功上传 ${filesUploaded} 个文件`,
        filesUploaded,
        filesDownloaded: 0,
        conflicts: 0,
      };
    } catch (error) {
      console.error('Sync to remote failed:', error);
      return {
        success: false,
        message: `同步失败: ${error instanceof Error ? error.message : '未知错误'}`,
        filesUploaded,
        filesDownloaded: 0,
        conflicts: 0,
      };
    }
  }
}
