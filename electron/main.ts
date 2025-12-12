import { app, BrowserWindow, ipcMain, dialog, protocol, net } from 'electron';
import type { BrowserWindowConstructorOptions, OpenDialogOptions } from 'electron';
import type {
  SetStoragePathOptions,
  CreateNotePayload,
  UpdateNotePayload,
} from '../src/services/types';
import type { AIConfig, ChatPayload } from '../src/services/aiConfig';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { storageManager } from './storage';
import { initAutoUpdater } from './updater';
import { readAIConfig, writeAIConfig } from './ai';
import { createAdapter } from './ai/adapter';
import {
  readAppConfig,
  writeAppConfig,
  getConfigPath,
  migrateFromLegacyConfigs,
  type AppConfig,
  type DeepPartial,
} from './config';
import log, {
  openLogDir,
  readRecentLogs,
  readLogsByLevel,
  searchLogs,
  cleanOldLogs,
  getLogPath,
  getLogStats,
} from './logger';

type AIConversationMessage = {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, '..');

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'];
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron');
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist');

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST;

let win: BrowserWindow | null;
let isQuitting = false; // 用于在 macOS 区分真正退出与仅关闭窗口

// 窗口状态接口（保持向后兼容，实际使用 config.window）

// 悬浮窗口管理
const floatingWindows = new Map<string, BrowserWindow>();
// 药丸窗口管理
const pillWindows = new Map<string, BrowserWindow>();
// 悬浮窗口最小化前尺寸记录
interface StoredBounds {
  width: number;
  height: number;
  x: number;
  y: number;
}
const minimizedBounds = new Map<string, StoredBounds>();
const PILL_SIZE = { width: 130, height: 48 }; // 药丸窗口固定大小

// 默认悬浮窗口大小
let defaultFloatingWindowSize = {
  width: 400,
  height: 400,
};

/**
 * 加载窗口状态（从统一配置）
 */
function loadWindowState() {
  const config = readAppConfig();
  return config.window;
}

/**
 * 保存窗口状态（到统一配置）
 */
function saveWindowState(): void {
  if (!win || win.isDestroyed()) return;

  try {
    const isMaximized = win.isMaximized();
    const windowConfig: {
      width: number;
      height: number;
      x?: number;
      y?: number;
      isMaximized: boolean;
    } = {
      width: win.getSize()[0],
      height: win.getSize()[1],
      isMaximized,
    };

    // 如果窗口未最大化，保存位置信息
    if (!isMaximized) {
      const [x, y] = win.getPosition();
      windowConfig.x = x;
      windowConfig.y = y;
    }

    writeAppConfig({ window: windowConfig });
  } catch (error) {
    console.error('[Window] Failed to save window state:', error);
  }
}

function createWindow() {
  // 加载保存的窗口状态（从统一配置）
  const savedState = loadWindowState();

  const windowOptions: BrowserWindowConstructorOptions = {
    width: savedState.width || 700,
    height: savedState.height || 560,
    x: savedState.x,
    y: savedState.y,
    minWidth: 700,
    minHeight: 560,
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    frame: false,
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 12, y: 10 },
    show: false,
    backgroundColor: '#FFFFFF',
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      webviewTag: true, // 启用 webview 标签支持
    },
  };

  win = new BrowserWindow(windowOptions);

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', new Date().toLocaleString());
  });

  // 准备好再显示窗口，减少"半秒加载感"
  win.once('ready-to-show', () => {
    win?.show();
    // 如果之前窗口是最大化的，恢复最大化状态
    if (savedState.isMaximized) {
      win?.maximize();
    }
  });

  // 在 macOS 上，点击关闭按钮仅隐藏窗口，避免每次重新创建导致页面重载
  win.on('close', (e) => {
    if (process.platform === 'darwin' && !isQuitting) {
      e.preventDefault();
      win?.hide();
      return;
    }
    // 保存窗口状态在窗口关闭时
    saveWindowState();
    win = null;
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(RENDERER_DIST, 'index.html'));
  }
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
    win = null;
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (win) {
    win.show();
  } else if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// 窗口控制 IPC 处理器
