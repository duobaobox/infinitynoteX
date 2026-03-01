/**
 * Main Window Module
 * 主窗口管理 - 从 main.ts 抽离
 */

import { BrowserWindow, ipcMain } from 'electron';
import type { BrowserWindowConstructorOptions } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { IPC_CHANNELS } from '../../src/shared/types/ipc';
import { readAppConfig, writeAppConfig } from '../config';

// 计算绝对路径（ESM 没有 __dirname）
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 导出路径常量
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'];
export const MAIN_DIST = path.join(__dirname, '..', 'dist-electron');
export const RENDERER_DIST = path.join(__dirname, '..', 'dist');

// 主窗口实例
let win: BrowserWindow | null = null;
let isQuitting = false;

/**
 * 获取主窗口实例
 */
export function getMainWindow(): BrowserWindow | null {
  return win;
}

/**
 * 设置应用退出标志
 */
export function setQuitting(value: boolean): void {
  isQuitting = value;
}

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
export function saveWindowState(): void {
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
    console.error('[MainWindow] Failed to save window state:', error);
  }
}

/**
 * 创建主窗口
 */
export function createMainWindow(): BrowserWindow {
  // 加载保存的窗口状态（从统一配置）
  const savedState = loadWindowState();

  const windowOptions: BrowserWindowConstructorOptions = {
    width: savedState.width || 700,
    height: savedState.height || 560,
    x: savedState.x,
    y: savedState.y,
    minWidth: 700,
    minHeight: 560,
    icon: path.join(process.env.VITE_PUBLIC ?? '', 'electron-vite.svg'),
    frame: false,
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 12, y: 10 },
    // Windows/Linux: 隐藏菜单栏（macOS 不受影响）
    autoHideMenuBar: true,
    show: false,
    backgroundColor: '#FFFFFF',
    webPreferences: {
      preload: path.join(MAIN_DIST, 'preload.mjs'),
      webviewTag: true,
    },
  };

  win = new BrowserWindow(windowOptions);

  // 广播窗口最大化状态，供渲染进程更新 UI
  const emitWindowStateChanged = () => {
    if (!win || win.isDestroyed()) return;
    win.webContents.send(IPC_CHANNELS.windowStateChanged, win.isMaximized());
  };

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send(IPC_CHANNELS.mainProcessMessage, new Date().toLocaleString());
    emitWindowStateChanged();
  });

  win.on('maximize', emitWindowStateChanged);
  win.on('unmaximize', emitWindowStateChanged);

  // 准备好再显示窗口，减少"半秒加载感"
  win.once('ready-to-show', () => {
    win?.show();
    // 如果之前窗口是最大化的，恢复最大化状态
    if (savedState.isMaximized) {
      win?.maximize();
    }
  });

  // 在 macOS 上，点击关闭按钮仅隐藏窗口
  win.on('close', (e) => {
    if (process.platform === 'darwin' && !isQuitting) {
      e.preventDefault();
      win?.hide();
      return;
    }
    saveWindowState();
    win = null;
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'));
  }

  return win;
}

/**
 * 注册主窗口相关 IPC 处理器
 */
export function registerMainWindowHandlers(): void {
  // 窗口控制
  ipcMain.on(IPC_CHANNELS.windowMinimize, () => {
    win?.minimize();
  });

  ipcMain.on(IPC_CHANNELS.windowMaximize, () => {
    if (win) {
      if (win.isMaximized()) {
        win.unmaximize();
      } else {
        win.maximize();
      }
    }
  });

  ipcMain.on(IPC_CHANNELS.windowUnmaximize, () => {
    win?.unmaximize();
  });

  ipcMain.on(IPC_CHANNELS.windowClose, () => {
    if (!win) return;
    if (process.platform === 'darwin') {
      win.hide();
    } else {
      win.close();
    }
  });

  ipcMain.handle(IPC_CHANNELS.windowIsMaximized, () => {
    return win?.isMaximized() ?? false;
  });

  ipcMain.handle(IPC_CHANNELS.windowReload, () => {
    win?.webContents.reload();
  });

  ipcMain.on(IPC_CHANNELS.windowDoubleClickTitlebar, () => {
    if (win) {
      if (win.isMaximized()) {
        win.unmaximize();
      } else {
        win.maximize();
      }
    }
  });
}
