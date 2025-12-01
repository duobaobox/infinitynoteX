/**
 * Storage Service - 存储管理服务
 *
 * 封装存储路径、备份、导入导出等管理操作。
 */

import type { HealthCheckResult, StorageStats, SetStoragePathOptions } from './types';

class StorageService {
  // ============ 存储路径管理 ============

  /**
   * 获取当前存储路径
   */
  async getCurrentPath(): Promise<string> {
    return window.storage.getCurrentPath();
  }

  /**
   * 获取默认存储路径
   */
  async getDefaultPath(): Promise<string> {
    return window.storage.getDefaultPath();
  }

  /**
   * 设置存储路径
   */
  async setStoragePath(path: string, options?: SetStoragePathOptions): Promise<void> {
    await window.storage.setStoragePath(path, options);
  }

  /**
   * 在文件管理器中打开存储目录
   */
  async openInFinder(): Promise<void> {
    await window.storage.openInFinder();
  }

  // ============ 初始化状态 ============

  /**
   * 检查是否首次启动
   */
  async isFirstLaunch(): Promise<boolean> {
    return window.storage.isFirstLaunch();
  }

  /**
   * 标记已完成初始化
   */
  async markInitialized(): Promise<void> {
    await window.storage.markInitialized();
  }

  // ============ 备份与恢复 ============

  /**
   * 创建备份
   */
  async createBackup(): Promise<string> {
    return window.storage.createBackup();
  }

  /**
   * 导出数据到指定路径
   */
  async exportData(exportPath: string): Promise<void> {
    await window.storage.exportData(exportPath);
  }

  // ============ 健康检查与统计 ============

  /**
   * 执行健康检查
   */
  async healthCheck(): Promise<HealthCheckResult> {
    return window.storage.healthCheck();
  }

  /**
   * 获取存储统计信息
   */
  async getStats(): Promise<StorageStats> {
    return window.storage.getStats();
  }
}

// 导出单例实例
export const storageService = new StorageService();

// 同时导出类型，便于测试时 mock
export type { StorageService };
