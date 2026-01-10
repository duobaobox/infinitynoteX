/**
 * Floating Window Module
 * 悬浮窗口管理（便签 + Todo）- 从 main.ts 抽离
 */

import { BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import { VITE_DEV_SERVER_URL, RENDERER_DIST, MAIN_DIST, getMainWindow } from './mainWindow';

// ============ 类型定义 ============

interface StoredBounds {
  width: number;
  height: number;
  x: number;
  y: number;
}

// ============ 常量 ============

const PILL_SIZE = { width: 130, height: 48 };
const TODO_FLOATING_SIZE = { width: 320, height: 400 };
const TODO_PILL_SIZE = { width: 130, height: 48 };

// ============ 状态管理 ============

// 便签悬浮窗口
const floatingWindows = new Map<string, BrowserWindow>();
const pillWindows = new Map<string, BrowserWindow>();
const minimizedBounds = new Map<string, StoredBounds>();

// Todo 悬浮窗口
const floatingTodoWindows = new Map<string, BrowserWindow>();
const todoPillWindows = new Map<string, BrowserWindow>();
const todoMinimizedBounds = new Map<string, StoredBounds>();

// 默认悬浮窗口大小
let defaultFloatingWindowSize = { width: 400, height: 400 };

// ============ 公共 API ============

export function getDefaultFloatingWindowSize() {
  return defaultFloatingWindowSize;
}

export function setDefaultFloatingWindowSize(size: { width: number; height: number }) {
  defaultFloatingWindowSize = size;
}

export function getFloatingNoteWindows() {
  return floatingWindows;
}

export function getFloatingTodoWindows() {
  return floatingTodoWindows;
}

// ============ 便签悬浮窗口操作 ============

async function createFloatingNoteWindow(noteId: string) {
  if (floatingWindows.has(noteId)) {
    const existing = floatingWindows.get(noteId);
    if (existing && !existing.isDestroyed()) {
      existing.focus();
      return { success: true, message: '窗口已存在' };
    }
  }

  const floatingWindow = new BrowserWindow({
    width: defaultFloatingWindowSize.width,
    height: defaultFloatingWindowSize.height,
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
      preload: path.join(MAIN_DIST, 'preload.mjs'),
    },
  });

  if (VITE_DEV_SERVER_URL) {
    floatingWindow.loadURL(`${VITE_DEV_SERVER_URL}#/floating/${noteId}`);
  } else {
    floatingWindow.loadFile(path.join(RENDERER_DIST, 'index.html'), {
      hash: `/floating/${noteId}`,
    });
  }

  floatingWindow.once('ready-to-show', () => floatingWindow.show());
  floatingWindow.on('closed', () => floatingWindows.delete(noteId));
  floatingWindows.set(noteId, floatingWindow);

  return { success: true, message: '创建成功' };
}

async function minimizeFloatingNoteWindow(noteId: string) {
  const floatingWin = floatingWindows.get(noteId);
  if (!floatingWin || floatingWin.isDestroyed()) {
    return { success: false, message: '窗口不存在' };
  }

  const bounds = floatingWin.getBounds();
  minimizedBounds.set(noteId, bounds);

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
      preload: path.join(MAIN_DIST, 'preload.mjs'),
    },
  });

  if (VITE_DEV_SERVER_URL) {
    pillWindow.loadURL(`${VITE_DEV_SERVER_URL}#/pill/${noteId}`);
  } else {
    pillWindow.loadFile(path.join(RENDERER_DIST, 'index.html'), {
      hash: `/pill/${noteId}`,
    });
  }

  pillWindow.once('ready-to-show', () => {
    pillWindow.show();
    floatingWin.close();
  });
  pillWindow.on('closed', () => pillWindows.delete(noteId));
  pillWindows.set(noteId, pillWindow);

  return { success: true };
}

