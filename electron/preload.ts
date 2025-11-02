import { ipcRenderer, contextBridge } from 'electron';
import type {
  OpenDialogOptions,
  SetStoragePathOptions,
  CreateNotePayload,
  UpdateNotePayload,
} from '../src/services/types';

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
  setStoragePath: (nextPath: string, options?: SetStoragePathOptions) =>
    ipcRenderer.invoke('storage:setStoragePath', nextPath, options),
  healthCheck: () => ipcRenderer.invoke('storage:healthCheck'),
  openInFinder: () => ipcRenderer.invoke('storage:openInFinder'),
  getStats: () => ipcRenderer.invoke('storage:getStats'),
  createBackup: () => ipcRenderer.invoke('storage:createBackup'),
  exportData: (targetPath: string) => ipcRenderer.invoke('storage:exportData', targetPath),

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
