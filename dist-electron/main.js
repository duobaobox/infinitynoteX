var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import { app, shell, BrowserWindow, ipcMain, dialog } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import { randomBytes } from "node:crypto";
class StorageError extends Error {
  constructor(code, message, details) {
    super(message);
    this.code = code;
    this.details = details;
    this.name = "StorageError";
  }
}
class StorageManager {
  constructor() {
    __publicField(this, "currentPath");
    __publicField(this, "foldersCache", null);
    __publicField(this, "notesIndexCache", null);
    __publicField(this, "defaultPath");
    this.defaultPath = path.join(app.getPath("userData"), "data-v1");
    this.currentPath = this.defaultPath;
  }
  /**
   * 初始化存储
   * 应用启动时调用，确保目录结构存在
   */
  async initialize() {
    try {
      await this.ensureStorageInitialized(this.currentPath);
      await this.recoverFromCrash();
      console.log(`[Storage] Initialized at: ${this.currentPath}`);
    } catch (error) {
      console.error("[Storage] Initialization failed:", error);
      throw new StorageError("E_IO_WRITE", "Failed to initialize storage", error);
    }
  }
  /**
   * 检查是否首次启动（未初始化）
   */
  async isFirstLaunch() {
    const metaPath = path.join(this.currentPath, "meta.json");
    const metaExists = await this.fileExists(metaPath);
    if (!metaExists) {
      return true;
    }
    try {
      const meta = await this.readJsonFile(metaPath);
      return !meta.initialized;
    } catch {
      return true;
    }
  }
  /**
   * 标记为已初始化
   */
  async markInitialized() {
    const metaPath = path.join(this.currentPath, "meta.json");
    const meta = await this.readJsonFile(metaPath, {
      schemaVersion: 1,
      storageId: this.generateId(),
      createdAt: Date.now()
    });
    meta.initialized = true;
    await this.writeJsonFile(metaPath, meta);
  }
  /**
   * 确保存储目录初始化
   */
  async ensureStorageInitialized(storagePath) {
    const metaPath = path.join(storagePath, "meta.json");
    const metaExists = await this.fileExists(metaPath);
    if (metaExists) {
      await this.loadCaches();
      return;
    }
    console.log(`[Storage] First-time initialization at: ${storagePath}`);
    await fs.mkdir(storagePath, { recursive: true });
    await fs.mkdir(path.join(storagePath, "notes"), { recursive: true });
    await fs.mkdir(path.join(storagePath, "temp"), { recursive: true });
    await fs.mkdir(path.join(storagePath, "backups"), { recursive: true });
    const meta = {
      schemaVersion: 1,
      storageId: this.generateId(),
      createdAt: Date.now()
    };
    await this.writeJsonFile(metaPath, meta);
    const defaultFolder = {
      id: "default",
      name: "默认文件夹",
      system: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      order: 0
    };
    const foldersPath = path.join(storagePath, "folders.json");
    await this.writeJsonFile(foldersPath, [defaultFolder]);
    const indexPath = path.join(storagePath, "notes.index.json");
    await this.writeJsonFile(indexPath, []);
    await this.loadCaches();
  }
  /**
   * 加载缓存
   */
  async loadCaches() {
    const foldersPath = path.join(this.currentPath, "folders.json");
    const indexPath = path.join(this.currentPath, "notes.index.json");
    this.foldersCache = await this.readJsonFile(foldersPath, []);
    this.notesIndexCache = await this.readJsonFile(indexPath, []);
  }
  /**
   * 清空缓存
   */
  clearCaches() {
    this.foldersCache = null;
    this.notesIndexCache = null;
  }
  /**
   * 崩溃恢复
   * 检查并恢复临时文件
   */
  async recoverFromCrash() {
    try {
      const tempDir = path.join(this.currentPath, "temp");
      const tempExists = await this.fileExists(tempDir);
      if (!tempExists) {
        return;
      }
      const tempFiles = await fs.readdir(tempDir);
      let recoveredCount = 0;
      for (const tempFile of tempFiles) {
        if (!tempFile.endsWith(".tmp")) {
          continue;
        }
        const tempPath = path.join(tempDir, tempFile);
        const originalName = tempFile.replace(".tmp", "");
        let targetPath;
        if (originalName.startsWith("note-")) {
          const noteId = originalName.replace("note-", "").replace(".json", "");
          targetPath = path.join(this.currentPath, "notes", `${noteId}.json`);
        } else {
          targetPath = path.join(this.currentPath, originalName);
        }
        try {
          const content = await fs.readFile(tempPath, "utf-8");
          JSON.parse(content);
          await fs.rename(tempPath, targetPath);
          recoveredCount++;
          console.log(`[Storage] Recovered temp file: ${tempFile}`);
        } catch (error) {
          console.warn(`[Storage] Removing corrupted temp file: ${tempFile}`, error);
          await fs.unlink(tempPath);
        }
      }
      if (recoveredCount > 0) {
        console.log(`[Storage] Crash recovery completed: ${recoveredCount} file(s) recovered`);
      }
    } catch (error) {
      console.error("[Storage] Crash recovery failed:", error);
    }
  }
  // ============ 路径管理 ============
  /**
   * 获取默认路径
   */
  getDefaultPath() {
    return this.defaultPath;
  }
  /**
   * 获取当前路径
   */
  getCurrentPath() {
    return this.currentPath;
  }
  /**
   * 设置存储路径
   */
  async setStoragePath(nextPath, options) {
    const migrate = (options == null ? void 0 : options.migrate) ?? false;
    if (!migrate) {
      this.currentPath = nextPath;
      this.clearCaches();
      await this.ensureStorageInitialized(nextPath);
      return;
    }
    await this.migrateData(this.currentPath, nextPath);
  }
  /**
   * 迁移数据
   */
  async migrateData(fromPath, toPath) {
    try {
      console.log(`[Storage] Migrating from ${fromPath} to ${toPath}`);
      await this.validateMigrationPath(toPath);
      const backupPath = path.join(fromPath, "backups", `backup-${Date.now()}`);
      await this.copyDirectory(fromPath, backupPath);
      await this.copyDirectory(fromPath, toPath);
      await this.validateStorageIntegrity(toPath);
      this.currentPath = toPath;
      this.clearCaches();
      await this.loadCaches();
      console.log(`[Storage] Migration completed successfully`);
    } catch (error) {
      console.error("[Storage] Migration failed:", error);
      throw new StorageError("E_MIGRATE_FAIL", "Data migration failed", error);
    }
  }
  /**
   * 校验迁移路径
   */
  async validateMigrationPath(targetPath) {
    try {
      const exists = await this.fileExists(targetPath);
      if (exists) {
        const files = await fs.readdir(targetPath);
        if (files.length > 0) {
          throw new Error("Target directory is not empty");
        }
      } else {
        await fs.mkdir(targetPath, { recursive: true });
      }
      await fs.access(targetPath, fsSync.constants.W_OK);
    } catch (error) {
      throw new StorageError("E_PATH_INVALID", "Invalid migration path", error);
    }
  }
  /**
   * 校验存储完整性
   */
  async validateStorageIntegrity(storagePath) {
    const requiredFiles = ["meta.json", "folders.json", "notes.index.json"];
    for (const file of requiredFiles) {
      const filePath = path.join(storagePath, file);
      const exists = await this.fileExists(filePath);
      if (!exists) {
        throw new Error(`Missing required file: ${file}`);
      }
    }
  }
  /**
   * 拷贝目录
   */
  async copyDirectory(src, dest) {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(src, { withFileTypes: true });
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "temp" || entry.name === "backups") {
          continue;
        }
        await this.copyDirectory(srcPath, destPath);
      } else {
        await fs.copyFile(srcPath, destPath);
      }
    }
  }
  /**
   * 健康检查
   */
  async healthCheck() {
    try {
      await this.validateStorageIntegrity(this.currentPath);
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        details: error instanceof Error ? error.message : "Unknown error"
      };
    }
  }
  /**
   * 在 Finder/Explorer 中打开数据目录
   */
  async openInFinder() {
    await shell.openPath(this.currentPath);
  }
  /**
   * 获取存储统计信息
   */
  async getStats() {
    const folders = this.foldersCache || [];
    const notes = this.notesIndexCache || [];
    const dataSize = await this.calculateDirectorySize(this.currentPath);
    return {
      folderCount: folders.length,
      noteCount: notes.length,
      dataSize
    };
  }
  /**
   * 创建备份
   */
  async createBackup() {
    try {
      const timestamp = Date.now();
      const backupName = `backup-${timestamp}`;
      const backupPath = path.join(this.currentPath, "backups", backupName);
      console.log(`[Storage] Creating backup: ${backupName}`);
      await this.copyDirectory(this.currentPath, backupPath);
      console.log(`[Storage] Backup created successfully: ${backupPath}`);
      return backupPath;
    } catch (error) {
      console.error("[Storage] Backup creation failed:", error);
      throw new StorageError("E_IO_WRITE", "Failed to create backup", error);
    }
  }
  /**
   * 导出数据到指定路径
   */
  async exportData(targetPath) {
    try {
      console.log(`[Storage] Exporting data to: ${targetPath}`);
      await fs.mkdir(targetPath, { recursive: true });
      await this.copyDirectory(this.currentPath, targetPath);
      console.log(`[Storage] Data exported successfully`);
    } catch (error) {
      console.error("[Storage] Data export failed:", error);
      throw new StorageError("E_IO_WRITE", "Failed to export data", error);
    }
  }
  /**
   * 重置所有数据（清空并重新初始化）
   * 用于开发环境或完全重置
   */
  async resetAllData() {
    try {
      console.log(`[Storage] Resetting all data at: ${this.currentPath}`);
      const entries = await fs.readdir(this.currentPath, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(this.currentPath, entry.name);
        if (entry.isDirectory()) {
          await this.deleteDirectory(fullPath);
        } else {
          await fs.unlink(fullPath);
        }
      }
      await this.ensureStorageInitialized(this.currentPath);
      console.log(`[Storage] Data reset successfully`);
    } catch (error) {
      console.error("[Storage] Data reset failed:", error);
      throw new StorageError("E_IO_WRITE", "Failed to reset data", error);
    }
  }
  /**
   * 递归删除目录
   */
  async deleteDirectory(dirPath) {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
          await this.deleteDirectory(fullPath);
        } else {
          await fs.unlink(fullPath);
        }
      }
      await fs.rmdir(dirPath);
    } catch (error) {
      console.error(`[Storage] Failed to delete directory ${dirPath}:`, error);
      throw error;
    }
  }
  /**
   * 计算目录大小
   */
  async calculateDirectorySize(dirPath) {
    let totalSize = 0;
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const entryPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
          totalSize += await this.calculateDirectorySize(entryPath);
        } else {
          const stats = await fs.stat(entryPath);
          totalSize += stats.size;
        }
      }
    } catch (error) {
      console.error(`[Storage] Error calculating size for ${dirPath}:`, error);
    }
    return totalSize;
  }
  // ============ 文件夹操作 ============
  /**
   * 列出所有文件夹
   */
  async listFolders() {
    if (!this.foldersCache) {
      await this.loadCaches();
    }
    return this.foldersCache || [];
  }
  /**
   * 创建文件夹
   */
  async createFolder(name) {
    const folders = await this.listFolders();
    if (folders.some((f) => f.name === name)) {
      throw new StorageError("E_ALREADY_EXISTS", `Folder "${name}" already exists`);
    }
    const now = Date.now();
    const newFolder = {
      id: this.generateId(),
      name,
      createdAt: now,
      updatedAt: now,
      order: folders.length,
      system: false
    };
    folders.push(newFolder);
    await this.saveFolders(folders);
    return newFolder;
  }
  /**
   * 重命名文件夹
   */
  async renameFolder(id, name) {
    const folders = await this.listFolders();
    const folder = folders.find((f) => f.id === id);
    if (!folder) {
      throw new StorageError("E_NOT_FOUND", `Folder not found: ${id}`);
    }
    if (folder.system) {
      throw new StorageError("E_FOLDER_SYSTEM", "Cannot rename system folder");
    }
    if (folders.some((f) => f.id !== id && f.name === name)) {
      throw new StorageError("E_ALREADY_EXISTS", `Folder "${name}" already exists`);
    }
    folder.name = name;
    folder.updatedAt = Date.now();
    await this.saveFolders(folders);
    return folder;
  }
  /**
   * 删除文件夹
   */
  async deleteFolder(id) {
    const folders = await this.listFolders();
    const folder = folders.find((f) => f.id === id);
    if (!folder) {
      throw new StorageError("E_NOT_FOUND", `Folder not found: ${id}`);
    }
    if (folder.system) {
      throw new StorageError(
        "E_FOLDER_SYSTEM",
        "Cannot delete system default folder"
      );
    }
    const notes = await this.listNotes(id);
    for (const note of notes) {
      const fullNote = await this.getNote(note.id);
      fullNote.folderId = "default";
      fullNote.updatedAt = Date.now();
      await this.saveNote(fullNote);
    }
    const index = folders.findIndex((f) => f.id === id);
    folders.splice(index, 1);
    await this.saveFolders(folders);
  }
  /**
   * 保存文件夹列表
   */
  async saveFolders(folders) {
    const foldersPath = path.join(this.currentPath, "folders.json");
    await this.writeJsonFile(foldersPath, folders);
    this.foldersCache = folders;
  }
  // ============ 便签操作 ============
  /**
   * 列出便签索引
   */
  async listNotes(folderId) {
    if (!this.notesIndexCache) {
      await this.loadCaches();
    }
    const allNotes = this.notesIndexCache || [];
    if (folderId) {
      return allNotes.filter((n) => n.folderId === folderId);
    }
    return allNotes;
  }
  /**
   * 创建便签
   */
  async createNote(folderId, payload) {
    const folders = await this.listFolders();
    if (!folders.some((f) => f.id === folderId)) {
      throw new StorageError("E_NOT_FOUND", `Folder not found: ${folderId}`);
    }
    const now = Date.now();
    const newNote = {
      id: this.generateId(),
      folderId,
      title: (payload == null ? void 0 : payload.title) || "无标题",
      content: (payload == null ? void 0 : payload.content) || { type: "doc", content: [] },
      tags: [],
      pinned: false,
      color: "ffffff",
      createdAt: now,
      updatedAt: now
    };
    await this.saveNote(newNote);
    return newNote;
  }
  /**
   * 获取便签完整内容
   */
  async getNote(id) {
    const notePath = path.join(this.currentPath, "notes", `${id}.json`);
    const exists = await this.fileExists(notePath);
    if (!exists) {
      throw new StorageError("E_NOT_FOUND", `Note not found: ${id}`);
    }
    return await this.readJsonFile(notePath);
  }
  /**
   * 更新便签
   */
  async updateNote(id, patch) {
    const note = await this.getNote(id);
    Object.assign(note, patch);
    note.updatedAt = Date.now();
    await this.saveNote(note);
    return note;
  }
  /**
   * 删除便签
   */
  async deleteNote(id) {
    const notePath = path.join(this.currentPath, "notes", `${id}.json`);
    const exists = await this.fileExists(notePath);
    if (!exists) {
      throw new StorageError("E_NOT_FOUND", `Note not found: ${id}`);
    }
    await fs.unlink(notePath);
    const index = this.notesIndexCache || [];
    const noteIndex = index.findIndex((n) => n.id === id);
    if (noteIndex >= 0) {
      index.splice(noteIndex, 1);
      await this.saveNotesIndex(index);
    }
  }
  /**
   * 保存便签
   * 先写正文，再更新索引
   */
  async saveNote(note) {
    const notePath = path.join(this.currentPath, "notes", `${note.id}.json`);
    await this.writeJsonFileAtomic(notePath, note);
    const index = this.notesIndexCache || [];
    const existingIndex = index.findIndex((n) => n.id === note.id);
    const noteIndex = {
      id: note.id,
      folderId: note.folderId,
      title: note.title,
      excerpt: this.generateExcerpt(note.content),
      updatedAt: note.updatedAt,
      pinned: note.pinned,
      tags: note.tags,
      color: note.color ?? "ffffff"
    };
    if (existingIndex >= 0) {
      index[existingIndex] = noteIndex;
    } else {
      index.push(noteIndex);
    }
    await this.saveNotesIndex(index);
  }
  /**
   * 保存便签索引
   */
  async saveNotesIndex(index) {
    const indexPath = path.join(this.currentPath, "notes.index.json");
    await this.writeJsonFile(indexPath, index);
    this.notesIndexCache = index;
  }
  /**
   * 生成摘要
   */
  generateExcerpt(content) {
    try {
      const isObj = (v) => typeof v === "object" && v !== null;
      if (!isObj(content)) return "";
      const root = content;
      if (!Array.isArray(root.content)) return "";
      let text = "";
      const extractText = (node) => {
        if (node.type === "text" && typeof node.text === "string") {
          text += node.text;
        }
        if (node.content && Array.isArray(node.content)) {
          node.content.forEach(extractText);
        }
      };
      extractText(root);
      return text.slice(0, 100);
    } catch {
      return "";
    }
  }
  // ============ 工具方法 ============
  /**
   * 生成唯一 ID
   */
  generateId() {
    return randomBytes(8).toString("hex");
  }
  /**
   * 检查文件是否存在
   */
  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
  /**
   * 读取 JSON 文件
   */
  async readJsonFile(filePath, defaultValue) {
    try {
      const content = await fs.readFile(filePath, "utf-8");
      return JSON.parse(content);
    } catch (error) {
      if (defaultValue !== void 0) {
        return defaultValue;
      }
      throw new StorageError("E_IO_READ", `Failed to read file: ${filePath}`, error);
    }
  }
  /**
   * 写入 JSON 文件
   */
  async writeJsonFile(filePath, data) {
    try {
      const content = JSON.stringify(data, null, 2);
      await fs.writeFile(filePath, content, "utf-8");
    } catch (error) {
      throw new StorageError(
        "E_IO_WRITE",
        `Failed to write file: ${filePath}`,
        error
      );
    }
  }
  /**
   * 原子写入 JSON 文件
   * 先写临时文件，再重命名
   */
  async writeJsonFileAtomic(filePath, data) {
    const isNoteFile = filePath.includes("/notes/");
    const baseName = path.basename(filePath);
    const tempFileName = isNoteFile ? `note-${baseName}.tmp` : `${baseName}.tmp`;
    const tempPath = path.join(this.currentPath, "temp", tempFileName);
    try {
      const content = JSON.stringify(data, null, 2);
      await fs.writeFile(tempPath, content, "utf-8");
      await fs.rename(tempPath, filePath);
    } catch (error) {
      try {
        await fs.unlink(tempPath);
      } catch {
      }
      throw new StorageError(
        "E_IO_WRITE",
        `Failed to write file atomically: ${filePath}`,
        error
      );
    }
  }
}
const storageManager = new StorageManager();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
process.env.APP_ROOT = path.join(__dirname, "..");
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
let win;
let isQuitting = false;
function createWindow() {
  win = new BrowserWindow({
    width: 700,
    // 默认宽度
    height: 560,
    // 默认高度
    minWidth: 700,
    // 最小宽度
    minHeight: 560,
    // 最小高度
    icon: path.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    frame: false,
    // 隐藏默认标题栏
    titleBarStyle: "hidden",
    // 隐藏标题栏但保留拖拽区域
    trafficLightPosition: { x: 12, y: 10 },
    // macOS 红绿黄按钮位置（不会显示因为 frame: false）
    show: false,
    // 等待渲染就绪再展示，避免白屏闪烁
    backgroundColor: "#FFFFFF",
    // 统一背景色，提升初次展示观感
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs")
    }
  });
  win.webContents.on("did-finish-load", () => {
    win == null ? void 0 : win.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  });
  win.once("ready-to-show", () => {
    win == null ? void 0 : win.show();
  });
  win.on("close", (e) => {
    if (process.platform === "darwin" && !isQuitting) {
      e.preventDefault();
      win == null ? void 0 : win.hide();
      return;
    }
    win = null;
  });
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
}
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});
app.on("activate", () => {
  if (win) {
    win.show();
  } else if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
ipcMain.on("window-minimize", () => {
  if (win) {
    win.minimize();
  }
});
ipcMain.on("window-maximize", () => {
  if (win) {
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
  }
});
ipcMain.on("window-close", () => {
  if (!win) return;
  if (process.platform === "darwin") {
    win.hide();
  } else {
    win.close();
  }
});
ipcMain.handle("window-is-maximized", () => {
  return (win == null ? void 0 : win.isMaximized()) ?? false;
});
ipcMain.on("window-double-click-titlebar", () => {
  if (win) {
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
  }
});
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
    }
  });
}
app.on("before-quit", () => {
  isQuitting = true;
});
app.whenReady().then(async () => {
  await storageManager.initialize();
  createWindow();
});
ipcMain.handle("storage:getDefaultPath", () => {
  return storageManager.getDefaultPath();
});
ipcMain.handle("storage:getCurrentPath", () => {
  return storageManager.getCurrentPath();
});
ipcMain.handle("storage:isFirstLaunch", async () => {
  return await storageManager.isFirstLaunch();
});
ipcMain.handle("storage:markInitialized", async () => {
  await storageManager.markInitialized();
});
ipcMain.handle(
  "storage:setStoragePath",
  async (_, nextPath, options) => {
    await storageManager.setStoragePath(nextPath, options);
  }
);
ipcMain.handle("storage:healthCheck", async () => {
  return await storageManager.healthCheck();
});
ipcMain.handle("storage:openInFinder", async () => {
  await storageManager.openInFinder();
});
ipcMain.handle("storage:getStats", async () => {
  return await storageManager.getStats();
});
ipcMain.handle("storage:createBackup", async () => {
  return await storageManager.createBackup();
});
ipcMain.handle("storage:exportData", async (_, targetPath) => {
  await storageManager.exportData(targetPath);
});
ipcMain.handle("storage:resetAllData", async () => {
  await storageManager.resetAllData();
});
ipcMain.handle("storage:listFolders", async () => {
  return await storageManager.listFolders();
});
ipcMain.handle("storage:createFolder", async (_, name) => {
  return await storageManager.createFolder(name);
});
ipcMain.handle("storage:renameFolder", async (_, id, name) => {
  return await storageManager.renameFolder(id, name);
});
ipcMain.handle("storage:deleteFolder", async (_, id) => {
  await storageManager.deleteFolder(id);
});
ipcMain.handle("storage:listNotes", async (_, folderId) => {
  return await storageManager.listNotes(folderId);
});
ipcMain.handle("storage:createNote", async (_, folderId, payload) => {
  return await storageManager.createNote(folderId, payload);
});
ipcMain.handle("storage:getNote", async (_, id) => {
  return await storageManager.getNote(id);
});
ipcMain.handle("storage:updateNote", async (_, id, patch) => {
  return await storageManager.updateNote(id, patch);
});
ipcMain.handle("storage:deleteNote", async (_, id) => {
  await storageManager.deleteNote(id);
});
ipcMain.handle("dialog:showOpenDialog", async (_, options) => {
  const result = await dialog.showOpenDialog(options);
  return result;
});
export {
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};
