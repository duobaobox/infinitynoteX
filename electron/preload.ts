import { ipcRenderer, contextBridge } from 'electron';
import type { OpenDialogOptions } from '../src/services/types';
import { createProxy } from '../src/shared/utils/ipcProxy';

// ============ 方法名列表定义 ============
// 注意：这些列表必须与 electron/ipc/*Handlers.ts 中注册的 IPC 通道保持一致

const STORAGE_METHODS = [
  'getDefaultPath',
  'getCurrentPath',
  'isFirstLaunch',
  'markInitialized',
  'setStoragePath',
  'healthCheck',
  'openInFinder',
  'getStats',
  'createBackup',
  'restoreBackup',
  'exportData',
  'resetAllData',
  'listFolders',
  'createFolder',
  'renameFolder',
  'deleteFolder',
  'listNotes',
  'createNote',
  'getNote',
  'updateNote',
  'deleteNote',
  'getAIConversations',
  'createAIConversation',
  'deleteAIConversation',
  'saveAIConversationMessages',
  'updateAIConversationTitle',
  'listTrash',
  'getTrashItem',
  'restoreNote',
  'deleteTrashItemPermanently',
  'emptyTrash',
  'listTodoLists',
  'createTodoList',
  'updateTodoList',
  'deleteTodoList',
  'listManualTasks',
  'createManualTask',
  'updateManualTask',
  'deleteManualTask',
  'toggleManualTask',
];

const BROWSER_CARDS_METHODS = ['list', 'create', 'update', 'delete', 'reorder'];

const ATTACHMENTS_METHODS = ['save', 'list', 'cleanup'];

const SYNC_METHODS = [
  'testConnection',
  'execute',
  'getLastResult',
  'preview',
  'getConfig',
  'setConfig',
  'openLogDir',
];

const AI_METHODS = [
  'getConfig',
  'setConfig',
  'testConnection',
  'chat',
  'chatStream',
  'abortStream',
];

const KNOWLEDGE_METHODS = [
  'getConfig',
  'setConfig',
  'testEmbedding',
  'rebuildIndex',
  'getStats',
  'search',
  'getChunks',
  'getNoteIndexList',
  'testSearch',
  'incrementalUpdate',
  'reindexNote',
  'deleteNoteIndex',
  'runDiagnostics',
  'repairIndex',
  'getIndexingConfig',
  'setIndexingConfig',
  'resetIndexingConfig',
  'getDefaultIndexingConfig',
];

const CONFIG_METHODS = [
  'getShortcutKeys',
  'setShortcutKeys',
  'getDefaultFloatingWindowSize',
  'setDefaultFloatingWindowSize',
];

const LOG_METHODS = [
  'openDir',
  'getPath',
  'readRecent',
  'readByLevel',
  'search',
  'cleanOld',
  'getStats',
];

const FLOATING_METHODS = [
  'createWindow',
  'minimizeWindow',
  'restoreWindow',
  'closeWindow',
  'listWindows',
];

const FLOATING_TODO_METHODS = [
  'createWindow',
  'closeWindow',
  'minimizeWindow',
  'restoreWindow',
  'listWindows',
];

const APP_METHODS = ['getConfig', 'setConfig', 'getConfigPath'];

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('ipcRenderer', {
  on(...args: Parameters<typeof ipcRenderer.on>) {
    const [channel, listener] = args;
    return ipcRenderer.on(channel, (event, ...args) => listener(event, ...args));
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
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  unmaximize: () => ipcRenderer.send('window-unmaximize'),
  close: () => ipcRenderer.send('window-close'),
  isMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  reload: () => ipcRenderer.invoke('window-reload'),
  onWindowStateChanged: (callback: (isMaximized: boolean) => void) => {
    ipcRenderer.on('window-state-changed', (_event, isMaximized: boolean) => {
      callback(isMaximized);
    });
  },
  showOpenDialog: (options: OpenDialogOptions) =>
    ipcRenderer.invoke('dialog:showOpenDialog', options),

  // AI 对话悬浮窗口
  showAIChatWindow: () => ipcRenderer.invoke('ai-chat-window:show'),
  hideAIChatWindow: () => ipcRenderer.invoke('ai-chat-window:hide'),
  toggleAIChatWindow: () => ipcRenderer.invoke('ai-chat-window:toggle'),
});

// --------- Expose storage API ---------
contextBridge.exposeInMainWorld('storage', {
  ...createProxy(ipcRenderer, 'storage', STORAGE_METHODS),
  // 手动暴露同步方法（绕过 createProxy 的 invoke 机制）
  updateNoteSync: (id: string, patch: unknown) => {
    return ipcRenderer.sendSync('storage:updateNoteSync', id, patch);
  },
});

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
    ipcRenderer.on('storage:event', listener);
    return () => {
      ipcRenderer.removeListener('storage:event', listener);
    };
  },
});

