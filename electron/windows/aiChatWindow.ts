/**
 * AI Chat Window Module
 * AI 对话悬浮窗口管理 - 从 main.ts 抽离
 */

import { BrowserWindow, ipcMain, screen } from 'electron';
import path from 'node:path';
import { IPC_CHANNELS } from '../../src/shared/types/ipc';
import { readAppConfig, writeAppConfig } from '../config';
import log from '../logger';
import { VITE_DEV_SERVER_URL, RENDERER_DIST, MAIN_DIST } from './mainWindow';

// AI 对话悬浮窗口实例
let aiChatWindow: BrowserWindow | null = null;

/**
 * 获取 AI 对话窗口实例
 */
export function getAIChatWindow(): BrowserWindow | null {
  return aiChatWindow;
}

/**
 * 创建 AI 对话悬浮窗口
 */
export function createAIChatWindow(): void {
  try {
    if (aiChatWindow && !aiChatWindow.isDestroyed()) {
      log.info('AI chat window already exists, showing it');
      aiChatWindow.show();
      aiChatWindow.focus();
      return;
    }

    log.info('Creating new AI chat window');

    // 获取当前鼠标所在屏幕，支持多显示器
    const cursorPoint = screen.getCursorScreenPoint();
    const currentScreen = screen.getDisplayNearestPoint(cursorPoint);
    const {
      width: screenWidth,
      height: screenHeight,
      x: screenX,
      y: screenY,
    } = currentScreen.workArea;

    log.info('Screen info', { screenWidth, screenHeight, screenX, screenY });

    // 读取保存的窗口配置
    const config = readAppConfig();
    const savedBounds = config.aiChatWindow;

    // 默认窗口尺寸
    const windowWidth = 420;
    const windowHeight = 600;

    // 默认位置：屏幕右侧，留 20px 边距
    let x = savedBounds?.x ?? screenX + screenWidth - windowWidth - 20;
    let y = savedBounds?.y ?? screenY + (screenHeight - windowHeight) / 2;

    // 如果有保存的位置，使用保存的位置（但确保在当前屏幕内）
    if (savedBounds) {
      x = Math.max(screenX, Math.min(savedBounds.x, screenX + screenWidth - windowWidth));
      y = Math.max(screenY, Math.min(savedBounds.y, screenY + screenHeight - windowHeight));
    }

    log.info('Window position', {
      x,
      y,
      width: savedBounds?.width ?? windowWidth,
      height: savedBounds?.height ?? windowHeight,
    });

    aiChatWindow = new BrowserWindow({
      width: savedBounds?.width ?? windowWidth,
      height: savedBounds?.height ?? windowHeight,
      x,
      y,
      minWidth: 380,
      minHeight: 400,
      frame: false,
      transparent: false,
      hasShadow: true,
      alwaysOnTop: true,
      resizable: true,
      show: false,
      backgroundColor: '#ffffff',
      webPreferences: {
        preload: path.join(MAIN_DIST, 'preload.mjs'),
        webviewTag: true,
      },
    });

    log.info('BrowserWindow created');

    // 加载 AI 对话窗口页面
    if (VITE_DEV_SERVER_URL) {
      const url = `${VITE_DEV_SERVER_URL}#/ai-chat-window`;
      log.info('Loading URL', { url });
      aiChatWindow.loadURL(url);
    } else {
      log.info('Loading file');
      aiChatWindow.loadFile(path.join(RENDERER_DIST, 'index.html'), {
        hash: '/ai-chat-window',
      });
    }

    // 准备好后显示
    aiChatWindow.once('ready-to-show', () => {
      log.info('AI chat window ready to show');
      aiChatWindow?.show();
    });

    // 窗口移动或调整大小时保存状态（使用防抖避免频繁写入）
    let saveTimer: ReturnType<typeof setTimeout> | null = null;
    const saveAIChatWindowState = () => {
      if (saveTimer) {
        clearTimeout(saveTimer);
      }
      saveTimer = setTimeout(() => {
        if (aiChatWindow && !aiChatWindow.isDestroyed()) {
          const bounds = aiChatWindow.getBounds();
          const config = readAppConfig();
          writeAppConfig({
            ...config,
            aiChatWindow: {
              width: bounds.width,
              height: bounds.height,
              x: bounds.x,
              y: bounds.y,
            },
          });
        }
      }, 500);
    };

    aiChatWindow.on('moved', saveAIChatWindowState);
    aiChatWindow.on('resized', saveAIChatWindowState);

    // 窗口关闭时清理
    aiChatWindow.on('closed', () => {
      log.info('AI chat window closed');
      aiChatWindow = null;
    });

    log.info('AI chat window created successfully');
  } catch (error) {
    log.error('Failed to create AI chat window', error);
  }
}

/**
 * 显示/隐藏 AI 对话窗口
 */
export function toggleAIChatWindow(): void {
  if (aiChatWindow && !aiChatWindow.isDestroyed()) {
    if (aiChatWindow.isVisible()) {
      aiChatWindow.hide();
    } else {
      aiChatWindow.show();
      aiChatWindow.focus();
    }
  } else {
    createAIChatWindow();
  }
}

/**
 * 注册 AI 对话窗口相关 IPC 处理器
 */
export function registerAIChatWindowHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.aiChatWindowShow, () => {
    log.info('Show AI chat window requested');
    createAIChatWindow();
  });

  ipcMain.handle(IPC_CHANNELS.aiChatWindowHide, () => {
    log.info('Hide AI chat window requested');
    if (aiChatWindow && !aiChatWindow.isDestroyed()) {
      aiChatWindow.hide();
    }
  });

  ipcMain.handle(IPC_CHANNELS.aiChatWindowToggle, () => {
    log.info('Toggle AI chat window requested');
    toggleAIChatWindow();
  });
}
