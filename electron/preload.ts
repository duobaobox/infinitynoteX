import { ipcRenderer, contextBridge } from 'electron';
import type {
  OpenDialogOptions,
  SetStoragePathOptions,
  CreateNotePayload,
  UpdateNotePayload,
  UpdateStatusPayload,
} from '../src/services/types';
import type { AIConfig, ChatPayload } from '../src/services/aiConfig';

type AIConversationMessage = {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
};

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

  // You can expose other APTs you need here.
  // ...
});

// --------- Expose window control API ---------
contextBridge.exposeInMainWorld('electronAPI', {
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  unmaximize: () => ipcRenderer.send('window-unmaximize'),
  close: () => ipcRenderer.send('window-close'),
  isMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  onWindowStateChanged: (callback: (isMaximized: boolean) => void) => {
    ipcRenderer.on('window-state-changed', (_event, isMaximized: boolean) => {
      callback(isMaximized);
    });
  },
  showOpenDialog: (options: OpenDialogOptions) =>
    ipcRenderer.invoke('dialog:showOpenDialog', options),
});

// --------- Expose storage API ---------
contextBridge.exposeInMainWorld('storage', {
  // 路径管理
  getDefaultPath: () => ipcRenderer.invoke('storage:getDefaultPath'),
  getCurrentPath: () => ipcRenderer.invoke('storage:getCurrentPath'),
  isFirstLaunch: () => ipcRenderer.invoke('storage:isFirstLaunch'),
  markInitialized: () => ipcRenderer.invoke('storage:markInitialized'),
  setStoragePath: (nextPath: string, options?: SetStoragePathOptions) =>
    ipcRenderer.invoke('storage:setStoragePath', nextPath, options),
  healthCheck: () => ipcRenderer.invoke('storage:healthCheck'),
  openInFinder: () => ipcRenderer.invoke('storage:openInFinder'),
  getStats: () => ipcRenderer.invoke('storage:getStats'),
  createBackup: () => ipcRenderer.invoke('storage:createBackup'),
  exportData: (targetPath: string) => ipcRenderer.invoke('storage:exportData', targetPath),
  resetAllData: () => ipcRenderer.invoke('storage:resetAllData'),

  // 文件夹操作
  listFolders: () => ipcRenderer.invoke('storage:listFolders'),
  createFolder: (name: string) => ipcRenderer.invoke('storage:createFolder', name),
  renameFolder: (id: string, name: string) => ipcRenderer.invoke('storage:renameFolder', id, name),
  deleteFolder: (id: string) => ipcRenderer.invoke('storage:deleteFolder', id),

  // 便签操作
  listNotes: (folderId?: string) => ipcRenderer.invoke('storage:listNotes', folderId),
  createNote: (folderId: string, payload?: CreateNotePayload) =>
    ipcRenderer.invoke('storage:createNote', folderId, payload),
  getNote: (id: string) => ipcRenderer.invoke('storage:getNote', id),
  updateNote: (id: string, patch: UpdateNotePayload) =>
    ipcRenderer.invoke('storage:updateNote', id, patch),
  deleteNote: (id: string) => ipcRenderer.invoke('storage:deleteNote', id),

  // AI 对话操作
  getAIConversations: () => ipcRenderer.invoke('storage:getAIConversations'),
  createAIConversation: (title?: string) =>
    ipcRenderer.invoke('storage:createAIConversation', title),
  deleteAIConversation: (id: string) => ipcRenderer.invoke('storage:deleteAIConversation', id),
  saveAIConversationMessages: (id: string, messages: AIConversationMessage[]) =>
    ipcRenderer.invoke('storage:saveAIConversationMessages', id, messages),
  updateAIConversationTitle: (id: string, title: string) =>
    ipcRenderer.invoke('storage:updateAIConversationTitle', id, title),

  // 回收站操作
  listTrash: () => ipcRenderer.invoke('storage:listTrash'),
  getTrashItem: (id: string) => ipcRenderer.invoke('storage:getTrashItem', id),
  restoreNote: (trashItemId: string, targetFolderId?: string) =>
    ipcRenderer.invoke('storage:restoreNote', trashItemId, targetFolderId),
  deleteTrashItemPermanently: (id: string) =>
    ipcRenderer.invoke('storage:deleteTrashItemPermanently', id),
  emptyTrash: () => ipcRenderer.invoke('storage:emptyTrash'),
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
contextBridge.exposeInMainWorld('floatingWindow', {
  createWindow: (noteId: string) => ipcRenderer.invoke('floating:createWindow', noteId),
  closeWindow: (noteId: string) => ipcRenderer.invoke('floating:closeWindow', noteId),
  listWindows: () => ipcRenderer.invoke('floating:listWindows'),
  minimizeWindow: (noteId: string) => ipcRenderer.invoke('floating:minimizeWindow', noteId),
  restoreWindow: (noteId: string) => ipcRenderer.invoke('floating:restoreWindow', noteId),
});

// --------- Expose auto-updater API ---------
contextBridge.exposeInMainWorld('autoUpdater', {
  checkForUpdates: () => ipcRenderer.invoke('updater:check-now'),
  installUpdate: () => ipcRenderer.invoke('updater:install-now'),
  getLastStatus: () => ipcRenderer.invoke('updater:last-status') as Promise<UpdateStatusPayload>,
  onStatusChange: (callback: (status: UpdateStatusPayload) => void) => {
    const listener = (_event: unknown, status: UpdateStatusPayload) => {
      callback(status);
    };
    ipcRenderer.on('updater:status', listener);
    return () => ipcRenderer.removeListener('updater:status', listener);
  },
});

// --------- Expose app info API ---------
contextBridge.exposeInMainWorld('appInfo', {
  getVersion: () => ipcRenderer.invoke('app:getVersion') as Promise<string>,
});

// --------- Expose Attachments API ---------
contextBridge.exposeInMainWorld('attachments', {
  /**
   * 保存附件（从 Base64 Data URL）
   * @param dataUrl 形如 data:image/png;base64,xxxxx 的字符串
   * @returns 附件 ID（用于构建 attachment://xxx URL）
   */
  save: (dataUrl: string) =>
    ipcRenderer.invoke('attachments:save', dataUrl) as Promise<{
      success: boolean;
      id?: string;
      error?: string;
    }>,

  /**
   * 获取附件的完整文件路径
   */
  getPath: (id: string) => ipcRenderer.invoke('attachments:getPath', id) as Promise<string | null>,

  /**
   * 删除附件
   */
  delete: (id: string) =>
    ipcRenderer.invoke('attachments:delete', id) as Promise<{
      success: boolean;
      error?: string;
    }>,

  /**
   * 列出所有附件
   */
  list: () =>
    ipcRenderer.invoke('attachments:list') as Promise<
      Array<{
        id: string;
        filename: string;
        size: number;
        createdAt: number;
      }>
    >,

  /**
   * 清理未被引用的附件（垃圾回收）
   */
  cleanup: () =>
    ipcRenderer.invoke('attachments:cleanup') as Promise<{
      deleted: number;
      freedBytes: number;
      errors: string[];
    }>,
});

// --------- Expose AI API ---------
contextBridge.exposeInMainWorld('ai', {
  getConfig: () => ipcRenderer.invoke('ai:getConfig') as Promise<AIConfig | null>,
  setConfig: (config: AIConfig) => ipcRenderer.invoke('ai:setConfig', config) as Promise<void>,
  testConnection: () =>
    ipcRenderer.invoke('ai:testConnection') as Promise<{ ok: boolean; message: string }>,
  chat: (payload: ChatPayload) =>
    ipcRenderer.invoke('ai:chat', payload) as Promise<{
      success: boolean;
      content?: string;
      error?: string;
    }>,
  chatStream: (payload: ChatPayload) =>
    ipcRenderer.invoke('ai:chatStream', payload) as Promise<{ success: boolean; error?: string }>,
  onStreamChunk: (
    callback: (data: { delta: string; reasoningDelta?: string; finishReason?: string }) => void,
  ) => {
    const listener = (
      _event: unknown,
      data: { delta: string; reasoningDelta?: string; finishReason?: string },
    ) => callback(data);
    ipcRenderer.on('ai:stream:chunk', listener);
    return () => ipcRenderer.removeListener('ai:stream:chunk', listener);
  },
  onStreamDone: (callback: (data: { success: boolean }) => void) => {
    const listener = (_event: unknown, data: { success: boolean }) => callback(data);
    ipcRenderer.on('ai:stream:done', listener);
    return () => ipcRenderer.removeListener('ai:stream:done', listener);
  },
  onStreamError: (callback: (data: { error: string }) => void) => {
    const listener = (_event: unknown, data: { error: string }) => callback(data);
    ipcRenderer.on('ai:stream:error', listener);
    return () => ipcRenderer.removeListener('ai:stream:error', listener);
  },
});

// --------- Expose Sync API ---------
contextBridge.exposeInMainWorld('sync', {
  testConnection: (providerId: string, config: any) =>
    ipcRenderer.invoke('sync:testConnection', providerId, config) as Promise<{
      ok: boolean;
      message: string;
    }>,
  execute: (providerId: string, config: any) =>
    ipcRenderer.invoke('sync:execute', providerId, config),
  preview: (providerId: string, config: any) =>
    ipcRenderer.invoke('sync:preview', providerId, config) as Promise<{
      toUpload: string[];
      toDownload: string[];
      toDeleteRemote: string[];
      toDeleteLocal: string[];
      conflicts: string[];
      unchanged: number;
    }>,
  getConfig: (providerId: string) => ipcRenderer.invoke('sync:getConfig', providerId),
  setConfig: (providerId: string, config: any) =>
    ipcRenderer.invoke('sync:setConfig', providerId, config),
  // 进度回调
  onProgress: (callback: (progress: any) => void) => {
    const listener = (_event: unknown, progress: any) => callback(progress);
    ipcRenderer.on('sync:progress', listener);
    return () => ipcRenderer.removeListener('sync:progress', listener);
  },
  // 同步完成回调
  onCompleted: (callback: (result: any) => void) => {
    const listener = (_event: unknown, result: any) => callback(result);
    ipcRenderer.on('sync:completed', listener);
    return () => ipcRenderer.removeListener('sync:completed', listener);
  },
  // 数据变化通知（同步后需要刷新）
  onDataChanged: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('sync:dataChanged', listener);
    return () => ipcRenderer.removeListener('sync:dataChanged', listener);
  },
});

// --------- Expose Unified App Config API ---------
contextBridge.exposeInMainWorld('app', {
  getConfig: () => ipcRenderer.invoke('app:getConfig'),
  setConfig: (partial: unknown) => ipcRenderer.invoke('app:setConfig', partial),
  getConfigPath: () => ipcRenderer.invoke('app:getConfigPath') as Promise<string>,
  onConfigChanged: (callback: (config: unknown) => void) => {
    const listener = (_event: unknown, config: unknown) => callback(config);
    ipcRenderer.on('app:configChanged', listener);
    return () => ipcRenderer.removeListener('app:configChanged', listener);
  },
});

// --------- Expose Log API ---------
contextBridge.exposeInMainWorld('log', {
  openDir: () => ipcRenderer.invoke('log:openDir'),
  getPath: () => ipcRenderer.invoke('log:getPath') as Promise<string>,
  readRecent: (lines?: number) => ipcRenderer.invoke('log:readRecent', lines) as Promise<string>,
  readByLevel: (level: 'error' | 'warn' | 'info' | 'debug' | 'all', lines?: number) =>
    ipcRenderer.invoke('log:readByLevel', level, lines) as Promise<string>,
  search: (keyword: string, lines?: number) =>
    ipcRenderer.invoke('log:search', keyword, lines) as Promise<string>,
  cleanOld: () => ipcRenderer.invoke('log:cleanOld') as Promise<number>,
  getStats: () =>
    ipcRenderer.invoke('log:getStats') as Promise<{
      totalSize: number;
      fileCount: number;
      oldestFile?: string;
      newestFile?: string;
    }>,
  // 渲染进程日志上报
  error: (...args: unknown[]) => ipcRenderer.send('log:renderer', 'error', ...args),
  warn: (...args: unknown[]) => ipcRenderer.send('log:renderer', 'warn', ...args),
  info: (...args: unknown[]) => ipcRenderer.send('log:renderer', 'info', ...args),
  debug: (...args: unknown[]) => ipcRenderer.send('log:renderer', 'debug', ...args),
});
