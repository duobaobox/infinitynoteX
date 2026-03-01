/**
 * Sync IPC Handlers
 * 数据同步相关 IPC 处理器 - 从 main.ts 抽离
 */

import { app, ipcMain, shell } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { IPC_CHANNELS, getIpcProxyChannel } from '../../src/shared/types/ipc';
import type { IpcProxyMethod } from '../../src/shared/types/ipc';
import { storageManager } from '../storage';
import { getMainWindow } from '../windows/mainWindow';
import { SyncManager } from '../sync/syncManager';
import type { SyncProgress, WebDAVConfig, SyncConfig } from '../sync/types';

const syncChannel = (method: IpcProxyMethod<'sync'>) => getIpcProxyChannel('sync', method);

// 同步管理器实例
const syncManager = new SyncManager();

/**
 * 注册同步相关 IPC 处理器
 */
export function registerSyncHandlers(): void {
  ipcMain.handle(syncChannel('testConnection'), async (_, providerId: string, config: unknown) => {
    try {
      if (providerId === 'webdav') {
        return await syncManager.testWebDAVConnection(config as WebDAVConfig);
      }
      return { ok: false, message: `Unknown provider: ${providerId}` };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { ok: false, message: `测试失败：${msg}` };
    }
  });

  ipcMain.handle(syncChannel('execute'), async (event, providerId: string, config: unknown) => {
    try {
      const storagePath = storageManager.getCurrentPath();
      const progressCallback = (progress: SyncProgress) => {
        event.sender.send(IPC_CHANNELS.syncProgress, progress);
      };
      syncManager.setProgressCallback(progressCallback);
      const result = await syncManager.execute(providerId, config as SyncConfig, storagePath);

      // 持久化最近一次同步结果
      try {
        const metaDir = path.join(storagePath, '.sync-meta');
        await fs.mkdir(metaDir, { recursive: true });
        const lastResultPath = path.join(metaDir, 'last-result.json');
        await fs.writeFile(lastResultPath, JSON.stringify(result, null, 2), 'utf-8');
      } catch (e) {
        console.warn('[Sync] Failed to persist last sync result:', e);
      }

      // 同步完成后清除缓存并重建索引
      storageManager.clearAllCaches();
      console.log('[Sync] Rebuilding all indexes after sync...');
      const rebuildResult = await storageManager.rebuildAllIndexes();
      console.log(
        `[Sync] Indexes rebuilt: ${rebuildResult.folders.rebuilt} folders, ${rebuildResult.notes.rebuilt} notes, ${rebuildResult.conversations.rebuilt} conversations`,
      );
      await storageManager.reloadAllCaches();

      event.sender.send(IPC_CHANNELS.syncCompleted, result);

      const win = getMainWindow();
      if (win && !win.isDestroyed()) {
        win.webContents.send(IPC_CHANNELS.syncDataChanged);
      }

      return result;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(`同步失败：${msg}`);
    }
  });

  ipcMain.handle(syncChannel('getLastResult'), async () => {
    const storagePath = storageManager.getCurrentPath();
    const lastResultPath = path.join(storagePath, '.sync-meta', 'last-result.json');
    try {
      const content = await fs.readFile(lastResultPath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  });

  ipcMain.handle(syncChannel('preview'), async (_, providerId: string, config: unknown) => {
    try {
      if (providerId !== 'webdav') {
        throw new Error(`Unknown provider: ${providerId}`);
      }
      const storagePath = storageManager.getCurrentPath();
      return await syncManager.preview(config as WebDAVConfig, storagePath);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(`预览失败：${msg}`);
    }
  });

  ipcMain.handle(syncChannel('getConfig'), async (_, providerId: string) => {
    return await syncManager.getConfig(providerId);
  });

  ipcMain.handle(syncChannel('setConfig'), async (_, providerId: string, config: unknown) => {
    await syncManager.setConfig(providerId, config as SyncConfig);
  });

  ipcMain.handle(syncChannel('openLogDir'), async () => {
    const logDir = path.join(app.getPath('userData'), 'sync-logs');
    await fs.mkdir(logDir, { recursive: true });
    await shell.openPath(logDir);
  });
}
