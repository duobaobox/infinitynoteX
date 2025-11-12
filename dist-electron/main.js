var O = Object.defineProperty;
var $ = (r, e, t) => e in r ? O(r, e, { enumerable: !0, configurable: !0, writable: !0, value: t }) : r[e] = t;
var p = (r, e, t) => $(r, typeof e != "symbol" ? e + "" : e, t);
import { app as g, shell as b, BrowserWindow as x, ipcMain as l, dialog as v } from "electron";
import { fileURLToPath as W } from "node:url";
import n from "node:path";
import _ from "node:fs";
import d from "node:fs/promises";
import { randomBytes as A } from "node:crypto";
class u extends Error {
  constructor(e, t, a) {
    super(t), this.code = e, this.details = a, this.name = "StorageError";
  }
}
class T {
  constructor() {
    p(this, "currentPath");
    p(this, "foldersCache", null);
    p(this, "notesIndexCache", null);
    p(this, "defaultPath");
    this.defaultPath = n.join(g.getPath("userData"), "data-v1"), this.currentPath = this.defaultPath;
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
    const e = n.join(this.currentPath, "meta.json");
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
    const e = n.join(this.currentPath, "meta.json"), t = await this.readJsonFile(e, {
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
    const t = n.join(e, "meta.json");
    if (await this.fileExists(t)) {
      await this.loadCaches();
      return;
    }
    console.log(`[Storage] First-time initialization at: ${e}`), await d.mkdir(e, { recursive: !0 }), await d.mkdir(n.join(e, "notes"), { recursive: !0 }), await d.mkdir(n.join(e, "temp"), { recursive: !0 }), await d.mkdir(n.join(e, "backups"), { recursive: !0 });
    const i = {
      schemaVersion: 1,
      storageId: this.generateId(),
      createdAt: Date.now()
    };
    await this.writeJsonFile(t, i);
    const o = {
      id: "default",
      name: "默认文件夹",
      system: !0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      order: 0
    }, c = n.join(e, "folders.json");
    await this.writeJsonFile(c, [o]);
    const w = n.join(e, "notes.index.json");
    await this.writeJsonFile(w, []), await this.loadCaches();
  }
  /**
   * 加载缓存
   */
  async loadCaches() {
    const e = n.join(this.currentPath, "folders.json"), t = n.join(this.currentPath, "notes.index.json");
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
      const e = n.join(this.currentPath, "temp");
      if (!await this.fileExists(e))
        return;
      const a = await d.readdir(e);
      let i = 0;
      for (const o of a) {
        if (!o.endsWith(".tmp"))
          continue;
        const c = n.join(e, o), w = o.replace(".tmp", "");
        let j;
        if (w.startsWith("note-")) {
          const y = w.replace("note-", "").replace(".json", "");
          j = n.join(this.currentPath, "notes", `${y}.json`);
        } else
          j = n.join(this.currentPath, w);
        try {
          const y = await d.readFile(c, "utf-8");
          JSON.parse(y), await d.rename(c, j), i++, console.log(`[Storage] Recovered temp file: ${o}`);
        } catch (y) {
          console.warn(`[Storage] Removing corrupted temp file: ${o}`, y), await d.unlink(c);
        }
      }
      i > 0 && console.log(`[Storage] Crash recovery completed: ${i} file(s) recovered`);
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
      const a = n.join(e, "backups", `backup-${Date.now()}`);
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
        if ((await d.readdir(e)).length > 0)
          throw new Error("Target directory is not empty");
      } else
        await d.mkdir(e, { recursive: !0 });
      await d.access(e, _.constants.W_OK);
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
      const i = n.join(e, a);
      if (!await this.fileExists(i))
        throw new Error(`Missing required file: ${a}`);
    }
  }
  /**
   * 拷贝目录
   */
  async copyDirectory(e, t) {
    await d.mkdir(t, { recursive: !0 });
    const a = await d.readdir(e, { withFileTypes: !0 });
    for (const i of a) {
      const o = n.join(e, i.name), c = n.join(t, i.name);
      if (i.isDirectory()) {
        if (i.name === "temp" || i.name === "backups")
          continue;
        await this.copyDirectory(o, c);
      } else
        await d.copyFile(o, c);
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
    await b.openPath(this.currentPath);
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
      const t = `backup-${Date.now()}`, a = n.join(this.currentPath, "backups", t);
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
      console.log(`[Storage] Exporting data to: ${e}`), await d.mkdir(e, { recursive: !0 }), await this.copyDirectory(this.currentPath, e), console.log("[Storage] Data exported successfully");
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
      const e = await d.readdir(this.currentPath, { withFileTypes: !0 });
      for (const t of e) {
        const a = n.join(this.currentPath, t.name);
        t.isDirectory() ? await this.deleteDirectory(a) : await d.unlink(a);
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
      const t = await d.readdir(e, { withFileTypes: !0 });
      for (const a of t) {
        const i = n.join(e, a.name);
        a.isDirectory() ? await this.deleteDirectory(i) : await d.unlink(i);
      }
      await d.rmdir(e);
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
      const a = await d.readdir(e, { withFileTypes: !0 });
      for (const i of a) {
        const o = n.join(e, i.name);
        if (i.isDirectory())
          t += await this.calculateDirectorySize(o);
        else {
          const c = await d.stat(o);
          t += c.size;
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
    if (t.some((o) => o.name === e))
      throw new u("E_ALREADY_EXISTS", `Folder "${e}" already exists`);
    const a = Date.now(), i = {
      id: this.generateId(),
      name: e,
      createdAt: a,
      updatedAt: a,
      order: t.length,
      system: !1
    };
    return t.push(i), await this.saveFolders(t), i;
  }
  /**
   * 重命名文件夹
   */
  async renameFolder(e, t) {
    const a = await this.listFolders(), i = a.find((o) => o.id === e);
    if (!i)
      throw new u("E_NOT_FOUND", `Folder not found: ${e}`);
    if (i.system)
      throw new u("E_FOLDER_SYSTEM", "Cannot rename system folder");
    if (a.some((o) => o.id !== e && o.name === t))
      throw new u("E_ALREADY_EXISTS", `Folder "${t}" already exists`);
    return i.name = t, i.updatedAt = Date.now(), await this.saveFolders(a), i;
  }
  /**
   * 删除文件夹
   */
  async deleteFolder(e) {
    const t = await this.listFolders(), a = t.find((c) => c.id === e);
    if (!a)
      throw new u("E_NOT_FOUND", `Folder not found: ${e}`);
    if (a.system)
      throw new u(
        "E_FOLDER_SYSTEM",
        "Cannot delete system default folder"
      );
    const i = await this.listNotes(e);
    for (const c of i) {
      const w = await this.getNote(c.id);
      w.folderId = "default", w.updatedAt = Date.now(), await this.saveNote(w);
    }
    const o = t.findIndex((c) => c.id === e);
    t.splice(o, 1), await this.saveFolders(t);
  }
  /**
   * 保存文件夹列表
   */
  async saveFolders(e) {
    const t = n.join(this.currentPath, "folders.json");
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
    if (!(await this.listFolders()).some((c) => c.id === e))
      throw new u("E_NOT_FOUND", `Folder not found: ${e}`);
    const i = Date.now(), o = {
      id: this.generateId(),
      folderId: e,
      title: (t == null ? void 0 : t.title) || "无标题",
      content: (t == null ? void 0 : t.content) || { type: "doc", content: [] },
      tags: [],
      pinned: !1,
      color: "ffffff",
      createdAt: i,
      updatedAt: i
    };
    return await this.saveNote(o), o;
  }
  /**
   * 获取便签完整内容
   */
  async getNote(e) {
    const t = n.join(this.currentPath, "notes", `${e}.json`);
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
    const t = n.join(this.currentPath, "notes", `${e}.json`);
    if (!await this.fileExists(t))
      throw new u("E_NOT_FOUND", `Note not found: ${e}`);
    await d.unlink(t);
    const i = this.notesIndexCache || [], o = i.findIndex((c) => c.id === e);
    o >= 0 && (i.splice(o, 1), await this.saveNotesIndex(i));
  }
  /**
   * 保存便签
   * 先写正文，再更新索引
   */
  async saveNote(e) {
    const t = n.join(this.currentPath, "notes", `${e.id}.json`);
    await this.writeJsonFileAtomic(t, e);
    const a = this.notesIndexCache || [], i = a.findIndex((c) => c.id === e.id), o = {
      id: e.id,
      folderId: e.folderId,
      title: e.title,
      excerpt: this.generateExcerpt(e.content),
      updatedAt: e.updatedAt,
      pinned: e.pinned,
      tags: e.tags,
      color: e.color ?? "ffffff"
    };
    i >= 0 ? a[i] = o : a.push(o), await this.saveNotesIndex(a);
  }
  /**
   * 保存便签索引
   */
  async saveNotesIndex(e) {
    const t = n.join(this.currentPath, "notes.index.json");
    await this.writeJsonFile(t, e), this.notesIndexCache = e;
  }
  /**
   * 生成摘要
   */
  generateExcerpt(e) {
    try {
      if (!((c) => typeof c == "object" && c !== null)(e)) return "";
      const a = e;
      if (!Array.isArray(a.content)) return "";
      let i = "";
      const o = (c) => {
        c.type === "text" && typeof c.text == "string" && (i += c.text), c.content && Array.isArray(c.content) && c.content.forEach(o);
      };
      return o(a), i.slice(0, 100);
    } catch {
      return "";
    }
  }
  // ============ 工具方法 ============
  /**
   * 生成唯一 ID
   */
  generateId() {
    return A(8).toString("hex");
  }
  /**
   * 检查文件是否存在
   */
  async fileExists(e) {
    try {
      return await d.access(e), !0;
    } catch {
      return !1;
    }
  }
  /**
   * 读取 JSON 文件
   */
  async readJsonFile(e, t) {
    try {
      const a = await d.readFile(e, "utf-8");
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
      await d.writeFile(e, a, "utf-8");
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
    const a = e.includes("/notes/"), i = n.basename(e), o = a ? `note-${i}.tmp` : `${i}.tmp`, c = n.join(this.currentPath, "temp", o);
    try {
      const w = JSON.stringify(t, null, 2);
      await d.writeFile(c, w, "utf-8"), await d.rename(c, e);
    } catch (w) {
      try {
        await d.unlink(c);
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
const h = new T(), D = n.dirname(W(import.meta.url));
process.env.APP_ROOT = n.join(D, "..");
const m = process.env.VITE_DEV_SERVER_URL, Y = n.join(process.env.APP_ROOT, "dist-electron"), E = n.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = m ? n.join(process.env.APP_ROOT, "public") : E;
let s, N = !1;
const f = /* @__PURE__ */ new Map(), S = /* @__PURE__ */ new Map(), P = /* @__PURE__ */ new Map(), I = { width: 130, height: 48 };
let F = {
  width: 400,
  height: 400
};
function C() {
  return n.join(g.getPath("userData"), "window-state.json");
}
function R() {
  try {
    const r = C();
    if (_.existsSync(r)) {
      const e = _.readFileSync(r, "utf-8");
      return JSON.parse(e);
    }
  } catch (r) {
    console.error("[Window] Failed to load window state:", r);
  }
  return null;
}
function z() {
  if (!(!s || s.isDestroyed()))
    try {
      const r = {
        width: s.getSize()[0],
        height: s.getSize()[1],
        isMaximized: s.isMaximized()
      };
      if (!r.isMaximized) {
        const [t, a] = s.getPosition();
        r.x = t, r.y = a;
      }
      const e = C();
      _.writeFileSync(e, JSON.stringify(r), "utf-8");
    } catch (r) {
      console.error("[Window] Failed to save window state:", r);
    }
}
function k() {
  const r = R();
  s = new x({
    width: (r == null ? void 0 : r.width) ?? 700,
    height: (r == null ? void 0 : r.height) ?? 560,
    x: r == null ? void 0 : r.x,
    y: r == null ? void 0 : r.y,
    minWidth: 700,
    minHeight: 560,
    icon: n.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    frame: !1,
    titleBarStyle: "hidden",
    trafficLightPosition: { x: 12, y: 10 },
    show: !1,
    backgroundColor: "#FFFFFF",
    webPreferences: {
      preload: n.join(D, "preload.mjs")
    }
  }), s.webContents.on("did-finish-load", () => {
    s == null || s.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  }), s.once("ready-to-show", () => {
    s == null || s.show(), r != null && r.isMaximized && (s == null || s.maximize());
  }), s.on("close", (e) => {
    if (process.platform === "darwin" && !N) {
      e.preventDefault(), s == null || s.hide();
      return;
    }
    z(), s = null;
  }), m ? s.loadURL(m) : s.loadFile(n.join(E, "index.html"));
}
g.on("window-all-closed", () => {
  process.platform !== "darwin" && (g.quit(), s = null);
});
g.on("activate", () => {
  s ? s.show() : x.getAllWindows().length === 0 && k();
});
l.on("window-minimize", () => {
  s && s.minimize();
});
l.on("window-maximize", () => {
  s && (s.isMaximized() ? s.unmaximize() : s.maximize());
});
l.on("window-close", () => {
  s && (process.platform === "darwin" ? s.hide() : s.close());
});
l.handle("window-is-maximized", () => (s == null ? void 0 : s.isMaximized()) ?? !1);
l.on("window-double-click-titlebar", () => {
  s && (s.isMaximized() ? s.unmaximize() : s.maximize());
});
const L = g.requestSingleInstanceLock();
L ? g.on("second-instance", () => {
  s && (s.isMinimized() && s.restore(), s.show(), s.focus());
}) : g.quit();
g.on("before-quit", () => {
  N = !0, z();
});
g.whenReady().then(async () => {
  await h.initialize(), k();
});
l.handle("storage:getDefaultPath", () => h.getDefaultPath());
l.handle("storage:getCurrentPath", () => h.getCurrentPath());
l.handle("storage:isFirstLaunch", async () => await h.isFirstLaunch());
l.handle("storage:markInitialized", async () => {
  await h.markInitialized();
});
l.handle(
  "storage:setStoragePath",
  async (r, e, t) => {
    await h.setStoragePath(e, t);
  }
);
l.handle("storage:healthCheck", async () => await h.healthCheck());
l.handle("storage:openInFinder", async () => {
  await h.openInFinder();
});
l.handle("storage:getStats", async () => await h.getStats());
l.handle("storage:createBackup", async () => await h.createBackup());
l.handle("storage:exportData", async (r, e) => {
  await h.exportData(e);
});
l.handle("storage:resetAllData", async () => {
  await h.resetAllData();
});
l.handle("storage:listFolders", async () => await h.listFolders());
l.handle("storage:createFolder", async (r, e) => await h.createFolder(e));
l.handle("storage:renameFolder", async (r, e, t) => await h.renameFolder(e, t));
l.handle("storage:deleteFolder", async (r, e) => {
  await h.deleteFolder(e);
});
l.handle("storage:listNotes", async (r, e) => await h.listNotes(e));
l.handle("storage:createNote", async (r, e, t) => await h.createNote(e, t));
l.handle("storage:getNote", async (r, e) => await h.getNote(e));
l.handle("storage:updateNote", async (r, e, t) => await h.updateNote(e, t));
l.handle("storage:deleteNote", async (r, e) => {
  await h.deleteNote(e);
});
l.handle("dialog:showOpenDialog", async (r, e) => await v.showOpenDialog(e));
l.handle("floating:createWindow", async (r, e) => {
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
    transparent: !1,
    // 设为 false 以支持圆角和阴影（圆角通过 CSS 实现）
    hasShadow: !0,
    alwaysOnTop: !0,
    // 始终置顶
    resizable: !0,
    show: !1,
    backgroundColor: "#ffffff",
    // 设置为背景色而非透明，避免阴影失效
    webPreferences: {
      preload: n.join(D, "preload.mjs")
    }
  });
  return m ? t.loadURL(`${m}#/floating/${e}`) : t.loadFile(n.join(E, "index.html"), {
    hash: `/floating/${e}`
  }), t.once("ready-to-show", () => {
    t.show();
  }), t.on("closed", () => {
    f.delete(e);
  }), f.set(e, t), { success: !0, message: "创建成功" };
});
l.handle("floating:minimizeWindow", async (r, e) => {
  const t = f.get(e);
  if (!t || t.isDestroyed())
    return { success: !1, message: "窗口不存在" };
  const a = t.getBounds();
  P.set(e, a);
  const i = new x({
    width: I.width,
    height: I.height,
    x: a.x,
    y: a.y,
    frame: !1,
    transparent: !1,
    hasShadow: !0,
    alwaysOnTop: !0,
    resizable: !1,
    show: !1,
    backgroundColor: "#ffffff",
    webPreferences: {
      preload: n.join(D, "preload.mjs")
    }
  });
  return m ? i.loadURL(`${m}#/pill/${e}`) : i.loadFile(n.join(E, "index.html"), {
    hash: `/pill/${e}`
  }), i.once("ready-to-show", () => {
    i.show(), t.close();
  }), i.on("closed", () => {
    S.delete(e);
  }), S.set(e, i), { success: !0 };
});
l.handle("floating:restoreWindow", async (r, e) => {
  const t = S.get(e);
  if (!t || t.isDestroyed())
    return { success: !1, message: "药丸窗口不存在" };
  const a = P.get(e);
  if (!a)
    return { success: !1, message: "未找到保存的窗口尺寸" };
  const i = new x({
    width: a.width,
    height: a.height,
    x: a.x,
    y: a.y,
    minWidth: 300,
    minHeight: 300,
    frame: !1,
    transparent: !1,
    hasShadow: !0,
    alwaysOnTop: !0,
    resizable: !0,
    show: !1,
    backgroundColor: "#ffffff",
    webPreferences: {
      preload: n.join(D, "preload.mjs")
    }
  });
  return m ? i.loadURL(`${m}#/floating/${e}`) : i.loadFile(n.join(E, "index.html"), {
    hash: `/floating/${e}`
  }), i.once("ready-to-show", () => {
    i.show(), t.close();
  }), i.on("closed", () => {
    f.delete(e);
  }), f.set(e, i), P.delete(e), { success: !0 };
});
l.handle("floating:closeWindow", async (r, e) => {
  const t = f.get(e);
  return t && !t.isDestroyed() ? (t.close(), f.delete(e), { success: !0 }) : { success: !1, message: "窗口不存在" };
});
l.handle("floating:listWindows", async () => Array.from(f.keys()).filter((e) => {
  const t = f.get(e);
  return t && !t.isDestroyed();
}));
l.on("note:changed", (r, e) => {
  const t = S.get(e);
  t && !t.isDestroyed() && t.webContents.send("note:updated", e);
  const a = f.get(e);
  a && !a.isDestroyed() && a.webContents.send("note:updated", e), s && !s.isDestroyed() && s.webContents.send("note:updated", e);
});
l.on("floating-note:changed", (r, e) => {
  s && !s.isDestroyed() && s.webContents.send("floating-note:updated", e);
});
l.handle("config:getDefaultFloatingWindowSize", async () => F);
l.handle(
  "config:setDefaultFloatingWindowSize",
  async (r, e) => (e.width && e.height && (F = {
    width: e.width,
    height: e.height
  }), F)
);
export {
  Y as MAIN_DIST,
  E as RENDERER_DIST,
  m as VITE_DEV_SERVER_URL
};
