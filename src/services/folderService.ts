/**
 * Folder Service - 文件夹数据服务
 *
 * 封装文件夹相关的所有数据操作，提供统一的接口。
 */

import type { Folder } from './types';

class FolderService {
  /**
   * 获取所有文件夹列表
   */
  async listFolders(): Promise<Folder[]> {
    return window.storage.listFolders();
  }

  /**
   * 创建新文件夹
   */
  async createFolder(name: string): Promise<void> {
    await window.storage.createFolder(name);
  }

  /**
   * 重命名文件夹
   */
  async renameFolder(id: string, name: string): Promise<void> {
    await window.storage.renameFolder(id, name);
  }

  /**
   * 删除文件夹
   */
  async deleteFolder(id: string): Promise<void> {
    await window.storage.deleteFolder(id);
  }
}

// 导出单例实例
export const folderService = new FolderService();

// 同时导出类型，便于测试时 mock
export type { FolderService };
