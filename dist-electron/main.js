var S = Object.defineProperty;
var D = (d, t, e) => t in d ? S(d, t, { enumerable: !0, configurable: !0, writable: !0, value: e }) : d[t] = e;
var g = (d, t, e) => D(d, typeof t != "symbol" ? t + "" : t, e);
import { app as f, shell as j, BrowserWindow as F, ipcMain as l, dialog as N } from "electron";
import { fileURLToPath as P } from "node:url";
import o from "node:path";
import c from "node:fs/promises";
import C from "node:fs";
import { randomBytes as v } from "node:crypto";
class u extends Error {
  constructor(t, e, a) {
    super(e), this.code = t, this.details = a, this.name = "StorageError";
  }
}
class k {
  constructor() {
    g(this, "currentPath");
    g(this, "foldersCache", null);
    g(this, "notesIndexCache", null);
    g(this, "defaultPath");
    this.defaultPath = o.join(f.getPath("userData"), "data-v1"), this.currentPath = this.defaultPath;
  }
  /**
   * 初始化存储
   * 应用启动时调用，确保目录结构存在
   */
  async initialize() {
    try {
      await this.ensureStorageInitialized(this.currentPath), await this.recoverFromCrash(), console.log(`[Storage] Initialized at: ${this.currentPath}`);
    } catch (t) {
      throw console.error("[Storage] Initialization failed:", t), new u("E_IO_WRITE", "Failed to initialize storage", t);
    }
  }
  /**
   * 确保存储目录初始化
   */
  async ensureStorageInitialized(t) {
    const e = o.join(t, "meta.json");
    if (await this.fileExists(e)) {
      await this.loadCaches();
      return;
    }
    console.log(`[Storage] First-time initialization at: ${t}`), await c.mkdir(t, { recursive: !0 }), await c.mkdir(o.join(t, "notes"), { recursive: !0 }), await c.mkdir(o.join(t, "temp"), { recursive: !0 }), await c.mkdir(o.join(t, "backups"), { recursive: !0 });
    const i = {
      schemaVersion: 1,
      storageId: this.generateId(),
      createdAt: Date.now()
    };
    await this.writeJsonFile(e, i);
    const s = {
      id: "default",
      name: "默认文件夹",
      system: !0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      order: 0
    }, n = o.join(t, "folders.json");
    await this.writeJsonFile(n, [s]);
    const w = o.join(t, "notes.index.json");
    await this.writeJsonFile(w, []), await this.loadCaches();
  }
  /**
   * 加载缓存
   */
  async loadCaches() {
    const t = o.join(this.currentPath, "folders.json"), e = o.join(this.currentPath, "notes.index.json");
    this.foldersCache = await this.readJsonFile(t, []), this.notesIndexCache = await this.readJsonFile(e, []);
  }
  /**
   * 清空缓存
   */
  clearCaches() {
    this.foldersCache = null, this.notesIndexCache = null;
  }
  /**
   * 崩溃恢复
   * 检查并恢复临时文件
   */
  async recoverFromCrash() {
    try {
      const t = o.join(this.currentPath, "temp");
      if (!await this.fileExists(t))
        return;
      const a = await c.readdir(t);
      let i = 0;
      for (const s of a) {
        if (!s.endsWith(".tmp"))
          continue;
        const n = o.join(t, s), w = s.replace(".tmp", "");
        let y;
        if (w.startsWith("note-")) {
          const m = w.replace("note-", "").replace(".json", "");
          y = o.join(this.currentPath, "notes", `${m}.json`);
        } else
          y = o.join(this.currentPath, w);
        try {
          const m = await c.readFile(n, "utf-8");
          JSON.parse(m), await c.rename(n, y), i++, console.log(`[Storage] Recovered temp file: ${s}`);
        } catch (m) {
          console.warn(`[Storage] Removing corrupted temp file: ${s}`, m), await c.unlink(n);
        }
      }
      i > 0 && console.log(`[Storage] Crash recovery completed: ${i} file(s) recovered`);
    } catch (t) {
      console.error("[Storage] Crash recovery failed:", t);
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
  async setStoragePath(t, e) {
    if (!((e == null ? void 0 : e.migrate) ?? !1)) {
      this.currentPath = t, this.clearCaches(), await this.ensureStorageInitialized(t);
      return;
    }
    await this.migrateData(this.currentPath, t);
  }
  /**
   * 迁移数据
   */
  async migrateData(t, e) {
    try {
      console.log(`[Storage] Migrating from ${t} to ${e}`), await this.validateMigrationPath(e);
      const a = o.join(t, "backups", `backup-${Date.now()}`);
      await this.copyDirectory(t, a), await this.copyDirectory(t, e), await this.validateStorageIntegrity(e), this.currentPath = e, this.clearCaches(), await this.loadCaches(), console.log("[Storage] Migration completed successfully");
    } catch (a) {
      throw console.error("[Storage] Migration failed:", a), new u("E_MIGRATE_FAIL", "Data migration failed", a);
    }
  }
  /**
   * 校验迁移路径
   */
  async validateMigrationPath(t) {
    try {
      if (await this.fileExists(t)) {
        if ((await c.readdir(t)).length > 0)
          throw new Error("Target directory is not empty");
      } else
        await c.mkdir(t, { recursive: !0 });
      await c.access(t, C.constants.W_OK);
    } catch (e) {
      throw new u("E_PATH_INVALID", "Invalid migration path", e);
    }
  }
  /**
   * 校验存储完整性
   */
  async validateStorageIntegrity(t) {
    const e = ["meta.json", "folders.json", "notes.index.json"];
    for (const a of e) {
      const i = o.join(t, a);
      if (!await this.fileExists(i))
        throw new Error(`Missing required file: ${a}`);
    }
  }
  /**
   * 拷贝目录
   */
  async copyDirectory(t, e) {
    await c.mkdir(e, { recursive: !0 });
    const a = await c.readdir(t, { withFileTypes: !0 });
    for (const i of a) {
      const s = o.join(t, i.name), n = o.join(e, i.name);
      if (i.isDirectory()) {
        if (i.name === "temp" || i.name === "backups")
          continue;
        await this.copyDirectory(s, n);
      } else
        await c.copyFile(s, n);
    }
  }
  /**
   * 健康检查
   */
  async healthCheck() {
    try {
      return await this.validateStorageIntegrity(this.currentPath), { ok: !0 };
    } catch (t) {
      return {
        ok: !1,
        details: t instanceof Error ? t.message : "Unknown error"
      };
    }
  }
  /**
   * 在 Finder/Explorer 中打开数据目录
   */
  async openInFinder() {
    await j.openPath(this.currentPath);
  }
  /**
   * 获取存储统计信息
   */
  async getStats() {
    const t = this.foldersCache || [], e = this.notesIndexCache || [], a = await this.calculateDirectorySize(this.currentPath);
    return {
      folderCount: t.length,
      noteCount: e.length,
      dataSize: a
    };
  }
  /**
   * 创建备份
   */
  async createBackup() {
    try {
      const e = `backup-${Date.now()}`, a = o.join(this.currentPath, "backups", e);
      return console.log(`[Storage] Creating backup: ${e}`), await this.copyDirectory(this.currentPath, a), console.log(`[Storage] Backup created successfully: ${a}`), a;
    } catch (t) {
      throw console.error("[Storage] Backup creation failed:", t), new u("E_IO_WRITE", "Failed to create backup", t);
    }
  }
  /**
   * 导出数据到指定路径
   */
  async exportData(t) {
    try {
      console.log(`[Storage] Exporting data to: ${t}`), await c.mkdir(t, { recursive: !0 }), await this.copyDirectory(this.currentPath, t), console.log("[Storage] Data exported successfully");
    } catch (e) {
      throw console.error("[Storage] Data export failed:", e), new u("E_IO_WRITE", "Failed to export data", e);
    }
  }
  /**
   * 计算目录大小
   */
  async calculateDirectorySize(t) {
    let e = 0;
    try {
      const a = await c.readdir(t, { withFileTypes: !0 });
      for (const i of a) {
        const s = o.join(t, i.name);
        if (i.isDirectory())
          e += await this.calculateDirectorySize(s);
        else {
          const n = await c.stat(s);
          e += n.size;
        }
      }
    } catch (a) {
      console.error(`[Storage] Error calculating size for ${t}:`, a);
    }
    return e;
  }
  // ============ 文件夹操作 ============
  /**
   * 列出所有文件夹
   */
  async listFolders() {
    return this.foldersCache || await this.loadCaches(), this.foldersCache || [];
  }
  /**
   * 创建文件夹
   */
  async createFolder(t) {
    const e = await this.listFolders();
    if (e.some((s) => s.name === t))
      throw new u("E_ALREADY_EXISTS", `Folder "${t}" already exists`);
    const a = Date.now(), i = {
      id: this.generateId(),
      name: t,
      createdAt: a,
      updatedAt: a,
      order: e.length,
      system: !1
    };
    return e.push(i), await this.saveFolders(e), i;
  }
  /**
   * 重命名文件夹
   */
  async renameFolder(t, e) {
    const a = await this.listFolders(), i = a.find((s) => s.id === t);
    if (!i)
      throw new u("E_NOT_FOUND", `Folder not found: ${t}`);
    if (i.system)
      throw new u("E_FOLDER_SYSTEM", "Cannot rename system folder");
    if (a.some((s) => s.id !== t && s.name === e))
      throw new u("E_ALREADY_EXISTS", `Folder "${e}" already exists`);
    return i.name = e, i.updatedAt = Date.now(), await this.saveFolders(a), i;
  }
  /**
   * 删除文件夹
   */
  async deleteFolder(t) {
    const e = await this.listFolders(), a = e.find((n) => n.id === t);
    if (!a)
      throw new u("E_NOT_FOUND", `Folder not found: ${t}`);
    if (a.system)
      throw new u(
        "E_FOLDER_SYSTEM",
        "Cannot delete system default folder"
      );
    const i = await this.listNotes(t);
    for (const n of i) {
      const w = await this.getNote(n.id);
      w.folderId = "default", w.updatedAt = Date.now(), await this.saveNote(w);
    }
    const s = e.findIndex((n) => n.id === t);
    e.splice(s, 1), await this.saveFolders(e);
  }
  /**
   * 保存文件夹列表
   */
  async saveFolders(t) {
    const e = o.join(this.currentPath, "folders.json");
    await this.writeJsonFile(e, t), this.foldersCache = t;
  }
  // ============ 便签操作 ============
  /**
   * 列出便签索引
   */
  async listNotes(t) {
    this.notesIndexCache || await this.loadCaches();
    const e = this.notesIndexCache || [];
    return t ? e.filter((a) => a.folderId === t) : e;
  }
  /**
   * 创建便签
   */
  async createNote(t, e) {
    if (!(await this.listFolders()).some((n) => n.id === t))
      throw new u("E_NOT_FOUND", `Folder not found: ${t}`);
    const i = Date.now(), s = {
      id: this.generateId(),
      folderId: t,
      title: (e == null ? void 0 : e.title) || "无标题",
      content: (e == null ? void 0 : e.content) || { type: "doc", content: [] },
      tags: [],
      pinned: !1,
      color: "ffffff",
      createdAt: i,
      updatedAt: i
    };
    return await this.saveNote(s), s;
  }
  /**
   * 获取便签完整内容
   */
  async getNote(t) {
    const e = o.join(this.currentPath, "notes", `${t}.json`);
    if (!await this.fileExists(e))
      throw new u("E_NOT_FOUND", `Note not found: ${t}`);
    return await this.readJsonFile(e);
  }
  /**
   * 更新便签
   */
  async updateNote(t, e) {
    const a = await this.getNote(t);
    return Object.assign(a, e), a.updatedAt = Date.now(), await this.saveNote(a), a;
  }
  /**
   * 删除便签
   */
  async deleteNote(t) {
    const e = o.join(this.currentPath, "notes", `${t}.json`);
    if (!await this.fileExists(e))
      throw new u("E_NOT_FOUND", `Note not found: ${t}`);
    await c.unlink(e);
    const i = this.notesIndexCache || [], s = i.findIndex((n) => n.id === t);
    s >= 0 && (i.splice(s, 1), await this.saveNotesIndex(i));
  }
  /**
   * 保存便签
   * 先写正文，再更新索引
   */
  async saveNote(t) {
    const e = o.join(this.currentPath, "notes", `${t.id}.json`);
    await this.writeJsonFileAtomic(e, t);
    const a = this.notesIndexCache || [], i = a.findIndex((n) => n.id === t.id), s = {
      id: t.id,
      folderId: t.folderId,
      title: t.title,
      excerpt: this.generateExcerpt(t.content),
      updatedAt: t.updatedAt,
      pinned: t.pinned,
      tags: t.tags,
      color: t.color ?? "ffffff"
    };
    i >= 0 ? a[i] = s : a.push(s), await this.saveNotesIndex(a);
  }
  /**
   * 保存便签索引
   */
  async saveNotesIndex(t) {
    const e = o.join(this.currentPath, "notes.index.json");
    await this.writeJsonFile(e, t), this.notesIndexCache = t;
  }
  /**
   * 生成摘要
   */
  generateExcerpt(t) {
    try {
      if (!((n) => typeof n == "object" && n !== null)(t)) return "";
      const a = t;
      if (!Array.isArray(a.content)) return "";
      let i = "";
      const s = (n) => {
        n.type === "text" && typeof n.text == "string" && (i += n.text), n.content && Array.isArray(n.content) && n.content.forEach(s);
      };
      return s(a), i.slice(0, 100);
    } catch {
      return "";
    }
  }
  // ============ 工具方法 ============
  /**
   * 生成唯一 ID
   */
  generateId() {
    return v(8).toString("hex");
  }
  /**
   * 检查文件是否存在
   */
  async fileExists(t) {
    try {
      return await c.access(t), !0;
    } catch {
      return !1;
    }
  }
  /**
   * 读取 JSON 文件
   */
  async readJsonFile(t, e) {
    try {
      const a = await c.readFile(t, "utf-8");
      return JSON.parse(a);
    } catch (a) {
      if (e !== void 0)
        return e;
      throw new u("E_IO_READ", `Failed to read file: ${t}`, a);
    }
  }
  /**
   * 写入 JSON 文件
   */
  async writeJsonFile(t, e) {
    try {
      const a = JSON.stringify(e, null, 2);
      await c.writeFile(t, a, "utf-8");
    } catch (a) {
      throw new u(
        "E_IO_WRITE",
        `Failed to write file: ${t}`,
        a
      );
    }
  }
  /**
   * 原子写入 JSON 文件
   * 先写临时文件，再重命名
   */
  async writeJsonFileAtomic(t, e) {
    const a = t.includes("/notes/"), i = o.basename(t), s = a ? `note-${i}.tmp` : `${i}.tmp`, n = o.join(this.currentPath, "temp", s);
    try {
      const w = JSON.stringify(e, null, 2);
      await c.writeFile(n, w, "utf-8"), await c.rename(n, t);
    } catch (w) {
      try {
        await c.unlink(n);
      } catch {
      }
      throw new u(
        "E_IO_WRITE",
        `Failed to write file atomically: ${t}`,
        w
      );
    }
  }
}
const h = new k(), x = o.dirname(P(import.meta.url));
process.env.APP_ROOT = o.join(x, "..");
const p = process.env.VITE_DEV_SERVER_URL, J = o.join(process.env.APP_ROOT, "dist-electron"), E = o.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = p ? o.join(process.env.APP_ROOT, "public") : E;
let r, I = !1;
function _() {
  r = new F({
    width: 700,
    // 默认宽度
    height: 560,
    // 默认高度
    minWidth: 700,
    // 最小宽度
    minHeight: 560,
    // 最小高度
    icon: o.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    frame: !1,
    // 隐藏默认标题栏
    titleBarStyle: "hidden",
    // 隐藏标题栏但保留拖拽区域
    trafficLightPosition: { x: 12, y: 10 },
    // macOS 红绿黄按钮位置（不会显示因为 frame: false）
    show: !1,
    // 等待渲染就绪再展示，避免白屏闪烁
    backgroundColor: "#FFFFFF",
    // 统一背景色，提升初次展示观感
    webPreferences: {
      preload: o.join(x, "preload.mjs")
    }
  }), r.webContents.on("did-finish-load", () => {
    r == null || r.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  }), r.once("ready-to-show", () => {
    r == null || r.show();
  }), r.on("close", (d) => {
    if (process.platform === "darwin" && !I) {
      d.preventDefault(), r == null || r.hide();
      return;
    }
    r = null;
  }), p ? r.loadURL(p) : r.loadFile(o.join(E, "index.html"));
}
f.on("window-all-closed", () => {
  process.platform !== "darwin" && (f.quit(), r = null);
});
f.on("activate", () => {
  r ? r.show() : F.getAllWindows().length === 0 && _();
});
l.on("window-minimize", () => {
  r && r.minimize();
});
l.on("window-maximize", () => {
  r && (r.isMaximized() ? r.unmaximize() : r.maximize());
});
l.on("window-close", () => {
  r && (process.platform === "darwin" ? r.hide() : r.close());
});
l.handle("window-is-maximized", () => (r == null ? void 0 : r.isMaximized()) ?? !1);
l.on("window-double-click-titlebar", () => {
  r && (r.isMaximized() ? r.unmaximize() : r.maximize());
});
const O = f.requestSingleInstanceLock();
O ? f.on("second-instance", () => {
  r && (r.isMinimized() && r.restore(), r.show(), r.focus());
}) : f.quit();
f.on("before-quit", () => {
  I = !0;
});
f.whenReady().then(async () => {
  await h.initialize(), _();
});
l.handle("storage:getDefaultPath", () => h.getDefaultPath());
l.handle("storage:getCurrentPath", () => h.getCurrentPath());
l.handle(
  "storage:setStoragePath",
  async (d, t, e) => {
    await h.setStoragePath(t, e);
  }
);
l.handle("storage:healthCheck", async () => await h.healthCheck());
l.handle("storage:openInFinder", async () => {
  await h.openInFinder();
});
l.handle("storage:getStats", async () => await h.getStats());
l.handle("storage:createBackup", async () => await h.createBackup());
l.handle("storage:exportData", async (d, t) => {
  await h.exportData(t);
});
l.handle("storage:listFolders", async () => await h.listFolders());
l.handle("storage:createFolder", async (d, t) => await h.createFolder(t));
l.handle("storage:renameFolder", async (d, t, e) => await h.renameFolder(t, e));
l.handle("storage:deleteFolder", async (d, t) => {
  await h.deleteFolder(t);
});
l.handle("storage:listNotes", async (d, t) => await h.listNotes(t));
l.handle("storage:createNote", async (d, t, e) => await h.createNote(t, e));
l.handle("storage:getNote", async (d, t) => await h.getNote(t));
l.handle("storage:updateNote", async (d, t, e) => await h.updateNote(t, e));
l.handle("storage:deleteNote", async (d, t) => {
  await h.deleteNote(t);
});
l.handle("dialog:showOpenDialog", async (d, t) => await N.showOpenDialog(t));
export {
  J as MAIN_DIST,
  E as RENDERER_DIST,
  p as VITE_DEV_SERVER_URL
};