async function restoreFloatingNoteWindow(noteId: string) {
  const pillWin = pillWindows.get(noteId);
  if (!pillWin || pillWin.isDestroyed()) {
    return { success: false, message: '药丸窗口不存在' };
  }

  const stored = minimizedBounds.get(noteId);
  if (!stored) {
    return { success: false, message: '未找到保存的窗口尺寸' };
  }

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
      preload: path.join(MAIN_DIST, 'preload.mjs'),
    },
  });

  if (VITE_DEV_SERVER_URL) {
    floatingWindow.loadURL(`${VITE_DEV_SERVER_URL}#/floating/${noteId}`);
  } else {
    floatingWindow.loadFile(path.join(RENDERER_DIST, 'index.html'), {
      hash: `/floating/${noteId}`,
    });
  }

  floatingWindow.once('ready-to-show', () => {
    floatingWindow.show();
    pillWin.close();
  });
  floatingWindow.on('closed', () => floatingWindows.delete(noteId));
  floatingWindows.set(noteId, floatingWindow);
  minimizedBounds.delete(noteId);

  return { success: true };
}

async function closeFloatingNoteWindow(noteId: string) {
  const floatingWindow = floatingWindows.get(noteId);
  if (floatingWindow && !floatingWindow.isDestroyed()) {
    floatingWindow.close();
    floatingWindows.delete(noteId);
    return { success: true };
  }
  return { success: false, message: '窗口不存在' };
}

function listFloatingNoteWindows() {
  return Array.from(floatingWindows.keys()).filter((noteId) => {
    const window = floatingWindows.get(noteId);
    return window && !window.isDestroyed();
  });
}

// ============ Todo 悬浮窗口操作 ============

async function createFloatingTodoWindow(listId: string) {
  if (floatingTodoWindows.has(listId)) {
    const existing = floatingTodoWindows.get(listId);
    if (existing && !existing.isDestroyed()) {
      existing.focus();
      return { success: true, message: '窗口已存在' };
    }
  }

  const floatingWindow = new BrowserWindow({
    width: TODO_FLOATING_SIZE.width,
    height: TODO_FLOATING_SIZE.height,
    minWidth: 280,
    minHeight: 300,
    frame: false,
    transparent: false,
    hasShadow: true,
    alwaysOnTop: true,
    resizable: true,
    show: false,
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: path.join(MAIN_DIST, 'preload.mjs'),
    },
  });

  if (VITE_DEV_SERVER_URL) {
    floatingWindow.loadURL(`${VITE_DEV_SERVER_URL}#/floating-todo/${listId}`);
  } else {
    floatingWindow.loadFile(path.join(RENDERER_DIST, 'index.html'), {
      hash: `/floating-todo/${listId}`,
    });
  }

  floatingWindow.once('ready-to-show', () => floatingWindow.show());
  floatingWindow.on('closed', () => floatingTodoWindows.delete(listId));
  floatingTodoWindows.set(listId, floatingWindow);

  return { success: true, message: '创建成功' };
}

async function closeFloatingTodoWindow(listId: string) {
  const floatingWindow = floatingTodoWindows.get(listId);
  if (floatingWindow && !floatingWindow.isDestroyed()) {
    floatingWindow.close();
    floatingTodoWindows.delete(listId);
    return { success: true };
  }
  return { success: false, message: '窗口不存在' };
}

async function minimizeFloatingTodoWindow(listId: string) {
  const floatingWin = floatingTodoWindows.get(listId);
  if (!floatingWin || floatingWin.isDestroyed()) {
    return { success: false, message: '窗口不存在' };
  }

  const bounds = floatingWin.getBounds();
  todoMinimizedBounds.set(listId, bounds);

  const pillWindow = new BrowserWindow({
    width: TODO_PILL_SIZE.width,
    height: TODO_PILL_SIZE.height,
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
      preload: path.join(MAIN_DIST, 'preload.mjs'),
    },
  });

  if (VITE_DEV_SERVER_URL) {
    pillWindow.loadURL(`${VITE_DEV_SERVER_URL}#/todo-pill/${listId}`);
  } else {
    pillWindow.loadFile(path.join(RENDERER_DIST, 'index.html'), {
      hash: `/todo-pill/${listId}`,
    });
  }

  pillWindow.once('ready-to-show', () => {
    pillWindow.show();
    floatingWin.close();
  });
  pillWindow.on('closed', () => todoPillWindows.delete(listId));
  todoPillWindows.set(listId, pillWindow);

  return { success: true };
}

