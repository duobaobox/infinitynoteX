import { ipcRenderer, contextBridge } from 'electron';
import type { OpenDialogOptions } from '../src/services/types';
import { IPC_CHANNELS, IPC_PROXY_METHODS } from '../src/shared/types/ipc';
import { createProxy } from '../src/shared/utils/ipcProxy';

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('ipcRenderer', {
  on(...args: Parameters<typeof ipcRenderer.on>) {
    // 直接传递原始 listener，不包装，确保 off 时能用相同引用解绑
    const [channel, listener] = args;
    return ipcRenderer.on(channel, listener);
  },
  off(...args: Parameters<typeof ipcRenderer.off>) {
    const [channel, ...omit] = args;
    return ipcRenderer.off(channel, ...omit);
  },
  send(...args: Parameters<typeof ipcRenderer.send>) {
    const [channel, ...omit] = args;
    return ipcRenderer.send(channel, ...omit);
  },
  invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
    const [channel, ...omit] = args;
    return ipcRenderer.invoke(channel, ...omit);
  },
});

// --------- Expose window control API ---------
contextBridge.exposeInMainWorld('electronAPI', {
  minimize: () => ipcRenderer.send(IPC_CHANNELS.windowMinimize),
  maximize: () => ipcRenderer.send(IPC_CHANNELS.windowMaximize),
  unmaximize: () => ipcRenderer.send(IPC_CHANNELS.windowUnmaximize),
  close: () => ipcRenderer.send(IPC_CHANNELS.windowClose),
  isMaximized: () => ipcRenderer.invoke(IPC_CHANNELS.windowIsMaximized),
  reload: () => ipcRenderer.invoke(IPC_CHANNELS.windowReload),
  onWindowStateChanged: (callback: (isMaximized: boolean) => void) => {
    ipcRenderer.on(IPC_CHANNELS.windowStateChanged, (_event, isMaximized: boolean) => {
      callback(isMaximized);
    });
  },
  showOpenDialog: (options: OpenDialogOptions) =>
    ipcRenderer.invoke(IPC_CHANNELS.dialogShowOpen, options),

  // AI 对话悬浮窗口
  showAIChatWindow: () => ipcRenderer.invoke(IPC_CHANNELS.aiChatWindowShow),
  hideAIChatWindow: () => ipcRenderer.invoke(IPC_CHANNELS.aiChatWindowHide),
  toggleAIChatWindow: () => ipcRenderer.invoke(IPC_CHANNELS.aiChatWindowToggle),
});

// --------- Expose storage API ---------
contextBridge.exposeInMainWorld(
  'storage',
  createProxy(ipcRenderer, 'storage', IPC_PROXY_METHODS.storage),
);

// --------- Expose storage events API ---------
contextBridge.exposeInMainWorld('storageEvents', {
  /**
   * 监听存储事件（创建、更新、删除）
   * @returns 取消监听的函数
   */
  onEvent: (
    callback: (event: {
      type: 'created' | 'updated' | 'deleted';
      entity: 'note' | 'aiConversation' | 'folder' | 'trash';
      id: string;
      data?: unknown;
    }) => void,
  ) => {
    const listener = (
      _: Electron.IpcRendererEvent,
      event: {
        type: 'created' | 'updated' | 'deleted';
        entity: 'note' | 'aiConversation' | 'folder' | 'trash';
        id: string;
        data?: unknown;
      },
    ) => callback(event);
    ipcRenderer.on(IPC_CHANNELS.storageEvent, listener);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.storageEvent, listener);
    };
  },
});

// --------- Expose floating window API ---------
contextBridge.exposeInMainWorld(
  'floatingWindow',
  createProxy(ipcRenderer, 'floating', IPC_PROXY_METHODS.floating),
);

// --------- Expose floating todo window API ---------
contextBridge.exposeInMainWorld(
  'floatingTodo',
  createProxy(ipcRenderer, 'floatingTodo', IPC_PROXY_METHODS.floatingTodo),
);

// --------- Expose auto-updater API (Manual due to naming mismatch) ---------
contextBridge.exposeInMainWorld('autoUpdater', {
  checkForUpdates: () => ipcRenderer.invoke(IPC_CHANNELS.updaterCheckNow),
  installUpdate: () => ipcRenderer.invoke(IPC_CHANNELS.updaterInstallNow),
  getLastStatus: () => ipcRenderer.invoke(IPC_CHANNELS.updaterLastStatus),
  onStatusChange: (callback: (status: unknown) => void) => {
    const listener = (_event: unknown, status: unknown) => {
      callback(status);
    };
    ipcRenderer.on(IPC_CHANNELS.updaterStatus, listener);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.updaterStatus, listener);
  },
});

