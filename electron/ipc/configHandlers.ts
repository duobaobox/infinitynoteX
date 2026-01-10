/**
 * Config IPC Handlers
 * 配置相关 IPC 处理器 - 从 main.ts 抽离
 */

import { app, BrowserWindow, ipcMain } from 'electron';
import log from '../logger';
import {
  readAppConfig,
  writeAppConfig,
  getConfigPath,
  type AppConfig,
  type DeepPartial,
} from '../config';

/**
 * 注册配置相关 IPC 处理器
 */
export function registerConfigHandlers(): void {
  // 快捷键配置
  ipcMain.handle('config:getShortcutKeys', async () => {
    const config = readAppConfig();
    return config.shortcutKeys || { aiChatWindow: 'CommandOrControl+Shift+Q' };
  });

  ipcMain.handle('config:setShortcutKeys', async (_, keys: { aiChatWindow: string }) => {
    const config = readAppConfig();
    writeAppConfig({
      ...config,
      shortcutKeys: keys,
    });
    log.info('Shortcut keys updated', keys);
    return keys;
  });

  // 统一配置
  ipcMain.handle('app:getVersion', () => app.getVersion());

  ipcMain.handle('app:getConfig', () => {
    return readAppConfig();
  });

  ipcMain.handle('app:setConfig', (_, partial: DeepPartial<AppConfig>) => {
    writeAppConfig(partial);
    const newConfig = readAppConfig();
    BrowserWindow.getAllWindows().forEach((w) => {
      w.webContents.send('app:configChanged', newConfig);
    });
    return newConfig;
  });

  ipcMain.handle('app:getConfigPath', () => {
    return getConfigPath();
  });
}
