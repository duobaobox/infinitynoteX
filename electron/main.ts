/**
 * InfinityNoteX - Main Process
 * 重构后的入口文件：职责分离，使用模块化架构
 *
 * Phase 1: 窗口管理模块化 ✅
 * Phase 2: IPC Handlers 模块化 ✅
 */

import { app, BrowserWindow, protocol, net, globalShortcut } from 'electron';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { storageManager } from './storage';
import { initAutoUpdater } from './updater';
import { readAppConfig, migrateFromLegacyConfigs } from './config';
import log from './logger';

// ============ 导入窗口模块 ============
import {
  createMainWindow,
  getMainWindow,
  saveWindowState,
  setQuitting,
  registerMainWindowHandlers,
  VITE_DEV_SERVER_URL,
  RENDERER_DIST,
} from './windows/mainWindow';
import { toggleAIChatWindow, registerAIChatWindowHandlers } from './windows/aiChatWindow';
import { registerFloatingWindowHandlers } from './windows/floatingWindow';
import { registerWebviewSecurity } from './windows/webviewSecurity';

// ============ 导入 IPC 模块 ============
import {
  registerLogHandlers,
  registerStorageHandlers,
  registerSyncHandlers,
  registerAIHandlers,
  registerConfigHandlers,
  registerKnowledgeHandlers,
} from './ipc';
import { syncNativeTheme } from './nativeTheme';
import { setupApplicationMenu } from './menu';

// 启用 Chromium 内核的自动暗黑模式生成（针对不支持 dark mode 的网页）
// 配合 nativeTheme.themeSource 使用
app.commandLine.appendSwitch('enable-features', 'WebContentsForceDark');
registerWebviewSecurity();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The built directory structure
process.env.APP_ROOT = path.join(__dirname, '..');
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST;

// ============ App 生命周期 ============

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  const win = getMainWindow();
  if (win) {
    win.show();
  } else if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});

// 单例锁
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const win = getMainWindow();
    if (win) {
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
    }
  });
}

app.on('before-quit', async () => {
  // 阻止退出，直到我们完成清理（虽然 before-quit 不支持 async wait, 但我们可以尽量同步或只触发）
  // 实际上 Electron 这里的行为有点复杂，为了简化，我们尽量快速执行
  setQuitting(true);
  saveWindowState();
  globalShortcut.unregisterAll();

  // 清理运行标记
  await storageManager.handleShutdown();
});

// ============ 注册自定义协议 attachment:// ============
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
      const id = url.hostname || url.pathname.replace(/^\//, '');
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

  // 从旧配置文件迁移
  await migrateFromLegacyConfigs();

  // 初始化存储
  await storageManager.initialize();
  await storageManager.performStartupChecks();

  // 注册所有 IPC 处理器
  // 窗口相关
  registerMainWindowHandlers();
  registerAIChatWindowHandlers();
  registerFloatingWindowHandlers();
  // IPC 处理器
  registerLogHandlers();
  registerStorageHandlers();
  registerSyncHandlers();
  registerAIHandlers();
  registerConfigHandlers();
  registerKnowledgeHandlers();

  // 创建主窗口
  createMainWindow();
  initAutoUpdater(() => getMainWindow());

  // 设置应用菜单（macOS 最小化菜单，Windows/Linux 隐藏）
  setupApplicationMenu();

  // 初始化 Native Theme
  syncNativeTheme();

  // 注册全局快捷键
  const config = readAppConfig();
  const shortcut = config.shortcutKeys?.aiChatWindow || 'CommandOrControl+Shift+Q';
  const registered = globalShortcut.register(shortcut, () => {
    log.info('Global shortcut triggered', { shortcut });
    toggleAIChatWindow();
  });

  if (registered) {
    log.info('Global shortcut registered', { shortcut });
  } else {
    log.warn('Failed to register global shortcut', { shortcut });
  }

  log.info('App started', { version: app.getVersion() });
});
