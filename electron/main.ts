import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import type {
  SetStoragePathOptions,
  CreateNotePayload,
  UpdateNotePayload,
} from '../src/services/types';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { storageManager } from './storage';

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

function createWindow() {
  win = new BrowserWindow({
    width: 700, // 默认宽度
    height: 560, // 默认高度
    minWidth: 700, // 最小宽度
    minHeight: 560, // 最小高度
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    frame: false, // 隐藏默认标题栏
    titleBarStyle: 'hidden', // 隐藏标题栏但保留拖拽区域
    trafficLightPosition: { x: 12, y: 10 }, // macOS 红绿黄按钮位置（不会显示因为 frame: false）
    show: false, // 等待渲染就绪再展示，避免白屏闪烁
    backgroundColor: '#FFFFFF', // 统一背景色，提升初次展示观感
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  });

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', new Date().toLocaleString());
  });

  // 准备好再显示窗口，减少“半秒加载感”
  win.once('ready-to-show', () => {
    win?.show();
  });

  // 在 macOS 上，点击关闭按钮仅隐藏窗口，避免每次重新创建导致页面重载
  win.on('close', (e) => {
    if (process.platform === 'darwin' && !isQuitting) {
      e.preventDefault();
      win?.hide();
      return;
    }
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
});

app.whenReady().then(async () => {
  // 初始化存储
  await storageManager.initialize();

  createWindow();
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

// ============ 系统对话框 IPC 处理器 ============

ipcMain.handle('dialog:showOpenDialog', async (_, options: Electron.OpenDialogOptions) => {
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
    transparent: true, // 透明窗口，便于实现药丸裁剪
    hasShadow: true,
    alwaysOnTop: true, // 始终置顶
    resizable: true,
    show: false,
    backgroundColor: '#00000000', // 完全透明背景
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
    transparent: true,
    hasShadow: true,
    alwaysOnTop: true,
    resizable: false,
    show: false,
    backgroundColor: '#00000000',
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
    transparent: true,
    hasShadow: true,
    alwaysOnTop: true,
    resizable: true,
    show: false,
    backgroundColor: '#00000000',
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
