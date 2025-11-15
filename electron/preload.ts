import { ipcRenderer, contextBridge } from 'electron';
import type {
  OpenDialogOptions,
  SetStoragePathOptions,
  CreateNotePayload,
  UpdateNotePayload,
  UpdateStatusPayload,
} from '../src/services/types';
import type { AIConfig, ChatPayload } from '../src/services/aiConfig';

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
