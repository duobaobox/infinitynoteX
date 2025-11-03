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
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  });

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', new Date().toLocaleString());
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
  if (BrowserWindow.getAllWindows().length === 0) {
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
  if (win) {
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
