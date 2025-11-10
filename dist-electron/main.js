var N = Object.defineProperty;
var v = (d, e, t) => e in d ? N(d, e, { enumerable: !0, configurable: !0, writable: !0, value: t }) : d[e] = t;
var p = (d, e, t) => v(d, typeof e != "symbol" ? e + "" : e, t);
import { app as g, shell as k, BrowserWindow as x, ipcMain as c, dialog as z } from "electron";
import { fileURLToPath as $ } from "node:url";
import r from "node:path";
import l from "node:fs/promises";
import O from "node:fs";
import { randomBytes as b } from "node:crypto";
class u extends Error {
  constructor(e, t, a) {
    super(t), this.code = e, this.details = a, this.name = "StorageError";
  }
}
class A {
  constructor() {
    p(this, "currentPath");
    p(this, "foldersCache", null);
    p(this, "notesIndexCache", null);
    p(this, "defaultPath");
    this.defaultPath = r.join(g.getPath("userData"), "data-v1"), this.currentPath = this.defaultPath;
  }
  /**
   * 初始化存储
   * 应用启动时调用，确保目录结构存在
   */
  async initialize() {
    try {
      await this.ensureStorageInitialized(this.currentPath), await this.recoverFromCrash(), console.log(`[Storage] Initialized at: ${this.currentPath}`);
    } catch (e) {
      throw console.error("[Storage] Initialization failed:", e), new u("E_IO_WRITE", "Failed to initialize storage", e);
    }
  }
  /**
   * 检查是否首次启动（未初始化）
   */
  async isFirstLaunch() {
    const e = r.join(this.currentPath, "meta.json");
    if (!await this.fileExists(e))
      return !0;
    try {
      return !(await this.readJsonFile(e)).initialized;
    } catch {
      return !0;
    }
  }
  /**
   * 标记为已初始化
   */
  async markInitialized() {
    const e = r.join(this.currentPath, "meta.json"), t = await this.readJsonFile(e, {
      schemaVersion: 1,
      storageId: this.generateId(),
      createdAt: Date.now()
    });
    t.initialized = !0, await this.writeJsonFile(e, t);
  }
  /**
   * 确保存储目录初始化
   */
  async ensureStorageInitialized(e) {
    const t = r.join(e, "meta.json");
    if (await this.fileExists(t)) {
      await this.loadCaches();
      return;
    }
    console.log(`[Storage] First-time initialization at: ${e}`), await l.mkdir(e, { recursive: !0 }), await l.mkdir(r.join(e, "notes"), { recursive: !0 }), await l.mkdir(r.join(e, "temp"), { recursive: !0 }), await l.mkdir(r.join(e, "backups"), { recursive: !0 });
    const s = {
      schemaVersion: 1,
      storageId: this.generateId(),
      createdAt: Date.now()
    };
    await this.writeJsonFile(t, s);
    const n = {
      id: "default",
      name: "默认文件夹",
      system: !0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      order: 0
    }, o = r.join(e, "folders.json");
    await this.writeJsonFile(o, [n]);
    const w = r.join(e, "notes.index.json");
    await this.writeJsonFile(w, []), await this.loadCaches();
  }
  /**
   * 加载缓存
   */
  async loadCaches() {
    const e = r.join(this.currentPath, "folders.json"), t = r.join(this.currentPath, "notes.index.json");
    this.foldersCache = await this.readJsonFile(e, []), this.notesIndexCache = await this.readJsonFile(t, []);
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
      const e = r.join(this.currentPath, "temp");
      if (!await this.fileExists(e))
        return;
      const a = await l.readdir(e);
      let s = 0;
      for (const n of a) {
        if (!n.endsWith(".tmp"))
          continue;
        const o = r.join(e, n), w = n.replace(".tmp", "");
        let S;
        if (w.startsWith("note-")) {
          const y = w.replace("note-", "").replace(".json", "");
          S = r.join(this.currentPath, "notes", `${y}.json`);
        } else
          S = r.join(this.currentPath, w);
        try {
          const y = await l.readFile(o, "utf-8");
          JSON.parse(y), await l.rename(o, S), s++, console.log(`[Storage] Recovered temp file: ${n}`);
        } catch (y) {
          console.warn(`[Storage] Removing corrupted temp file: ${n}`, y), await l.unlink(o);
        }
      }
      s > 0 && console.log(`[Storage] Crash recovery completed: ${s} file(s) recovered`);
    } catch (e) {
      console.error("[Storage] Crash recovery failed:", e);
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
  async setStoragePath(e, t) {
    if (!((t == null ? void 0 : t.migrate) ?? !1)) {
      this.currentPath = e, this.clearCaches(), await this.ensureStorageInitialized(e);
      return;
    }
    await this.migrateData(this.currentPath, e);
  }
  /**
   * 迁移数据
   */
  async migrateData(e, t) {
    try {
      console.log(`[Storage] Migrating from ${e} to ${t}`), await this.validateMigrationPath(t);
      const a = r.join(e, "backups", `backup-${Date.now()}`);
      await this.copyDirectory(e, a), await this.copyDirectory(e, t), await this.validateStorageIntegrity(t), this.currentPath = t, this.clearCaches(), await this.loadCaches(), console.log("[Storage] Migration completed successfully");
    } catch (a) {
      throw console.error("[Storage] Migration failed:", a), new u("E_MIGRATE_FAIL", "Data migration failed", a);
    }
  }
  /**
   * 校验迁移路径
   */
  async validateMigrationPath(e) {
    try {
      if (await this.fileExists(e)) {
        if ((await l.readdir(e)).length > 0)
          throw new Error("Target directory is not empty");
      } else
        await l.mkdir(e, { recursive: !0 });
      await l.access(e, O.constants.W_OK);
    } catch (t) {
      throw new u("E_PATH_INVALID", "Invalid migration path", t);
    }
  }
  /**
   * 校验存储完整性
   */
  async validateStorageIntegrity(e) {
    const t = ["meta.json", "folders.json", "notes.index.json"];
    for (const a of t) {
      const s = r.join(e, a);
      if (!await this.fileExists(s))
        throw new Error(`Missing required file: ${a}`);
    }
  }
  /**
   * 拷贝目录
   */
  async copyDirectory(e, t) {
    await l.mkdir(t, { recursive: !0 });
    const a = await l.readdir(e, { withFileTypes: !0 });
    for (const s of a) {
      const n = r.join(e, s.name), o = r.join(t, s.name);
      if (s.isDirectory()) {
        if (s.name === "temp" || s.name === "backups")
          continue;
        await this.copyDirectory(n, o);
      } else
        await l.copyFile(n, o);
    }
  }
  /**
   * 健康检查
   */
  async healthCheck() {
    try {
      return await this.validateStorageIntegrity(this.currentPath), { ok: !0 };
    } catch (e) {
      return {
        ok: !1,
        details: e instanceof Error ? e.message : "Unknown error"
      };
    }
  }
  /**
   * 在 Finder/Explorer 中打开数据目录
   */
  async openInFinder() {
    await k.openPath(this.currentPath);
  }
  /**
   * 获取存储统计信息
   */
  async getStats() {
    const e = this.foldersCache || [], t = this.notesIndexCache || [], a = await this.calculateDirectorySize(this.currentPath);
    return {
      folderCount: e.length,
      noteCount: t.length,
      dataSize: a
    };
  }
  /**
   * 创建备份
   */
  async createBackup() {
    try {
      const t = `backup-${Date.now()}`, a = r.join(this.currentPath, "backups", t);
      return console.log(`[Storage] Creating backup: ${t}`), await this.copyDirectory(this.currentPath, a), console.log(`[Storage] Backup created successfully: ${a}`), a;
    } catch (e) {
      throw console.error("[Storage] Backup creation failed:", e), new u("E_IO_WRITE", "Failed to create backup", e);
    }
  }
  /**
   * 导出数据到指定路径
   */
  async exportData(e) {
    try {
      console.log(`[Storage] Exporting data to: ${e}`), await l.mkdir(e, { recursive: !0 }), await this.copyDirectory(this.currentPath, e), console.log("[Storage] Data exported successfully");
    } catch (t) {
      throw console.error("[Storage] Data export failed:", t), new u("E_IO_WRITE", "Failed to export data", t);
    }
  }
  /**
   * 重置所有数据（清空并重新初始化）
   * 用于开发环境或完全重置
   */
  async resetAllData() {
    try {
      console.log(`[Storage] Resetting all data at: ${this.currentPath}`);
      const e = await l.readdir(this.currentPath, { withFileTypes: !0 });
      for (const t of e) {
        const a = r.join(this.currentPath, t.name);
        t.isDirectory() ? await this.deleteDirectory(a) : await l.unlink(a);
      }
      await this.ensureStorageInitialized(this.currentPath), console.log("[Storage] Data reset successfully");
    } catch (e) {
      throw console.error("[Storage] Data reset failed:", e), new u("E_IO_WRITE", "Failed to reset data", e);
    }
  }
  /**
   * 递归删除目录
   */
  async deleteDirectory(e) {
    try {
      const t = await l.readdir(e, { withFileTypes: !0 });
      for (const a of t) {
        const s = r.join(e, a.name);
        a.isDirectory() ? await this.deleteDirectory(s) : await l.unlink(s);
      }
      await l.rmdir(e);
    } catch (t) {
      throw console.error(`[Storage] Failed to delete directory ${e}:`, t), t;
    }
  }
  /**
   * 计算目录大小
   */
  async calculateDirectorySize(e) {
    let t = 0;
    try {
      const a = await l.readdir(e, { withFileTypes: !0 });
      for (const s of a) {
        const n = r.join(e, s.name);
        if (s.isDirectory())
          t += await this.calculateDirectorySize(n);
        else {
          const o = await l.stat(n);
          t += o.size;
        }
      }
    } catch (a) {
      console.error(`[Storage] Error calculating size for ${e}:`, a);
    }
    return t;
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
  async createFolder(e) {
    const t = await this.listFolders();
    if (t.some((n) => n.name === e))
      throw new u("E_ALREADY_EXISTS", `Folder "${e}" already exists`);
    const a = Date.now(), s = {
      id: this.generateId(),
      name: e,
      createdAt: a,
      updatedAt: a,
      order: t.length,
      system: !1
    };
    return t.push(s), await this.saveFolders(t), s;
  }
  /**
   * 重命名文件夹
   */
  async renameFolder(e, t) {
    const a = await this.listFolders(), s = a.find((n) => n.id === e);
    if (!s)
      throw new u("E_NOT_FOUND", `Folder not found: ${e}`);
    if (s.system)
      throw new u("E_FOLDER_SYSTEM", "Cannot rename system folder");
    if (a.some((n) => n.id !== e && n.name === t))
      throw new u("E_ALREADY_EXISTS", `Folder "${t}" already exists`);
    return s.name = t, s.updatedAt = Date.now(), await this.saveFolders(a), s;
  }
  /**
   * 删除文件夹
   */
  async deleteFolder(e) {
    const t = await this.listFolders(), a = t.find((o) => o.id === e);
    if (!a)
      throw new u("E_NOT_FOUND", `Folder not found: ${e}`);
    if (a.system)
      throw new u(
        "E_FOLDER_SYSTEM",
        "Cannot delete system default folder"
      );
    const s = await this.listNotes(e);
    for (const o of s) {
      const w = await this.getNote(o.id);
      w.folderId = "default", w.updatedAt = Date.now(), await this.saveNote(w);
    }
    const n = t.findIndex((o) => o.id === e);
    t.splice(n, 1), await this.saveFolders(t);
  }
  /**
   * 保存文件夹列表
   */
  async saveFolders(e) {
    const t = r.join(this.currentPath, "folders.json");
    await this.writeJsonFile(t, e), this.foldersCache = e;
  }
  // ============ 便签操作 ============
  /**
   * 列出便签索引
   */
  async listNotes(e) {
    this.notesIndexCache || await this.loadCaches();
    const t = this.notesIndexCache || [];
    return e ? t.filter((a) => a.folderId === e) : t;
  }
  /**
   * 创建便签
   */
  async createNote(e, t) {
    if (!(await this.listFolders()).some((o) => o.id === e))
      throw new u("E_NOT_FOUND", `Folder not found: ${e}`);
    const s = Date.now(), n = {
      id: this.generateId(),
      folderId: e,
      title: (t == null ? void 0 : t.title) || "无标题",
      content: (t == null ? void 0 : t.content) || { type: "doc", content: [] },
      tags: [],
      pinned: !1,
      color: "ffffff",
      createdAt: s,
      updatedAt: s
    };
    return await this.saveNote(n), n;
  }
  /**
   * 获取便签完整内容
   */
  async getNote(e) {
    const t = r.join(this.currentPath, "notes", `${e}.json`);
    if (!await this.fileExists(t))
      throw new u("E_NOT_FOUND", `Note not found: ${e}`);
    return await this.readJsonFile(t);
  }
  /**
   * 更新便签
   */
  async updateNote(e, t) {
    const a = await this.getNote(e);
    return Object.assign(a, t), a.updatedAt = Date.now(), await this.saveNote(a), a;
  }
  /**
   * 删除便签
   */
  async deleteNote(e) {
    const t = r.join(this.currentPath, "notes", `${e}.json`);
    if (!await this.fileExists(t))
      throw new u("E_NOT_FOUND", `Note not found: ${e}`);
    await l.unlink(t);
    const s = this.notesIndexCache || [], n = s.findIndex((o) => o.id === e);
    n >= 0 && (s.splice(n, 1), await this.saveNotesIndex(s));
  }
  /**
   * 保存便签
   * 先写正文，再更新索引
   */
  async saveNote(e) {
    const t = r.join(this.currentPath, "notes", `${e.id}.json`);
    await this.writeJsonFileAtomic(t, e);
    const a = this.notesIndexCache || [], s = a.findIndex((o) => o.id === e.id), n = {
      id: e.id,
      folderId: e.folderId,
      title: e.title,
      excerpt: this.generateExcerpt(e.content),
      updatedAt: e.updatedAt,
      pinned: e.pinned,
      tags: e.tags,
      color: e.color ?? "ffffff"
    };
    s >= 0 ? a[s] = n : a.push(n), await this.saveNotesIndex(a);
  }
  /**
   * 保存便签索引
   */
  async saveNotesIndex(e) {
    const t = r.join(this.currentPath, "notes.index.json");
    await this.writeJsonFile(t, e), this.notesIndexCache = e;
  }
  /**
   * 生成摘要
   */
  generateExcerpt(e) {
    try {
      if (!((o) => typeof o == "object" && o !== null)(e)) return "";
      const a = e;
      if (!Array.isArray(a.content)) return "";
      let s = "";
      const n = (o) => {
        o.type === "text" && typeof o.text == "string" && (s += o.text), o.content && Array.isArray(o.content) && o.content.forEach(n);
      };
      return n(a), s.slice(0, 100);
    } catch {
      return "";
    }
  }
  // ============ 工具方法 ============
  /**
   * 生成唯一 ID
   */
  generateId() {
    return b(8).toString("hex");
  }
  /**
   * 检查文件是否存在
   */
  async fileExists(e) {
    try {
      return await l.access(e), !0;
    } catch {
      return !1;
    }
  }
  /**
   * 读取 JSON 文件
   */
  async readJsonFile(e, t) {
    try {
      const a = await l.readFile(e, "utf-8");
      return JSON.parse(a);
    } catch (a) {
      if (t !== void 0)
        return t;
      throw new u("E_IO_READ", `Failed to read file: ${e}`, a);
    }
  }
  /**
   * 写入 JSON 文件
   */
  async writeJsonFile(e, t) {
    try {
      const a = JSON.stringify(t, null, 2);
      await l.writeFile(e, a, "utf-8");
    } catch (a) {
      throw new u(
        "E_IO_WRITE",
        `Failed to write file: ${e}`,
        a
      );
    }
  }
  /**
   * 原子写入 JSON 文件
   * 先写临时文件，再重命名
   */
  async writeJsonFileAtomic(e, t) {
    const a = e.includes("/notes/"), s = r.basename(e), n = a ? `note-${s}.tmp` : `${s}.tmp`, o = r.join(this.currentPath, "temp", n);
    try {
      const w = JSON.stringify(t, null, 2);
      await l.writeFile(o, w, "utf-8"), await l.rename(o, e);
    } catch (w) {
      try {
        await l.unlink(o);
      } catch {
      }
      throw new u(
        "E_IO_WRITE",
        `Failed to write file atomically: ${e}`,
        w
      );
    }
  }
}
const h = new A(), D = r.dirname($(import.meta.url));
process.env.APP_ROOT = r.join(D, "..");
const m = process.env.VITE_DEV_SERVER_URL, V = r.join(process.env.APP_ROOT, "dist-electron"), E = r.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = m ? r.join(process.env.APP_ROOT, "public") : E;
let i, I = !1;
const f = /* @__PURE__ */ new Map(), _ = /* @__PURE__ */ new Map(), j = /* @__PURE__ */ new Map(), P = { width: 130, height: 48 };
let F = {
  width: 400,
  height: 400
};
function C() {
  i = new x({
    width: 700,
    // 默认宽度
    height: 560,
    // 默认高度
    minWidth: 700,
    // 最小宽度
    minHeight: 560,
    // 最小高度
    icon: r.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
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
      preload: r.join(D, "preload.mjs")
    }
  }), i.webContents.on("did-finish-load", () => {
    i == null || i.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  }), i.once("ready-to-show", () => {
    i == null || i.show();
  }), i.on("close", (d) => {
    if (process.platform === "darwin" && !I) {
      d.preventDefault(), i == null || i.hide();
      return;
    }
    i = null;
  }), m ? i.loadURL(m) : i.loadFile(r.join(E, "index.html"));
}
g.on("window-all-closed", () => {
  process.platform !== "darwin" && (g.quit(), i = null);
});
g.on("activate", () => {
  i ? i.show() : x.getAllWindows().length === 0 && C();
});
c.on("window-minimize", () => {
  i && i.minimize();
});
c.on("window-maximize", () => {
  i && (i.isMaximized() ? i.unmaximize() : i.maximize());
});
c.on("window-close", () => {
  i && (process.platform === "darwin" ? i.hide() : i.close());
});
c.handle("window-is-maximized", () => (i == null ? void 0 : i.isMaximized()) ?? !1);
c.on("window-double-click-titlebar", () => {
  i && (i.isMaximized() ? i.unmaximize() : i.maximize());
});
const T = g.requestSingleInstanceLock();
T ? g.on("second-instance", () => {
  i && (i.isMinimized() && i.restore(), i.show(), i.focus());
}) : g.quit();
g.on("before-quit", () => {
  I = !0;
});
g.whenReady().then(async () => {
  await h.initialize(), C();
});
c.handle("storage:getDefaultPath", () => h.getDefaultPath());
c.handle("storage:getCurrentPath", () => h.getCurrentPath());
c.handle("storage:isFirstLaunch", async () => await h.isFirstLaunch());
c.handle("storage:markInitialized", async () => {
  await h.markInitialized();
});
c.handle(
  "storage:setStoragePath",
  async (d, e, t) => {
    await h.setStoragePath(e, t);
  }
);
c.handle("storage:healthCheck", async () => await h.healthCheck());
c.handle("storage:openInFinder", async () => {
  await h.openInFinder();
});
c.handle("storage:getStats", async () => await h.getStats());
c.handle("storage:createBackup", async () => await h.createBackup());
c.handle("storage:exportData", async (d, e) => {
  await h.exportData(e);
});
c.handle("storage:resetAllData", async () => {
  await h.resetAllData();
});
c.handle("storage:listFolders", async () => await h.listFolders());
c.handle("storage:createFolder", async (d, e) => await h.createFolder(e));
c.handle("storage:renameFolder", async (d, e, t) => await h.renameFolder(e, t));
c.handle("storage:deleteFolder", async (d, e) => {
  await h.deleteFolder(e);
});
c.handle("storage:listNotes", async (d, e) => await h.listNotes(e));
c.handle("storage:createNote", async (d, e, t) => await h.createNote(e, t));
c.handle("storage:getNote", async (d, e) => await h.getNote(e));
c.handle("storage:updateNote", async (d, e, t) => await h.updateNote(e, t));
c.handle("storage:deleteNote", async (d, e) => {
  await h.deleteNote(e);
});
c.handle("dialog:showOpenDialog", async (d, e) => await z.showOpenDialog(e));
c.handle("floating:createWindow", async (d, e) => {
  if (f.has(e)) {
    const a = f.get(e);
    if (a && !a.isDestroyed())
      return a.focus(), { success: !0, message: "窗口已存在" };
  }
  const t = new x({
    width: F.width,
    height: F.height,
    minWidth: 300,
    minHeight: 300,
    frame: !1,
    // 无边框窗口
    transparent: !0,
    // 透明窗口，便于实现药丸裁剪
    hasShadow: !0,
    alwaysOnTop: !0,
    // 始终置顶
    resizable: !0,
    show: !1,
    backgroundColor: "#00000000",
    // 完全透明背景
    webPreferences: {
      preload: r.join(D, "preload.mjs")
    }
  });
  return m ? t.loadURL(`${m}#/floating/${e}`) : t.loadFile(r.join(E, "index.html"), {
    hash: `/floating/${e}`
  }), t.once("ready-to-show", () => {
    t.show();
  }), t.on("closed", () => {
    f.delete(e);
  }), f.set(e, t), { success: !0, message: "创建成功" };
});
c.handle("floating:minimizeWindow", async (d, e) => {
  const t = f.get(e);
  if (!t || t.isDestroyed())
    return { success: !1, message: "窗口不存在" };
  const a = t.getBounds();
  j.set(e, a);
  const s = new x({
    width: P.width,
    height: P.height,
    x: a.x,
    y: a.y,
    frame: !1,
    transparent: !0,
    hasShadow: !0,
    alwaysOnTop: !0,
    resizable: !1,
    show: !1,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: r.join(D, "preload.mjs")
    }
  });
  return m ? s.loadURL(`${m}#/pill/${e}`) : s.loadFile(r.join(E, "index.html"), {
    hash: `/pill/${e}`
  }), s.once("ready-to-show", () => {
    s.show(), t.close();
  }), s.on("closed", () => {
    _.delete(e);
  }), _.set(e, s), { success: !0 };
});
c.handle("floating:restoreWindow", async (d, e) => {
  const t = _.get(e);
  if (!t || t.isDestroyed())
    return { success: !1, message: "药丸窗口不存在" };
  const a = j.get(e);
  if (!a)
    return { success: !1, message: "未找到保存的窗口尺寸" };
  const s = new x({
    width: a.width,
    height: a.height,
    x: a.x,
    y: a.y,
    minWidth: 300,
    minHeight: 300,
    frame: !1,
    transparent: !0,
    hasShadow: !0,
    alwaysOnTop: !0,
    resizable: !0,
    show: !1,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: r.join(D, "preload.mjs")
    }
  });
  return m ? s.loadURL(`${m}#/floating/${e}`) : s.loadFile(r.join(E, "index.html"), {
    hash: `/floating/${e}`
  }), s.once("ready-to-show", () => {
    s.show(), t.close();
  }), s.on("closed", () => {
    f.delete(e);
  }), f.set(e, s), j.delete(e), { success: !0 };
});
c.handle("floating:closeWindow", async (d, e) => {
  const t = f.get(e);
  return t && !t.isDestroyed() ? (t.close(), f.delete(e), { success: !0 }) : { success: !1, message: "窗口不存在" };
});
c.handle("floating:listWindows", async () => Array.from(f.keys()).filter((e) => {
  const t = f.get(e);
  return t && !t.isDestroyed();
}));
c.on("note:changed", (d, e) => {
  const t = _.get(e);
  t && !t.isDestroyed() && t.webContents.send("note:updated", e);
  const a = f.get(e);
  a && !a.isDestroyed() && a.webContents.send("note:updated", e), i && !i.isDestroyed() && i.webContents.send("note:updated", e);
});
c.on("floating-note:changed", (d, e) => {
  i && !i.isDestroyed() && i.webContents.send("floating-note:updated", e);
});
c.handle("config:getDefaultFloatingWindowSize", async () => F);
c.handle(
  "config:setDefaultFloatingWindowSize",
  async (d, e) => (e.width && e.height && (F = {
    width: e.width,
    height: e.height
  }), F)
);
export {
  V as MAIN_DIST,
  E as RENDERER_DIST,
  m as VITE_DEV_SERVER_URL
};
