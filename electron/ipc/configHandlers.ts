/**
 * Config IPC Handlers
 * 配置相关 IPC 处理器 - 从 main.ts 抽离
 */

import { app, BrowserWindow, ipcMain } from 'electron';
import { IPC_CHANNELS, getIpcProxyChannel } from '../../src/shared/types/ipc';
import type { IpcProxyMethod } from '../../src/shared/types/ipc';
import log from '../logger';
import {
  readAppConfig,
  writeAppConfig,
  getConfigPath,
  type AppConfig,
  type DeepPartial,
} from '../config';
import { sanitizeAppConfigForRenderer } from '../ai';
import { syncNativeTheme } from '../nativeTheme';

// 配置保存防抖机制
let configSaveTimer: NodeJS.Timeout | null = null;
let pendingConfigUpdates: DeepPartial<AppConfig> = {};
const CONFIG_SAVE_DEBOUNCE_MS = 500; // 500ms 防抖延迟
const configChannel = (method: IpcProxyMethod<'config'>) => getIpcProxyChannel('config', method);
const appChannel = (method: IpcProxyMethod<'app'>) => getIpcProxyChannel('app', method);

/**
 * 防抖保存配置
 */
function debouncedSaveConfig(partial: DeepPartial<AppConfig>): void {
  // 合并待保存的配置更新
  pendingConfigUpdates = deepMergePartial(pendingConfigUpdates, partial);

  // 清除之前的定时器
  if (configSaveTimer) {
    clearTimeout(configSaveTimer);
  }

  // 设置新的防抖定时器
  configSaveTimer = setTimeout(() => {
    try {
      writeAppConfig(pendingConfigUpdates);

      // 同步 Native Theme
      syncNativeTheme();

      const newConfig = readAppConfig();

      // 广播配置变化
      BrowserWindow.getAllWindows().forEach((w) => {
        w.webContents.send(IPC_CHANNELS.appConfigChanged, sanitizeAppConfigForRenderer(newConfig));
      });

      // 清空待保存的配置
      pendingConfigUpdates = {};
      configSaveTimer = null;
    } catch (error) {
      log.error('Failed to save config:', error);
    }
  }, CONFIG_SAVE_DEBOUNCE_MS);
}

/**
 * 简单的深度合并 Partial 对象
 */
function deepMergePartial(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  target: Record<string, any>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  source: Record<string, any>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Record<string, any> {
  if (!source || typeof source !== 'object') return target;
  if (!target || typeof target !== 'object') return source;

  const result = { ...target };
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMergePartial(result[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

/**
 * 注册配置相关 IPC 处理器
 */
export function registerConfigHandlers(): void {
  // 快捷键配置
  ipcMain.handle(configChannel('getShortcutKeys'), async () => {
    const config = readAppConfig();
    return config.shortcutKeys || { aiChatWindow: 'CommandOrControl+Shift+Q' };
  });

  ipcMain.handle(configChannel('setShortcutKeys'), async (_, keys: { aiChatWindow: string }) => {
    const config = readAppConfig();
    writeAppConfig({
      ...config,
      shortcutKeys: keys,
    });
    log.info('Shortcut keys updated', keys);
    return keys;
  });

  // 统一配置
  ipcMain.handle(IPC_CHANNELS.appGetVersion, () => app.getVersion());

  ipcMain.handle(appChannel('getConfig'), () => {
    return sanitizeAppConfigForRenderer(readAppConfig());
  });

  ipcMain.handle(appChannel('setConfig'), (_, partial: DeepPartial<AppConfig>) => {
    // 使用防抖保存
    debouncedSaveConfig(partial);

    // 立即返回当前配置（包含待保存的更新）
    const currentConfig = readAppConfig();
    return sanitizeAppConfigForRenderer(
      deepMergePartial(currentConfig, { ...pendingConfigUpdates, ...partial }) as AppConfig,
    );
  });

  ipcMain.handle(appChannel('getConfigPath'), () => {
    return getConfigPath();
  });
}
