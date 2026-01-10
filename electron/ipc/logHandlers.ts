/**
 * Log IPC Handlers
 * 日志相关 IPC 处理器 - 从 main.ts 抽离
 */

import { ipcMain } from 'electron';
import log, {
  openLogDir,
  readRecentLogs,
  readLogsByLevel,
  searchLogs,
  cleanOldLogs,
  getLogPath,
  getLogStats,
} from '../logger';

/**
 * 注册日志相关 IPC 处理器
 */
export function registerLogHandlers(): void {
  ipcMain.handle('log:openDir', async () => {
    await openLogDir();
  });

  ipcMain.handle('log:getPath', () => {
    return getLogPath();
  });

  ipcMain.handle('log:readRecent', async (_, lines?: number) => {
    return await readRecentLogs(lines);
  });

  ipcMain.handle(
    'log:readByLevel',
    async (_, level: 'error' | 'warn' | 'info' | 'debug' | 'all', lines?: number) => {
      return await readLogsByLevel(level, lines);
    },
  );

  ipcMain.handle('log:search', async (_, keyword: string, lines?: number) => {
    return await searchLogs(keyword, lines);
  });

  ipcMain.handle('log:cleanOld', async () => {
    return await cleanOldLogs();
  });

  ipcMain.handle('log:getStats', async () => {
    return await getLogStats();
  });

  // 渲染进程日志收集
  ipcMain.on('log:renderer', (_, level: string, ...args: unknown[]) => {
    switch (level) {
      case 'error':
        log.error('[Renderer]', ...args);
        break;
      case 'warn':
        log.warn('[Renderer]', ...args);
        break;
      case 'info':
        log.info('[Renderer]', ...args);
        break;
      case 'debug':
        log.debug('[Renderer]', ...args);
        break;
      default:
        log.log('[Renderer]', ...args);
    }
  });
}