ipcMain.on('window-minimize', () => {
  if (win) {
    win.minimize();
  }
});

ipcMain.on('window-maximize', () => {
  if (win) {
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
  }
});

ipcMain.on('window-close', () => {
  if (!win) return;
  if (process.platform === 'darwin') {
    // macOS 习惯：关闭窗口但不退出应用
    win.hide();
  } else {
    win.close();
  }
});

// 获取窗口最大化状态
ipcMain.handle('window-is-maximized', () => {
  return win?.isMaximized() ?? false;
});

// 双击标题栏最大化行为
ipcMain.on('window-double-click-titlebar', () => {
  if (win) {
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
  }
});

// 单例锁，二次启动唤起现有窗口
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
    }
  });
}

app.on('before-quit', () => {
  isQuitting = true;
  // 在应用完全退出前保存窗口状态
  saveWindowState();
});

// ============ 注册自定义协议 attachment:// ============
// 必须在 app.ready 之前配置
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'attachment',
    privileges: {
      secure: true,
      supportFetchAPI: true,
      stream: true,
    },
  },
]);

app.whenReady().then(async () => {
  // 注册 attachment:// 协议处理器
  protocol.handle('attachment', async (request) => {
    try {
      const url = new URL(request.url);
      // URL 格式: attachment://img-xxx (不含扩展名)
      const id = url.hostname || url.pathname.replace(/^\//, '');

      // 获取附件完整路径
      const filePath = await storageManager.attachments.getPath(id);
      if (!filePath) {
        console.warn(`[Attachment] File not found: ${id}`);
        return new Response('Not Found', { status: 404 });
      }

      return net.fetch(`file://${filePath}`);
    } catch (error) {
      console.error('[Attachment] Protocol handler error:', error);
      return new Response('Internal Error', { status: 500 });
    }
  });
  // 从旧配置文件迁移（首次升级时执行）
  await migrateFromLegacyConfigs();

  // 初始化存储
  await storageManager.initialize();

  // 执行启动时的数据一致性检查
  await storageManager.performStartupChecks();

  createWindow();
  initAutoUpdater(() => win ?? null);

  // 启动时记录日志
  log.info('App started', { version: app.getVersion() });
});

ipcMain.handle('app:getVersion', () => app.getVersion());

// ============ 日志 IPC 处理器 ============

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

// ============ 存储 IPC 处理器 ============

// 路径管理
ipcMain.handle('storage:getDefaultPath', () => {
  return storageManager.getDefaultPath();
});

ipcMain.handle('storage:getCurrentPath', () => {
  return storageManager.getCurrentPath();
});

ipcMain.handle('storage:isFirstLaunch', async () => {
  return await storageManager.isFirstLaunch();
});

ipcMain.handle('storage:markInitialized', async () => {
  await storageManager.markInitialized();
});

ipcMain.handle(
  'storage:setStoragePath',
  async (_, nextPath: string, options?: SetStoragePathOptions) => {
    await storageManager.setStoragePath(nextPath, options);
  },
);

ipcMain.handle('storage:healthCheck', async () => {
  return await storageManager.healthCheck();
});

ipcMain.handle('storage:openInFinder', async () => {
  await storageManager.openInFinder();
});

ipcMain.handle('storage:getStats', async () => {
  return await storageManager.getStats();
});

ipcMain.handle('storage:createBackup', async () => {
  return await storageManager.createBackup();
});

ipcMain.handle('storage:exportData', async (_, targetPath: string) => {
  await storageManager.exportData(targetPath);
});

ipcMain.handle('storage:resetAllData', async () => {
  await storageManager.resetAllData();
});

// 文件夹操作
ipcMain.handle('storage:listFolders', async () => {
  return await storageManager.listFolders();
});

ipcMain.handle('storage:createFolder', async (_, name: string) => {
  return await storageManager.createFolder(name);
});

ipcMain.handle('storage:renameFolder', async (_, id: string, name: string) => {
  return await storageManager.renameFolder(id, name);
});

ipcMain.handle('storage:deleteFolder', async (_, id: string) => {
  await storageManager.deleteFolder(id);
});

// 便签操作
ipcMain.handle('storage:listNotes', async (_, folderId?: string) => {
  return await storageManager.listNotes(folderId);
});

ipcMain.handle('storage:createNote', async (_, folderId: string, payload?: CreateNotePayload) => {
  return await storageManager.createNote(folderId, payload);
});

ipcMain.handle('storage:getNote', async (_, id: string) => {
  return await storageManager.getNote(id);
});

ipcMain.handle('storage:updateNote', async (_, id: string, patch: UpdateNotePayload) => {
  return await storageManager.updateNote(id, patch);
});

ipcMain.handle('storage:deleteNote', async (_, id: string) => {
  await storageManager.deleteNote(id);
});

// AI 对话操作
ipcMain.handle('storage:getAIConversations', async () => {
  return await storageManager.getAIConversations();
});

ipcMain.handle('storage:createAIConversation', async (_, title?: string) => {
  return await storageManager.createAIConversation(title);
});

ipcMain.handle('storage:deleteAIConversation', async (_, id: string) => {
  await storageManager.deleteAIConversation(id);
});

ipcMain.handle(
  'storage:saveAIConversationMessages',
  async (_, id: string, messages: AIConversationMessage[]) => {
    return await storageManager.saveAIConversationMessages(id, messages);
  },
);

ipcMain.handle('storage:updateAIConversationTitle', async (_, id: string, title: string) => {
  return await storageManager.updateAIConversationTitle(id, title);
});

// 回收站操作
ipcMain.handle('storage:listTrash', async () => {
  return await storageManager.listTrash();
});

ipcMain.handle('storage:getTrashItem', async (_, id: string) => {
  return await storageManager.getTrashItem(id);
});

ipcMain.handle('storage:restoreNote', async (_, trashItemId: string, targetFolderId?: string) => {
  return await storageManager.restoreNote(trashItemId, targetFolderId);
});

ipcMain.handle('storage:deleteTrashItemPermanently', async (_, id: string) => {
  await storageManager.deleteTrashItemPermanently(id);
});

ipcMain.handle('storage:emptyTrash', async () => {
  return await storageManager.emptyTrash();
});

// ============ 浏览器卡片 IPC 处理器 ============

/**
 * 获取所有浏览器卡片
 */
ipcMain.handle('browserCards:list', async () => {
  return await storageManager.browserCards.getAll();
});

/**
 * 创建浏览器卡片
 */
ipcMain.handle(
  'browserCards:create',
  async (_, card: { name: string; url: string; icon?: string }) => {
    const nextOrder = await storageManager.browserCards.getNextOrder();
    return await storageManager.browserCards.create({
      ...card,
      order: nextOrder,
    });
  },
);

/**
 * 更新浏览器卡片
 */
ipcMain.handle(
  'browserCards:update',
  async (_, id: string, patch: { name?: string; url?: string; icon?: string }) => {
    return await storageManager.browserCards.update(id, patch);
  },
);

/**
 * 删除浏览器卡片
 */
ipcMain.handle('browserCards:delete', async (_, id: string) => {
  await storageManager.browserCards.delete(id);
});

/**
 * 重新排序浏览器卡片
 */
ipcMain.handle('browserCards:reorder', async (_, orderedIds: string[]) => {
  await storageManager.browserCards.reorder(orderedIds);
});

// ============ 附件 IPC 处理器 ============

/**
 * 保存附件（从 Base64 Data URL）
 * @returns 附件 ID
 */
ipcMain.handle('attachments:save', async (_, dataUrl: string) => {
  try {
    const id = await storageManager.attachments.saveFromDataUrl(dataUrl);
    return { success: true, id };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[Attachments] Save failed:', msg);
    return { success: false, error: msg };
  }
});

/**
 * 获取附件路径
 */
ipcMain.handle('attachments:getPath', async (_, id: string) => {
  return await storageManager.attachments.getPath(id);
});

/**
 * 删除附件
 */
ipcMain.handle('attachments:delete', async (_, id: string) => {
  try {
    await storageManager.attachments.delete(id);
    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { success: false, error: msg };
  }
});

/**
 * 列出所有附件
 */
ipcMain.handle('attachments:list', async () => {
  return await storageManager.attachments.list();
});

/**
 * 附件垃圾回收
 * 清理未被任何便签引用的孤立附件
 */
ipcMain.handle('attachments:cleanup', async () => {
  return await storageManager.cleanupOrphanedAttachments();
});

// ============ 系统对话框 IPC 处理器 ============

ipcMain.handle('dialog:showOpenDialog', async (_, options: OpenDialogOptions) => {
  const result = await dialog.showOpenDialog(options);
  return result;
});

// ============ 悬浮窗口 IPC 处理器 ============

/**
 * 创建悬浮便签窗口
 */
ipcMain.handle('floating:createWindow', async (_, noteId: string) => {
  // 防止重复创建同一便签的悬浮窗口
  if (floatingWindows.has(noteId)) {
    const existingWindow = floatingWindows.get(noteId);
    if (existingWindow && !existingWindow.isDestroyed()) {
      existingWindow.focus();
      return { success: true, message: '窗口已存在' };
    }
  }

  // 创建悬浮窗口，使用默认大小
  const floatingWindow = new BrowserWindow({
    width: defaultFloatingWindowSize.width,
    height: defaultFloatingWindowSize.height,
    minWidth: 300,
    minHeight: 300,
    frame: false, // 无边框窗口
    transparent: false, // 设为 false 以支持圆角和阴影（圆角通过 CSS 实现）
    hasShadow: true,
    alwaysOnTop: true, // 始终置顶
    resizable: true,
    show: false,
    backgroundColor: '#ffffff', // 设置为背景色而非透明，避免阴影失效
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  });

  // 加载悬浮窗口页面
  if (VITE_DEV_SERVER_URL) {
    floatingWindow.loadURL(`${VITE_DEV_SERVER_URL}#/floating/${noteId}`);
  } else {
    floatingWindow.loadFile(path.join(RENDERER_DIST, 'index.html'), {
      hash: `/floating/${noteId}`,
    });
  }

  // 准备好后显示
  floatingWindow.once('ready-to-show', () => {
    floatingWindow.show();
  });

  // 窗口关闭时清理
  floatingWindow.on('closed', () => {
    floatingWindows.delete(noteId);
  });

  // 保存到管理器
  floatingWindows.set(noteId, floatingWindow);

  return { success: true, message: '创建成功' };
});

/**
 * 最小化悬浮便签窗口为"药丸"（实际是关闭正常窗口，打开药丸窗口）
 */
ipcMain.handle('floating:minimizeWindow', async (_, noteId: string) => {
  const floatingWin = floatingWindows.get(noteId);
  if (!floatingWin || floatingWin.isDestroyed()) {
    return { success: false, message: '窗口不存在' };
  }

  // 记录当前窗口位置和尺寸
  const bounds = floatingWin.getBounds();
  minimizedBounds.set(noteId, bounds);

  // 创建药丸窗口在相同位置
  const pillWindow = new BrowserWindow({
    width: PILL_SIZE.width,
    height: PILL_SIZE.height,
    x: bounds.x,
    y: bounds.y,
    frame: false,
    transparent: false,
    hasShadow: true,
    alwaysOnTop: true,
    resizable: false,
    show: false,
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  });

  // 加载药丸页面
  if (VITE_DEV_SERVER_URL) {
    pillWindow.loadURL(`${VITE_DEV_SERVER_URL}#/pill/${noteId}`);
  } else {
    pillWindow.loadFile(path.join(RENDERER_DIST, 'index.html'), {
      hash: `/pill/${noteId}`,
    });
  }

  // 准备好后显示药丸，同时关闭正常窗口
  pillWindow.once('ready-to-show', () => {
    pillWindow.show();
    floatingWin.close();
  });

  // 药丸窗口关闭时清理
  pillWindow.on('closed', () => {
    pillWindows.delete(noteId);
  });

  // 保存到管理器
  pillWindows.set(noteId, pillWindow);

  return { success: true };
});

/**
 * 还原悬浮便签窗口（实际是关闭药丸窗口，重新打开正常窗口）
 */
ipcMain.handle('floating:restoreWindow', async (_, noteId: string) => {
  const pillWin = pillWindows.get(noteId);
  if (!pillWin || pillWin.isDestroyed()) {
    return { success: false, message: '药丸窗口不存在' };
  }

  // 获取记录的窗口位置和尺寸
  const stored = minimizedBounds.get(noteId);
  if (!stored) {
    return { success: false, message: '未找到保存的窗口尺寸' };
  }

  // 创建正常悬浮窗口
  const floatingWindow = new BrowserWindow({
    width: stored.width,
    height: stored.height,
    x: stored.x,
    y: stored.y,
    minWidth: 300,
    minHeight: 300,
    frame: false,
    transparent: false,
    hasShadow: true,
    alwaysOnTop: true,
    resizable: true,
    show: false,
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  });

  // 加载悬浮窗口页面
  if (VITE_DEV_SERVER_URL) {
    floatingWindow.loadURL(`${VITE_DEV_SERVER_URL}#/floating/${noteId}`);
  } else {
    floatingWindow.loadFile(path.join(RENDERER_DIST, 'index.html'), {
      hash: `/floating/${noteId}`,
    });
  }

  // 准备好后显示正常窗口，同时关闭药丸
  floatingWindow.once('ready-to-show', () => {
    floatingWindow.show();
    pillWin.close();
  });

  // 窗口关闭时清理
  floatingWindow.on('closed', () => {
    floatingWindows.delete(noteId);
  });

  // 保存到管理器并清理记录
  floatingWindows.set(noteId, floatingWindow);
  minimizedBounds.delete(noteId);

  return { success: true };
});

/**
 * 关闭悬浮便签窗口
 */
ipcMain.handle('floating:closeWindow', async (_, noteId: string) => {
  const floatingWindow = floatingWindows.get(noteId);
  if (floatingWindow && !floatingWindow.isDestroyed()) {
    floatingWindow.close();
    floatingWindows.delete(noteId);
    return { success: true };
  }
  return { success: false, message: '窗口不存在' };
});

/**
 * 获取所有悬浮窗口的 noteId 列表
 */
ipcMain.handle('floating:listWindows', async () => {
  const noteIds = Array.from(floatingWindows.keys());
  return noteIds.filter((noteId) => {
    const window = floatingWindows.get(noteId);
    return window && !window.isDestroyed();
  });
});

/**
 * 处理便签数据变化，转发到相关窗口（pill 窗口、悬浮窗口、主窗口）
 */
ipcMain.on('note:changed', (_event, noteId: string) => {
  // 获取指定 noteId 的 pill 窗口，并发送更新通知
  const pillWindow = pillWindows.get(noteId);
  if (pillWindow && !pillWindow.isDestroyed()) {
    pillWindow.webContents.send('note:updated', noteId);
  }

  // 获取指定 noteId 的悬浮窗口，并发送更新通知
  const floatingWindow = floatingWindows.get(noteId);
  if (floatingWindow && !floatingWindow.isDestroyed()) {
    floatingWindow.webContents.send('note:updated', noteId);
  }

  // 同时通知主窗口（用于更新列表等组件）
  if (win && !win.isDestroyed()) {
    win.webContents.send('note:updated', noteId);
  }
});

/**
 * 处理悬浮窗口的数据变化，转发到主窗口
 */
ipcMain.on('floating-note:changed', (_event, noteId: string) => {
  if (win && !win.isDestroyed()) {
    win.webContents.send('floating-note:updated', noteId);
  }
});

// ============ 配置 IPC 处理器 ============

/**
 * 获取默认悬浮窗口大小
 */
ipcMain.handle('config:getDefaultFloatingWindowSize', async () => {
  return defaultFloatingWindowSize;
});

/**
 * 设置默认悬浮窗口大小
 */
ipcMain.handle(
  'config:setDefaultFloatingWindowSize',
  async (_, config: { width: number; height: number }) => {
    if (config.width && config.height) {
      defaultFloatingWindowSize = {
        width: config.width,
        height: config.height,
      };
    }
    return defaultFloatingWindowSize;
  },
);

// ============ 数据同步 IPC 处理器 ============

import { SyncManager } from './sync/syncManager';
import type { SyncProgress } from './sync/types';
const syncManager = new SyncManager();

/**
 * 测试同步连接
 */
ipcMain.handle('sync:testConnection', async (_, providerId: string, config: any) => {
  try {
    if (providerId === 'webdav') {
      return await syncManager.testWebDAVConnection(config);
    }
    return { ok: false, message: `Unknown provider: ${providerId}` };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { ok: false, message: `测试失败：${msg}` };
  }
});

/**
 * 执行同步（带进度回调）
 */
ipcMain.handle('sync:execute', async (event, providerId: string, config: any) => {
  try {
    const storagePath = storageManager.getCurrentPath();

    // 设置进度回调，通过 IPC 发送给渲染进程
    const progressCallback = (progress: SyncProgress) => {
      event.sender.send('sync:progress', progress);
    };

    syncManager.setProgressCallback(progressCallback);

    const result = await syncManager.execute(providerId, config, storagePath);

    // 同步完成后清除缓存
    storageManager.clearAllCaches();

    // 重建所有索引（确保索引与实际文件一致）
    console.log('[Sync] Rebuilding all indexes after sync...');
    const rebuildResult = await storageManager.rebuildAllIndexes();
    console.log(
      `[Sync] Indexes rebuilt: ${rebuildResult.notes.rebuilt} notes, ${rebuildResult.conversations.rebuilt} conversations`,
    );
    if (rebuildResult.notes.errors.length > 0) {
      console.warn('[Sync] Notes index rebuild had errors:', rebuildResult.notes.errors);
    }
    if (rebuildResult.conversations.errors.length > 0) {
      console.warn(
        '[Sync] Conversations index rebuild had errors:',
        rebuildResult.conversations.errors,
      );
    }

    // 重新加载缓存
    await storageManager.reloadAllCaches();

    // 同步完成后通知渲染进程刷新数据
    event.sender.send('sync:completed', result);

    // 同步完成后，通知主窗口刷新列表
    if (win && !win.isDestroyed()) {
      win.webContents.send('sync:dataChanged');
    }

    return result;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(`同步失败：${msg}`);
  }
});

/**
 * 获取同步预览（不实际执行同步）
 */
ipcMain.handle('sync:preview', async (_, providerId: string, config: any) => {
  try {
    if (providerId !== 'webdav') {
      throw new Error(`Unknown provider: ${providerId}`);
    }
    const storagePath = storageManager.getCurrentPath();
    return await syncManager.preview(config, storagePath);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(`预览失败：${msg}`);
  }
});

/**
 * 获取同步配置
 */
ipcMain.handle('sync:getConfig', async (_, providerId: string) => {
  return await syncManager.getConfig(providerId);
});

/**
 * 保存同步配置
 */
ipcMain.handle('sync:setConfig', async (_, providerId: string, config: any) => {
  await syncManager.setConfig(providerId, config);
});

// ============ AI IPC 处理器 ============

/**
 * 获取 AI 配置
 */
ipcMain.handle('ai:getConfig', async () => {
  return await readAIConfig();
});

/**
 * 保存 AI 配置
 */
ipcMain.handle('ai:setConfig', async (_, config: AIConfig) => {
  await writeAIConfig(config);
});

/**
 * 测试 AI 连接
 */
ipcMain.handle('ai:testConnection', async () => {
  try {
    const config = await readAIConfig();
    if (!config) {
      return { ok: false, message: '未找到 AI 配置，请先设置' };
    }
    const adapter = createAdapter(config);
    return await adapter.testConnection();
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { ok: false, message: `连接测试失败：${msg}` };
  }
});

/**
 * 发送 AI 聊天请求（非流式）
 */
ipcMain.handle('ai:chat', async (_, payload: ChatPayload) => {
  try {
    const config = await readAIConfig();
    if (!config) {
      throw new Error('未找到 AI 配置，请先在设置中配置 AI');
    }
    const adapter = createAdapter(config);
    const response = await adapter.chat(payload);
    return { success: true, content: response.content };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { success: false, error: msg };
  }
});

/**
 * 发送 AI 聊天请求（流式）
 * 逐段通过 ai:stream:chunk 事件回传
 */
ipcMain.handle('ai:chatStream', async (event, payload: ChatPayload) => {
  try {
    const config = await readAIConfig();
    if (!config) {
      throw new Error('未找到 AI 配置，请先在设置中配置 AI');
    }
    const adapter = createAdapter(config);

    (async () => {
      try {
        for await (const chunk of adapter.chatStream(payload)) {
          event.sender.send('ai:stream:chunk', chunk);
        }
        event.sender.send('ai:stream:done', { success: true });
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        event.sender.send('ai:stream:error', { error: msg });
      }
    })();

    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { success: false, error: msg };
  }
});

// ============ 统一配置 IPC 处理器 ============

/**
 * 获取完整配置
 */
ipcMain.handle('app:getConfig', () => {
  return readAppConfig();
});

/**
 * 更新配置（深度合并 + 广播）
 */
ipcMain.handle('app:setConfig', (_, partial: DeepPartial<AppConfig>) => {
  writeAppConfig(partial);
  const newConfig = readAppConfig();
  // 广播给所有窗口
  BrowserWindow.getAllWindows().forEach((w) => {
    w.webContents.send('app:configChanged', newConfig);
  });
  return newConfig;
});

/**
 * 获取配置文件路径
 */
ipcMain.handle('app:getConfigPath', () => {
  return getConfigPath();
});

// ============ 知识库 IPC 处理器 ============

import {
  readKnowledgeConfig,
  writeKnowledgeConfig,
  createEmbeddingService,
  type EmbeddingConfig,
} from './knowledge';

/**
 * 获取知识库配置
 */
ipcMain.handle('knowledge:getConfig', async () => {
  return await readKnowledgeConfig();
});

/**
 * 设置知识库配置
 */
ipcMain.handle(
  'knowledge:setConfig',
  async (
    _,
    config: {
      enabled: boolean;
      embedding?: EmbeddingConfig;
    },
  ) => {
    await writeKnowledgeConfig(config);
  },
);

/**
 * 测试 Embedding 连接
 */
ipcMain.handle(
  'knowledge:testEmbedding',
  async (
    _,
    config: {
      baseURL: string;
      apiKey: string;
      model: string;
      dimensions?: number;
    },
  ) => {
    try {
      const embeddingConfig: EmbeddingConfig = {
        provider: 'test',
        baseURL: config.baseURL,
        apiKey: config.apiKey,
        model: config.model,
        dimensions: config.dimensions,
        timeoutMs: 30000,
      };
      const service = createEmbeddingService(embeddingConfig);
      const result = await service.testConnection();
      return result;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { ok: false, message: `测试失败: ${msg}` };
    }
  },
);

/**
 * 重建索引
 */
ipcMain.handle('knowledge:rebuildIndex', async () => {
  const { rebuildAllIndex } = await import('./knowledge');
  return await rebuildAllIndex();
});

/**
 * 获取知识库统计
 */
ipcMain.handle('knowledge:getStats', async () => {
  const { getIndexStats } = await import('./knowledge');
  return getIndexStats();
});

/**
 * 语义搜索
 */
ipcMain.handle('knowledge:search', async (_, query: string, topK?: number) => {
  const { semanticSearch } = await import('./knowledge');
  return await semanticSearch(query, topK ?? 3);
});