// --------- Expose floating window API ---------
contextBridge.exposeInMainWorld(
  'floatingWindow',
  createProxy(ipcRenderer, 'floating', FLOATING_METHODS),
);

// --------- Expose floating todo window API ---------
contextBridge.exposeInMainWorld(
  'floatingTodo',
  createProxy(ipcRenderer, 'floatingTodo', FLOATING_TODO_METHODS),
);

// --------- Expose auto-updater API (Manual due to naming mismatch) ---------
contextBridge.exposeInMainWorld('autoUpdater', {
  checkForUpdates: () => ipcRenderer.invoke('updater:check-now'),
  installUpdate: () => ipcRenderer.invoke('updater:install-now'),
  getLastStatus: () => ipcRenderer.invoke('updater:last-status'),
  onStatusChange: (callback: (status: unknown) => void) => {
    const listener = (_event: unknown, status: unknown) => {
      callback(status);
    };
    ipcRenderer.on('updater:status', listener);
    return () => ipcRenderer.removeListener('updater:status', listener);
  },
});

// --------- Expose app info API (Manual) ---------
contextBridge.exposeInMainWorld('appInfo', {
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
});

// --------- Expose Browser Cards API ---------
contextBridge.exposeInMainWorld(
  'browserCards',
  createProxy(ipcRenderer, 'browserCards', BROWSER_CARDS_METHODS),
);

// --------- Expose Attachments API ---------
contextBridge.exposeInMainWorld(
  'attachments',
  createProxy(ipcRenderer, 'attachments', ATTACHMENTS_METHODS),
);

// --------- Expose AI API ---------
contextBridge.exposeInMainWorld(
  'ai',
  createProxy(ipcRenderer, 'ai', AI_METHODS, {
    onStreamChunk: (callback: (data: unknown) => void) => {
      const listener = (_: unknown, data: unknown) => callback(data);
      ipcRenderer.on('ai:stream:chunk', listener);
      return () => ipcRenderer.removeListener('ai:stream:chunk', listener);
    },
    onStreamDone: (callback: (data: unknown) => void) => {
      const listener = (_: unknown, data: unknown) => callback(data);
      ipcRenderer.on('ai:stream:done', listener);
      return () => ipcRenderer.removeListener('ai:stream:done', listener);
    },
    onStreamError: (callback: (error: unknown) => void) => {
      const listener = (_: unknown, data: unknown) => callback(data);
      ipcRenderer.on('ai:stream:error', listener);
      return () => ipcRenderer.removeListener('ai:stream:error', listener);
    },
  }),
);

// --------- Expose Sync API ---------
contextBridge.exposeInMainWorld(
  'sync',
  createProxy(ipcRenderer, 'sync', SYNC_METHODS, {
    onProgress: (callback: (progress: unknown) => void) => {
      const listener = (_: unknown, progress: unknown) => callback(progress);
      ipcRenderer.on('sync:progress', listener);
      return () => ipcRenderer.removeListener('sync:progress', listener);
    },
    onCompleted: (callback: (result: unknown) => void) => {
      const listener = (_: unknown, result: unknown) => callback(result);
      ipcRenderer.on('sync:completed', listener);
      return () => ipcRenderer.removeListener('sync:completed', listener);
    },
    onDataChanged: (callback: () => void) => {
      const listener = () => callback();
      ipcRenderer.on('sync:dataChanged', listener);
      return () => ipcRenderer.removeListener('sync:dataChanged', listener);
    },
  }),
);

// --------- Expose Unified App Config API ---------
contextBridge.exposeInMainWorld(
  'app',
  createProxy(ipcRenderer, 'app', APP_METHODS, {
    onConfigChanged: (callback: (config: unknown) => void) => {
      const listener = (_: unknown, config: unknown) => callback(config);
      ipcRenderer.on('app:configChanged', listener);
      return () => ipcRenderer.removeListener('app:configChanged', listener);
    },
  }),
);

// --------- Expose Log API ---------
contextBridge.exposeInMainWorld(
  'log',
  createProxy(ipcRenderer, 'log', LOG_METHODS, {
    error: (...args: unknown[]) => ipcRenderer.send('log:renderer', 'error', ...args),
    warn: (...args: unknown[]) => ipcRenderer.send('log:renderer', 'warn', ...args),
    info: (...args: unknown[]) => ipcRenderer.send('log:renderer', 'info', ...args),
    debug: (...args: unknown[]) => ipcRenderer.send('log:renderer', 'debug', ...args),
  }),
);

// --------- Expose Knowledge Base API ---------
contextBridge.exposeInMainWorld(
  'knowledge',
  createProxy(ipcRenderer, 'knowledge', KNOWLEDGE_METHODS),
);

// --------- Expose Config API ---------
contextBridge.exposeInMainWorld('config', createProxy(ipcRenderer, 'config', CONFIG_METHODS));