async function restoreFloatingTodoWindow(listId: string) {
  const pillWin = todoPillWindows.get(listId);
  if (!pillWin || pillWin.isDestroyed()) {
    return { success: false, message: '药丸窗口不存在' };
  }

  const stored = todoMinimizedBounds.get(listId);
  if (!stored) {
    return { success: false, message: '未找到保存的窗口尺寸' };
  }

  const floatingWindow = new BrowserWindow({
    width: stored.width,
    height: stored.height,
    x: stored.x,
    y: stored.y,
    minWidth: 280,
    minHeight: 300,
    frame: false,
    transparent: false,
    hasShadow: true,
    alwaysOnTop: true,
    resizable: true,
    show: false,
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: path.join(MAIN_DIST, 'preload.mjs'),
    },
  });

  if (VITE_DEV_SERVER_URL) {
    floatingWindow.loadURL(`${VITE_DEV_SERVER_URL}#/floating-todo/${listId}`);
  } else {
    floatingWindow.loadFile(path.join(RENDERER_DIST, 'index.html'), {
      hash: `/floating-todo/${listId}`,
    });
  }

  floatingWindow.once('ready-to-show', () => {
    floatingWindow.show();
    pillWin.close();
  });
  floatingWindow.on('closed', () => floatingTodoWindows.delete(listId));
  floatingTodoWindows.set(listId, floatingWindow);
  todoMinimizedBounds.delete(listId);

  return { success: true };
}

function listFloatingTodoWindows() {
  return Array.from(floatingTodoWindows.keys()).filter((listId) => {
    const window = floatingTodoWindows.get(listId);
    return window && !window.isDestroyed();
  });
}

// ============ IPC 处理器注册 ============

export function registerFloatingWindowHandlers(): void {
  // 便签悬浮窗口
  ipcMain.handle('floating:createWindow', (_, noteId: string) => createFloatingNoteWindow(noteId));
  ipcMain.handle('floating:minimizeWindow', (_, noteId: string) =>
    minimizeFloatingNoteWindow(noteId),
  );
  ipcMain.handle('floating:restoreWindow', (_, noteId: string) =>
    restoreFloatingNoteWindow(noteId),
  );
  ipcMain.handle('floating:closeWindow', (_, noteId: string) => closeFloatingNoteWindow(noteId));
  ipcMain.handle('floating:listWindows', () => listFloatingNoteWindows());

  // Todo 悬浮窗口
  ipcMain.handle('floatingTodo:createWindow', (_, listId: string) =>
    createFloatingTodoWindow(listId),
  );
  ipcMain.handle('floatingTodo:closeWindow', (_, listId: string) =>
    closeFloatingTodoWindow(listId),
  );
  ipcMain.handle('floatingTodo:minimizeWindow', (_, listId: string) =>
    minimizeFloatingTodoWindow(listId),
  );
  ipcMain.handle('floatingTodo:restoreWindow', (_, listId: string) =>
    restoreFloatingTodoWindow(listId),
  );
  ipcMain.handle('floatingTodo:listWindows', () => listFloatingTodoWindows());

  // 配置相关
  ipcMain.handle('config:getDefaultFloatingWindowSize', () => defaultFloatingWindowSize);
  ipcMain.handle(
    'config:setDefaultFloatingWindowSize',
    (_, config: { width: number; height: number }) => {
      if (config.width && config.height) {
        defaultFloatingWindowSize = { width: config.width, height: config.height };
      }
    },
  );

  // 跨窗口消息转发
  ipcMain.on('note:changed', (_event, noteId: string) => {
    const pillWindow = pillWindows.get(noteId);
    if (pillWindow && !pillWindow.isDestroyed()) {
      pillWindow.webContents.send('note:updated', noteId);
    }

    const floatingWindow = floatingWindows.get(noteId);
    if (floatingWindow && !floatingWindow.isDestroyed()) {
      floatingWindow.webContents.send('note:updated', noteId);
    }

    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send('note:updated', noteId);
    }
  });

  ipcMain.on('floating-note:changed', (_event, noteId: string) => {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send('floating-note:updated', noteId);
    }
  });

  ipcMain.on('todo:changed', (_event, listId: string) => {
    const floatingWindow = floatingTodoWindows.get(listId);
    if (floatingWindow && !floatingWindow.isDestroyed()) {
      floatingWindow.webContents.send('todo:updated', listId);
    }

    const pillWindow = todoPillWindows.get(listId);
    if (pillWindow && !pillWindow.isDestroyed()) {
      pillWindow.webContents.send('todo:updated', listId);
    }

    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send('todo:updated', listId);
    }
  });
}
