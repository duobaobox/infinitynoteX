"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("ipcRenderer", {
  on(...args) {
    const [channel, listener] = args;
    return electron.ipcRenderer.on(
      channel,
      (event, ...args2) => listener(event, ...args2)
    );
  },
  off(...args) {
    const [channel, ...omit] = args;
    return electron.ipcRenderer.off(channel, ...omit);
  },
  send(...args) {
    const [channel, ...omit] = args;
    return electron.ipcRenderer.send(channel, ...omit);
  },
  invoke(...args) {
    const [channel, ...omit] = args;
    return electron.ipcRenderer.invoke(channel, ...omit);
  }
  // You can expose other APTs you need here.
  // ...
});
electron.contextBridge.exposeInMainWorld("electronAPI", {
  minimize: () => electron.ipcRenderer.send("window-minimize"),
  maximize: () => electron.ipcRenderer.send("window-maximize"),
  unmaximize: () => electron.ipcRenderer.send("window-unmaximize"),
  close: () => electron.ipcRenderer.send("window-close"),
  isMaximized: () => electron.ipcRenderer.invoke("window-is-maximized"),
  onWindowStateChanged: (callback) => {
    electron.ipcRenderer.on("window-state-changed", (_event, isMaximized) => {
      callback(isMaximized);
    });
  },
  showOpenDialog: (options) => electron.ipcRenderer.invoke("dialog:showOpenDialog", options)
});
electron.contextBridge.exposeInMainWorld("storage", {
  // 路径管理
  getDefaultPath: () => electron.ipcRenderer.invoke("storage:getDefaultPath"),
  getCurrentPath: () => electron.ipcRenderer.invoke("storage:getCurrentPath"),
  setStoragePath: (nextPath, options) => electron.ipcRenderer.invoke("storage:setStoragePath", nextPath, options),
  healthCheck: () => electron.ipcRenderer.invoke("storage:healthCheck"),
  openInFinder: () => electron.ipcRenderer.invoke("storage:openInFinder"),
  getStats: () => electron.ipcRenderer.invoke("storage:getStats"),
  createBackup: () => electron.ipcRenderer.invoke("storage:createBackup"),
  exportData: (targetPath) => electron.ipcRenderer.invoke("storage:exportData", targetPath),
  // 文件夹操作
  listFolders: () => electron.ipcRenderer.invoke("storage:listFolders"),
  createFolder: (name) => electron.ipcRenderer.invoke("storage:createFolder", name),
  renameFolder: (id, name) => electron.ipcRenderer.invoke("storage:renameFolder", id, name),
  deleteFolder: (id) => electron.ipcRenderer.invoke("storage:deleteFolder", id),
  // 便签操作
  listNotes: (folderId) => electron.ipcRenderer.invoke("storage:listNotes", folderId),
  createNote: (folderId, payload) => electron.ipcRenderer.invoke("storage:createNote", folderId, payload),
  getNote: (id) => electron.ipcRenderer.invoke("storage:getNote", id),
  updateNote: (id, patch) => electron.ipcRenderer.invoke("storage:updateNote", id, patch),
  deleteNote: (id) => electron.ipcRenderer.invoke("storage:deleteNote", id)
});