// --------- Expose app info API (Manual) ---------
contextBridge.exposeInMainWorld('appInfo', {
  getVersion: () => ipcRenderer.invoke(IPC_CHANNELS.appGetVersion),
});

// --------- Expose Browser Cards API ---------
contextBridge.exposeInMainWorld(
  'browserCards',
  createProxy(ipcRenderer, 'browserCards', IPC_PROXY_METHODS.browserCards),
);

// --------- Expose Attachments API ---------
contextBridge.exposeInMainWorld(
  'attachments',
  createProxy(ipcRenderer, 'attachments', IPC_PROXY_METHODS.attachments),
);

// --------- Expose AI API ---------
contextBridge.exposeInMainWorld(
  'ai',
  createProxy(ipcRenderer, 'ai', IPC_PROXY_METHODS.ai, {
    onStreamChunk: (callback: (data: unknown) => void) => {
      const listener = (_: unknown, data: unknown) => callback(data);
      ipcRenderer.on(IPC_CHANNELS.aiStreamChunk, listener);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.aiStreamChunk, listener);
    },
    onStreamDone: (callback: (data: unknown) => void) => {
      const listener = (_: unknown, data: unknown) => callback(data);
      ipcRenderer.on(IPC_CHANNELS.aiStreamDone, listener);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.aiStreamDone, listener);
    },
    onStreamError: (callback: (error: unknown) => void) => {
      const listener = (_: unknown, data: unknown) => callback(data);
      ipcRenderer.on(IPC_CHANNELS.aiStreamError, listener);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.aiStreamError, listener);
    },
    onToolApprovalRequest: (callback: (data: unknown) => void) => {
      const listener = (_: unknown, data: unknown) => callback(data);
      ipcRenderer.on(IPC_CHANNELS.aiToolApprovalRequested, listener);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.aiToolApprovalRequested, listener);
    },
    onToolProgress: (callback: (data: unknown) => void) => {
      const listener = (_: unknown, data: unknown) => callback(data);
      ipcRenderer.on(IPC_CHANNELS.aiToolProgress, listener);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.aiToolProgress, listener);
    },
    onRunUpdate: (callback: (data: unknown) => void) => {
      const listener = (_: unknown, data: unknown) => callback(data);
      ipcRenderer.on(IPC_CHANNELS.aiRunUpdate, listener);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.aiRunUpdate, listener);
    },
  }),
);

// --------- Expose Sync API ---------
contextBridge.exposeInMainWorld(
  'sync',
  createProxy(ipcRenderer, 'sync', IPC_PROXY_METHODS.sync, {
    onProgress: (callback: (progress: unknown) => void) => {
      const listener = (_: unknown, progress: unknown) => callback(progress);
      ipcRenderer.on(IPC_CHANNELS.syncProgress, listener);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.syncProgress, listener);
    },
    onCompleted: (callback: (result: unknown) => void) => {
      const listener = (_: unknown, result: unknown) => callback(result);
      ipcRenderer.on(IPC_CHANNELS.syncCompleted, listener);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.syncCompleted, listener);
    },
    onDataChanged: (callback: () => void) => {
      const listener = () => callback();
      ipcRenderer.on(IPC_CHANNELS.syncDataChanged, listener);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.syncDataChanged, listener);
    },
  }),
);

// --------- Expose Unified App Config API ---------
contextBridge.exposeInMainWorld(
  'app',
  createProxy(ipcRenderer, 'app', IPC_PROXY_METHODS.app, {
    onConfigChanged: (callback: (config: unknown) => void) => {
      const listener = (_: unknown, config: unknown) => callback(config);
      ipcRenderer.on(IPC_CHANNELS.appConfigChanged, listener);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.appConfigChanged, listener);
    },
  }),
);

// --------- Expose Log API ---------
contextBridge.exposeInMainWorld(
  'log',
  createProxy(ipcRenderer, 'log', IPC_PROXY_METHODS.log, {
    error: (...args: unknown[]) => ipcRenderer.send(IPC_CHANNELS.logRenderer, 'error', ...args),
    warn: (...args: unknown[]) => ipcRenderer.send(IPC_CHANNELS.logRenderer, 'warn', ...args),
    info: (...args: unknown[]) => ipcRenderer.send(IPC_CHANNELS.logRenderer, 'info', ...args),
    debug: (...args: unknown[]) => ipcRenderer.send(IPC_CHANNELS.logRenderer, 'debug', ...args),
  }),
);

// --------- Expose Knowledge Base API ---------
contextBridge.exposeInMainWorld(
  'knowledge',
  createProxy(ipcRenderer, 'knowledge', IPC_PROXY_METHODS.knowledge),
);

// --------- Expose Config API ---------
contextBridge.exposeInMainWorld(
  'config',
  createProxy(ipcRenderer, 'config', IPC_PROXY_METHODS.config),
);
