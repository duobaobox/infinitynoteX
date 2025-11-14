var jf = Object.defineProperty;
var Bf = (e, t, r) => t in e ? jf(e, t, { enumerable: !0, configurable: !0, writable: !0, value: r }) : e[t] = r;
var wr = (e, t, r) => Bf(e, typeof t != "symbol" ? t + "" : t, r);
import kt, { app as je, shell as Hf, ipcMain as W, BrowserWindow as zr, dialog as qf } from "electron";
import { fileURLToPath as Gf } from "node:url";
import B from "node:path";
import kn from "node:fs";
import K from "node:fs/promises";
import { randomBytes as Wf } from "node:crypto";
import At from "fs";
import zf from "constants";
import Vr from "stream";
import $a from "util";
import Sl from "assert";
import oe from "path";
import Zn from "child_process";
import Al from "events";
import Yr from "crypto";
import Tl from "tty";
import ei from "os";
import lr from "url";
import Vf from "string_decoder";
import Cl from "zlib";
import Yf from "http";
class ge extends Error {
  constructor(t, r, n) {
    super(r), this.code = t, this.details = n, this.name = "StorageError";
  }
}
class Xf {
  constructor() {
    wr(this, "currentPath");
    wr(this, "foldersCache", null);
    wr(this, "notesIndexCache", null);
    wr(this, "defaultPath");
    this.defaultPath = B.join(je.getPath("userData"), "data-v1"), this.currentPath = this.defaultPath;
  }
  /**
   * 初始化存储
   * 应用启动时调用，确保目录结构存在
   */
  async initialize() {
    try {
      await this.ensureStorageInitialized(this.currentPath), await this.recoverFromCrash(), console.log(`[Storage] Initialized at: ${this.currentPath}`);
    } catch (t) {
      throw console.error("[Storage] Initialization failed:", t), new ge("E_IO_WRITE", "Failed to initialize storage", t);
    }
  }
  /**
   * 检查是否首次启动（未初始化）
   */
  async isFirstLaunch() {
    const t = B.join(this.currentPath, "meta.json");
    if (!await this.fileExists(t))
      return !0;
    try {
      return !(await this.readJsonFile(t)).initialized;
    } catch {
      return !0;
    }
  }
  /**
   * 标记为已初始化
   */
  async markInitialized() {
    const t = B.join(this.currentPath, "meta.json"), r = await this.readJsonFile(t, {
      schemaVersion: 1,
      storageId: this.generateId(),
      createdAt: Date.now()
    });
    r.initialized = !0, await this.writeJsonFile(t, r);
  }
  /**
   * 确保存储目录初始化
   */
  async ensureStorageInitialized(t) {
    const r = B.join(t, "meta.json");
    if (await this.fileExists(r)) {
      await this.loadCaches();
      return;
    }
    console.log(`[Storage] First-time initialization at: ${t}`), await K.mkdir(t, { recursive: !0 }), await K.mkdir(B.join(t, "notes"), { recursive: !0 }), await K.mkdir(B.join(t, "temp"), { recursive: !0 }), await K.mkdir(B.join(t, "backups"), { recursive: !0 });
    const i = {
      schemaVersion: 1,
      storageId: this.generateId(),
      createdAt: Date.now()
    };
    await this.writeJsonFile(r, i);
    const a = {
      id: "default",
      name: "默认文件夹",
      system: !0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      order: 0
    }, o = B.join(t, "folders.json");
    await this.writeJsonFile(o, [a]);
    const s = B.join(t, "notes.index.json");
    await this.writeJsonFile(s, []), await this.loadCaches();
  }
  /**
   * 加载缓存
   */
  async loadCaches() {
    const t = B.join(this.currentPath, "folders.json"), r = B.join(this.currentPath, "notes.index.json");
    this.foldersCache = await this.readJsonFile(t, []), this.notesIndexCache = await this.readJsonFile(r, []);
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
      const t = B.join(this.currentPath, "temp");
      if (!await this.fileExists(t))
        return;
      const n = await K.readdir(t);
      let i = 0;
      for (const a of n) {
        if (!a.endsWith(".tmp"))
          continue;
        const o = B.join(t, a), s = a.replace(".tmp", "");
        let l;
        if (s.startsWith("note-")) {
          const m = s.replace("note-", "").replace(".json", "");
          l = B.join(this.currentPath, "notes", `${m}.json`);
        } else
          l = B.join(this.currentPath, s);
        try {
          const m = await K.readFile(o, "utf-8");
          JSON.parse(m), await K.rename(o, l), i++, console.log(`[Storage] Recovered temp file: ${a}`);
        } catch (m) {
          console.warn(`[Storage] Removing corrupted temp file: ${a}`, m), await K.unlink(o);
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
  async setStoragePath(t, r) {
    if (!((r == null ? void 0 : r.migrate) ?? !1)) {
      this.currentPath = t, this.clearCaches(), await this.ensureStorageInitialized(t);
      return;
    }
    await this.migrateData(this.currentPath, t);
  }
  /**
   * 迁移数据
   */
  async migrateData(t, r) {
    try {
      console.log(`[Storage] Migrating from ${t} to ${r}`), await this.validateMigrationPath(r);
      const n = B.join(t, "backups", `backup-${Date.now()}`);
      await this.copyDirectory(t, n), await this.copyDirectory(t, r), await this.validateStorageIntegrity(r), this.currentPath = r, this.clearCaches(), await this.loadCaches(), console.log("[Storage] Migration completed successfully");
    } catch (n) {
      throw console.error("[Storage] Migration failed:", n), new ge("E_MIGRATE_FAIL", "Data migration failed", n);
    }
  }
  /**
   * 校验迁移路径
   */
  async validateMigrationPath(t) {
    try {
      if (await this.fileExists(t)) {
        if ((await K.readdir(t)).length > 0)
          throw new Error("Target directory is not empty");
      } else
        await K.mkdir(t, { recursive: !0 });
      await K.access(t, kn.constants.W_OK);
    } catch (r) {
      throw new ge("E_PATH_INVALID", "Invalid migration path", r);
    }
  }
  /**
   * 校验存储完整性
   */
  async validateStorageIntegrity(t) {
    const r = ["meta.json", "folders.json", "notes.index.json"];
    for (const n of r) {
      const i = B.join(t, n);
      if (!await this.fileExists(i))
        throw new Error(`Missing required file: ${n}`);
    }
  }
  /**
   * 拷贝目录
   */
  async copyDirectory(t, r) {
    await K.mkdir(r, { recursive: !0 });
    const n = await K.readdir(t, { withFileTypes: !0 });
    for (const i of n) {
      const a = B.join(t, i.name), o = B.join(r, i.name);
      if (i.isDirectory()) {
        if (i.name === "temp" || i.name === "backups")
          continue;
        await this.copyDirectory(a, o);
      } else
        await K.copyFile(a, o);
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
    await Hf.openPath(this.currentPath);
  }
  /**
   * 获取存储统计信息
   */
  async getStats() {
    const t = this.foldersCache || [], r = this.notesIndexCache || [], n = await this.calculateDirectorySize(this.currentPath);
    return {
      folderCount: t.length,
      noteCount: r.length,
      dataSize: n
    };
  }
  /**
   * 创建备份
   */
  async createBackup() {
    try {
      const r = `backup-${Date.now()}`, n = B.join(this.currentPath, "backups", r);
      return console.log(`[Storage] Creating backup: ${r}`), await this.copyDirectory(this.currentPath, n), console.log(`[Storage] Backup created successfully: ${n}`), n;
    } catch (t) {
      throw console.error("[Storage] Backup creation failed:", t), new ge("E_IO_WRITE", "Failed to create backup", t);
    }
  }
  /**
   * 导出数据到指定路径
   */
  async exportData(t) {
    try {
      console.log(`[Storage] Exporting data to: ${t}`), await K.mkdir(t, { recursive: !0 }), await this.copyDirectory(this.currentPath, t), console.log("[Storage] Data exported successfully");
    } catch (r) {
      throw console.error("[Storage] Data export failed:", r), new ge("E_IO_WRITE", "Failed to export data", r);
    }
  }
  /**
   * 重置所有数据（清空并重新初始化）
   * 用于开发环境或完全重置
   */
  async resetAllData() {
    try {
      console.log(`[Storage] Resetting all data at: ${this.currentPath}`);
      const t = await K.readdir(this.currentPath, { withFileTypes: !0 });
      for (const r of t) {
        const n = B.join(this.currentPath, r.name);
        r.isDirectory() ? await this.deleteDirectory(n) : await K.unlink(n);
      }
      await this.ensureStorageInitialized(this.currentPath), console.log("[Storage] Data reset successfully");
    } catch (t) {
      throw console.error("[Storage] Data reset failed:", t), new ge("E_IO_WRITE", "Failed to reset data", t);
    }
  }
  /**
   * 递归删除目录
   */
  async deleteDirectory(t) {
    try {
      const r = await K.readdir(t, { withFileTypes: !0 });
      for (const n of r) {
        const i = B.join(t, n.name);
        n.isDirectory() ? await this.deleteDirectory(i) : await K.unlink(i);
      }
      await K.rmdir(t);
    } catch (r) {
      throw console.error(`[Storage] Failed to delete directory ${t}:`, r), r;
    }
  }
  /**
   * 计算目录大小
   */
  async calculateDirectorySize(t) {
    let r = 0;
    try {
      const n = await K.readdir(t, { withFileTypes: !0 });
      for (const i of n) {
        const a = B.join(t, i.name);
        if (i.isDirectory())
          r += await this.calculateDirectorySize(a);
        else {
          const o = await K.stat(a);
          r += o.size;
        }
      }
    } catch (n) {
      console.error(`[Storage] Error calculating size for ${t}:`, n);
    }
    return r;
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
    const r = await this.listFolders();
    if (r.some((a) => a.name === t))
      throw new ge("E_ALREADY_EXISTS", `Folder "${t}" already exists`);
    const n = Date.now(), i = {
      id: this.generateId(),
      name: t,
      createdAt: n,
      updatedAt: n,
      order: r.length,
      system: !1
    };
    return r.push(i), await this.saveFolders(r), i;
  }
  /**
   * 重命名文件夹
   */
  async renameFolder(t, r) {
    const n = await this.listFolders(), i = n.find((a) => a.id === t);
    if (!i)
      throw new ge("E_NOT_FOUND", `Folder not found: ${t}`);
    if (i.system)
      throw new ge("E_FOLDER_SYSTEM", "Cannot rename system folder");
    if (n.some((a) => a.id !== t && a.name === r))
      throw new ge("E_ALREADY_EXISTS", `Folder "${r}" already exists`);
    return i.name = r, i.updatedAt = Date.now(), await this.saveFolders(n), i;
  }
  /**
   * 删除文件夹
   */
  async deleteFolder(t) {
    const r = await this.listFolders(), n = r.find((o) => o.id === t);
    if (!n)
      throw new ge("E_NOT_FOUND", `Folder not found: ${t}`);
    if (n.system)
      throw new ge(
        "E_FOLDER_SYSTEM",
        "Cannot delete system default folder"
      );
    const i = await this.listNotes(t);
    for (const o of i) {
      const s = await this.getNote(o.id);
      s.folderId = "default", s.updatedAt = Date.now(), await this.saveNote(s);
    }
    const a = r.findIndex((o) => o.id === t);
    r.splice(a, 1), await this.saveFolders(r);
  }
  /**
   * 保存文件夹列表
   */
  async saveFolders(t) {
    const r = B.join(this.currentPath, "folders.json");
    await this.writeJsonFile(r, t), this.foldersCache = t;
  }
  // ============ 便签操作 ============
  /**
   * 列出便签索引
   */
  async listNotes(t) {
    this.notesIndexCache || await this.loadCaches();
    const r = this.notesIndexCache || [];
    return t ? r.filter((n) => n.folderId === t) : r;
  }
  /**
   * 创建便签
   */
  async createNote(t, r) {
    if (!(await this.listFolders()).some((o) => o.id === t))
      throw new ge("E_NOT_FOUND", `Folder not found: ${t}`);
    const i = Date.now(), a = {
      id: this.generateId(),
      folderId: t,
      title: (r == null ? void 0 : r.title) || "无标题",
      content: (r == null ? void 0 : r.content) || { type: "doc", content: [] },
      tags: [],
      pinned: !1,
      color: "ffffff",
      createdAt: i,
      updatedAt: i
    };
    return await this.saveNote(a), a;
  }
  /**
   * 获取便签完整内容
   */
  async getNote(t) {
    const r = B.join(this.currentPath, "notes", `${t}.json`);
    if (!await this.fileExists(r))
      throw new ge("E_NOT_FOUND", `Note not found: ${t}`);
    return await this.readJsonFile(r);
  }
  /**
   * 更新便签
   */
  async updateNote(t, r) {
    const n = await this.getNote(t);
    return Object.assign(n, r), n.updatedAt = Date.now(), await this.saveNote(n), n;
  }
  /**
   * 删除便签
   */
  async deleteNote(t) {
    const r = B.join(this.currentPath, "notes", `${t}.json`);
    if (!await this.fileExists(r))
      throw new ge("E_NOT_FOUND", `Note not found: ${t}`);
    await K.unlink(r);
    const i = this.notesIndexCache || [], a = i.findIndex((o) => o.id === t);
    a >= 0 && (i.splice(a, 1), await this.saveNotesIndex(i));
  }
  /**
   * 保存便签
   * 先写正文，再更新索引
   */
  async saveNote(t) {
    const r = B.join(this.currentPath, "notes", `${t.id}.json`);
    await this.writeJsonFileAtomic(r, t);
    const n = this.notesIndexCache || [], i = n.findIndex((o) => o.id === t.id), a = {
      id: t.id,
      folderId: t.folderId,
      title: t.title,
      excerpt: this.generateExcerpt(t.content),
      updatedAt: t.updatedAt,
      pinned: t.pinned,
      tags: t.tags,
      color: t.color ?? "ffffff"
    };
    i >= 0 ? n[i] = a : n.push(a), await this.saveNotesIndex(n);
  }
  /**
   * 保存便签索引
   */
  async saveNotesIndex(t) {
    const r = B.join(this.currentPath, "notes.index.json");
    await this.writeJsonFile(r, t), this.notesIndexCache = t;
  }
  /**
   * 生成摘要
   */
  generateExcerpt(t) {
    try {
      if (!((o) => typeof o == "object" && o !== null)(t)) return "";
      const n = t;
      if (!Array.isArray(n.content)) return "";
      let i = "";
      const a = (o) => {
        o.type === "text" && typeof o.text == "string" && (i += o.text), o.content && Array.isArray(o.content) && o.content.forEach(a);
      };
      return a(n), i.slice(0, 100);
    } catch {
      return "";
    }
  }
  // ============ 工具方法 ============
  /**
   * 生成唯一 ID
   */
  generateId() {
    return Wf(8).toString("hex");
  }
  /**
   * 检查文件是否存在
   */
  async fileExists(t) {
    try {
      return await K.access(t), !0;
    } catch {
      return !1;
    }
  }
  /**
   * 读取 JSON 文件
   */
  async readJsonFile(t, r) {
    try {
      const n = await K.readFile(t, "utf-8");
      return JSON.parse(n);
    } catch (n) {
      if (r !== void 0)
        return r;
      throw new ge("E_IO_READ", `Failed to read file: ${t}`, n);
    }
  }
  /**
   * 写入 JSON 文件
   */
  async writeJsonFile(t, r) {
    try {
      const n = JSON.stringify(r, null, 2);
      await K.writeFile(t, n, "utf-8");
    } catch (n) {
      throw new ge(
        "E_IO_WRITE",
        `Failed to write file: ${t}`,
        n
      );
    }
  }
  /**
   * 原子写入 JSON 文件
   * 先写临时文件，再重命名
   */
  async writeJsonFileAtomic(t, r) {
    const n = t.includes("/notes/"), i = B.basename(t), a = n ? `note-${i}.tmp` : `${i}.tmp`, o = B.join(this.currentPath, "temp", a);
    try {
      const s = JSON.stringify(r, null, 2);
      await K.writeFile(o, s, "utf-8"), await K.rename(o, t);
    } catch (s) {
      try {
        await K.unlink(o);
      } catch {
      }
      throw new ge(
        "E_IO_WRITE",
        `Failed to write file atomically: ${t}`,
        s
      );
    }
  }
}
const ue = new Xf();
var Ie = typeof globalThis < "u" ? globalThis : typeof window < "u" ? window : typeof global < "u" ? global : typeof self < "u" ? self : {}, xe = {}, jt = {}, Pe = {};
Pe.fromCallback = function(e) {
  return Object.defineProperty(function(...t) {
    if (typeof t[t.length - 1] == "function") e.apply(this, t);
    else
      return new Promise((r, n) => {
        t.push((i, a) => i != null ? n(i) : r(a)), e.apply(this, t);
      });
  }, "name", { value: e.name });
};
Pe.fromPromise = function(e) {
  return Object.defineProperty(function(...t) {
    const r = t[t.length - 1];
    if (typeof r != "function") return e.apply(this, t);
    t.pop(), e.apply(this, t).then((n) => r(null, n), r);
  }, "name", { value: e.name });
};
var dt = zf, Jf = process.cwd, Fn = null, Kf = process.env.GRACEFUL_FS_PLATFORM || process.platform;
process.cwd = function() {
  return Fn || (Fn = Jf.call(process)), Fn;
};
try {
  process.cwd();
} catch {
}
if (typeof process.chdir == "function") {
  var Ao = process.chdir;
  process.chdir = function(e) {
    Fn = null, Ao.call(process, e);
  }, Object.setPrototypeOf && Object.setPrototypeOf(process.chdir, Ao);
}
var Qf = Zf;
function Zf(e) {
  dt.hasOwnProperty("O_SYMLINK") && process.version.match(/^v0\.6\.[0-2]|^v0\.5\./) && t(e), e.lutimes || r(e), e.chown = a(e.chown), e.fchown = a(e.fchown), e.lchown = a(e.lchown), e.chmod = n(e.chmod), e.fchmod = n(e.fchmod), e.lchmod = n(e.lchmod), e.chownSync = o(e.chownSync), e.fchownSync = o(e.fchownSync), e.lchownSync = o(e.lchownSync), e.chmodSync = i(e.chmodSync), e.fchmodSync = i(e.fchmodSync), e.lchmodSync = i(e.lchmodSync), e.stat = s(e.stat), e.fstat = s(e.fstat), e.lstat = s(e.lstat), e.statSync = l(e.statSync), e.fstatSync = l(e.fstatSync), e.lstatSync = l(e.lstatSync), e.chmod && !e.lchmod && (e.lchmod = function(c, f, h) {
    h && process.nextTick(h);
  }, e.lchmodSync = function() {
  }), e.chown && !e.lchown && (e.lchown = function(c, f, h, g) {
    g && process.nextTick(g);
  }, e.lchownSync = function() {
  }), Kf === "win32" && (e.rename = typeof e.rename != "function" ? e.rename : function(c) {
    function f(h, g, _) {
      var w = Date.now(), S = 0;
      c(h, g, function T(A) {
        if (A && (A.code === "EACCES" || A.code === "EPERM" || A.code === "EBUSY") && Date.now() - w < 6e4) {
          setTimeout(function() {
            e.stat(g, function(R, x) {
              R && R.code === "ENOENT" ? c(h, g, T) : _(A);
            });
          }, S), S < 100 && (S += 10);
          return;
        }
        _ && _(A);
      });
    }
    return Object.setPrototypeOf && Object.setPrototypeOf(f, c), f;
  }(e.rename)), e.read = typeof e.read != "function" ? e.read : function(c) {
    function f(h, g, _, w, S, T) {
      var A;
      if (T && typeof T == "function") {
        var R = 0;
        A = function(x, re, ce) {
          if (x && x.code === "EAGAIN" && R < 10)
            return R++, c.call(e, h, g, _, w, S, A);
          T.apply(this, arguments);
        };
      }
      return c.call(e, h, g, _, w, S, A);
    }
    return Object.setPrototypeOf && Object.setPrototypeOf(f, c), f;
  }(e.read), e.readSync = typeof e.readSync != "function" ? e.readSync : /* @__PURE__ */ function(c) {
    return function(f, h, g, _, w) {
      for (var S = 0; ; )
        try {
          return c.call(e, f, h, g, _, w);
        } catch (T) {
          if (T.code === "EAGAIN" && S < 10) {
            S++;
            continue;
          }
          throw T;
        }
    };
  }(e.readSync);
  function t(c) {
    c.lchmod = function(f, h, g) {
      c.open(
        f,
        dt.O_WRONLY | dt.O_SYMLINK,
        h,
        function(_, w) {
          if (_) {
            g && g(_);
            return;
          }
          c.fchmod(w, h, function(S) {
            c.close(w, function(T) {
              g && g(S || T);
            });
          });
        }
      );
    }, c.lchmodSync = function(f, h) {
      var g = c.openSync(f, dt.O_WRONLY | dt.O_SYMLINK, h), _ = !0, w;
      try {
        w = c.fchmodSync(g, h), _ = !1;
      } finally {
        if (_)
          try {
            c.closeSync(g);
          } catch {
          }
        else
          c.closeSync(g);
      }
      return w;
    };
  }
  function r(c) {
    dt.hasOwnProperty("O_SYMLINK") && c.futimes ? (c.lutimes = function(f, h, g, _) {
      c.open(f, dt.O_SYMLINK, function(w, S) {
        if (w) {
          _ && _(w);
          return;
        }
        c.futimes(S, h, g, function(T) {
          c.close(S, function(A) {
            _ && _(T || A);
          });
        });
      });
    }, c.lutimesSync = function(f, h, g) {
      var _ = c.openSync(f, dt.O_SYMLINK), w, S = !0;
      try {
        w = c.futimesSync(_, h, g), S = !1;
      } finally {
        if (S)
          try {
            c.closeSync(_);
          } catch {
          }
        else
          c.closeSync(_);
      }
      return w;
    }) : c.futimes && (c.lutimes = function(f, h, g, _) {
      _ && process.nextTick(_);
    }, c.lutimesSync = function() {
    });
  }
  function n(c) {
    return c && function(f, h, g) {
      return c.call(e, f, h, function(_) {
        m(_) && (_ = null), g && g.apply(this, arguments);
      });
    };
  }
  function i(c) {
    return c && function(f, h) {
      try {
        return c.call(e, f, h);
      } catch (g) {
        if (!m(g)) throw g;
      }
    };
  }
  function a(c) {
    return c && function(f, h, g, _) {
      return c.call(e, f, h, g, function(w) {
        m(w) && (w = null), _ && _.apply(this, arguments);
      });
    };
  }
  function o(c) {
    return c && function(f, h, g) {
      try {
        return c.call(e, f, h, g);
      } catch (_) {
        if (!m(_)) throw _;
      }
    };
  }
  function s(c) {
    return c && function(f, h, g) {
      typeof h == "function" && (g = h, h = null);
      function _(w, S) {
        S && (S.uid < 0 && (S.uid += 4294967296), S.gid < 0 && (S.gid += 4294967296)), g && g.apply(this, arguments);
      }
      return h ? c.call(e, f, h, _) : c.call(e, f, _);
    };
  }
  function l(c) {
    return c && function(f, h) {
      var g = h ? c.call(e, f, h) : c.call(e, f);
      return g && (g.uid < 0 && (g.uid += 4294967296), g.gid < 0 && (g.gid += 4294967296)), g;
    };
  }
  function m(c) {
    if (!c || c.code === "ENOSYS")
      return !0;
    var f = !process.getuid || process.getuid() !== 0;
    return !!(f && (c.code === "EINVAL" || c.code === "EPERM"));
  }
}
var To = Vr.Stream, ed = td;
function td(e) {
  return {
    ReadStream: t,
    WriteStream: r
  };
  function t(n, i) {
    if (!(this instanceof t)) return new t(n, i);
    To.call(this);
    var a = this;
    this.path = n, this.fd = null, this.readable = !0, this.paused = !1, this.flags = "r", this.mode = 438, this.bufferSize = 64 * 1024, i = i || {};
    for (var o = Object.keys(i), s = 0, l = o.length; s < l; s++) {
      var m = o[s];
      this[m] = i[m];
    }
    if (this.encoding && this.setEncoding(this.encoding), this.start !== void 0) {
      if (typeof this.start != "number")
        throw TypeError("start must be a Number");
      if (this.end === void 0)
        this.end = 1 / 0;
      else if (typeof this.end != "number")
        throw TypeError("end must be a Number");
      if (this.start > this.end)
        throw new Error("start must be <= end");
      this.pos = this.start;
    }
    if (this.fd !== null) {
      process.nextTick(function() {
        a._read();
      });
      return;
    }
    e.open(this.path, this.flags, this.mode, function(c, f) {
      if (c) {
        a.emit("error", c), a.readable = !1;
        return;
      }
      a.fd = f, a.emit("open", f), a._read();
    });
  }
  function r(n, i) {
    if (!(this instanceof r)) return new r(n, i);
    To.call(this), this.path = n, this.fd = null, this.writable = !0, this.flags = "w", this.encoding = "binary", this.mode = 438, this.bytesWritten = 0, i = i || {};
    for (var a = Object.keys(i), o = 0, s = a.length; o < s; o++) {
      var l = a[o];
      this[l] = i[l];
    }
    if (this.start !== void 0) {
      if (typeof this.start != "number")
        throw TypeError("start must be a Number");
      if (this.start < 0)
        throw new Error("start must be >= zero");
      this.pos = this.start;
    }
    this.busy = !1, this._queue = [], this.fd === null && (this._open = e.open, this._queue.push([this._open, this.path, this.flags, this.mode, void 0]), this.flush());
  }
}
var rd = id, nd = Object.getPrototypeOf || function(e) {
  return e.__proto__;
};
function id(e) {
  if (e === null || typeof e != "object")
    return e;
  if (e instanceof Object)
    var t = { __proto__: nd(e) };
  else
    var t = /* @__PURE__ */ Object.create(null);
  return Object.getOwnPropertyNames(e).forEach(function(r) {
    Object.defineProperty(t, r, Object.getOwnPropertyDescriptor(e, r));
  }), t;
}
var ae = At, ad = Qf, od = ed, sd = rd, wn = $a, _e, Mn;
typeof Symbol == "function" && typeof Symbol.for == "function" ? (_e = Symbol.for("graceful-fs.queue"), Mn = Symbol.for("graceful-fs.previous")) : (_e = "___graceful-fs.queue", Mn = "___graceful-fs.previous");
function ld() {
}
function $l(e, t) {
  Object.defineProperty(e, _e, {
    get: function() {
      return t;
    }
  });
}
var Lt = ld;
wn.debuglog ? Lt = wn.debuglog("gfs4") : /\bgfs4\b/i.test(process.env.NODE_DEBUG || "") && (Lt = function() {
  var e = wn.format.apply(wn, arguments);
  e = "GFS4: " + e.split(/\n/).join(`
GFS4: `), console.error(e);
});
if (!ae[_e]) {
  var cd = Ie[_e] || [];
  $l(ae, cd), ae.close = function(e) {
    function t(r, n) {
      return e.call(ae, r, function(i) {
        i || Co(), typeof n == "function" && n.apply(this, arguments);
      });
    }
    return Object.defineProperty(t, Mn, {
      value: e
    }), t;
  }(ae.close), ae.closeSync = function(e) {
    function t(r) {
      e.apply(ae, arguments), Co();
    }
    return Object.defineProperty(t, Mn, {
      value: e
    }), t;
  }(ae.closeSync), /\bgfs4\b/i.test(process.env.NODE_DEBUG || "") && process.on("exit", function() {
    Lt(ae[_e]), Sl.equal(ae[_e].length, 0);
  });
}
Ie[_e] || $l(Ie, ae[_e]);
var Ne = ba(sd(ae));
process.env.TEST_GRACEFUL_FS_GLOBAL_PATCH && !ae.__patched && (Ne = ba(ae), ae.__patched = !0);
function ba(e) {
  ad(e), e.gracefulify = ba, e.createReadStream = re, e.createWriteStream = ce;
  var t = e.readFile;
  e.readFile = r;
  function r(y, z, H) {
    return typeof z == "function" && (H = z, z = null), j(y, z, H);
    function j(Q, O, b, P) {
      return t(Q, O, function($) {
        $ && ($.code === "EMFILE" || $.code === "ENFILE") ? Gt([j, [Q, O, b], $, P || Date.now(), Date.now()]) : typeof b == "function" && b.apply(this, arguments);
      });
    }
  }
  var n = e.writeFile;
  e.writeFile = i;
  function i(y, z, H, j) {
    return typeof H == "function" && (j = H, H = null), Q(y, z, H, j);
    function Q(O, b, P, $, N) {
      return n(O, b, P, function(D) {
        D && (D.code === "EMFILE" || D.code === "ENFILE") ? Gt([Q, [O, b, P, $], D, N || Date.now(), Date.now()]) : typeof $ == "function" && $.apply(this, arguments);
      });
    }
  }
  var a = e.appendFile;
  a && (e.appendFile = o);
  function o(y, z, H, j) {
    return typeof H == "function" && (j = H, H = null), Q(y, z, H, j);
    function Q(O, b, P, $, N) {
      return a(O, b, P, function(D) {
        D && (D.code === "EMFILE" || D.code === "ENFILE") ? Gt([Q, [O, b, P, $], D, N || Date.now(), Date.now()]) : typeof $ == "function" && $.apply(this, arguments);
      });
    }
  }
  var s = e.copyFile;
  s && (e.copyFile = l);
  function l(y, z, H, j) {
    return typeof H == "function" && (j = H, H = 0), Q(y, z, H, j);
    function Q(O, b, P, $, N) {
      return s(O, b, P, function(D) {
        D && (D.code === "EMFILE" || D.code === "ENFILE") ? Gt([Q, [O, b, P, $], D, N || Date.now(), Date.now()]) : typeof $ == "function" && $.apply(this, arguments);
      });
    }
  }
  var m = e.readdir;
  e.readdir = f;
  var c = /^v[0-5]\./;
  function f(y, z, H) {
    typeof z == "function" && (H = z, z = null);
    var j = c.test(process.version) ? function(b, P, $, N) {
      return m(b, Q(
        b,
        P,
        $,
        N
      ));
    } : function(b, P, $, N) {
      return m(b, P, Q(
        b,
        P,
        $,
        N
      ));
    };
    return j(y, z, H);
    function Q(O, b, P, $) {
      return function(N, D) {
        N && (N.code === "EMFILE" || N.code === "ENFILE") ? Gt([
          j,
          [O, b, P],
          N,
          $ || Date.now(),
          Date.now()
        ]) : (D && D.sort && D.sort(), typeof P == "function" && P.call(this, N, D));
      };
    }
  }
  if (process.version.substr(0, 4) === "v0.8") {
    var h = od(e);
    T = h.ReadStream, R = h.WriteStream;
  }
  var g = e.ReadStream;
  g && (T.prototype = Object.create(g.prototype), T.prototype.open = A);
  var _ = e.WriteStream;
  _ && (R.prototype = Object.create(_.prototype), R.prototype.open = x), Object.defineProperty(e, "ReadStream", {
    get: function() {
      return T;
    },
    set: function(y) {
      T = y;
    },
    enumerable: !0,
    configurable: !0
  }), Object.defineProperty(e, "WriteStream", {
    get: function() {
      return R;
    },
    set: function(y) {
      R = y;
    },
    enumerable: !0,
    configurable: !0
  });
  var w = T;
  Object.defineProperty(e, "FileReadStream", {
    get: function() {
      return w;
    },
    set: function(y) {
      w = y;
    },
    enumerable: !0,
    configurable: !0
  });
  var S = R;
  Object.defineProperty(e, "FileWriteStream", {
    get: function() {
      return S;
    },
    set: function(y) {
      S = y;
    },
    enumerable: !0,
    configurable: !0
  });
  function T(y, z) {
    return this instanceof T ? (g.apply(this, arguments), this) : T.apply(Object.create(T.prototype), arguments);
  }
  function A() {
    var y = this;
    ke(y.path, y.flags, y.mode, function(z, H) {
      z ? (y.autoClose && y.destroy(), y.emit("error", z)) : (y.fd = H, y.emit("open", H), y.read());
    });
  }
  function R(y, z) {
    return this instanceof R ? (_.apply(this, arguments), this) : R.apply(Object.create(R.prototype), arguments);
  }
  function x() {
    var y = this;
    ke(y.path, y.flags, y.mode, function(z, H) {
      z ? (y.destroy(), y.emit("error", z)) : (y.fd = H, y.emit("open", H));
    });
  }
  function re(y, z) {
    return new e.ReadStream(y, z);
  }
  function ce(y, z) {
    return new e.WriteStream(y, z);
  }
  var X = e.open;
  e.open = ke;
  function ke(y, z, H, j) {
    return typeof H == "function" && (j = H, H = null), Q(y, z, H, j);
    function Q(O, b, P, $, N) {
      return X(O, b, P, function(D, M) {
        D && (D.code === "EMFILE" || D.code === "ENFILE") ? Gt([Q, [O, b, P, $], D, N || Date.now(), Date.now()]) : typeof $ == "function" && $.apply(this, arguments);
      });
    }
  }
  return e;
}
function Gt(e) {
  Lt("ENQUEUE", e[0].name, e[1]), ae[_e].push(e), Ia();
}
var En;
function Co() {
  for (var e = Date.now(), t = 0; t < ae[_e].length; ++t)
    ae[_e][t].length > 2 && (ae[_e][t][3] = e, ae[_e][t][4] = e);
  Ia();
}
function Ia() {
  if (clearTimeout(En), En = void 0, ae[_e].length !== 0) {
    var e = ae[_e].shift(), t = e[0], r = e[1], n = e[2], i = e[3], a = e[4];
    if (i === void 0)
      Lt("RETRY", t.name, r), t.apply(null, r);
    else if (Date.now() - i >= 6e4) {
      Lt("TIMEOUT", t.name, r);
      var o = r.pop();
      typeof o == "function" && o.call(null, n);
    } else {
      var s = Date.now() - a, l = Math.max(a - i, 1), m = Math.min(l * 1.2, 100);
      s >= m ? (Lt("RETRY", t.name, r), t.apply(null, r.concat([i]))) : ae[_e].push(e);
    }
    En === void 0 && (En = setTimeout(Ia, 0));
  }
}
(function(e) {
  const t = Pe.fromCallback, r = Ne, n = [
    "access",
    "appendFile",
    "chmod",
    "chown",
    "close",
    "copyFile",
    "fchmod",
    "fchown",
    "fdatasync",
    "fstat",
    "fsync",
    "ftruncate",
    "futimes",
    "lchmod",
    "lchown",
    "link",
    "lstat",
    "mkdir",
    "mkdtemp",
    "open",
    "opendir",
    "readdir",
    "readFile",
    "readlink",
    "realpath",
    "rename",
    "rm",
    "rmdir",
    "stat",
    "symlink",
    "truncate",
    "unlink",
    "utimes",
    "writeFile"
  ].filter((i) => typeof r[i] == "function");
  Object.assign(e, r), n.forEach((i) => {
    e[i] = t(r[i]);
  }), e.exists = function(i, a) {
    return typeof a == "function" ? r.exists(i, a) : new Promise((o) => r.exists(i, o));
  }, e.read = function(i, a, o, s, l, m) {
    return typeof m == "function" ? r.read(i, a, o, s, l, m) : new Promise((c, f) => {
      r.read(i, a, o, s, l, (h, g, _) => {
        if (h) return f(h);
        c({ bytesRead: g, buffer: _ });
      });
    });
  }, e.write = function(i, a, ...o) {
    return typeof o[o.length - 1] == "function" ? r.write(i, a, ...o) : new Promise((s, l) => {
      r.write(i, a, ...o, (m, c, f) => {
        if (m) return l(m);
        s({ bytesWritten: c, buffer: f });
      });
    });
  }, typeof r.writev == "function" && (e.writev = function(i, a, ...o) {
    return typeof o[o.length - 1] == "function" ? r.writev(i, a, ...o) : new Promise((s, l) => {
      r.writev(i, a, ...o, (m, c, f) => {
        if (m) return l(m);
        s({ bytesWritten: c, buffers: f });
      });
    });
  }), typeof r.realpath.native == "function" ? e.realpath.native = t(r.realpath.native) : process.emitWarning(
    "fs.realpath.native is not a function. Is fs being monkey-patched?",
    "Warning",
    "fs-extra-WARN0003"
  );
})(jt);
var Oa = {}, bl = {};
const ud = oe;
bl.checkPath = function(t) {
  if (process.platform === "win32" && /[<>:"|?*]/.test(t.replace(ud.parse(t).root, ""))) {
    const n = new Error(`Path contains invalid characters: ${t}`);
    throw n.code = "EINVAL", n;
  }
};
const Il = jt, { checkPath: Ol } = bl, Dl = (e) => {
  const t = { mode: 511 };
  return typeof e == "number" ? e : { ...t, ...e }.mode;
};
Oa.makeDir = async (e, t) => (Ol(e), Il.mkdir(e, {
  mode: Dl(t),
  recursive: !0
}));
Oa.makeDirSync = (e, t) => (Ol(e), Il.mkdirSync(e, {
  mode: Dl(t),
  recursive: !0
}));
const fd = Pe.fromPromise, { makeDir: dd, makeDirSync: Pi } = Oa, Ni = fd(dd);
var tt = {
  mkdirs: Ni,
  mkdirsSync: Pi,
  // alias
  mkdirp: Ni,
  mkdirpSync: Pi,
  ensureDir: Ni,
  ensureDirSync: Pi
};
const hd = Pe.fromPromise, Pl = jt;
function pd(e) {
  return Pl.access(e).then(() => !0).catch(() => !1);
}
var Bt = {
  pathExists: hd(pd),
  pathExistsSync: Pl.existsSync
};
const rr = Ne;
function md(e, t, r, n) {
  rr.open(e, "r+", (i, a) => {
    if (i) return n(i);
    rr.futimes(a, t, r, (o) => {
      rr.close(a, (s) => {
        n && n(o || s);
      });
    });
  });
}
function gd(e, t, r) {
  const n = rr.openSync(e, "r+");
  return rr.futimesSync(n, t, r), rr.closeSync(n);
}
var Nl = {
  utimesMillis: md,
  utimesMillisSync: gd
};
const ir = jt, ye = oe, yd = $a;
function wd(e, t, r) {
  const n = r.dereference ? (i) => ir.stat(i, { bigint: !0 }) : (i) => ir.lstat(i, { bigint: !0 });
  return Promise.all([
    n(e),
    n(t).catch((i) => {
      if (i.code === "ENOENT") return null;
      throw i;
    })
  ]).then(([i, a]) => ({ srcStat: i, destStat: a }));
}
function Ed(e, t, r) {
  let n;
  const i = r.dereference ? (o) => ir.statSync(o, { bigint: !0 }) : (o) => ir.lstatSync(o, { bigint: !0 }), a = i(e);
  try {
    n = i(t);
  } catch (o) {
    if (o.code === "ENOENT") return { srcStat: a, destStat: null };
    throw o;
  }
  return { srcStat: a, destStat: n };
}
function vd(e, t, r, n, i) {
  yd.callbackify(wd)(e, t, n, (a, o) => {
    if (a) return i(a);
    const { srcStat: s, destStat: l } = o;
    if (l) {
      if (Xr(s, l)) {
        const m = ye.basename(e), c = ye.basename(t);
        return r === "move" && m !== c && m.toLowerCase() === c.toLowerCase() ? i(null, { srcStat: s, destStat: l, isChangingCase: !0 }) : i(new Error("Source and destination must not be the same."));
      }
      if (s.isDirectory() && !l.isDirectory())
        return i(new Error(`Cannot overwrite non-directory '${t}' with directory '${e}'.`));
      if (!s.isDirectory() && l.isDirectory())
        return i(new Error(`Cannot overwrite directory '${t}' with non-directory '${e}'.`));
    }
    return s.isDirectory() && Da(e, t) ? i(new Error(ti(e, t, r))) : i(null, { srcStat: s, destStat: l });
  });
}
function _d(e, t, r, n) {
  const { srcStat: i, destStat: a } = Ed(e, t, n);
  if (a) {
    if (Xr(i, a)) {
      const o = ye.basename(e), s = ye.basename(t);
      if (r === "move" && o !== s && o.toLowerCase() === s.toLowerCase())
        return { srcStat: i, destStat: a, isChangingCase: !0 };
      throw new Error("Source and destination must not be the same.");
    }
    if (i.isDirectory() && !a.isDirectory())
      throw new Error(`Cannot overwrite non-directory '${t}' with directory '${e}'.`);
    if (!i.isDirectory() && a.isDirectory())
      throw new Error(`Cannot overwrite directory '${t}' with non-directory '${e}'.`);
  }
  if (i.isDirectory() && Da(e, t))
    throw new Error(ti(e, t, r));
  return { srcStat: i, destStat: a };
}
function Rl(e, t, r, n, i) {
  const a = ye.resolve(ye.dirname(e)), o = ye.resolve(ye.dirname(r));
  if (o === a || o === ye.parse(o).root) return i();
  ir.stat(o, { bigint: !0 }, (s, l) => s ? s.code === "ENOENT" ? i() : i(s) : Xr(t, l) ? i(new Error(ti(e, r, n))) : Rl(e, t, o, n, i));
}
function Fl(e, t, r, n) {
  const i = ye.resolve(ye.dirname(e)), a = ye.resolve(ye.dirname(r));
  if (a === i || a === ye.parse(a).root) return;
  let o;
  try {
    o = ir.statSync(a, { bigint: !0 });
  } catch (s) {
    if (s.code === "ENOENT") return;
    throw s;
  }
  if (Xr(t, o))
    throw new Error(ti(e, r, n));
  return Fl(e, t, a, n);
}
function Xr(e, t) {
  return t.ino && t.dev && t.ino === e.ino && t.dev === e.dev;
}
function Da(e, t) {
  const r = ye.resolve(e).split(ye.sep).filter((i) => i), n = ye.resolve(t).split(ye.sep).filter((i) => i);
  return r.reduce((i, a, o) => i && n[o] === a, !0);
}
function ti(e, t, r) {
  return `Cannot ${r} '${e}' to a subdirectory of itself, '${t}'.`;
}
var cr = {
  checkPaths: vd,
  checkPathsSync: _d,
  checkParentPaths: Rl,
  checkParentPathsSync: Fl,
  isSrcSubdir: Da,
  areIdentical: Xr
};
const Le = Ne, Dr = oe, Sd = tt.mkdirs, Ad = Bt.pathExists, Td = Nl.utimesMillis, Pr = cr;
function Cd(e, t, r, n) {
  typeof r == "function" && !n ? (n = r, r = {}) : typeof r == "function" && (r = { filter: r }), n = n || function() {
  }, r = r || {}, r.clobber = "clobber" in r ? !!r.clobber : !0, r.overwrite = "overwrite" in r ? !!r.overwrite : r.clobber, r.preserveTimestamps && process.arch === "ia32" && process.emitWarning(
    `Using the preserveTimestamps option in 32-bit node is not recommended;

	see https://github.com/jprichardson/node-fs-extra/issues/269`,
    "Warning",
    "fs-extra-WARN0001"
  ), Pr.checkPaths(e, t, "copy", r, (i, a) => {
    if (i) return n(i);
    const { srcStat: o, destStat: s } = a;
    Pr.checkParentPaths(e, o, t, "copy", (l) => l ? n(l) : r.filter ? xl($o, s, e, t, r, n) : $o(s, e, t, r, n));
  });
}
function $o(e, t, r, n, i) {
  const a = Dr.dirname(r);
  Ad(a, (o, s) => {
    if (o) return i(o);
    if (s) return jn(e, t, r, n, i);
    Sd(a, (l) => l ? i(l) : jn(e, t, r, n, i));
  });
}
function xl(e, t, r, n, i, a) {
  Promise.resolve(i.filter(r, n)).then((o) => o ? e(t, r, n, i, a) : a(), (o) => a(o));
}
function $d(e, t, r, n, i) {
  return n.filter ? xl(jn, e, t, r, n, i) : jn(e, t, r, n, i);
}
function jn(e, t, r, n, i) {
  (n.dereference ? Le.stat : Le.lstat)(t, (o, s) => o ? i(o) : s.isDirectory() ? Rd(s, e, t, r, n, i) : s.isFile() || s.isCharacterDevice() || s.isBlockDevice() ? bd(s, e, t, r, n, i) : s.isSymbolicLink() ? Ld(e, t, r, n, i) : s.isSocket() ? i(new Error(`Cannot copy a socket file: ${t}`)) : s.isFIFO() ? i(new Error(`Cannot copy a FIFO pipe: ${t}`)) : i(new Error(`Unknown file: ${t}`)));
}
function bd(e, t, r, n, i, a) {
  return t ? Id(e, r, n, i, a) : Ll(e, r, n, i, a);
}
function Id(e, t, r, n, i) {
  if (n.overwrite)
    Le.unlink(r, (a) => a ? i(a) : Ll(e, t, r, n, i));
  else return n.errorOnExist ? i(new Error(`'${r}' already exists`)) : i();
}
function Ll(e, t, r, n, i) {
  Le.copyFile(t, r, (a) => a ? i(a) : n.preserveTimestamps ? Od(e.mode, t, r, i) : ri(r, e.mode, i));
}
function Od(e, t, r, n) {
  return Dd(e) ? Pd(r, e, (i) => i ? n(i) : bo(e, t, r, n)) : bo(e, t, r, n);
}
function Dd(e) {
  return (e & 128) === 0;
}
function Pd(e, t, r) {
  return ri(e, t | 128, r);
}
function bo(e, t, r, n) {
  Nd(t, r, (i) => i ? n(i) : ri(r, e, n));
}
function ri(e, t, r) {
  return Le.chmod(e, t, r);
}
function Nd(e, t, r) {
  Le.stat(e, (n, i) => n ? r(n) : Td(t, i.atime, i.mtime, r));
}
function Rd(e, t, r, n, i, a) {
  return t ? Ul(r, n, i, a) : Fd(e.mode, r, n, i, a);
}
function Fd(e, t, r, n, i) {
  Le.mkdir(r, (a) => {
    if (a) return i(a);
    Ul(t, r, n, (o) => o ? i(o) : ri(r, e, i));
  });
}
function Ul(e, t, r, n) {
  Le.readdir(e, (i, a) => i ? n(i) : kl(a, e, t, r, n));
}
function kl(e, t, r, n, i) {
  const a = e.pop();
  return a ? xd(e, a, t, r, n, i) : i();
}
function xd(e, t, r, n, i, a) {
  const o = Dr.join(r, t), s = Dr.join(n, t);
  Pr.checkPaths(o, s, "copy", i, (l, m) => {
    if (l) return a(l);
    const { destStat: c } = m;
    $d(c, o, s, i, (f) => f ? a(f) : kl(e, r, n, i, a));
  });
}
function Ld(e, t, r, n, i) {
  Le.readlink(t, (a, o) => {
    if (a) return i(a);
    if (n.dereference && (o = Dr.resolve(process.cwd(), o)), e)
      Le.readlink(r, (s, l) => s ? s.code === "EINVAL" || s.code === "UNKNOWN" ? Le.symlink(o, r, i) : i(s) : (n.dereference && (l = Dr.resolve(process.cwd(), l)), Pr.isSrcSubdir(o, l) ? i(new Error(`Cannot copy '${o}' to a subdirectory of itself, '${l}'.`)) : e.isDirectory() && Pr.isSrcSubdir(l, o) ? i(new Error(`Cannot overwrite '${l}' with '${o}'.`)) : Ud(o, r, i)));
    else
      return Le.symlink(o, r, i);
  });
}
function Ud(e, t, r) {
  Le.unlink(t, (n) => n ? r(n) : Le.symlink(e, t, r));
}
var kd = Cd;
const Ce = Ne, Nr = oe, Md = tt.mkdirsSync, jd = Nl.utimesMillisSync, Rr = cr;
function Bd(e, t, r) {
  typeof r == "function" && (r = { filter: r }), r = r || {}, r.clobber = "clobber" in r ? !!r.clobber : !0, r.overwrite = "overwrite" in r ? !!r.overwrite : r.clobber, r.preserveTimestamps && process.arch === "ia32" && process.emitWarning(
    `Using the preserveTimestamps option in 32-bit node is not recommended;

	see https://github.com/jprichardson/node-fs-extra/issues/269`,
    "Warning",
    "fs-extra-WARN0002"
  );
  const { srcStat: n, destStat: i } = Rr.checkPathsSync(e, t, "copy", r);
  return Rr.checkParentPathsSync(e, n, t, "copy"), Hd(i, e, t, r);
}
function Hd(e, t, r, n) {
  if (n.filter && !n.filter(t, r)) return;
  const i = Nr.dirname(r);
  return Ce.existsSync(i) || Md(i), Ml(e, t, r, n);
}
function qd(e, t, r, n) {
  if (!(n.filter && !n.filter(t, r)))
    return Ml(e, t, r, n);
}
function Ml(e, t, r, n) {
  const a = (n.dereference ? Ce.statSync : Ce.lstatSync)(t);
  if (a.isDirectory()) return Jd(a, e, t, r, n);
  if (a.isFile() || a.isCharacterDevice() || a.isBlockDevice()) return Gd(a, e, t, r, n);
  if (a.isSymbolicLink()) return Zd(e, t, r, n);
  throw a.isSocket() ? new Error(`Cannot copy a socket file: ${t}`) : a.isFIFO() ? new Error(`Cannot copy a FIFO pipe: ${t}`) : new Error(`Unknown file: ${t}`);
}
function Gd(e, t, r, n, i) {
  return t ? Wd(e, r, n, i) : jl(e, r, n, i);
}
function Wd(e, t, r, n) {
  if (n.overwrite)
    return Ce.unlinkSync(r), jl(e, t, r, n);
  if (n.errorOnExist)
    throw new Error(`'${r}' already exists`);
}
function jl(e, t, r, n) {
  return Ce.copyFileSync(t, r), n.preserveTimestamps && zd(e.mode, t, r), Pa(r, e.mode);
}
function zd(e, t, r) {
  return Vd(e) && Yd(r, e), Xd(t, r);
}
function Vd(e) {
  return (e & 128) === 0;
}
function Yd(e, t) {
  return Pa(e, t | 128);
}
function Pa(e, t) {
  return Ce.chmodSync(e, t);
}
function Xd(e, t) {
  const r = Ce.statSync(e);
  return jd(t, r.atime, r.mtime);
}
function Jd(e, t, r, n, i) {
  return t ? Bl(r, n, i) : Kd(e.mode, r, n, i);
}
function Kd(e, t, r, n) {
  return Ce.mkdirSync(r), Bl(t, r, n), Pa(r, e);
}
function Bl(e, t, r) {
  Ce.readdirSync(e).forEach((n) => Qd(n, e, t, r));
}
function Qd(e, t, r, n) {
  const i = Nr.join(t, e), a = Nr.join(r, e), { destStat: o } = Rr.checkPathsSync(i, a, "copy", n);
  return qd(o, i, a, n);
}
function Zd(e, t, r, n) {
  let i = Ce.readlinkSync(t);
  if (n.dereference && (i = Nr.resolve(process.cwd(), i)), e) {
    let a;
    try {
      a = Ce.readlinkSync(r);
    } catch (o) {
      if (o.code === "EINVAL" || o.code === "UNKNOWN") return Ce.symlinkSync(i, r);
      throw o;
    }
    if (n.dereference && (a = Nr.resolve(process.cwd(), a)), Rr.isSrcSubdir(i, a))
      throw new Error(`Cannot copy '${i}' to a subdirectory of itself, '${a}'.`);
    if (Ce.statSync(r).isDirectory() && Rr.isSrcSubdir(a, i))
      throw new Error(`Cannot overwrite '${a}' with '${i}'.`);
    return eh(i, r);
  } else
    return Ce.symlinkSync(i, r);
}
function eh(e, t) {
  return Ce.unlinkSync(t), Ce.symlinkSync(e, t);
}
var th = Bd;
const rh = Pe.fromCallback;
var Na = {
  copy: rh(kd),
  copySync: th
};
const Io = Ne, Hl = oe, ee = Sl, Fr = process.platform === "win32";
function ql(e) {
  [
    "unlink",
    "chmod",
    "stat",
    "lstat",
    "rmdir",
    "readdir"
  ].forEach((r) => {
    e[r] = e[r] || Io[r], r = r + "Sync", e[r] = e[r] || Io[r];
  }), e.maxBusyTries = e.maxBusyTries || 3;
}
function Ra(e, t, r) {
  let n = 0;
  typeof t == "function" && (r = t, t = {}), ee(e, "rimraf: missing path"), ee.strictEqual(typeof e, "string", "rimraf: path should be a string"), ee.strictEqual(typeof r, "function", "rimraf: callback function required"), ee(t, "rimraf: invalid options argument provided"), ee.strictEqual(typeof t, "object", "rimraf: options should be object"), ql(t), Oo(e, t, function i(a) {
    if (a) {
      if ((a.code === "EBUSY" || a.code === "ENOTEMPTY" || a.code === "EPERM") && n < t.maxBusyTries) {
        n++;
        const o = n * 100;
        return setTimeout(() => Oo(e, t, i), o);
      }
      a.code === "ENOENT" && (a = null);
    }
    r(a);
  });
}
function Oo(e, t, r) {
  ee(e), ee(t), ee(typeof r == "function"), t.lstat(e, (n, i) => {
    if (n && n.code === "ENOENT")
      return r(null);
    if (n && n.code === "EPERM" && Fr)
      return Do(e, t, n, r);
    if (i && i.isDirectory())
      return xn(e, t, n, r);
    t.unlink(e, (a) => {
      if (a) {
        if (a.code === "ENOENT")
          return r(null);
        if (a.code === "EPERM")
          return Fr ? Do(e, t, a, r) : xn(e, t, a, r);
        if (a.code === "EISDIR")
          return xn(e, t, a, r);
      }
      return r(a);
    });
  });
}
function Do(e, t, r, n) {
  ee(e), ee(t), ee(typeof n == "function"), t.chmod(e, 438, (i) => {
    i ? n(i.code === "ENOENT" ? null : r) : t.stat(e, (a, o) => {
      a ? n(a.code === "ENOENT" ? null : r) : o.isDirectory() ? xn(e, t, r, n) : t.unlink(e, n);
    });
  });
}
function Po(e, t, r) {
  let n;
  ee(e), ee(t);
  try {
    t.chmodSync(e, 438);
  } catch (i) {
    if (i.code === "ENOENT")
      return;
    throw r;
  }
  try {
    n = t.statSync(e);
  } catch (i) {
    if (i.code === "ENOENT")
      return;
    throw r;
  }
  n.isDirectory() ? Ln(e, t, r) : t.unlinkSync(e);
}
function xn(e, t, r, n) {
  ee(e), ee(t), ee(typeof n == "function"), t.rmdir(e, (i) => {
    i && (i.code === "ENOTEMPTY" || i.code === "EEXIST" || i.code === "EPERM") ? nh(e, t, n) : i && i.code === "ENOTDIR" ? n(r) : n(i);
  });
}
function nh(e, t, r) {
  ee(e), ee(t), ee(typeof r == "function"), t.readdir(e, (n, i) => {
    if (n) return r(n);
    let a = i.length, o;
    if (a === 0) return t.rmdir(e, r);
    i.forEach((s) => {
      Ra(Hl.join(e, s), t, (l) => {
        if (!o) {
          if (l) return r(o = l);
          --a === 0 && t.rmdir(e, r);
        }
      });
    });
  });
}
function Gl(e, t) {
  let r;
  t = t || {}, ql(t), ee(e, "rimraf: missing path"), ee.strictEqual(typeof e, "string", "rimraf: path should be a string"), ee(t, "rimraf: missing options"), ee.strictEqual(typeof t, "object", "rimraf: options should be object");
  try {
    r = t.lstatSync(e);
  } catch (n) {
    if (n.code === "ENOENT")
      return;
    n.code === "EPERM" && Fr && Po(e, t, n);
  }
  try {
    r && r.isDirectory() ? Ln(e, t, null) : t.unlinkSync(e);
  } catch (n) {
    if (n.code === "ENOENT")
      return;
    if (n.code === "EPERM")
      return Fr ? Po(e, t, n) : Ln(e, t, n);
    if (n.code !== "EISDIR")
      throw n;
    Ln(e, t, n);
  }
}
function Ln(e, t, r) {
  ee(e), ee(t);
  try {
    t.rmdirSync(e);
  } catch (n) {
    if (n.code === "ENOTDIR")
      throw r;
    if (n.code === "ENOTEMPTY" || n.code === "EEXIST" || n.code === "EPERM")
      ih(e, t);
    else if (n.code !== "ENOENT")
      throw n;
  }
}
function ih(e, t) {
  if (ee(e), ee(t), t.readdirSync(e).forEach((r) => Gl(Hl.join(e, r), t)), Fr) {
    const r = Date.now();
    do
      try {
        return t.rmdirSync(e, t);
      } catch {
      }
    while (Date.now() - r < 500);
  } else
    return t.rmdirSync(e, t);
}
var ah = Ra;
Ra.sync = Gl;
const Bn = Ne, oh = Pe.fromCallback, Wl = ah;
function sh(e, t) {
  if (Bn.rm) return Bn.rm(e, { recursive: !0, force: !0 }, t);
  Wl(e, t);
}
function lh(e) {
  if (Bn.rmSync) return Bn.rmSync(e, { recursive: !0, force: !0 });
  Wl.sync(e);
}
var ni = {
  remove: oh(sh),
  removeSync: lh
};
const ch = Pe.fromPromise, zl = jt, Vl = oe, Yl = tt, Xl = ni, No = ch(async function(t) {
  let r;
  try {
    r = await zl.readdir(t);
  } catch {
    return Yl.mkdirs(t);
  }
  return Promise.all(r.map((n) => Xl.remove(Vl.join(t, n))));
});
function Ro(e) {
  let t;
  try {
    t = zl.readdirSync(e);
  } catch {
    return Yl.mkdirsSync(e);
  }
  t.forEach((r) => {
    r = Vl.join(e, r), Xl.removeSync(r);
  });
}
var uh = {
  emptyDirSync: Ro,
  emptydirSync: Ro,
  emptyDir: No,
  emptydir: No
};
const fh = Pe.fromCallback, Jl = oe, mt = Ne, Kl = tt;
function dh(e, t) {
  function r() {
    mt.writeFile(e, "", (n) => {
      if (n) return t(n);
      t();
    });
  }
  mt.stat(e, (n, i) => {
    if (!n && i.isFile()) return t();
    const a = Jl.dirname(e);
    mt.stat(a, (o, s) => {
      if (o)
        return o.code === "ENOENT" ? Kl.mkdirs(a, (l) => {
          if (l) return t(l);
          r();
        }) : t(o);
      s.isDirectory() ? r() : mt.readdir(a, (l) => {
        if (l) return t(l);
      });
    });
  });
}
function hh(e) {
  let t;
  try {
    t = mt.statSync(e);
  } catch {
  }
  if (t && t.isFile()) return;
  const r = Jl.dirname(e);
  try {
    mt.statSync(r).isDirectory() || mt.readdirSync(r);
  } catch (n) {
    if (n && n.code === "ENOENT") Kl.mkdirsSync(r);
    else throw n;
  }
  mt.writeFileSync(e, "");
}
var ph = {
  createFile: fh(dh),
  createFileSync: hh
};
const mh = Pe.fromCallback, Ql = oe, pt = Ne, Zl = tt, gh = Bt.pathExists, { areIdentical: ec } = cr;
function yh(e, t, r) {
  function n(i, a) {
    pt.link(i, a, (o) => {
      if (o) return r(o);
      r(null);
    });
  }
  pt.lstat(t, (i, a) => {
    pt.lstat(e, (o, s) => {
      if (o)
        return o.message = o.message.replace("lstat", "ensureLink"), r(o);
      if (a && ec(s, a)) return r(null);
      const l = Ql.dirname(t);
      gh(l, (m, c) => {
        if (m) return r(m);
        if (c) return n(e, t);
        Zl.mkdirs(l, (f) => {
          if (f) return r(f);
          n(e, t);
        });
      });
    });
  });
}
function wh(e, t) {
  let r;
  try {
    r = pt.lstatSync(t);
  } catch {
  }
  try {
    const a = pt.lstatSync(e);
    if (r && ec(a, r)) return;
  } catch (a) {
    throw a.message = a.message.replace("lstat", "ensureLink"), a;
  }
  const n = Ql.dirname(t);
  return pt.existsSync(n) || Zl.mkdirsSync(n), pt.linkSync(e, t);
}
var Eh = {
  createLink: mh(yh),
  createLinkSync: wh
};
const gt = oe, $r = Ne, vh = Bt.pathExists;
function _h(e, t, r) {
  if (gt.isAbsolute(e))
    return $r.lstat(e, (n) => n ? (n.message = n.message.replace("lstat", "ensureSymlink"), r(n)) : r(null, {
      toCwd: e,
      toDst: e
    }));
  {
    const n = gt.dirname(t), i = gt.join(n, e);
    return vh(i, (a, o) => a ? r(a) : o ? r(null, {
      toCwd: i,
      toDst: e
    }) : $r.lstat(e, (s) => s ? (s.message = s.message.replace("lstat", "ensureSymlink"), r(s)) : r(null, {
      toCwd: e,
      toDst: gt.relative(n, e)
    })));
  }
}
function Sh(e, t) {
  let r;
  if (gt.isAbsolute(e)) {
    if (r = $r.existsSync(e), !r) throw new Error("absolute srcpath does not exist");
    return {
      toCwd: e,
      toDst: e
    };
  } else {
    const n = gt.dirname(t), i = gt.join(n, e);
    if (r = $r.existsSync(i), r)
      return {
        toCwd: i,
        toDst: e
      };
    if (r = $r.existsSync(e), !r) throw new Error("relative srcpath does not exist");
    return {
      toCwd: e,
      toDst: gt.relative(n, e)
    };
  }
}
var Ah = {
  symlinkPaths: _h,
  symlinkPathsSync: Sh
};
const tc = Ne;
function Th(e, t, r) {
  if (r = typeof t == "function" ? t : r, t = typeof t == "function" ? !1 : t, t) return r(null, t);
  tc.lstat(e, (n, i) => {
    if (n) return r(null, "file");
    t = i && i.isDirectory() ? "dir" : "file", r(null, t);
  });
}
function Ch(e, t) {
  let r;
  if (t) return t;
  try {
    r = tc.lstatSync(e);
  } catch {
    return "file";
  }
  return r && r.isDirectory() ? "dir" : "file";
}
var $h = {
  symlinkType: Th,
  symlinkTypeSync: Ch
};
const bh = Pe.fromCallback, rc = oe, Ve = jt, nc = tt, Ih = nc.mkdirs, Oh = nc.mkdirsSync, ic = Ah, Dh = ic.symlinkPaths, Ph = ic.symlinkPathsSync, ac = $h, Nh = ac.symlinkType, Rh = ac.symlinkTypeSync, Fh = Bt.pathExists, { areIdentical: oc } = cr;
function xh(e, t, r, n) {
  n = typeof r == "function" ? r : n, r = typeof r == "function" ? !1 : r, Ve.lstat(t, (i, a) => {
    !i && a.isSymbolicLink() ? Promise.all([
      Ve.stat(e),
      Ve.stat(t)
    ]).then(([o, s]) => {
      if (oc(o, s)) return n(null);
      Fo(e, t, r, n);
    }) : Fo(e, t, r, n);
  });
}
function Fo(e, t, r, n) {
  Dh(e, t, (i, a) => {
    if (i) return n(i);
    e = a.toDst, Nh(a.toCwd, r, (o, s) => {
      if (o) return n(o);
      const l = rc.dirname(t);
      Fh(l, (m, c) => {
        if (m) return n(m);
        if (c) return Ve.symlink(e, t, s, n);
        Ih(l, (f) => {
          if (f) return n(f);
          Ve.symlink(e, t, s, n);
        });
      });
    });
  });
}
function Lh(e, t, r) {
  let n;
  try {
    n = Ve.lstatSync(t);
  } catch {
  }
  if (n && n.isSymbolicLink()) {
    const s = Ve.statSync(e), l = Ve.statSync(t);
    if (oc(s, l)) return;
  }
  const i = Ph(e, t);
  e = i.toDst, r = Rh(i.toCwd, r);
  const a = rc.dirname(t);
  return Ve.existsSync(a) || Oh(a), Ve.symlinkSync(e, t, r);
}
var Uh = {
  createSymlink: bh(xh),
  createSymlinkSync: Lh
};
const { createFile: xo, createFileSync: Lo } = ph, { createLink: Uo, createLinkSync: ko } = Eh, { createSymlink: Mo, createSymlinkSync: jo } = Uh;
var kh = {
  // file
  createFile: xo,
  createFileSync: Lo,
  ensureFile: xo,
  ensureFileSync: Lo,
  // link
  createLink: Uo,
  createLinkSync: ko,
  ensureLink: Uo,
  ensureLinkSync: ko,
  // symlink
  createSymlink: Mo,
  createSymlinkSync: jo,
  ensureSymlink: Mo,
  ensureSymlinkSync: jo
};
function Mh(e, { EOL: t = `
`, finalEOL: r = !0, replacer: n = null, spaces: i } = {}) {
  const a = r ? t : "";
  return JSON.stringify(e, n, i).replace(/\n/g, t) + a;
}
function jh(e) {
  return Buffer.isBuffer(e) && (e = e.toString("utf8")), e.replace(/^\uFEFF/, "");
}
var Fa = { stringify: Mh, stripBom: jh };
let ar;
try {
  ar = Ne;
} catch {
  ar = At;
}
const ii = Pe, { stringify: sc, stripBom: lc } = Fa;
async function Bh(e, t = {}) {
  typeof t == "string" && (t = { encoding: t });
  const r = t.fs || ar, n = "throws" in t ? t.throws : !0;
  let i = await ii.fromCallback(r.readFile)(e, t);
  i = lc(i);
  let a;
  try {
    a = JSON.parse(i, t ? t.reviver : null);
  } catch (o) {
    if (n)
      throw o.message = `${e}: ${o.message}`, o;
    return null;
  }
  return a;
}
const Hh = ii.fromPromise(Bh);
function qh(e, t = {}) {
  typeof t == "string" && (t = { encoding: t });
  const r = t.fs || ar, n = "throws" in t ? t.throws : !0;
  try {
    let i = r.readFileSync(e, t);
    return i = lc(i), JSON.parse(i, t.reviver);
  } catch (i) {
    if (n)
      throw i.message = `${e}: ${i.message}`, i;
    return null;
  }
}
async function Gh(e, t, r = {}) {
  const n = r.fs || ar, i = sc(t, r);
  await ii.fromCallback(n.writeFile)(e, i, r);
}
const Wh = ii.fromPromise(Gh);
function zh(e, t, r = {}) {
  const n = r.fs || ar, i = sc(t, r);
  return n.writeFileSync(e, i, r);
}
var Vh = {
  readFile: Hh,
  readFileSync: qh,
  writeFile: Wh,
  writeFileSync: zh
};
const vn = Vh;
var Yh = {
  // jsonfile exports
  readJson: vn.readFile,
  readJsonSync: vn.readFileSync,
  writeJson: vn.writeFile,
  writeJsonSync: vn.writeFileSync
};
const Xh = Pe.fromCallback, br = Ne, cc = oe, uc = tt, Jh = Bt.pathExists;
function Kh(e, t, r, n) {
  typeof r == "function" && (n = r, r = "utf8");
  const i = cc.dirname(e);
  Jh(i, (a, o) => {
    if (a) return n(a);
    if (o) return br.writeFile(e, t, r, n);
    uc.mkdirs(i, (s) => {
      if (s) return n(s);
      br.writeFile(e, t, r, n);
    });
  });
}
function Qh(e, ...t) {
  const r = cc.dirname(e);
  if (br.existsSync(r))
    return br.writeFileSync(e, ...t);
  uc.mkdirsSync(r), br.writeFileSync(e, ...t);
}
var xa = {
  outputFile: Xh(Kh),
  outputFileSync: Qh
};
const { stringify: Zh } = Fa, { outputFile: ep } = xa;
async function tp(e, t, r = {}) {
  const n = Zh(t, r);
  await ep(e, n, r);
}
var rp = tp;
const { stringify: np } = Fa, { outputFileSync: ip } = xa;
function ap(e, t, r) {
  const n = np(t, r);
  ip(e, n, r);
}
var op = ap;
const sp = Pe.fromPromise, De = Yh;
De.outputJson = sp(rp);
De.outputJsonSync = op;
De.outputJSON = De.outputJson;
De.outputJSONSync = De.outputJsonSync;
De.writeJSON = De.writeJson;
De.writeJSONSync = De.writeJsonSync;
De.readJSON = De.readJson;
De.readJSONSync = De.readJsonSync;
var lp = De;
const cp = Ne, ca = oe, up = Na.copy, fc = ni.remove, fp = tt.mkdirp, dp = Bt.pathExists, Bo = cr;
function hp(e, t, r, n) {
  typeof r == "function" && (n = r, r = {}), r = r || {};
  const i = r.overwrite || r.clobber || !1;
  Bo.checkPaths(e, t, "move", r, (a, o) => {
    if (a) return n(a);
    const { srcStat: s, isChangingCase: l = !1 } = o;
    Bo.checkParentPaths(e, s, t, "move", (m) => {
      if (m) return n(m);
      if (pp(t)) return Ho(e, t, i, l, n);
      fp(ca.dirname(t), (c) => c ? n(c) : Ho(e, t, i, l, n));
    });
  });
}
function pp(e) {
  const t = ca.dirname(e);
  return ca.parse(t).root === t;
}
function Ho(e, t, r, n, i) {
  if (n) return Ri(e, t, r, i);
  if (r)
    return fc(t, (a) => a ? i(a) : Ri(e, t, r, i));
  dp(t, (a, o) => a ? i(a) : o ? i(new Error("dest already exists.")) : Ri(e, t, r, i));
}
function Ri(e, t, r, n) {
  cp.rename(e, t, (i) => i ? i.code !== "EXDEV" ? n(i) : mp(e, t, r, n) : n());
}
function mp(e, t, r, n) {
  up(e, t, {
    overwrite: r,
    errorOnExist: !0
  }, (a) => a ? n(a) : fc(e, n));
}
var gp = hp;
const dc = Ne, ua = oe, yp = Na.copySync, hc = ni.removeSync, wp = tt.mkdirpSync, qo = cr;
function Ep(e, t, r) {
  r = r || {};
  const n = r.overwrite || r.clobber || !1, { srcStat: i, isChangingCase: a = !1 } = qo.checkPathsSync(e, t, "move", r);
  return qo.checkParentPathsSync(e, i, t, "move"), vp(t) || wp(ua.dirname(t)), _p(e, t, n, a);
}
function vp(e) {
  const t = ua.dirname(e);
  return ua.parse(t).root === t;
}
function _p(e, t, r, n) {
  if (n) return Fi(e, t, r);
  if (r)
    return hc(t), Fi(e, t, r);
  if (dc.existsSync(t)) throw new Error("dest already exists.");
  return Fi(e, t, r);
}
function Fi(e, t, r) {
  try {
    dc.renameSync(e, t);
  } catch (n) {
    if (n.code !== "EXDEV") throw n;
    return Sp(e, t, r);
  }
}
function Sp(e, t, r) {
  return yp(e, t, {
    overwrite: r,
    errorOnExist: !0
  }), hc(e);
}
var Ap = Ep;
const Tp = Pe.fromCallback;
var Cp = {
  move: Tp(gp),
  moveSync: Ap
}, Tt = {
  // Export promiseified graceful-fs:
  ...jt,
  // Export extra methods:
  ...Na,
  ...uh,
  ...kh,
  ...lp,
  ...tt,
  ...Cp,
  ...xa,
  ...Bt,
  ...ni
}, st = {}, wt = {}, we = {}, Et = {};
Object.defineProperty(Et, "__esModule", { value: !0 });
Et.CancellationError = Et.CancellationToken = void 0;
const $p = Al;
class bp extends $p.EventEmitter {
  get cancelled() {
    return this._cancelled || this._parent != null && this._parent.cancelled;
  }
  set parent(t) {
    this.removeParentCancelHandler(), this._parent = t, this.parentCancelHandler = () => this.cancel(), this._parent.onCancel(this.parentCancelHandler);
  }
  // babel cannot compile ... correctly for super calls
  constructor(t) {
    super(), this.parentCancelHandler = null, this._parent = null, this._cancelled = !1, t != null && (this.parent = t);
  }
  cancel() {
    this._cancelled = !0, this.emit("cancel");
  }
  onCancel(t) {
    this.cancelled ? t() : this.once("cancel", t);
  }
  createPromise(t) {
    if (this.cancelled)
      return Promise.reject(new fa());
    const r = () => {
      if (n != null)
        try {
          this.removeListener("cancel", n), n = null;
        } catch {
        }
    };
    let n = null;
    return new Promise((i, a) => {
      let o = null;
      if (n = () => {
        try {
          o != null && (o(), o = null);
        } finally {
          a(new fa());
        }
      }, this.cancelled) {
        n();
        return;
      }
      this.onCancel(n), t(i, a, (s) => {
        o = s;
      });
    }).then((i) => (r(), i)).catch((i) => {
      throw r(), i;
    });
  }
  removeParentCancelHandler() {
    const t = this._parent;
    t != null && this.parentCancelHandler != null && (t.removeListener("cancel", this.parentCancelHandler), this.parentCancelHandler = null);
  }
  dispose() {
    try {
      this.removeParentCancelHandler();
    } finally {
      this.removeAllListeners(), this._parent = null;
    }
  }
}
Et.CancellationToken = bp;
class fa extends Error {
  constructor() {
    super("cancelled");
  }
}
Et.CancellationError = fa;
var ur = {};
Object.defineProperty(ur, "__esModule", { value: !0 });
ur.newError = Ip;
function Ip(e, t) {
  const r = new Error(e);
  return r.code = t, r;
}
var Oe = {}, da = { exports: {} }, _n = { exports: {} }, xi, Go;
function Op() {
  if (Go) return xi;
  Go = 1;
  var e = 1e3, t = e * 60, r = t * 60, n = r * 24, i = n * 7, a = n * 365.25;
  xi = function(c, f) {
    f = f || {};
    var h = typeof c;
    if (h === "string" && c.length > 0)
      return o(c);
    if (h === "number" && isFinite(c))
      return f.long ? l(c) : s(c);
    throw new Error(
      "val is not a non-empty string or a valid number. val=" + JSON.stringify(c)
    );
  };
  function o(c) {
    if (c = String(c), !(c.length > 100)) {
      var f = /^(-?(?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)?$/i.exec(
        c
      );
      if (f) {
        var h = parseFloat(f[1]), g = (f[2] || "ms").toLowerCase();
        switch (g) {
          case "years":
          case "year":
          case "yrs":
          case "yr":
          case "y":
            return h * a;
          case "weeks":
          case "week":
          case "w":
            return h * i;
          case "days":
          case "day":
          case "d":
            return h * n;
          case "hours":
          case "hour":
          case "hrs":
          case "hr":
          case "h":
            return h * r;
          case "minutes":
          case "minute":
          case "mins":
          case "min":
          case "m":
            return h * t;
          case "seconds":
          case "second":
          case "secs":
          case "sec":
          case "s":
            return h * e;
          case "milliseconds":
          case "millisecond":
          case "msecs":
          case "msec":
          case "ms":
            return h;
          default:
            return;
        }
      }
    }
  }
  function s(c) {
    var f = Math.abs(c);
    return f >= n ? Math.round(c / n) + "d" : f >= r ? Math.round(c / r) + "h" : f >= t ? Math.round(c / t) + "m" : f >= e ? Math.round(c / e) + "s" : c + "ms";
  }
  function l(c) {
    var f = Math.abs(c);
    return f >= n ? m(c, f, n, "day") : f >= r ? m(c, f, r, "hour") : f >= t ? m(c, f, t, "minute") : f >= e ? m(c, f, e, "second") : c + " ms";
  }
  function m(c, f, h, g) {
    var _ = f >= h * 1.5;
    return Math.round(c / h) + " " + g + (_ ? "s" : "");
  }
  return xi;
}
var Li, Wo;
function pc() {
  if (Wo) return Li;
  Wo = 1;
  function e(t) {
    n.debug = n, n.default = n, n.coerce = m, n.disable = s, n.enable = a, n.enabled = l, n.humanize = Op(), n.destroy = c, Object.keys(t).forEach((f) => {
      n[f] = t[f];
    }), n.names = [], n.skips = [], n.formatters = {};
    function r(f) {
      let h = 0;
      for (let g = 0; g < f.length; g++)
        h = (h << 5) - h + f.charCodeAt(g), h |= 0;
      return n.colors[Math.abs(h) % n.colors.length];
    }
    n.selectColor = r;
    function n(f) {
      let h, g = null, _, w;
      function S(...T) {
        if (!S.enabled)
          return;
        const A = S, R = Number(/* @__PURE__ */ new Date()), x = R - (h || R);
        A.diff = x, A.prev = h, A.curr = R, h = R, T[0] = n.coerce(T[0]), typeof T[0] != "string" && T.unshift("%O");
        let re = 0;
        T[0] = T[0].replace(/%([a-zA-Z%])/g, (X, ke) => {
          if (X === "%%")
            return "%";
          re++;
          const y = n.formatters[ke];
          if (typeof y == "function") {
            const z = T[re];
            X = y.call(A, z), T.splice(re, 1), re--;
          }
          return X;
        }), n.formatArgs.call(A, T), (A.log || n.log).apply(A, T);
      }
      return S.namespace = f, S.useColors = n.useColors(), S.color = n.selectColor(f), S.extend = i, S.destroy = n.destroy, Object.defineProperty(S, "enabled", {
        enumerable: !0,
        configurable: !1,
        get: () => g !== null ? g : (_ !== n.namespaces && (_ = n.namespaces, w = n.enabled(f)), w),
        set: (T) => {
          g = T;
        }
      }), typeof n.init == "function" && n.init(S), S;
    }
    function i(f, h) {
      const g = n(this.namespace + (typeof h > "u" ? ":" : h) + f);
      return g.log = this.log, g;
    }
    function a(f) {
      n.save(f), n.namespaces = f, n.names = [], n.skips = [];
      const h = (typeof f == "string" ? f : "").trim().replace(/\s+/g, ",").split(",").filter(Boolean);
      for (const g of h)
        g[0] === "-" ? n.skips.push(g.slice(1)) : n.names.push(g);
    }
    function o(f, h) {
      let g = 0, _ = 0, w = -1, S = 0;
      for (; g < f.length; )
        if (_ < h.length && (h[_] === f[g] || h[_] === "*"))
          h[_] === "*" ? (w = _, S = g, _++) : (g++, _++);
        else if (w !== -1)
          _ = w + 1, S++, g = S;
        else
          return !1;
      for (; _ < h.length && h[_] === "*"; )
        _++;
      return _ === h.length;
    }
    function s() {
      const f = [
        ...n.names,
        ...n.skips.map((h) => "-" + h)
      ].join(",");
      return n.enable(""), f;
    }
    function l(f) {
      for (const h of n.skips)
        if (o(f, h))
          return !1;
      for (const h of n.names)
        if (o(f, h))
          return !0;
      return !1;
    }
    function m(f) {
      return f instanceof Error ? f.stack || f.message : f;
    }
    function c() {
      console.warn("Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.");
    }
    return n.enable(n.load()), n;
  }
  return Li = e, Li;
}
var zo;
function Dp() {
  return zo || (zo = 1, function(e, t) {
    t.formatArgs = n, t.save = i, t.load = a, t.useColors = r, t.storage = o(), t.destroy = /* @__PURE__ */ (() => {
      let l = !1;
      return () => {
        l || (l = !0, console.warn("Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`."));
      };
    })(), t.colors = [
      "#0000CC",
      "#0000FF",
      "#0033CC",
      "#0033FF",
      "#0066CC",
      "#0066FF",
      "#0099CC",
      "#0099FF",
      "#00CC00",
      "#00CC33",
      "#00CC66",
      "#00CC99",
      "#00CCCC",
      "#00CCFF",
      "#3300CC",
      "#3300FF",
      "#3333CC",
      "#3333FF",
      "#3366CC",
      "#3366FF",
      "#3399CC",
      "#3399FF",
      "#33CC00",
      "#33CC33",
      "#33CC66",
      "#33CC99",
      "#33CCCC",
      "#33CCFF",
      "#6600CC",
      "#6600FF",
      "#6633CC",
      "#6633FF",
      "#66CC00",
      "#66CC33",
      "#9900CC",
      "#9900FF",
      "#9933CC",
      "#9933FF",
      "#99CC00",
      "#99CC33",
      "#CC0000",
      "#CC0033",
      "#CC0066",
      "#CC0099",
      "#CC00CC",
      "#CC00FF",
      "#CC3300",
      "#CC3333",
      "#CC3366",
      "#CC3399",
      "#CC33CC",
      "#CC33FF",
      "#CC6600",
      "#CC6633",
      "#CC9900",
      "#CC9933",
      "#CCCC00",
      "#CCCC33",
      "#FF0000",
      "#FF0033",
      "#FF0066",
      "#FF0099",
      "#FF00CC",
      "#FF00FF",
      "#FF3300",
      "#FF3333",
      "#FF3366",
      "#FF3399",
      "#FF33CC",
      "#FF33FF",
      "#FF6600",
      "#FF6633",
      "#FF9900",
      "#FF9933",
      "#FFCC00",
      "#FFCC33"
    ];
    function r() {
      if (typeof window < "u" && window.process && (window.process.type === "renderer" || window.process.__nwjs))
        return !0;
      if (typeof navigator < "u" && navigator.userAgent && navigator.userAgent.toLowerCase().match(/(edge|trident)\/(\d+)/))
        return !1;
      let l;
      return typeof document < "u" && document.documentElement && document.documentElement.style && document.documentElement.style.WebkitAppearance || // Is firebug? http://stackoverflow.com/a/398120/376773
      typeof window < "u" && window.console && (window.console.firebug || window.console.exception && window.console.table) || // Is firefox >= v31?
      // https://developer.mozilla.org/en-US/docs/Tools/Web_Console#Styling_messages
      typeof navigator < "u" && navigator.userAgent && (l = navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/)) && parseInt(l[1], 10) >= 31 || // Double check webkit in userAgent just in case we are in a worker
      typeof navigator < "u" && navigator.userAgent && navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/);
    }
    function n(l) {
      if (l[0] = (this.useColors ? "%c" : "") + this.namespace + (this.useColors ? " %c" : " ") + l[0] + (this.useColors ? "%c " : " ") + "+" + e.exports.humanize(this.diff), !this.useColors)
        return;
      const m = "color: " + this.color;
      l.splice(1, 0, m, "color: inherit");
      let c = 0, f = 0;
      l[0].replace(/%[a-zA-Z%]/g, (h) => {
        h !== "%%" && (c++, h === "%c" && (f = c));
      }), l.splice(f, 0, m);
    }
    t.log = console.debug || console.log || (() => {
    });
    function i(l) {
      try {
        l ? t.storage.setItem("debug", l) : t.storage.removeItem("debug");
      } catch {
      }
    }
    function a() {
      let l;
      try {
        l = t.storage.getItem("debug") || t.storage.getItem("DEBUG");
      } catch {
      }
      return !l && typeof process < "u" && "env" in process && (l = process.env.DEBUG), l;
    }
    function o() {
      try {
        return localStorage;
      } catch {
      }
    }
    e.exports = pc()(t);
    const { formatters: s } = e.exports;
    s.j = function(l) {
      try {
        return JSON.stringify(l);
      } catch (m) {
        return "[UnexpectedJSONParseError]: " + m.message;
      }
    };
  }(_n, _n.exports)), _n.exports;
}
var Sn = { exports: {} }, Ui, Vo;
function Pp() {
  return Vo || (Vo = 1, Ui = (e, t = process.argv) => {
    const r = e.startsWith("-") ? "" : e.length === 1 ? "-" : "--", n = t.indexOf(r + e), i = t.indexOf("--");
    return n !== -1 && (i === -1 || n < i);
  }), Ui;
}
var ki, Yo;
function Np() {
  if (Yo) return ki;
  Yo = 1;
  const e = ei, t = Tl, r = Pp(), { env: n } = process;
  let i;
  r("no-color") || r("no-colors") || r("color=false") || r("color=never") ? i = 0 : (r("color") || r("colors") || r("color=true") || r("color=always")) && (i = 1), "FORCE_COLOR" in n && (n.FORCE_COLOR === "true" ? i = 1 : n.FORCE_COLOR === "false" ? i = 0 : i = n.FORCE_COLOR.length === 0 ? 1 : Math.min(parseInt(n.FORCE_COLOR, 10), 3));
  function a(l) {
    return l === 0 ? !1 : {
      level: l,
      hasBasic: !0,
      has256: l >= 2,
      has16m: l >= 3
    };
  }
  function o(l, m) {
    if (i === 0)
      return 0;
    if (r("color=16m") || r("color=full") || r("color=truecolor"))
      return 3;
    if (r("color=256"))
      return 2;
    if (l && !m && i === void 0)
      return 0;
    const c = i || 0;
    if (n.TERM === "dumb")
      return c;
    if (process.platform === "win32") {
      const f = e.release().split(".");
      return Number(f[0]) >= 10 && Number(f[2]) >= 10586 ? Number(f[2]) >= 14931 ? 3 : 2 : 1;
    }
    if ("CI" in n)
      return ["TRAVIS", "CIRCLECI", "APPVEYOR", "GITLAB_CI", "GITHUB_ACTIONS", "BUILDKITE"].some((f) => f in n) || n.CI_NAME === "codeship" ? 1 : c;
    if ("TEAMCITY_VERSION" in n)
      return /^(9\.(0*[1-9]\d*)\.|\d{2,}\.)/.test(n.TEAMCITY_VERSION) ? 1 : 0;
    if (n.COLORTERM === "truecolor")
      return 3;
    if ("TERM_PROGRAM" in n) {
      const f = parseInt((n.TERM_PROGRAM_VERSION || "").split(".")[0], 10);
      switch (n.TERM_PROGRAM) {
        case "iTerm.app":
          return f >= 3 ? 3 : 2;
        case "Apple_Terminal":
          return 2;
      }
    }
    return /-256(color)?$/i.test(n.TERM) ? 2 : /^screen|^xterm|^vt100|^vt220|^rxvt|color|ansi|cygwin|linux/i.test(n.TERM) || "COLORTERM" in n ? 1 : c;
  }
  function s(l) {
    const m = o(l, l && l.isTTY);
    return a(m);
  }
  return ki = {
    supportsColor: s,
    stdout: a(o(!0, t.isatty(1))),
    stderr: a(o(!0, t.isatty(2)))
  }, ki;
}
var Xo;
function Rp() {
  return Xo || (Xo = 1, function(e, t) {
    const r = Tl, n = $a;
    t.init = c, t.log = s, t.formatArgs = a, t.save = l, t.load = m, t.useColors = i, t.destroy = n.deprecate(
      () => {
      },
      "Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`."
    ), t.colors = [6, 2, 3, 4, 5, 1];
    try {
      const h = Np();
      h && (h.stderr || h).level >= 2 && (t.colors = [
        20,
        21,
        26,
        27,
        32,
        33,
        38,
        39,
        40,
        41,
        42,
        43,
        44,
        45,
        56,
        57,
        62,
        63,
        68,
        69,
        74,
        75,
        76,
        77,
        78,
        79,
        80,
        81,
        92,
        93,
        98,
        99,
        112,
        113,
        128,
        129,
        134,
        135,
        148,
        149,
        160,
        161,
        162,
        163,
        164,
        165,
        166,
        167,
        168,
        169,
        170,
        171,
        172,
        173,
        178,
        179,
        184,
        185,
        196,
        197,
        198,
        199,
        200,
        201,
        202,
        203,
        204,
        205,
        206,
        207,
        208,
        209,
        214,
        215,
        220,
        221
      ]);
    } catch {
    }
    t.inspectOpts = Object.keys(process.env).filter((h) => /^debug_/i.test(h)).reduce((h, g) => {
      const _ = g.substring(6).toLowerCase().replace(/_([a-z])/g, (S, T) => T.toUpperCase());
      let w = process.env[g];
      return /^(yes|on|true|enabled)$/i.test(w) ? w = !0 : /^(no|off|false|disabled)$/i.test(w) ? w = !1 : w === "null" ? w = null : w = Number(w), h[_] = w, h;
    }, {});
    function i() {
      return "colors" in t.inspectOpts ? !!t.inspectOpts.colors : r.isatty(process.stderr.fd);
    }
    function a(h) {
      const { namespace: g, useColors: _ } = this;
      if (_) {
        const w = this.color, S = "\x1B[3" + (w < 8 ? w : "8;5;" + w), T = `  ${S};1m${g} \x1B[0m`;
        h[0] = T + h[0].split(`
`).join(`
` + T), h.push(S + "m+" + e.exports.humanize(this.diff) + "\x1B[0m");
      } else
        h[0] = o() + g + " " + h[0];
    }
    function o() {
      return t.inspectOpts.hideDate ? "" : (/* @__PURE__ */ new Date()).toISOString() + " ";
    }
    function s(...h) {
      return process.stderr.write(n.formatWithOptions(t.inspectOpts, ...h) + `
`);
    }
    function l(h) {
      h ? process.env.DEBUG = h : delete process.env.DEBUG;
    }
    function m() {
      return process.env.DEBUG;
    }
    function c(h) {
      h.inspectOpts = {};
      const g = Object.keys(t.inspectOpts);
      for (let _ = 0; _ < g.length; _++)
        h.inspectOpts[g[_]] = t.inspectOpts[g[_]];
    }
    e.exports = pc()(t);
    const { formatters: f } = e.exports;
    f.o = function(h) {
      return this.inspectOpts.colors = this.useColors, n.inspect(h, this.inspectOpts).split(`
`).map((g) => g.trim()).join(" ");
    }, f.O = function(h) {
      return this.inspectOpts.colors = this.useColors, n.inspect(h, this.inspectOpts);
    };
  }(Sn, Sn.exports)), Sn.exports;
}
typeof process > "u" || process.type === "renderer" || process.browser === !0 || process.__nwjs ? da.exports = Dp() : da.exports = Rp();
var Fp = da.exports, Jr = {};
Object.defineProperty(Jr, "__esModule", { value: !0 });
Jr.ProgressCallbackTransform = void 0;
const xp = Vr;
class Lp extends xp.Transform {
  constructor(t, r, n) {
    super(), this.total = t, this.cancellationToken = r, this.onProgress = n, this.start = Date.now(), this.transferred = 0, this.delta = 0, this.nextUpdate = this.start + 1e3;
  }
  _transform(t, r, n) {
    if (this.cancellationToken.cancelled) {
      n(new Error("cancelled"), null);
      return;
    }
    this.transferred += t.length, this.delta += t.length;
    const i = Date.now();
    i >= this.nextUpdate && this.transferred !== this.total && (this.nextUpdate = i + 1e3, this.onProgress({
      total: this.total,
      delta: this.delta,
      transferred: this.transferred,
      percent: this.transferred / this.total * 100,
      bytesPerSecond: Math.round(this.transferred / ((i - this.start) / 1e3))
    }), this.delta = 0), n(null, t);
  }
  _flush(t) {
    if (this.cancellationToken.cancelled) {
      t(new Error("cancelled"));
      return;
    }
    this.onProgress({
      total: this.total,
      delta: this.delta,
      transferred: this.total,
      percent: 100,
      bytesPerSecond: Math.round(this.transferred / ((Date.now() - this.start) / 1e3))
    }), this.delta = 0, t(null);
  }
}
Jr.ProgressCallbackTransform = Lp;
Object.defineProperty(Oe, "__esModule", { value: !0 });
Oe.DigestTransform = Oe.HttpExecutor = Oe.HttpError = void 0;
Oe.createHttpError = ha;
Oe.parseJson = Gp;
Oe.configureRequestOptionsFromUrl = gc;
Oe.configureRequestUrl = Ua;
Oe.safeGetHeader = nr;
Oe.configureRequestOptions = qn;
Oe.safeStringifyJson = Gn;
const Up = Yr, kp = Fp, Mp = At, jp = Vr, mc = lr, Bp = Et, Jo = ur, Hp = Jr, Er = (0, kp.default)("electron-builder");
function ha(e, t = null) {
  return new La(e.statusCode || -1, `${e.statusCode} ${e.statusMessage}` + (t == null ? "" : `
` + JSON.stringify(t, null, "  ")) + `
Headers: ` + Gn(e.headers), t);
}
const qp = /* @__PURE__ */ new Map([
  [429, "Too many requests"],
  [400, "Bad request"],
  [403, "Forbidden"],
  [404, "Not found"],
  [405, "Method not allowed"],
  [406, "Not acceptable"],
  [408, "Request timeout"],
  [413, "Request entity too large"],
  [500, "Internal server error"],
  [502, "Bad gateway"],
  [503, "Service unavailable"],
  [504, "Gateway timeout"],
  [505, "HTTP version not supported"]
]);
class La extends Error {
  constructor(t, r = `HTTP error: ${qp.get(t) || t}`, n = null) {
    super(r), this.statusCode = t, this.description = n, this.name = "HttpError", this.code = `HTTP_ERROR_${t}`;
  }
  isServerError() {
    return this.statusCode >= 500 && this.statusCode <= 599;
  }
}
Oe.HttpError = La;
function Gp(e) {
  return e.then((t) => t == null || t.length === 0 ? null : JSON.parse(t));
}
class Hn {
  constructor() {
    this.maxRedirects = 10;
  }
  request(t, r = new Bp.CancellationToken(), n) {
    qn(t);
    const i = n == null ? void 0 : JSON.stringify(n), a = i ? Buffer.from(i) : void 0;
    if (a != null) {
      Er(i);
      const { headers: o, ...s } = t;
      t = {
        method: "post",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": a.length,
          ...o
        },
        ...s
      };
    }
    return this.doApiRequest(t, r, (o) => o.end(a));
  }
  doApiRequest(t, r, n, i = 0) {
    return Er.enabled && Er(`Request: ${Gn(t)}`), r.createPromise((a, o, s) => {
      const l = this.createRequest(t, (m) => {
        try {
          this.handleResponse(m, t, r, a, o, i, n);
        } catch (c) {
          o(c);
        }
      });
      this.addErrorAndTimeoutHandlers(l, o, t.timeout), this.addRedirectHandlers(l, t, o, i, (m) => {
        this.doApiRequest(m, r, n, i).then(a).catch(o);
      }), n(l, o), s(() => l.abort());
    });
  }
  // noinspection JSUnusedLocalSymbols
  // eslint-disable-next-line
  addRedirectHandlers(t, r, n, i, a) {
  }
  addErrorAndTimeoutHandlers(t, r, n = 60 * 1e3) {
    this.addTimeOutHandler(t, r, n), t.on("error", r), t.on("aborted", () => {
      r(new Error("Request has been aborted by the server"));
    });
  }
  handleResponse(t, r, n, i, a, o, s) {
    var l;
    if (Er.enabled && Er(`Response: ${t.statusCode} ${t.statusMessage}, request options: ${Gn(r)}`), t.statusCode === 404) {
      a(ha(t, `method: ${r.method || "GET"} url: ${r.protocol || "https:"}//${r.hostname}${r.port ? `:${r.port}` : ""}${r.path}

Please double check that your authentication token is correct. Due to security reasons, actual status maybe not reported, but 404.
`));
      return;
    } else if (t.statusCode === 204) {
      i();
      return;
    }
    const m = (l = t.statusCode) !== null && l !== void 0 ? l : 0, c = m >= 300 && m < 400, f = nr(t, "location");
    if (c && f != null) {
      if (o > this.maxRedirects) {
        a(this.createMaxRedirectError());
        return;
      }
      this.doApiRequest(Hn.prepareRedirectUrlOptions(f, r), n, s, o).then(i).catch(a);
      return;
    }
    t.setEncoding("utf8");
    let h = "";
    t.on("error", a), t.on("data", (g) => h += g), t.on("end", () => {
      try {
        if (t.statusCode != null && t.statusCode >= 400) {
          const g = nr(t, "content-type"), _ = g != null && (Array.isArray(g) ? g.find((w) => w.includes("json")) != null : g.includes("json"));
          a(ha(t, `method: ${r.method || "GET"} url: ${r.protocol || "https:"}//${r.hostname}${r.port ? `:${r.port}` : ""}${r.path}

          Data:
          ${_ ? JSON.stringify(JSON.parse(h)) : h}
          `));
        } else
          i(h.length === 0 ? null : h);
      } catch (g) {
        a(g);
      }
    });
  }
  async downloadToBuffer(t, r) {
    return await r.cancellationToken.createPromise((n, i, a) => {
      const o = [], s = {
        headers: r.headers || void 0,
        // because PrivateGitHubProvider requires HttpExecutor.prepareRedirectUrlOptions logic, so, we need to redirect manually
        redirect: "manual"
      };
      Ua(t, s), qn(s), this.doDownload(s, {
        destination: null,
        options: r,
        onCancel: a,
        callback: (l) => {
          l == null ? n(Buffer.concat(o)) : i(l);
        },
        responseHandler: (l, m) => {
          let c = 0;
          l.on("data", (f) => {
            if (c += f.length, c > 524288e3) {
              m(new Error("Maximum allowed size is 500 MB"));
              return;
            }
            o.push(f);
          }), l.on("end", () => {
            m(null);
          });
        }
      }, 0);
    });
  }
  doDownload(t, r, n) {
    const i = this.createRequest(t, (a) => {
      if (a.statusCode >= 400) {
        r.callback(new Error(`Cannot download "${t.protocol || "https:"}//${t.hostname}${t.path}", status ${a.statusCode}: ${a.statusMessage}`));
        return;
      }
      a.on("error", r.callback);
      const o = nr(a, "location");
      if (o != null) {
        n < this.maxRedirects ? this.doDownload(Hn.prepareRedirectUrlOptions(o, t), r, n++) : r.callback(this.createMaxRedirectError());
        return;
      }
      r.responseHandler == null ? zp(r, a) : r.responseHandler(a, r.callback);
    });
    this.addErrorAndTimeoutHandlers(i, r.callback, t.timeout), this.addRedirectHandlers(i, t, r.callback, n, (a) => {
      this.doDownload(a, r, n++);
    }), i.end();
  }
  createMaxRedirectError() {
    return new Error(`Too many redirects (> ${this.maxRedirects})`);
  }
  addTimeOutHandler(t, r, n) {
    t.on("socket", (i) => {
      i.setTimeout(n, () => {
        t.abort(), r(new Error("Request timed out"));
      });
    });
  }
  static prepareRedirectUrlOptions(t, r) {
    const n = gc(t, { ...r }), i = n.headers;
    if (i != null && i.authorization) {
      const a = new mc.URL(t);
      (a.hostname.endsWith(".amazonaws.com") || a.searchParams.has("X-Amz-Credential")) && delete i.authorization;
    }
    return n;
  }
  static retryOnServerError(t, r = 3) {
    for (let n = 0; ; n++)
      try {
        return t();
      } catch (i) {
        if (n < r && (i instanceof La && i.isServerError() || i.code === "EPIPE"))
          continue;
        throw i;
      }
  }
}
Oe.HttpExecutor = Hn;
function gc(e, t) {
  const r = qn(t);
  return Ua(new mc.URL(e), r), r;
}
function Ua(e, t) {
  t.protocol = e.protocol, t.hostname = e.hostname, e.port ? t.port = e.port : t.port && delete t.port, t.path = e.pathname + e.search;
}
class pa extends jp.Transform {
  // noinspection JSUnusedGlobalSymbols
  get actual() {
    return this._actual;
  }
  constructor(t, r = "sha512", n = "base64") {
    super(), this.expected = t, this.algorithm = r, this.encoding = n, this._actual = null, this.isValidateOnEnd = !0, this.digester = (0, Up.createHash)(r);
  }
  // noinspection JSUnusedGlobalSymbols
  _transform(t, r, n) {
    this.digester.update(t), n(null, t);
  }
  // noinspection JSUnusedGlobalSymbols
  _flush(t) {
    if (this._actual = this.digester.digest(this.encoding), this.isValidateOnEnd)
      try {
        this.validate();
      } catch (r) {
        t(r);
        return;
      }
    t(null);
  }
  validate() {
    if (this._actual == null)
      throw (0, Jo.newError)("Not finished yet", "ERR_STREAM_NOT_FINISHED");
    if (this._actual !== this.expected)
      throw (0, Jo.newError)(`${this.algorithm} checksum mismatch, expected ${this.expected}, got ${this._actual}`, "ERR_CHECKSUM_MISMATCH");
    return null;
  }
}
Oe.DigestTransform = pa;
function Wp(e, t, r) {
  return e != null && t != null && e !== t ? (r(new Error(`checksum mismatch: expected ${t} but got ${e} (X-Checksum-Sha2 header)`)), !1) : !0;
}
function nr(e, t) {
  const r = e.headers[t];
  return r == null ? null : Array.isArray(r) ? r.length === 0 ? null : r[r.length - 1] : r;
}
function zp(e, t) {
  if (!Wp(nr(t, "X-Checksum-Sha2"), e.options.sha2, e.callback))
    return;
  const r = [];
  if (e.options.onProgress != null) {
    const o = nr(t, "content-length");
    o != null && r.push(new Hp.ProgressCallbackTransform(parseInt(o, 10), e.options.cancellationToken, e.options.onProgress));
  }
  const n = e.options.sha512;
  n != null ? r.push(new pa(n, "sha512", n.length === 128 && !n.includes("+") && !n.includes("Z") && !n.includes("=") ? "hex" : "base64")) : e.options.sha2 != null && r.push(new pa(e.options.sha2, "sha256", "hex"));
  const i = (0, Mp.createWriteStream)(e.destination);
  r.push(i);
  let a = t;
  for (const o of r)
    o.on("error", (s) => {
      i.close(), e.options.cancellationToken.cancelled || e.callback(s);
    }), a = a.pipe(o);
  i.on("finish", () => {
    i.close(e.callback);
  });
}
function qn(e, t, r) {
  r != null && (e.method = r), e.headers = { ...e.headers };
  const n = e.headers;
  return t != null && (n.authorization = t.startsWith("Basic") || t.startsWith("Bearer") ? t : `token ${t}`), n["User-Agent"] == null && (n["User-Agent"] = "electron-builder"), (r == null || r === "GET" || n["Cache-Control"] == null) && (n["Cache-Control"] = "no-cache"), e.protocol == null && process.versions.electron != null && (e.protocol = "https:"), e;
}
function Gn(e, t) {
  return JSON.stringify(e, (r, n) => r.endsWith("Authorization") || r.endsWith("authorization") || r.endsWith("Password") || r.endsWith("PASSWORD") || r.endsWith("Token") || r.includes("password") || r.includes("token") || t != null && t.has(r) ? "<stripped sensitive data>" : n, 2);
}
var ai = {};
Object.defineProperty(ai, "__esModule", { value: !0 });
ai.MemoLazy = void 0;
class Vp {
  constructor(t, r) {
    this.selector = t, this.creator = r, this.selected = void 0, this._value = void 0;
  }
  get hasValue() {
    return this._value !== void 0;
  }
  get value() {
    const t = this.selector();
    if (this._value !== void 0 && yc(this.selected, t))
      return this._value;
    this.selected = t;
    const r = this.creator(t);
    return this.value = r, r;
  }
  set value(t) {
    this._value = t;
  }
}
ai.MemoLazy = Vp;
function yc(e, t) {
  if (typeof e == "object" && e !== null && (typeof t == "object" && t !== null)) {
    const i = Object.keys(e), a = Object.keys(t);
    return i.length === a.length && i.every((o) => yc(e[o], t[o]));
  }
  return e === t;
}
var oi = {};
Object.defineProperty(oi, "__esModule", { value: !0 });
oi.githubUrl = Yp;
oi.getS3LikeProviderBaseUrl = Xp;
function Yp(e, t = "github.com") {
  return `${e.protocol || "https"}://${e.host || t}`;
}
function Xp(e) {
  const t = e.provider;
  if (t === "s3")
    return Jp(e);
  if (t === "spaces")
    return Kp(e);
  throw new Error(`Not supported provider: ${t}`);
}
function Jp(e) {
  let t;
  if (e.accelerate == !0)
    t = `https://${e.bucket}.s3-accelerate.amazonaws.com`;
  else if (e.endpoint != null)
    t = `${e.endpoint}/${e.bucket}`;
  else if (e.bucket.includes(".")) {
    if (e.region == null)
      throw new Error(`Bucket name "${e.bucket}" includes a dot, but S3 region is missing`);
    e.region === "us-east-1" ? t = `https://s3.amazonaws.com/${e.bucket}` : t = `https://s3-${e.region}.amazonaws.com/${e.bucket}`;
  } else e.region === "cn-north-1" ? t = `https://${e.bucket}.s3.${e.region}.amazonaws.com.cn` : t = `https://${e.bucket}.s3.amazonaws.com`;
  return wc(t, e.path);
}
function wc(e, t) {
  return t != null && t.length > 0 && (t.startsWith("/") || (e += "/"), e += t), e;
}
function Kp(e) {
  if (e.name == null)
    throw new Error("name is missing");
  if (e.region == null)
    throw new Error("region is missing");
  return wc(`https://${e.name}.${e.region}.digitaloceanspaces.com`, e.path);
}
var ka = {};
Object.defineProperty(ka, "__esModule", { value: !0 });
ka.retry = Ec;
const Qp = Et;
async function Ec(e, t, r, n = 0, i = 0, a) {
  var o;
  const s = new Qp.CancellationToken();
  try {
    return await e();
  } catch (l) {
    if ((!((o = a == null ? void 0 : a(l)) !== null && o !== void 0) || o) && t > 0 && !s.cancelled)
      return await new Promise((m) => setTimeout(m, r + n * i)), await Ec(e, t - 1, r, n, i + 1, a);
    throw l;
  }
}
var Ma = {};
Object.defineProperty(Ma, "__esModule", { value: !0 });
Ma.parseDn = Zp;
function Zp(e) {
  let t = !1, r = null, n = "", i = 0;
  e = e.trim();
  const a = /* @__PURE__ */ new Map();
  for (let o = 0; o <= e.length; o++) {
    if (o === e.length) {
      r !== null && a.set(r, n);
      break;
    }
    const s = e[o];
    if (t) {
      if (s === '"') {
        t = !1;
        continue;
      }
    } else {
      if (s === '"') {
        t = !0;
        continue;
      }
      if (s === "\\") {
        o++;
        const l = parseInt(e.slice(o, o + 2), 16);
        Number.isNaN(l) ? n += e[o] : (o++, n += String.fromCharCode(l));
        continue;
      }
      if (r === null && s === "=") {
        r = n, n = "";
        continue;
      }
      if (s === "," || s === ";" || s === "+") {
        r !== null && a.set(r, n), r = null, n = "";
        continue;
      }
    }
    if (s === " " && !t) {
      if (n.length === 0)
        continue;
      if (o > i) {
        let l = o;
        for (; e[l] === " "; )
          l++;
        i = l;
      }
      if (i >= e.length || e[i] === "," || e[i] === ";" || r === null && e[i] === "=" || r !== null && e[i] === "+") {
        o = i - 1;
        continue;
      }
    }
    n += s;
  }
  return a;
}
var or = {};
Object.defineProperty(or, "__esModule", { value: !0 });
or.nil = or.UUID = void 0;
const vc = Yr, _c = ur, em = "options.name must be either a string or a Buffer", Ko = (0, vc.randomBytes)(16);
Ko[0] = Ko[0] | 1;
const Un = {}, Y = [];
for (let e = 0; e < 256; e++) {
  const t = (e + 256).toString(16).substr(1);
  Un[t] = e, Y[e] = t;
}
class Mt {
  constructor(t) {
    this.ascii = null, this.binary = null;
    const r = Mt.check(t);
    if (!r)
      throw new Error("not a UUID");
    this.version = r.version, r.format === "ascii" ? this.ascii = t : this.binary = t;
  }
  static v5(t, r) {
    return tm(t, "sha1", 80, r);
  }
  toString() {
    return this.ascii == null && (this.ascii = rm(this.binary)), this.ascii;
  }
  inspect() {
    return `UUID v${this.version} ${this.toString()}`;
  }
  static check(t, r = 0) {
    if (typeof t == "string")
      return t = t.toLowerCase(), /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-([a-f0-9]{12})$/.test(t) ? t === "00000000-0000-0000-0000-000000000000" ? { version: void 0, variant: "nil", format: "ascii" } : {
        version: (Un[t[14] + t[15]] & 240) >> 4,
        variant: Qo((Un[t[19] + t[20]] & 224) >> 5),
        format: "ascii"
      } : !1;
    if (Buffer.isBuffer(t)) {
      if (t.length < r + 16)
        return !1;
      let n = 0;
      for (; n < 16 && t[r + n] === 0; n++)
        ;
      return n === 16 ? { version: void 0, variant: "nil", format: "binary" } : {
        version: (t[r + 6] & 240) >> 4,
        variant: Qo((t[r + 8] & 224) >> 5),
        format: "binary"
      };
    }
    throw (0, _c.newError)("Unknown type of uuid", "ERR_UNKNOWN_UUID_TYPE");
  }
  // read stringified uuid into a Buffer
  static parse(t) {
    const r = Buffer.allocUnsafe(16);
    let n = 0;
    for (let i = 0; i < 16; i++)
      r[i] = Un[t[n++] + t[n++]], (i === 3 || i === 5 || i === 7 || i === 9) && (n += 1);
    return r;
  }
}
or.UUID = Mt;
Mt.OID = Mt.parse("6ba7b812-9dad-11d1-80b4-00c04fd430c8");
function Qo(e) {
  switch (e) {
    case 0:
    case 1:
    case 3:
      return "ncs";
    case 4:
    case 5:
      return "rfc4122";
    case 6:
      return "microsoft";
    default:
      return "future";
  }
}
var Ir;
(function(e) {
  e[e.ASCII = 0] = "ASCII", e[e.BINARY = 1] = "BINARY", e[e.OBJECT = 2] = "OBJECT";
})(Ir || (Ir = {}));
function tm(e, t, r, n, i = Ir.ASCII) {
  const a = (0, vc.createHash)(t);
  if (typeof e != "string" && !Buffer.isBuffer(e))
    throw (0, _c.newError)(em, "ERR_INVALID_UUID_NAME");
  a.update(n), a.update(e);
  const s = a.digest();
  let l;
  switch (i) {
    case Ir.BINARY:
      s[6] = s[6] & 15 | r, s[8] = s[8] & 63 | 128, l = s;
      break;
    case Ir.OBJECT:
      s[6] = s[6] & 15 | r, s[8] = s[8] & 63 | 128, l = new Mt(s);
      break;
    default:
      l = Y[s[0]] + Y[s[1]] + Y[s[2]] + Y[s[3]] + "-" + Y[s[4]] + Y[s[5]] + "-" + Y[s[6] & 15 | r] + Y[s[7]] + "-" + Y[s[8] & 63 | 128] + Y[s[9]] + "-" + Y[s[10]] + Y[s[11]] + Y[s[12]] + Y[s[13]] + Y[s[14]] + Y[s[15]];
      break;
  }
  return l;
}
function rm(e) {
  return Y[e[0]] + Y[e[1]] + Y[e[2]] + Y[e[3]] + "-" + Y[e[4]] + Y[e[5]] + "-" + Y[e[6]] + Y[e[7]] + "-" + Y[e[8]] + Y[e[9]] + "-" + Y[e[10]] + Y[e[11]] + Y[e[12]] + Y[e[13]] + Y[e[14]] + Y[e[15]];
}
or.nil = new Mt("00000000-0000-0000-0000-000000000000");
var Kr = {}, Sc = {};
(function(e) {
  (function(t) {
    t.parser = function(d, u) {
      return new n(d, u);
    }, t.SAXParser = n, t.SAXStream = c, t.createStream = m, t.MAX_BUFFER_LENGTH = 64 * 1024;
    var r = [
      "comment",
      "sgmlDecl",
      "textNode",
      "tagName",
      "doctype",
      "procInstName",
      "procInstBody",
      "entity",
      "attribName",
      "attribValue",
      "cdata",
      "script"
    ];
    t.EVENTS = [
      "text",
      "processinginstruction",
      "sgmldeclaration",
      "doctype",
      "comment",
      "opentagstart",
      "attribute",
      "opentag",
      "closetag",
      "opencdata",
      "cdata",
      "closecdata",
      "error",
      "end",
      "ready",
      "script",
      "opennamespace",
      "closenamespace"
    ];
    function n(d, u) {
      if (!(this instanceof n))
        return new n(d, u);
      var C = this;
      a(C), C.q = C.c = "", C.bufferCheckPosition = t.MAX_BUFFER_LENGTH, C.opt = u || {}, C.opt.lowercase = C.opt.lowercase || C.opt.lowercasetags, C.looseCase = C.opt.lowercase ? "toLowerCase" : "toUpperCase", C.tags = [], C.closed = C.closedRoot = C.sawRoot = !1, C.tag = C.error = null, C.strict = !!d, C.noscript = !!(d || C.opt.noscript), C.state = y.BEGIN, C.strictEntities = C.opt.strictEntities, C.ENTITIES = C.strictEntities ? Object.create(t.XML_ENTITIES) : Object.create(t.ENTITIES), C.attribList = [], C.opt.xmlns && (C.ns = Object.create(w)), C.opt.unquotedAttributeValues === void 0 && (C.opt.unquotedAttributeValues = !d), C.trackPosition = C.opt.position !== !1, C.trackPosition && (C.position = C.line = C.column = 0), H(C, "onready");
    }
    Object.create || (Object.create = function(d) {
      function u() {
      }
      u.prototype = d;
      var C = new u();
      return C;
    }), Object.keys || (Object.keys = function(d) {
      var u = [];
      for (var C in d) d.hasOwnProperty(C) && u.push(C);
      return u;
    });
    function i(d) {
      for (var u = Math.max(t.MAX_BUFFER_LENGTH, 10), C = 0, v = 0, J = r.length; v < J; v++) {
        var ne = d[r[v]].length;
        if (ne > u)
          switch (r[v]) {
            case "textNode":
              Q(d);
              break;
            case "cdata":
              j(d, "oncdata", d.cdata), d.cdata = "";
              break;
            case "script":
              j(d, "onscript", d.script), d.script = "";
              break;
            default:
              b(d, "Max buffer length exceeded: " + r[v]);
          }
        C = Math.max(C, ne);
      }
      var se = t.MAX_BUFFER_LENGTH - C;
      d.bufferCheckPosition = se + d.position;
    }
    function a(d) {
      for (var u = 0, C = r.length; u < C; u++)
        d[r[u]] = "";
    }
    function o(d) {
      Q(d), d.cdata !== "" && (j(d, "oncdata", d.cdata), d.cdata = ""), d.script !== "" && (j(d, "onscript", d.script), d.script = "");
    }
    n.prototype = {
      end: function() {
        P(this);
      },
      write: Ke,
      resume: function() {
        return this.error = null, this;
      },
      close: function() {
        return this.write(null);
      },
      flush: function() {
        o(this);
      }
    };
    var s;
    try {
      s = require("stream").Stream;
    } catch {
      s = function() {
      };
    }
    s || (s = function() {
    });
    var l = t.EVENTS.filter(function(d) {
      return d !== "error" && d !== "end";
    });
    function m(d, u) {
      return new c(d, u);
    }
    function c(d, u) {
      if (!(this instanceof c))
        return new c(d, u);
      s.apply(this), this._parser = new n(d, u), this.writable = !0, this.readable = !0;
      var C = this;
      this._parser.onend = function() {
        C.emit("end");
      }, this._parser.onerror = function(v) {
        C.emit("error", v), C._parser.error = null;
      }, this._decoder = null, l.forEach(function(v) {
        Object.defineProperty(C, "on" + v, {
          get: function() {
            return C._parser["on" + v];
          },
          set: function(J) {
            if (!J)
              return C.removeAllListeners(v), C._parser["on" + v] = J, J;
            C.on(v, J);
          },
          enumerable: !0,
          configurable: !1
        });
      });
    }
    c.prototype = Object.create(s.prototype, {
      constructor: {
        value: c
      }
    }), c.prototype.write = function(d) {
      if (typeof Buffer == "function" && typeof Buffer.isBuffer == "function" && Buffer.isBuffer(d)) {
        if (!this._decoder) {
          var u = Vf.StringDecoder;
          this._decoder = new u("utf8");
        }
        d = this._decoder.write(d);
      }
      return this._parser.write(d.toString()), this.emit("data", d), !0;
    }, c.prototype.end = function(d) {
      return d && d.length && this.write(d), this._parser.end(), !0;
    }, c.prototype.on = function(d, u) {
      var C = this;
      return !C._parser["on" + d] && l.indexOf(d) !== -1 && (C._parser["on" + d] = function() {
        var v = arguments.length === 1 ? [arguments[0]] : Array.apply(null, arguments);
        v.splice(0, 0, d), C.emit.apply(C, v);
      }), s.prototype.on.call(C, d, u);
    };
    var f = "[CDATA[", h = "DOCTYPE", g = "http://www.w3.org/XML/1998/namespace", _ = "http://www.w3.org/2000/xmlns/", w = { xml: g, xmlns: _ }, S = /[:_A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD]/, T = /[:_A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\u00B7\u0300-\u036F\u203F-\u2040.\d-]/, A = /[#:_A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD]/, R = /[#:_A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\u00B7\u0300-\u036F\u203F-\u2040.\d-]/;
    function x(d) {
      return d === " " || d === `
` || d === "\r" || d === "	";
    }
    function re(d) {
      return d === '"' || d === "'";
    }
    function ce(d) {
      return d === ">" || x(d);
    }
    function X(d, u) {
      return d.test(u);
    }
    function ke(d, u) {
      return !X(d, u);
    }
    var y = 0;
    t.STATE = {
      BEGIN: y++,
      // leading byte order mark or whitespace
      BEGIN_WHITESPACE: y++,
      // leading whitespace
      TEXT: y++,
      // general stuff
      TEXT_ENTITY: y++,
      // &amp and such.
      OPEN_WAKA: y++,
      // <
      SGML_DECL: y++,
      // <!BLARG
      SGML_DECL_QUOTED: y++,
      // <!BLARG foo "bar
      DOCTYPE: y++,
      // <!DOCTYPE
      DOCTYPE_QUOTED: y++,
      // <!DOCTYPE "//blah
      DOCTYPE_DTD: y++,
      // <!DOCTYPE "//blah" [ ...
      DOCTYPE_DTD_QUOTED: y++,
      // <!DOCTYPE "//blah" [ "foo
      COMMENT_STARTING: y++,
      // <!-
      COMMENT: y++,
      // <!--
      COMMENT_ENDING: y++,
      // <!-- blah -
      COMMENT_ENDED: y++,
      // <!-- blah --
      CDATA: y++,
      // <![CDATA[ something
      CDATA_ENDING: y++,
      // ]
      CDATA_ENDING_2: y++,
      // ]]
      PROC_INST: y++,
      // <?hi
      PROC_INST_BODY: y++,
      // <?hi there
      PROC_INST_ENDING: y++,
      // <?hi "there" ?
      OPEN_TAG: y++,
      // <strong
      OPEN_TAG_SLASH: y++,
      // <strong /
      ATTRIB: y++,
      // <a
      ATTRIB_NAME: y++,
      // <a foo
      ATTRIB_NAME_SAW_WHITE: y++,
      // <a foo _
      ATTRIB_VALUE: y++,
      // <a foo=
      ATTRIB_VALUE_QUOTED: y++,
      // <a foo="bar
      ATTRIB_VALUE_CLOSED: y++,
      // <a foo="bar"
      ATTRIB_VALUE_UNQUOTED: y++,
      // <a foo=bar
      ATTRIB_VALUE_ENTITY_Q: y++,
      // <foo bar="&quot;"
      ATTRIB_VALUE_ENTITY_U: y++,
      // <foo bar=&quot
      CLOSE_TAG: y++,
      // </a
      CLOSE_TAG_SAW_WHITE: y++,
      // </a   >
      SCRIPT: y++,
      // <script> ...
      SCRIPT_ENDING: y++
      // <script> ... <
    }, t.XML_ENTITIES = {
      amp: "&",
      gt: ">",
      lt: "<",
      quot: '"',
      apos: "'"
    }, t.ENTITIES = {
      amp: "&",
      gt: ">",
      lt: "<",
      quot: '"',
      apos: "'",
      AElig: 198,
      Aacute: 193,
      Acirc: 194,
      Agrave: 192,
      Aring: 197,
      Atilde: 195,
      Auml: 196,
      Ccedil: 199,
      ETH: 208,
      Eacute: 201,
      Ecirc: 202,
      Egrave: 200,
      Euml: 203,
      Iacute: 205,
      Icirc: 206,
      Igrave: 204,
      Iuml: 207,
      Ntilde: 209,
      Oacute: 211,
      Ocirc: 212,
      Ograve: 210,
      Oslash: 216,
      Otilde: 213,
      Ouml: 214,
      THORN: 222,
      Uacute: 218,
      Ucirc: 219,
      Ugrave: 217,
      Uuml: 220,
      Yacute: 221,
      aacute: 225,
      acirc: 226,
      aelig: 230,
      agrave: 224,
      aring: 229,
      atilde: 227,
      auml: 228,
      ccedil: 231,
      eacute: 233,
      ecirc: 234,
      egrave: 232,
      eth: 240,
      euml: 235,
      iacute: 237,
      icirc: 238,
      igrave: 236,
      iuml: 239,
      ntilde: 241,
      oacute: 243,
      ocirc: 244,
      ograve: 242,
      oslash: 248,
      otilde: 245,
      ouml: 246,
      szlig: 223,
      thorn: 254,
      uacute: 250,
      ucirc: 251,
      ugrave: 249,
      uuml: 252,
      yacute: 253,
      yuml: 255,
      copy: 169,
      reg: 174,
      nbsp: 160,
      iexcl: 161,
      cent: 162,
      pound: 163,
      curren: 164,
      yen: 165,
      brvbar: 166,
      sect: 167,
      uml: 168,
      ordf: 170,
      laquo: 171,
      not: 172,
      shy: 173,
      macr: 175,
      deg: 176,
      plusmn: 177,
      sup1: 185,
      sup2: 178,
      sup3: 179,
      acute: 180,
      micro: 181,
      para: 182,
      middot: 183,
      cedil: 184,
      ordm: 186,
      raquo: 187,
      frac14: 188,
      frac12: 189,
      frac34: 190,
      iquest: 191,
      times: 215,
      divide: 247,
      OElig: 338,
      oelig: 339,
      Scaron: 352,
      scaron: 353,
      Yuml: 376,
      fnof: 402,
      circ: 710,
      tilde: 732,
      Alpha: 913,
      Beta: 914,
      Gamma: 915,
      Delta: 916,
      Epsilon: 917,
      Zeta: 918,
      Eta: 919,
      Theta: 920,
      Iota: 921,
      Kappa: 922,
      Lambda: 923,
      Mu: 924,
      Nu: 925,
      Xi: 926,
      Omicron: 927,
      Pi: 928,
      Rho: 929,
      Sigma: 931,
      Tau: 932,
      Upsilon: 933,
      Phi: 934,
      Chi: 935,
      Psi: 936,
      Omega: 937,
      alpha: 945,
      beta: 946,
      gamma: 947,
      delta: 948,
      epsilon: 949,
      zeta: 950,
      eta: 951,
      theta: 952,
      iota: 953,
      kappa: 954,
      lambda: 955,
      mu: 956,
      nu: 957,
      xi: 958,
      omicron: 959,
      pi: 960,
      rho: 961,
      sigmaf: 962,
      sigma: 963,
      tau: 964,
      upsilon: 965,
      phi: 966,
      chi: 967,
      psi: 968,
      omega: 969,
      thetasym: 977,
      upsih: 978,
      piv: 982,
      ensp: 8194,
      emsp: 8195,
      thinsp: 8201,
      zwnj: 8204,
      zwj: 8205,
      lrm: 8206,
      rlm: 8207,
      ndash: 8211,
      mdash: 8212,
      lsquo: 8216,
      rsquo: 8217,
      sbquo: 8218,
      ldquo: 8220,
      rdquo: 8221,
      bdquo: 8222,
      dagger: 8224,
      Dagger: 8225,
      bull: 8226,
      hellip: 8230,
      permil: 8240,
      prime: 8242,
      Prime: 8243,
      lsaquo: 8249,
      rsaquo: 8250,
      oline: 8254,
      frasl: 8260,
      euro: 8364,
      image: 8465,
      weierp: 8472,
      real: 8476,
      trade: 8482,
      alefsym: 8501,
      larr: 8592,
      uarr: 8593,
      rarr: 8594,
      darr: 8595,
      harr: 8596,
      crarr: 8629,
      lArr: 8656,
      uArr: 8657,
      rArr: 8658,
      dArr: 8659,
      hArr: 8660,
      forall: 8704,
      part: 8706,
      exist: 8707,
      empty: 8709,
      nabla: 8711,
      isin: 8712,
      notin: 8713,
      ni: 8715,
      prod: 8719,
      sum: 8721,
      minus: 8722,
      lowast: 8727,
      radic: 8730,
      prop: 8733,
      infin: 8734,
      ang: 8736,
      and: 8743,
      or: 8744,
      cap: 8745,
      cup: 8746,
      int: 8747,
      there4: 8756,
      sim: 8764,
      cong: 8773,
      asymp: 8776,
      ne: 8800,
      equiv: 8801,
      le: 8804,
      ge: 8805,
      sub: 8834,
      sup: 8835,
      nsub: 8836,
      sube: 8838,
      supe: 8839,
      oplus: 8853,
      otimes: 8855,
      perp: 8869,
      sdot: 8901,
      lceil: 8968,
      rceil: 8969,
      lfloor: 8970,
      rfloor: 8971,
      lang: 9001,
      rang: 9002,
      loz: 9674,
      spades: 9824,
      clubs: 9827,
      hearts: 9829,
      diams: 9830
    }, Object.keys(t.ENTITIES).forEach(function(d) {
      var u = t.ENTITIES[d], C = typeof u == "number" ? String.fromCharCode(u) : u;
      t.ENTITIES[d] = C;
    });
    for (var z in t.STATE)
      t.STATE[t.STATE[z]] = z;
    y = t.STATE;
    function H(d, u, C) {
      d[u] && d[u](C);
    }
    function j(d, u, C) {
      d.textNode && Q(d), H(d, u, C);
    }
    function Q(d) {
      d.textNode = O(d.opt, d.textNode), d.textNode && H(d, "ontext", d.textNode), d.textNode = "";
    }
    function O(d, u) {
      return d.trim && (u = u.trim()), d.normalize && (u = u.replace(/\s+/g, " ")), u;
    }
    function b(d, u) {
      return Q(d), d.trackPosition && (u += `
Line: ` + d.line + `
Column: ` + d.column + `
Char: ` + d.c), u = new Error(u), d.error = u, H(d, "onerror", u), d;
    }
    function P(d) {
      return d.sawRoot && !d.closedRoot && $(d, "Unclosed root tag"), d.state !== y.BEGIN && d.state !== y.BEGIN_WHITESPACE && d.state !== y.TEXT && b(d, "Unexpected end"), Q(d), d.c = "", d.closed = !0, H(d, "onend"), n.call(d, d.strict, d.opt), d;
    }
    function $(d, u) {
      if (typeof d != "object" || !(d instanceof n))
        throw new Error("bad call to strictFail");
      d.strict && b(d, u);
    }
    function N(d) {
      d.strict || (d.tagName = d.tagName[d.looseCase]());
      var u = d.tags[d.tags.length - 1] || d, C = d.tag = { name: d.tagName, attributes: {} };
      d.opt.xmlns && (C.ns = u.ns), d.attribList.length = 0, j(d, "onopentagstart", C);
    }
    function D(d, u) {
      var C = d.indexOf(":"), v = C < 0 ? ["", d] : d.split(":"), J = v[0], ne = v[1];
      return u && d === "xmlns" && (J = "xmlns", ne = ""), { prefix: J, local: ne };
    }
    function M(d) {
      if (d.strict || (d.attribName = d.attribName[d.looseCase]()), d.attribList.indexOf(d.attribName) !== -1 || d.tag.attributes.hasOwnProperty(d.attribName)) {
        d.attribName = d.attribValue = "";
        return;
      }
      if (d.opt.xmlns) {
        var u = D(d.attribName, !0), C = u.prefix, v = u.local;
        if (C === "xmlns")
          if (v === "xml" && d.attribValue !== g)
            $(
              d,
              "xml: prefix must be bound to " + g + `
Actual: ` + d.attribValue
            );
          else if (v === "xmlns" && d.attribValue !== _)
            $(
              d,
              "xmlns: prefix must be bound to " + _ + `
Actual: ` + d.attribValue
            );
          else {
            var J = d.tag, ne = d.tags[d.tags.length - 1] || d;
            J.ns === ne.ns && (J.ns = Object.create(ne.ns)), J.ns[v] = d.attribValue;
          }
        d.attribList.push([d.attribName, d.attribValue]);
      } else
        d.tag.attributes[d.attribName] = d.attribValue, j(d, "onattribute", {
          name: d.attribName,
          value: d.attribValue
        });
      d.attribName = d.attribValue = "";
    }
    function V(d, u) {
      if (d.opt.xmlns) {
        var C = d.tag, v = D(d.tagName);
        C.prefix = v.prefix, C.local = v.local, C.uri = C.ns[v.prefix] || "", C.prefix && !C.uri && ($(d, "Unbound namespace prefix: " + JSON.stringify(d.tagName)), C.uri = v.prefix);
        var J = d.tags[d.tags.length - 1] || d;
        C.ns && J.ns !== C.ns && Object.keys(C.ns).forEach(function(cn) {
          j(d, "onopennamespace", {
            prefix: cn,
            uri: C.ns[cn]
          });
        });
        for (var ne = 0, se = d.attribList.length; ne < se; ne++) {
          var Ee = d.attribList[ne], Ae = Ee[0], lt = Ee[1], de = D(Ae, !0), We = de.prefix, Ai = de.local, ln = We === "" ? "" : C.ns[We] || "", hr = {
            name: Ae,
            value: lt,
            prefix: We,
            local: Ai,
            uri: ln
          };
          We && We !== "xmlns" && !ln && ($(d, "Unbound namespace prefix: " + JSON.stringify(We)), hr.uri = We), d.tag.attributes[Ae] = hr, j(d, "onattribute", hr);
        }
        d.attribList.length = 0;
      }
      d.tag.isSelfClosing = !!u, d.sawRoot = !0, d.tags.push(d.tag), j(d, "onopentag", d.tag), u || (!d.noscript && d.tagName.toLowerCase() === "script" ? d.state = y.SCRIPT : d.state = y.TEXT, d.tag = null, d.tagName = ""), d.attribName = d.attribValue = "", d.attribList.length = 0;
    }
    function q(d) {
      if (!d.tagName) {
        $(d, "Weird empty close tag."), d.textNode += "</>", d.state = y.TEXT;
        return;
      }
      if (d.script) {
        if (d.tagName !== "script") {
          d.script += "</" + d.tagName + ">", d.tagName = "", d.state = y.SCRIPT;
          return;
        }
        j(d, "onscript", d.script), d.script = "";
      }
      var u = d.tags.length, C = d.tagName;
      d.strict || (C = C[d.looseCase]());
      for (var v = C; u--; ) {
        var J = d.tags[u];
        if (J.name !== v)
          $(d, "Unexpected close tag");
        else
          break;
      }
      if (u < 0) {
        $(d, "Unmatched closing tag: " + d.tagName), d.textNode += "</" + d.tagName + ">", d.state = y.TEXT;
        return;
      }
      d.tagName = C;
      for (var ne = d.tags.length; ne-- > u; ) {
        var se = d.tag = d.tags.pop();
        d.tagName = d.tag.name, j(d, "onclosetag", d.tagName);
        var Ee = {};
        for (var Ae in se.ns)
          Ee[Ae] = se.ns[Ae];
        var lt = d.tags[d.tags.length - 1] || d;
        d.opt.xmlns && se.ns !== lt.ns && Object.keys(se.ns).forEach(function(de) {
          var We = se.ns[de];
          j(d, "onclosenamespace", { prefix: de, uri: We });
        });
      }
      u === 0 && (d.closedRoot = !0), d.tagName = d.attribValue = d.attribName = "", d.attribList.length = 0, d.state = y.TEXT;
    }
    function Z(d) {
      var u = d.entity, C = u.toLowerCase(), v, J = "";
      return d.ENTITIES[u] ? d.ENTITIES[u] : d.ENTITIES[C] ? d.ENTITIES[C] : (u = C, u.charAt(0) === "#" && (u.charAt(1) === "x" ? (u = u.slice(2), v = parseInt(u, 16), J = v.toString(16)) : (u = u.slice(1), v = parseInt(u, 10), J = v.toString(10))), u = u.replace(/^0+/, ""), isNaN(v) || J.toLowerCase() !== u ? ($(d, "Invalid character entity"), "&" + d.entity + ";") : String.fromCodePoint(v));
    }
    function pe(d, u) {
      u === "<" ? (d.state = y.OPEN_WAKA, d.startTagPosition = d.position) : x(u) || ($(d, "Non-whitespace before first tag."), d.textNode = u, d.state = y.TEXT);
    }
    function k(d, u) {
      var C = "";
      return u < d.length && (C = d.charAt(u)), C;
    }
    function Ke(d) {
      var u = this;
      if (this.error)
        throw this.error;
      if (u.closed)
        return b(
          u,
          "Cannot write after close. Assign an onready handler."
        );
      if (d === null)
        return P(u);
      typeof d == "object" && (d = d.toString());
      for (var C = 0, v = ""; v = k(d, C++), u.c = v, !!v; )
        switch (u.trackPosition && (u.position++, v === `
` ? (u.line++, u.column = 0) : u.column++), u.state) {
          case y.BEGIN:
            if (u.state = y.BEGIN_WHITESPACE, v === "\uFEFF")
              continue;
            pe(u, v);
            continue;
          case y.BEGIN_WHITESPACE:
            pe(u, v);
            continue;
          case y.TEXT:
            if (u.sawRoot && !u.closedRoot) {
              for (var J = C - 1; v && v !== "<" && v !== "&"; )
                v = k(d, C++), v && u.trackPosition && (u.position++, v === `
` ? (u.line++, u.column = 0) : u.column++);
              u.textNode += d.substring(J, C - 1);
            }
            v === "<" && !(u.sawRoot && u.closedRoot && !u.strict) ? (u.state = y.OPEN_WAKA, u.startTagPosition = u.position) : (!x(v) && (!u.sawRoot || u.closedRoot) && $(u, "Text data outside of root node."), v === "&" ? u.state = y.TEXT_ENTITY : u.textNode += v);
            continue;
          case y.SCRIPT:
            v === "<" ? u.state = y.SCRIPT_ENDING : u.script += v;
            continue;
          case y.SCRIPT_ENDING:
            v === "/" ? u.state = y.CLOSE_TAG : (u.script += "<" + v, u.state = y.SCRIPT);
            continue;
          case y.OPEN_WAKA:
            if (v === "!")
              u.state = y.SGML_DECL, u.sgmlDecl = "";
            else if (!x(v)) if (X(S, v))
              u.state = y.OPEN_TAG, u.tagName = v;
            else if (v === "/")
              u.state = y.CLOSE_TAG, u.tagName = "";
            else if (v === "?")
              u.state = y.PROC_INST, u.procInstName = u.procInstBody = "";
            else {
              if ($(u, "Unencoded <"), u.startTagPosition + 1 < u.position) {
                var ne = u.position - u.startTagPosition;
                v = new Array(ne).join(" ") + v;
              }
              u.textNode += "<" + v, u.state = y.TEXT;
            }
            continue;
          case y.SGML_DECL:
            if (u.sgmlDecl + v === "--") {
              u.state = y.COMMENT, u.comment = "", u.sgmlDecl = "";
              continue;
            }
            u.doctype && u.doctype !== !0 && u.sgmlDecl ? (u.state = y.DOCTYPE_DTD, u.doctype += "<!" + u.sgmlDecl + v, u.sgmlDecl = "") : (u.sgmlDecl + v).toUpperCase() === f ? (j(u, "onopencdata"), u.state = y.CDATA, u.sgmlDecl = "", u.cdata = "") : (u.sgmlDecl + v).toUpperCase() === h ? (u.state = y.DOCTYPE, (u.doctype || u.sawRoot) && $(
              u,
              "Inappropriately located doctype declaration"
            ), u.doctype = "", u.sgmlDecl = "") : v === ">" ? (j(u, "onsgmldeclaration", u.sgmlDecl), u.sgmlDecl = "", u.state = y.TEXT) : (re(v) && (u.state = y.SGML_DECL_QUOTED), u.sgmlDecl += v);
            continue;
          case y.SGML_DECL_QUOTED:
            v === u.q && (u.state = y.SGML_DECL, u.q = ""), u.sgmlDecl += v;
            continue;
          case y.DOCTYPE:
            v === ">" ? (u.state = y.TEXT, j(u, "ondoctype", u.doctype), u.doctype = !0) : (u.doctype += v, v === "[" ? u.state = y.DOCTYPE_DTD : re(v) && (u.state = y.DOCTYPE_QUOTED, u.q = v));
            continue;
          case y.DOCTYPE_QUOTED:
            u.doctype += v, v === u.q && (u.q = "", u.state = y.DOCTYPE);
            continue;
          case y.DOCTYPE_DTD:
            v === "]" ? (u.doctype += v, u.state = y.DOCTYPE) : v === "<" ? (u.state = y.OPEN_WAKA, u.startTagPosition = u.position) : re(v) ? (u.doctype += v, u.state = y.DOCTYPE_DTD_QUOTED, u.q = v) : u.doctype += v;
            continue;
          case y.DOCTYPE_DTD_QUOTED:
            u.doctype += v, v === u.q && (u.state = y.DOCTYPE_DTD, u.q = "");
            continue;
          case y.COMMENT:
            v === "-" ? u.state = y.COMMENT_ENDING : u.comment += v;
            continue;
          case y.COMMENT_ENDING:
            v === "-" ? (u.state = y.COMMENT_ENDED, u.comment = O(u.opt, u.comment), u.comment && j(u, "oncomment", u.comment), u.comment = "") : (u.comment += "-" + v, u.state = y.COMMENT);
            continue;
          case y.COMMENT_ENDED:
            v !== ">" ? ($(u, "Malformed comment"), u.comment += "--" + v, u.state = y.COMMENT) : u.doctype && u.doctype !== !0 ? u.state = y.DOCTYPE_DTD : u.state = y.TEXT;
            continue;
          case y.CDATA:
            v === "]" ? u.state = y.CDATA_ENDING : u.cdata += v;
            continue;
          case y.CDATA_ENDING:
            v === "]" ? u.state = y.CDATA_ENDING_2 : (u.cdata += "]" + v, u.state = y.CDATA);
            continue;
          case y.CDATA_ENDING_2:
            v === ">" ? (u.cdata && j(u, "oncdata", u.cdata), j(u, "onclosecdata"), u.cdata = "", u.state = y.TEXT) : v === "]" ? u.cdata += "]" : (u.cdata += "]]" + v, u.state = y.CDATA);
            continue;
          case y.PROC_INST:
            v === "?" ? u.state = y.PROC_INST_ENDING : x(v) ? u.state = y.PROC_INST_BODY : u.procInstName += v;
            continue;
          case y.PROC_INST_BODY:
            if (!u.procInstBody && x(v))
              continue;
            v === "?" ? u.state = y.PROC_INST_ENDING : u.procInstBody += v;
            continue;
          case y.PROC_INST_ENDING:
            v === ">" ? (j(u, "onprocessinginstruction", {
              name: u.procInstName,
              body: u.procInstBody
            }), u.procInstName = u.procInstBody = "", u.state = y.TEXT) : (u.procInstBody += "?" + v, u.state = y.PROC_INST_BODY);
            continue;
          case y.OPEN_TAG:
            X(T, v) ? u.tagName += v : (N(u), v === ">" ? V(u) : v === "/" ? u.state = y.OPEN_TAG_SLASH : (x(v) || $(u, "Invalid character in tag name"), u.state = y.ATTRIB));
            continue;
          case y.OPEN_TAG_SLASH:
            v === ">" ? (V(u, !0), q(u)) : ($(u, "Forward-slash in opening tag not followed by >"), u.state = y.ATTRIB);
            continue;
          case y.ATTRIB:
            if (x(v))
              continue;
            v === ">" ? V(u) : v === "/" ? u.state = y.OPEN_TAG_SLASH : X(S, v) ? (u.attribName = v, u.attribValue = "", u.state = y.ATTRIB_NAME) : $(u, "Invalid attribute name");
            continue;
          case y.ATTRIB_NAME:
            v === "=" ? u.state = y.ATTRIB_VALUE : v === ">" ? ($(u, "Attribute without value"), u.attribValue = u.attribName, M(u), V(u)) : x(v) ? u.state = y.ATTRIB_NAME_SAW_WHITE : X(T, v) ? u.attribName += v : $(u, "Invalid attribute name");
            continue;
          case y.ATTRIB_NAME_SAW_WHITE:
            if (v === "=")
              u.state = y.ATTRIB_VALUE;
            else {
              if (x(v))
                continue;
              $(u, "Attribute without value"), u.tag.attributes[u.attribName] = "", u.attribValue = "", j(u, "onattribute", {
                name: u.attribName,
                value: ""
              }), u.attribName = "", v === ">" ? V(u) : X(S, v) ? (u.attribName = v, u.state = y.ATTRIB_NAME) : ($(u, "Invalid attribute name"), u.state = y.ATTRIB);
            }
            continue;
          case y.ATTRIB_VALUE:
            if (x(v))
              continue;
            re(v) ? (u.q = v, u.state = y.ATTRIB_VALUE_QUOTED) : (u.opt.unquotedAttributeValues || b(u, "Unquoted attribute value"), u.state = y.ATTRIB_VALUE_UNQUOTED, u.attribValue = v);
            continue;
          case y.ATTRIB_VALUE_QUOTED:
            if (v !== u.q) {
              v === "&" ? u.state = y.ATTRIB_VALUE_ENTITY_Q : u.attribValue += v;
              continue;
            }
            M(u), u.q = "", u.state = y.ATTRIB_VALUE_CLOSED;
            continue;
          case y.ATTRIB_VALUE_CLOSED:
            x(v) ? u.state = y.ATTRIB : v === ">" ? V(u) : v === "/" ? u.state = y.OPEN_TAG_SLASH : X(S, v) ? ($(u, "No whitespace between attributes"), u.attribName = v, u.attribValue = "", u.state = y.ATTRIB_NAME) : $(u, "Invalid attribute name");
            continue;
          case y.ATTRIB_VALUE_UNQUOTED:
            if (!ce(v)) {
              v === "&" ? u.state = y.ATTRIB_VALUE_ENTITY_U : u.attribValue += v;
              continue;
            }
            M(u), v === ">" ? V(u) : u.state = y.ATTRIB;
            continue;
          case y.CLOSE_TAG:
            if (u.tagName)
              v === ">" ? q(u) : X(T, v) ? u.tagName += v : u.script ? (u.script += "</" + u.tagName, u.tagName = "", u.state = y.SCRIPT) : (x(v) || $(u, "Invalid tagname in closing tag"), u.state = y.CLOSE_TAG_SAW_WHITE);
            else {
              if (x(v))
                continue;
              ke(S, v) ? u.script ? (u.script += "</" + v, u.state = y.SCRIPT) : $(u, "Invalid tagname in closing tag.") : u.tagName = v;
            }
            continue;
          case y.CLOSE_TAG_SAW_WHITE:
            if (x(v))
              continue;
            v === ">" ? q(u) : $(u, "Invalid characters in closing tag");
            continue;
          case y.TEXT_ENTITY:
          case y.ATTRIB_VALUE_ENTITY_Q:
          case y.ATTRIB_VALUE_ENTITY_U:
            var se, Ee;
            switch (u.state) {
              case y.TEXT_ENTITY:
                se = y.TEXT, Ee = "textNode";
                break;
              case y.ATTRIB_VALUE_ENTITY_Q:
                se = y.ATTRIB_VALUE_QUOTED, Ee = "attribValue";
                break;
              case y.ATTRIB_VALUE_ENTITY_U:
                se = y.ATTRIB_VALUE_UNQUOTED, Ee = "attribValue";
                break;
            }
            if (v === ";") {
              var Ae = Z(u);
              u.opt.unparsedEntities && !Object.values(t.XML_ENTITIES).includes(Ae) ? (u.entity = "", u.state = se, u.write(Ae)) : (u[Ee] += Ae, u.entity = "", u.state = se);
            } else X(u.entity.length ? R : A, v) ? u.entity += v : ($(u, "Invalid character in entity name"), u[Ee] += "&" + u.entity + v, u.entity = "", u.state = se);
            continue;
          default:
            throw new Error(u, "Unknown state: " + u.state);
        }
      return u.position >= u.bufferCheckPosition && i(u), u;
    }
    /*! http://mths.be/fromcodepoint v0.1.0 by @mathias */
    String.fromCodePoint || function() {
      var d = String.fromCharCode, u = Math.floor, C = function() {
        var v = 16384, J = [], ne, se, Ee = -1, Ae = arguments.length;
        if (!Ae)
          return "";
        for (var lt = ""; ++Ee < Ae; ) {
          var de = Number(arguments[Ee]);
          if (!isFinite(de) || // `NaN`, `+Infinity`, or `-Infinity`
          de < 0 || // not a valid Unicode code point
          de > 1114111 || // not a valid Unicode code point
          u(de) !== de)
            throw RangeError("Invalid code point: " + de);
          de <= 65535 ? J.push(de) : (de -= 65536, ne = (de >> 10) + 55296, se = de % 1024 + 56320, J.push(ne, se)), (Ee + 1 === Ae || J.length > v) && (lt += d.apply(null, J), J.length = 0);
        }
        return lt;
      };
      Object.defineProperty ? Object.defineProperty(String, "fromCodePoint", {
        value: C,
        configurable: !0,
        writable: !0
      }) : String.fromCodePoint = C;
    }();
  })(e);
})(Sc);
Object.defineProperty(Kr, "__esModule", { value: !0 });
Kr.XElement = void 0;
Kr.parseXml = om;
const nm = Sc, An = ur;
class Ac {
  constructor(t) {
    if (this.name = t, this.value = "", this.attributes = null, this.isCData = !1, this.elements = null, !t)
      throw (0, An.newError)("Element name cannot be empty", "ERR_XML_ELEMENT_NAME_EMPTY");
    if (!am(t))
      throw (0, An.newError)(`Invalid element name: ${t}`, "ERR_XML_ELEMENT_INVALID_NAME");
  }
  attribute(t) {
    const r = this.attributes === null ? null : this.attributes[t];
    if (r == null)
      throw (0, An.newError)(`No attribute "${t}"`, "ERR_XML_MISSED_ATTRIBUTE");
    return r;
  }
  removeAttribute(t) {
    this.attributes !== null && delete this.attributes[t];
  }
  element(t, r = !1, n = null) {
    const i = this.elementOrNull(t, r);
    if (i === null)
      throw (0, An.newError)(n || `No element "${t}"`, "ERR_XML_MISSED_ELEMENT");
    return i;
  }
  elementOrNull(t, r = !1) {
    if (this.elements === null)
      return null;
    for (const n of this.elements)
      if (Zo(n, t, r))
        return n;
    return null;
  }
  getElements(t, r = !1) {
    return this.elements === null ? [] : this.elements.filter((n) => Zo(n, t, r));
  }
  elementValueOrEmpty(t, r = !1) {
    const n = this.elementOrNull(t, r);
    return n === null ? "" : n.value;
  }
}
Kr.XElement = Ac;
const im = new RegExp(/^[A-Za-z_][:A-Za-z0-9_-]*$/i);
function am(e) {
  return im.test(e);
}
function Zo(e, t, r) {
  const n = e.name;
  return n === t || r === !0 && n.length === t.length && n.toLowerCase() === t.toLowerCase();
}
function om(e) {
  let t = null;
  const r = nm.parser(!0, {}), n = [];
  return r.onopentag = (i) => {
    const a = new Ac(i.name);
    if (a.attributes = i.attributes, t === null)
      t = a;
    else {
      const o = n[n.length - 1];
      o.elements == null && (o.elements = []), o.elements.push(a);
    }
    n.push(a);
  }, r.onclosetag = () => {
    n.pop();
  }, r.ontext = (i) => {
    n.length > 0 && (n[n.length - 1].value = i);
  }, r.oncdata = (i) => {
    const a = n[n.length - 1];
    a.value = i, a.isCData = !0;
  }, r.onerror = (i) => {
    throw i;
  }, r.write(e), t;
}
(function(e) {
  Object.defineProperty(e, "__esModule", { value: !0 }), e.CURRENT_APP_PACKAGE_FILE_NAME = e.CURRENT_APP_INSTALLER_FILE_NAME = e.XElement = e.parseXml = e.UUID = e.parseDn = e.retry = e.githubUrl = e.getS3LikeProviderBaseUrl = e.ProgressCallbackTransform = e.MemoLazy = e.safeStringifyJson = e.safeGetHeader = e.parseJson = e.HttpExecutor = e.HttpError = e.DigestTransform = e.createHttpError = e.configureRequestUrl = e.configureRequestOptionsFromUrl = e.configureRequestOptions = e.newError = e.CancellationToken = e.CancellationError = void 0, e.asArray = f;
  var t = Et;
  Object.defineProperty(e, "CancellationError", { enumerable: !0, get: function() {
    return t.CancellationError;
  } }), Object.defineProperty(e, "CancellationToken", { enumerable: !0, get: function() {
    return t.CancellationToken;
  } });
  var r = ur;
  Object.defineProperty(e, "newError", { enumerable: !0, get: function() {
    return r.newError;
  } });
  var n = Oe;
  Object.defineProperty(e, "configureRequestOptions", { enumerable: !0, get: function() {
    return n.configureRequestOptions;
  } }), Object.defineProperty(e, "configureRequestOptionsFromUrl", { enumerable: !0, get: function() {
    return n.configureRequestOptionsFromUrl;
  } }), Object.defineProperty(e, "configureRequestUrl", { enumerable: !0, get: function() {
    return n.configureRequestUrl;
  } }), Object.defineProperty(e, "createHttpError", { enumerable: !0, get: function() {
    return n.createHttpError;
  } }), Object.defineProperty(e, "DigestTransform", { enumerable: !0, get: function() {
    return n.DigestTransform;
  } }), Object.defineProperty(e, "HttpError", { enumerable: !0, get: function() {
    return n.HttpError;
  } }), Object.defineProperty(e, "HttpExecutor", { enumerable: !0, get: function() {
    return n.HttpExecutor;
  } }), Object.defineProperty(e, "parseJson", { enumerable: !0, get: function() {
    return n.parseJson;
  } }), Object.defineProperty(e, "safeGetHeader", { enumerable: !0, get: function() {
    return n.safeGetHeader;
  } }), Object.defineProperty(e, "safeStringifyJson", { enumerable: !0, get: function() {
    return n.safeStringifyJson;
  } });
  var i = ai;
  Object.defineProperty(e, "MemoLazy", { enumerable: !0, get: function() {
    return i.MemoLazy;
  } });
  var a = Jr;
  Object.defineProperty(e, "ProgressCallbackTransform", { enumerable: !0, get: function() {
    return a.ProgressCallbackTransform;
  } });
  var o = oi;
  Object.defineProperty(e, "getS3LikeProviderBaseUrl", { enumerable: !0, get: function() {
    return o.getS3LikeProviderBaseUrl;
  } }), Object.defineProperty(e, "githubUrl", { enumerable: !0, get: function() {
    return o.githubUrl;
  } });
  var s = ka;
  Object.defineProperty(e, "retry", { enumerable: !0, get: function() {
    return s.retry;
  } });
  var l = Ma;
  Object.defineProperty(e, "parseDn", { enumerable: !0, get: function() {
    return l.parseDn;
  } });
  var m = or;
  Object.defineProperty(e, "UUID", { enumerable: !0, get: function() {
    return m.UUID;
  } });
  var c = Kr;
  Object.defineProperty(e, "parseXml", { enumerable: !0, get: function() {
    return c.parseXml;
  } }), Object.defineProperty(e, "XElement", { enumerable: !0, get: function() {
    return c.XElement;
  } }), e.CURRENT_APP_INSTALLER_FILE_NAME = "installer.exe", e.CURRENT_APP_PACKAGE_FILE_NAME = "package.7z";
  function f(h) {
    return h == null ? [] : Array.isArray(h) ? h : [h];
  }
})(we);
var Se = {}, ja = {}, Ye = {};
function Tc(e) {
  return typeof e > "u" || e === null;
}
function sm(e) {
  return typeof e == "object" && e !== null;
}
function lm(e) {
  return Array.isArray(e) ? e : Tc(e) ? [] : [e];
}
function cm(e, t) {
  var r, n, i, a;
  if (t)
    for (a = Object.keys(t), r = 0, n = a.length; r < n; r += 1)
      i = a[r], e[i] = t[i];
  return e;
}
function um(e, t) {
  var r = "", n;
  for (n = 0; n < t; n += 1)
    r += e;
  return r;
}
function fm(e) {
  return e === 0 && Number.NEGATIVE_INFINITY === 1 / e;
}
Ye.isNothing = Tc;
Ye.isObject = sm;
Ye.toArray = lm;
Ye.repeat = um;
Ye.isNegativeZero = fm;
Ye.extend = cm;
function Cc(e, t) {
  var r = "", n = e.reason || "(unknown reason)";
  return e.mark ? (e.mark.name && (r += 'in "' + e.mark.name + '" '), r += "(" + (e.mark.line + 1) + ":" + (e.mark.column + 1) + ")", !t && e.mark.snippet && (r += `

` + e.mark.snippet), n + " " + r) : n;
}
function xr(e, t) {
  Error.call(this), this.name = "YAMLException", this.reason = e, this.mark = t, this.message = Cc(this, !1), Error.captureStackTrace ? Error.captureStackTrace(this, this.constructor) : this.stack = new Error().stack || "";
}
xr.prototype = Object.create(Error.prototype);
xr.prototype.constructor = xr;
xr.prototype.toString = function(t) {
  return this.name + ": " + Cc(this, t);
};
var Qr = xr, Tr = Ye;
function Mi(e, t, r, n, i) {
  var a = "", o = "", s = Math.floor(i / 2) - 1;
  return n - t > s && (a = " ... ", t = n - s + a.length), r - n > s && (o = " ...", r = n + s - o.length), {
    str: a + e.slice(t, r).replace(/\t/g, "→") + o,
    pos: n - t + a.length
    // relative position
  };
}
function ji(e, t) {
  return Tr.repeat(" ", t - e.length) + e;
}
function dm(e, t) {
  if (t = Object.create(t || null), !e.buffer) return null;
  t.maxLength || (t.maxLength = 79), typeof t.indent != "number" && (t.indent = 1), typeof t.linesBefore != "number" && (t.linesBefore = 3), typeof t.linesAfter != "number" && (t.linesAfter = 2);
  for (var r = /\r?\n|\r|\0/g, n = [0], i = [], a, o = -1; a = r.exec(e.buffer); )
    i.push(a.index), n.push(a.index + a[0].length), e.position <= a.index && o < 0 && (o = n.length - 2);
  o < 0 && (o = n.length - 1);
  var s = "", l, m, c = Math.min(e.line + t.linesAfter, i.length).toString().length, f = t.maxLength - (t.indent + c + 3);
  for (l = 1; l <= t.linesBefore && !(o - l < 0); l++)
    m = Mi(
      e.buffer,
      n[o - l],
      i[o - l],
      e.position - (n[o] - n[o - l]),
      f
    ), s = Tr.repeat(" ", t.indent) + ji((e.line - l + 1).toString(), c) + " | " + m.str + `
` + s;
  for (m = Mi(e.buffer, n[o], i[o], e.position, f), s += Tr.repeat(" ", t.indent) + ji((e.line + 1).toString(), c) + " | " + m.str + `
`, s += Tr.repeat("-", t.indent + c + 3 + m.pos) + `^
`, l = 1; l <= t.linesAfter && !(o + l >= i.length); l++)
    m = Mi(
      e.buffer,
      n[o + l],
      i[o + l],
      e.position - (n[o] - n[o + l]),
      f
    ), s += Tr.repeat(" ", t.indent) + ji((e.line + l + 1).toString(), c) + " | " + m.str + `
`;
  return s.replace(/\n$/, "");
}
var hm = dm, es = Qr, pm = [
  "kind",
  "multi",
  "resolve",
  "construct",
  "instanceOf",
  "predicate",
  "represent",
  "representName",
  "defaultStyle",
  "styleAliases"
], mm = [
  "scalar",
  "sequence",
  "mapping"
];
function gm(e) {
  var t = {};
  return e !== null && Object.keys(e).forEach(function(r) {
    e[r].forEach(function(n) {
      t[String(n)] = r;
    });
  }), t;
}
function ym(e, t) {
  if (t = t || {}, Object.keys(t).forEach(function(r) {
    if (pm.indexOf(r) === -1)
      throw new es('Unknown option "' + r + '" is met in definition of "' + e + '" YAML type.');
  }), this.options = t, this.tag = e, this.kind = t.kind || null, this.resolve = t.resolve || function() {
    return !0;
  }, this.construct = t.construct || function(r) {
    return r;
  }, this.instanceOf = t.instanceOf || null, this.predicate = t.predicate || null, this.represent = t.represent || null, this.representName = t.representName || null, this.defaultStyle = t.defaultStyle || null, this.multi = t.multi || !1, this.styleAliases = gm(t.styleAliases || null), mm.indexOf(this.kind) === -1)
    throw new es('Unknown kind "' + this.kind + '" is specified for "' + e + '" YAML type.');
}
var Re = ym, vr = Qr, Bi = Re;
function ts(e, t) {
  var r = [];
  return e[t].forEach(function(n) {
    var i = r.length;
    r.forEach(function(a, o) {
      a.tag === n.tag && a.kind === n.kind && a.multi === n.multi && (i = o);
    }), r[i] = n;
  }), r;
}
function wm() {
  var e = {
    scalar: {},
    sequence: {},
    mapping: {},
    fallback: {},
    multi: {
      scalar: [],
      sequence: [],
      mapping: [],
      fallback: []
    }
  }, t, r;
  function n(i) {
    i.multi ? (e.multi[i.kind].push(i), e.multi.fallback.push(i)) : e[i.kind][i.tag] = e.fallback[i.tag] = i;
  }
  for (t = 0, r = arguments.length; t < r; t += 1)
    arguments[t].forEach(n);
  return e;
}
function ma(e) {
  return this.extend(e);
}
ma.prototype.extend = function(t) {
  var r = [], n = [];
  if (t instanceof Bi)
    n.push(t);
  else if (Array.isArray(t))
    n = n.concat(t);
  else if (t && (Array.isArray(t.implicit) || Array.isArray(t.explicit)))
    t.implicit && (r = r.concat(t.implicit)), t.explicit && (n = n.concat(t.explicit));
  else
    throw new vr("Schema.extend argument should be a Type, [ Type ], or a schema definition ({ implicit: [...], explicit: [...] })");
  r.forEach(function(a) {
    if (!(a instanceof Bi))
      throw new vr("Specified list of YAML types (or a single Type object) contains a non-Type object.");
    if (a.loadKind && a.loadKind !== "scalar")
      throw new vr("There is a non-scalar type in the implicit list of a schema. Implicit resolving of such types is not supported.");
    if (a.multi)
      throw new vr("There is a multi type in the implicit list of a schema. Multi tags can only be listed as explicit.");
  }), n.forEach(function(a) {
    if (!(a instanceof Bi))
      throw new vr("Specified list of YAML types (or a single Type object) contains a non-Type object.");
  });
  var i = Object.create(ma.prototype);
  return i.implicit = (this.implicit || []).concat(r), i.explicit = (this.explicit || []).concat(n), i.compiledImplicit = ts(i, "implicit"), i.compiledExplicit = ts(i, "explicit"), i.compiledTypeMap = wm(i.compiledImplicit, i.compiledExplicit), i;
};
var $c = ma, Em = Re, bc = new Em("tag:yaml.org,2002:str", {
  kind: "scalar",
  construct: function(e) {
    return e !== null ? e : "";
  }
}), vm = Re, Ic = new vm("tag:yaml.org,2002:seq", {
  kind: "sequence",
  construct: function(e) {
    return e !== null ? e : [];
  }
}), _m = Re, Oc = new _m("tag:yaml.org,2002:map", {
  kind: "mapping",
  construct: function(e) {
    return e !== null ? e : {};
  }
}), Sm = $c, Dc = new Sm({
  explicit: [
    bc,
    Ic,
    Oc
  ]
}), Am = Re;
function Tm(e) {
  if (e === null) return !0;
  var t = e.length;
  return t === 1 && e === "~" || t === 4 && (e === "null" || e === "Null" || e === "NULL");
}
function Cm() {
  return null;
}
function $m(e) {
  return e === null;
}
var Pc = new Am("tag:yaml.org,2002:null", {
  kind: "scalar",
  resolve: Tm,
  construct: Cm,
  predicate: $m,
  represent: {
    canonical: function() {
      return "~";
    },
    lowercase: function() {
      return "null";
    },
    uppercase: function() {
      return "NULL";
    },
    camelcase: function() {
      return "Null";
    },
    empty: function() {
      return "";
    }
  },
  defaultStyle: "lowercase"
}), bm = Re;
function Im(e) {
  if (e === null) return !1;
  var t = e.length;
  return t === 4 && (e === "true" || e === "True" || e === "TRUE") || t === 5 && (e === "false" || e === "False" || e === "FALSE");
}
function Om(e) {
  return e === "true" || e === "True" || e === "TRUE";
}
function Dm(e) {
  return Object.prototype.toString.call(e) === "[object Boolean]";
}
var Nc = new bm("tag:yaml.org,2002:bool", {
  kind: "scalar",
  resolve: Im,
  construct: Om,
  predicate: Dm,
  represent: {
    lowercase: function(e) {
      return e ? "true" : "false";
    },
    uppercase: function(e) {
      return e ? "TRUE" : "FALSE";
    },
    camelcase: function(e) {
      return e ? "True" : "False";
    }
  },
  defaultStyle: "lowercase"
}), Pm = Ye, Nm = Re;
function Rm(e) {
  return 48 <= e && e <= 57 || 65 <= e && e <= 70 || 97 <= e && e <= 102;
}
function Fm(e) {
  return 48 <= e && e <= 55;
}
function xm(e) {
  return 48 <= e && e <= 57;
}
function Lm(e) {
  if (e === null) return !1;
  var t = e.length, r = 0, n = !1, i;
  if (!t) return !1;
  if (i = e[r], (i === "-" || i === "+") && (i = e[++r]), i === "0") {
    if (r + 1 === t) return !0;
    if (i = e[++r], i === "b") {
      for (r++; r < t; r++)
        if (i = e[r], i !== "_") {
          if (i !== "0" && i !== "1") return !1;
          n = !0;
        }
      return n && i !== "_";
    }
    if (i === "x") {
      for (r++; r < t; r++)
        if (i = e[r], i !== "_") {
          if (!Rm(e.charCodeAt(r))) return !1;
          n = !0;
        }
      return n && i !== "_";
    }
    if (i === "o") {
      for (r++; r < t; r++)
        if (i = e[r], i !== "_") {
          if (!Fm(e.charCodeAt(r))) return !1;
          n = !0;
        }
      return n && i !== "_";
    }
  }
  if (i === "_") return !1;
  for (; r < t; r++)
    if (i = e[r], i !== "_") {
      if (!xm(e.charCodeAt(r)))
        return !1;
      n = !0;
    }
  return !(!n || i === "_");
}
function Um(e) {
  var t = e, r = 1, n;
  if (t.indexOf("_") !== -1 && (t = t.replace(/_/g, "")), n = t[0], (n === "-" || n === "+") && (n === "-" && (r = -1), t = t.slice(1), n = t[0]), t === "0") return 0;
  if (n === "0") {
    if (t[1] === "b") return r * parseInt(t.slice(2), 2);
    if (t[1] === "x") return r * parseInt(t.slice(2), 16);
    if (t[1] === "o") return r * parseInt(t.slice(2), 8);
  }
  return r * parseInt(t, 10);
}
function km(e) {
  return Object.prototype.toString.call(e) === "[object Number]" && e % 1 === 0 && !Pm.isNegativeZero(e);
}
var Rc = new Nm("tag:yaml.org,2002:int", {
  kind: "scalar",
  resolve: Lm,
  construct: Um,
  predicate: km,
  represent: {
    binary: function(e) {
      return e >= 0 ? "0b" + e.toString(2) : "-0b" + e.toString(2).slice(1);
    },
    octal: function(e) {
      return e >= 0 ? "0o" + e.toString(8) : "-0o" + e.toString(8).slice(1);
    },
    decimal: function(e) {
      return e.toString(10);
    },
    /* eslint-disable max-len */
    hexadecimal: function(e) {
      return e >= 0 ? "0x" + e.toString(16).toUpperCase() : "-0x" + e.toString(16).toUpperCase().slice(1);
    }
  },
  defaultStyle: "decimal",
  styleAliases: {
    binary: [2, "bin"],
    octal: [8, "oct"],
    decimal: [10, "dec"],
    hexadecimal: [16, "hex"]
  }
}), Fc = Ye, Mm = Re, jm = new RegExp(
  // 2.5e4, 2.5 and integers
  "^(?:[-+]?(?:[0-9][0-9_]*)(?:\\.[0-9_]*)?(?:[eE][-+]?[0-9]+)?|\\.[0-9_]+(?:[eE][-+]?[0-9]+)?|[-+]?\\.(?:inf|Inf|INF)|\\.(?:nan|NaN|NAN))$"
);
function Bm(e) {
  return !(e === null || !jm.test(e) || // Quick hack to not allow integers end with `_`
  // Probably should update regexp & check speed
  e[e.length - 1] === "_");
}
function Hm(e) {
  var t, r;
  return t = e.replace(/_/g, "").toLowerCase(), r = t[0] === "-" ? -1 : 1, "+-".indexOf(t[0]) >= 0 && (t = t.slice(1)), t === ".inf" ? r === 1 ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY : t === ".nan" ? NaN : r * parseFloat(t, 10);
}
var qm = /^[-+]?[0-9]+e/;
function Gm(e, t) {
  var r;
  if (isNaN(e))
    switch (t) {
      case "lowercase":
        return ".nan";
      case "uppercase":
        return ".NAN";
      case "camelcase":
        return ".NaN";
    }
  else if (Number.POSITIVE_INFINITY === e)
    switch (t) {
      case "lowercase":
        return ".inf";
      case "uppercase":
        return ".INF";
      case "camelcase":
        return ".Inf";
    }
  else if (Number.NEGATIVE_INFINITY === e)
    switch (t) {
      case "lowercase":
        return "-.inf";
      case "uppercase":
        return "-.INF";
      case "camelcase":
        return "-.Inf";
    }
  else if (Fc.isNegativeZero(e))
    return "-0.0";
  return r = e.toString(10), qm.test(r) ? r.replace("e", ".e") : r;
}
function Wm(e) {
  return Object.prototype.toString.call(e) === "[object Number]" && (e % 1 !== 0 || Fc.isNegativeZero(e));
}
var xc = new Mm("tag:yaml.org,2002:float", {
  kind: "scalar",
  resolve: Bm,
  construct: Hm,
  predicate: Wm,
  represent: Gm,
  defaultStyle: "lowercase"
}), Lc = Dc.extend({
  implicit: [
    Pc,
    Nc,
    Rc,
    xc
  ]
}), Uc = Lc, zm = Re, kc = new RegExp(
  "^([0-9][0-9][0-9][0-9])-([0-9][0-9])-([0-9][0-9])$"
), Mc = new RegExp(
  "^([0-9][0-9][0-9][0-9])-([0-9][0-9]?)-([0-9][0-9]?)(?:[Tt]|[ \\t]+)([0-9][0-9]?):([0-9][0-9]):([0-9][0-9])(?:\\.([0-9]*))?(?:[ \\t]*(Z|([-+])([0-9][0-9]?)(?::([0-9][0-9]))?))?$"
);
function Vm(e) {
  return e === null ? !1 : kc.exec(e) !== null || Mc.exec(e) !== null;
}
function Ym(e) {
  var t, r, n, i, a, o, s, l = 0, m = null, c, f, h;
  if (t = kc.exec(e), t === null && (t = Mc.exec(e)), t === null) throw new Error("Date resolve error");
  if (r = +t[1], n = +t[2] - 1, i = +t[3], !t[4])
    return new Date(Date.UTC(r, n, i));
  if (a = +t[4], o = +t[5], s = +t[6], t[7]) {
    for (l = t[7].slice(0, 3); l.length < 3; )
      l += "0";
    l = +l;
  }
  return t[9] && (c = +t[10], f = +(t[11] || 0), m = (c * 60 + f) * 6e4, t[9] === "-" && (m = -m)), h = new Date(Date.UTC(r, n, i, a, o, s, l)), m && h.setTime(h.getTime() - m), h;
}
function Xm(e) {
  return e.toISOString();
}
var jc = new zm("tag:yaml.org,2002:timestamp", {
  kind: "scalar",
  resolve: Vm,
  construct: Ym,
  instanceOf: Date,
  represent: Xm
}), Jm = Re;
function Km(e) {
  return e === "<<" || e === null;
}
var Bc = new Jm("tag:yaml.org,2002:merge", {
  kind: "scalar",
  resolve: Km
}), Qm = Re, Ba = `ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=
\r`;
function Zm(e) {
  if (e === null) return !1;
  var t, r, n = 0, i = e.length, a = Ba;
  for (r = 0; r < i; r++)
    if (t = a.indexOf(e.charAt(r)), !(t > 64)) {
      if (t < 0) return !1;
      n += 6;
    }
  return n % 8 === 0;
}
function eg(e) {
  var t, r, n = e.replace(/[\r\n=]/g, ""), i = n.length, a = Ba, o = 0, s = [];
  for (t = 0; t < i; t++)
    t % 4 === 0 && t && (s.push(o >> 16 & 255), s.push(o >> 8 & 255), s.push(o & 255)), o = o << 6 | a.indexOf(n.charAt(t));
  return r = i % 4 * 6, r === 0 ? (s.push(o >> 16 & 255), s.push(o >> 8 & 255), s.push(o & 255)) : r === 18 ? (s.push(o >> 10 & 255), s.push(o >> 2 & 255)) : r === 12 && s.push(o >> 4 & 255), new Uint8Array(s);
}
function tg(e) {
  var t = "", r = 0, n, i, a = e.length, o = Ba;
  for (n = 0; n < a; n++)
    n % 3 === 0 && n && (t += o[r >> 18 & 63], t += o[r >> 12 & 63], t += o[r >> 6 & 63], t += o[r & 63]), r = (r << 8) + e[n];
  return i = a % 3, i === 0 ? (t += o[r >> 18 & 63], t += o[r >> 12 & 63], t += o[r >> 6 & 63], t += o[r & 63]) : i === 2 ? (t += o[r >> 10 & 63], t += o[r >> 4 & 63], t += o[r << 2 & 63], t += o[64]) : i === 1 && (t += o[r >> 2 & 63], t += o[r << 4 & 63], t += o[64], t += o[64]), t;
}
function rg(e) {
  return Object.prototype.toString.call(e) === "[object Uint8Array]";
}
var Hc = new Qm("tag:yaml.org,2002:binary", {
  kind: "scalar",
  resolve: Zm,
  construct: eg,
  predicate: rg,
  represent: tg
}), ng = Re, ig = Object.prototype.hasOwnProperty, ag = Object.prototype.toString;
function og(e) {
  if (e === null) return !0;
  var t = [], r, n, i, a, o, s = e;
  for (r = 0, n = s.length; r < n; r += 1) {
    if (i = s[r], o = !1, ag.call(i) !== "[object Object]") return !1;
    for (a in i)
      if (ig.call(i, a))
        if (!o) o = !0;
        else return !1;
    if (!o) return !1;
    if (t.indexOf(a) === -1) t.push(a);
    else return !1;
  }
  return !0;
}
function sg(e) {
  return e !== null ? e : [];
}
var qc = new ng("tag:yaml.org,2002:omap", {
  kind: "sequence",
  resolve: og,
  construct: sg
}), lg = Re, cg = Object.prototype.toString;
function ug(e) {
  if (e === null) return !0;
  var t, r, n, i, a, o = e;
  for (a = new Array(o.length), t = 0, r = o.length; t < r; t += 1) {
    if (n = o[t], cg.call(n) !== "[object Object]" || (i = Object.keys(n), i.length !== 1)) return !1;
    a[t] = [i[0], n[i[0]]];
  }
  return !0;
}
function fg(e) {
  if (e === null) return [];
  var t, r, n, i, a, o = e;
  for (a = new Array(o.length), t = 0, r = o.length; t < r; t += 1)
    n = o[t], i = Object.keys(n), a[t] = [i[0], n[i[0]]];
  return a;
}
var Gc = new lg("tag:yaml.org,2002:pairs", {
  kind: "sequence",
  resolve: ug,
  construct: fg
}), dg = Re, hg = Object.prototype.hasOwnProperty;
function pg(e) {
  if (e === null) return !0;
  var t, r = e;
  for (t in r)
    if (hg.call(r, t) && r[t] !== null)
      return !1;
  return !0;
}
function mg(e) {
  return e !== null ? e : {};
}
var Wc = new dg("tag:yaml.org,2002:set", {
  kind: "mapping",
  resolve: pg,
  construct: mg
}), Ha = Uc.extend({
  implicit: [
    jc,
    Bc
  ],
  explicit: [
    Hc,
    qc,
    Gc,
    Wc
  ]
}), Ft = Ye, zc = Qr, gg = hm, yg = Ha, vt = Object.prototype.hasOwnProperty, Wn = 1, Vc = 2, Yc = 3, zn = 4, Hi = 1, wg = 2, rs = 3, Eg = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x84\x86-\x9F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]/, vg = /[\x85\u2028\u2029]/, _g = /[,\[\]\{\}]/, Xc = /^(?:!|!!|![a-z\-]+!)$/i, Jc = /^(?:!|[^,\[\]\{\}])(?:%[0-9a-f]{2}|[0-9a-z\-#;\/\?:@&=\+\$,_\.!~\*'\(\)\[\]])*$/i;
function ns(e) {
  return Object.prototype.toString.call(e);
}
function et(e) {
  return e === 10 || e === 13;
}
function Ut(e) {
  return e === 9 || e === 32;
}
function Ue(e) {
  return e === 9 || e === 32 || e === 10 || e === 13;
}
function Kt(e) {
  return e === 44 || e === 91 || e === 93 || e === 123 || e === 125;
}
function Sg(e) {
  var t;
  return 48 <= e && e <= 57 ? e - 48 : (t = e | 32, 97 <= t && t <= 102 ? t - 97 + 10 : -1);
}
function Ag(e) {
  return e === 120 ? 2 : e === 117 ? 4 : e === 85 ? 8 : 0;
}
function Tg(e) {
  return 48 <= e && e <= 57 ? e - 48 : -1;
}
function is(e) {
  return e === 48 ? "\0" : e === 97 ? "\x07" : e === 98 ? "\b" : e === 116 || e === 9 ? "	" : e === 110 ? `
` : e === 118 ? "\v" : e === 102 ? "\f" : e === 114 ? "\r" : e === 101 ? "\x1B" : e === 32 ? " " : e === 34 ? '"' : e === 47 ? "/" : e === 92 ? "\\" : e === 78 ? "" : e === 95 ? " " : e === 76 ? "\u2028" : e === 80 ? "\u2029" : "";
}
function Cg(e) {
  return e <= 65535 ? String.fromCharCode(e) : String.fromCharCode(
    (e - 65536 >> 10) + 55296,
    (e - 65536 & 1023) + 56320
  );
}
var Kc = new Array(256), Qc = new Array(256);
for (var Wt = 0; Wt < 256; Wt++)
  Kc[Wt] = is(Wt) ? 1 : 0, Qc[Wt] = is(Wt);
function $g(e, t) {
  this.input = e, this.filename = t.filename || null, this.schema = t.schema || yg, this.onWarning = t.onWarning || null, this.legacy = t.legacy || !1, this.json = t.json || !1, this.listener = t.listener || null, this.implicitTypes = this.schema.compiledImplicit, this.typeMap = this.schema.compiledTypeMap, this.length = e.length, this.position = 0, this.line = 0, this.lineStart = 0, this.lineIndent = 0, this.firstTabInLine = -1, this.documents = [];
}
function Zc(e, t) {
  var r = {
    name: e.filename,
    buffer: e.input.slice(0, -1),
    // omit trailing \0
    position: e.position,
    line: e.line,
    column: e.position - e.lineStart
  };
  return r.snippet = gg(r), new zc(t, r);
}
function U(e, t) {
  throw Zc(e, t);
}
function Vn(e, t) {
  e.onWarning && e.onWarning.call(null, Zc(e, t));
}
var as = {
  YAML: function(t, r, n) {
    var i, a, o;
    t.version !== null && U(t, "duplication of %YAML directive"), n.length !== 1 && U(t, "YAML directive accepts exactly one argument"), i = /^([0-9]+)\.([0-9]+)$/.exec(n[0]), i === null && U(t, "ill-formed argument of the YAML directive"), a = parseInt(i[1], 10), o = parseInt(i[2], 10), a !== 1 && U(t, "unacceptable YAML version of the document"), t.version = n[0], t.checkLineBreaks = o < 2, o !== 1 && o !== 2 && Vn(t, "unsupported YAML version of the document");
  },
  TAG: function(t, r, n) {
    var i, a;
    n.length !== 2 && U(t, "TAG directive accepts exactly two arguments"), i = n[0], a = n[1], Xc.test(i) || U(t, "ill-formed tag handle (first argument) of the TAG directive"), vt.call(t.tagMap, i) && U(t, 'there is a previously declared suffix for "' + i + '" tag handle'), Jc.test(a) || U(t, "ill-formed tag prefix (second argument) of the TAG directive");
    try {
      a = decodeURIComponent(a);
    } catch {
      U(t, "tag prefix is malformed: " + a);
    }
    t.tagMap[i] = a;
  }
};
function yt(e, t, r, n) {
  var i, a, o, s;
  if (t < r) {
    if (s = e.input.slice(t, r), n)
      for (i = 0, a = s.length; i < a; i += 1)
        o = s.charCodeAt(i), o === 9 || 32 <= o && o <= 1114111 || U(e, "expected valid JSON character");
    else Eg.test(s) && U(e, "the stream contains non-printable characters");
    e.result += s;
  }
}
function os(e, t, r, n) {
  var i, a, o, s;
  for (Ft.isObject(r) || U(e, "cannot merge mappings; the provided source object is unacceptable"), i = Object.keys(r), o = 0, s = i.length; o < s; o += 1)
    a = i[o], vt.call(t, a) || (t[a] = r[a], n[a] = !0);
}
function Qt(e, t, r, n, i, a, o, s, l) {
  var m, c;
  if (Array.isArray(i))
    for (i = Array.prototype.slice.call(i), m = 0, c = i.length; m < c; m += 1)
      Array.isArray(i[m]) && U(e, "nested arrays are not supported inside keys"), typeof i == "object" && ns(i[m]) === "[object Object]" && (i[m] = "[object Object]");
  if (typeof i == "object" && ns(i) === "[object Object]" && (i = "[object Object]"), i = String(i), t === null && (t = {}), n === "tag:yaml.org,2002:merge")
    if (Array.isArray(a))
      for (m = 0, c = a.length; m < c; m += 1)
        os(e, t, a[m], r);
    else
      os(e, t, a, r);
  else
    !e.json && !vt.call(r, i) && vt.call(t, i) && (e.line = o || e.line, e.lineStart = s || e.lineStart, e.position = l || e.position, U(e, "duplicated mapping key")), i === "__proto__" ? Object.defineProperty(t, i, {
      configurable: !0,
      enumerable: !0,
      writable: !0,
      value: a
    }) : t[i] = a, delete r[i];
  return t;
}
function qa(e) {
  var t;
  t = e.input.charCodeAt(e.position), t === 10 ? e.position++ : t === 13 ? (e.position++, e.input.charCodeAt(e.position) === 10 && e.position++) : U(e, "a line break is expected"), e.line += 1, e.lineStart = e.position, e.firstTabInLine = -1;
}
function fe(e, t, r) {
  for (var n = 0, i = e.input.charCodeAt(e.position); i !== 0; ) {
    for (; Ut(i); )
      i === 9 && e.firstTabInLine === -1 && (e.firstTabInLine = e.position), i = e.input.charCodeAt(++e.position);
    if (t && i === 35)
      do
        i = e.input.charCodeAt(++e.position);
      while (i !== 10 && i !== 13 && i !== 0);
    if (et(i))
      for (qa(e), i = e.input.charCodeAt(e.position), n++, e.lineIndent = 0; i === 32; )
        e.lineIndent++, i = e.input.charCodeAt(++e.position);
    else
      break;
  }
  return r !== -1 && n !== 0 && e.lineIndent < r && Vn(e, "deficient indentation"), n;
}
function si(e) {
  var t = e.position, r;
  return r = e.input.charCodeAt(t), !!((r === 45 || r === 46) && r === e.input.charCodeAt(t + 1) && r === e.input.charCodeAt(t + 2) && (t += 3, r = e.input.charCodeAt(t), r === 0 || Ue(r)));
}
function Ga(e, t) {
  t === 1 ? e.result += " " : t > 1 && (e.result += Ft.repeat(`
`, t - 1));
}
function bg(e, t, r) {
  var n, i, a, o, s, l, m, c, f = e.kind, h = e.result, g;
  if (g = e.input.charCodeAt(e.position), Ue(g) || Kt(g) || g === 35 || g === 38 || g === 42 || g === 33 || g === 124 || g === 62 || g === 39 || g === 34 || g === 37 || g === 64 || g === 96 || (g === 63 || g === 45) && (i = e.input.charCodeAt(e.position + 1), Ue(i) || r && Kt(i)))
    return !1;
  for (e.kind = "scalar", e.result = "", a = o = e.position, s = !1; g !== 0; ) {
    if (g === 58) {
      if (i = e.input.charCodeAt(e.position + 1), Ue(i) || r && Kt(i))
        break;
    } else if (g === 35) {
      if (n = e.input.charCodeAt(e.position - 1), Ue(n))
        break;
    } else {
      if (e.position === e.lineStart && si(e) || r && Kt(g))
        break;
      if (et(g))
        if (l = e.line, m = e.lineStart, c = e.lineIndent, fe(e, !1, -1), e.lineIndent >= t) {
          s = !0, g = e.input.charCodeAt(e.position);
          continue;
        } else {
          e.position = o, e.line = l, e.lineStart = m, e.lineIndent = c;
          break;
        }
    }
    s && (yt(e, a, o, !1), Ga(e, e.line - l), a = o = e.position, s = !1), Ut(g) || (o = e.position + 1), g = e.input.charCodeAt(++e.position);
  }
  return yt(e, a, o, !1), e.result ? !0 : (e.kind = f, e.result = h, !1);
}
function Ig(e, t) {
  var r, n, i;
  if (r = e.input.charCodeAt(e.position), r !== 39)
    return !1;
  for (e.kind = "scalar", e.result = "", e.position++, n = i = e.position; (r = e.input.charCodeAt(e.position)) !== 0; )
    if (r === 39)
      if (yt(e, n, e.position, !0), r = e.input.charCodeAt(++e.position), r === 39)
        n = e.position, e.position++, i = e.position;
      else
        return !0;
    else et(r) ? (yt(e, n, i, !0), Ga(e, fe(e, !1, t)), n = i = e.position) : e.position === e.lineStart && si(e) ? U(e, "unexpected end of the document within a single quoted scalar") : (e.position++, i = e.position);
  U(e, "unexpected end of the stream within a single quoted scalar");
}
function Og(e, t) {
  var r, n, i, a, o, s;
  if (s = e.input.charCodeAt(e.position), s !== 34)
    return !1;
  for (e.kind = "scalar", e.result = "", e.position++, r = n = e.position; (s = e.input.charCodeAt(e.position)) !== 0; ) {
    if (s === 34)
      return yt(e, r, e.position, !0), e.position++, !0;
    if (s === 92) {
      if (yt(e, r, e.position, !0), s = e.input.charCodeAt(++e.position), et(s))
        fe(e, !1, t);
      else if (s < 256 && Kc[s])
        e.result += Qc[s], e.position++;
      else if ((o = Ag(s)) > 0) {
        for (i = o, a = 0; i > 0; i--)
          s = e.input.charCodeAt(++e.position), (o = Sg(s)) >= 0 ? a = (a << 4) + o : U(e, "expected hexadecimal character");
        e.result += Cg(a), e.position++;
      } else
        U(e, "unknown escape sequence");
      r = n = e.position;
    } else et(s) ? (yt(e, r, n, !0), Ga(e, fe(e, !1, t)), r = n = e.position) : e.position === e.lineStart && si(e) ? U(e, "unexpected end of the document within a double quoted scalar") : (e.position++, n = e.position);
  }
  U(e, "unexpected end of the stream within a double quoted scalar");
}
function Dg(e, t) {
  var r = !0, n, i, a, o = e.tag, s, l = e.anchor, m, c, f, h, g, _ = /* @__PURE__ */ Object.create(null), w, S, T, A;
  if (A = e.input.charCodeAt(e.position), A === 91)
    c = 93, g = !1, s = [];
  else if (A === 123)
    c = 125, g = !0, s = {};
  else
    return !1;
  for (e.anchor !== null && (e.anchorMap[e.anchor] = s), A = e.input.charCodeAt(++e.position); A !== 0; ) {
    if (fe(e, !0, t), A = e.input.charCodeAt(e.position), A === c)
      return e.position++, e.tag = o, e.anchor = l, e.kind = g ? "mapping" : "sequence", e.result = s, !0;
    r ? A === 44 && U(e, "expected the node content, but found ','") : U(e, "missed comma between flow collection entries"), S = w = T = null, f = h = !1, A === 63 && (m = e.input.charCodeAt(e.position + 1), Ue(m) && (f = h = !0, e.position++, fe(e, !0, t))), n = e.line, i = e.lineStart, a = e.position, sr(e, t, Wn, !1, !0), S = e.tag, w = e.result, fe(e, !0, t), A = e.input.charCodeAt(e.position), (h || e.line === n) && A === 58 && (f = !0, A = e.input.charCodeAt(++e.position), fe(e, !0, t), sr(e, t, Wn, !1, !0), T = e.result), g ? Qt(e, s, _, S, w, T, n, i, a) : f ? s.push(Qt(e, null, _, S, w, T, n, i, a)) : s.push(w), fe(e, !0, t), A = e.input.charCodeAt(e.position), A === 44 ? (r = !0, A = e.input.charCodeAt(++e.position)) : r = !1;
  }
  U(e, "unexpected end of the stream within a flow collection");
}
function Pg(e, t) {
  var r, n, i = Hi, a = !1, o = !1, s = t, l = 0, m = !1, c, f;
  if (f = e.input.charCodeAt(e.position), f === 124)
    n = !1;
  else if (f === 62)
    n = !0;
  else
    return !1;
  for (e.kind = "scalar", e.result = ""; f !== 0; )
    if (f = e.input.charCodeAt(++e.position), f === 43 || f === 45)
      Hi === i ? i = f === 43 ? rs : wg : U(e, "repeat of a chomping mode identifier");
    else if ((c = Tg(f)) >= 0)
      c === 0 ? U(e, "bad explicit indentation width of a block scalar; it cannot be less than one") : o ? U(e, "repeat of an indentation width identifier") : (s = t + c - 1, o = !0);
    else
      break;
  if (Ut(f)) {
    do
      f = e.input.charCodeAt(++e.position);
    while (Ut(f));
    if (f === 35)
      do
        f = e.input.charCodeAt(++e.position);
      while (!et(f) && f !== 0);
  }
  for (; f !== 0; ) {
    for (qa(e), e.lineIndent = 0, f = e.input.charCodeAt(e.position); (!o || e.lineIndent < s) && f === 32; )
      e.lineIndent++, f = e.input.charCodeAt(++e.position);
    if (!o && e.lineIndent > s && (s = e.lineIndent), et(f)) {
      l++;
      continue;
    }
    if (e.lineIndent < s) {
      i === rs ? e.result += Ft.repeat(`
`, a ? 1 + l : l) : i === Hi && a && (e.result += `
`);
      break;
    }
    for (n ? Ut(f) ? (m = !0, e.result += Ft.repeat(`
`, a ? 1 + l : l)) : m ? (m = !1, e.result += Ft.repeat(`
`, l + 1)) : l === 0 ? a && (e.result += " ") : e.result += Ft.repeat(`
`, l) : e.result += Ft.repeat(`
`, a ? 1 + l : l), a = !0, o = !0, l = 0, r = e.position; !et(f) && f !== 0; )
      f = e.input.charCodeAt(++e.position);
    yt(e, r, e.position, !1);
  }
  return !0;
}
function ss(e, t) {
  var r, n = e.tag, i = e.anchor, a = [], o, s = !1, l;
  if (e.firstTabInLine !== -1) return !1;
  for (e.anchor !== null && (e.anchorMap[e.anchor] = a), l = e.input.charCodeAt(e.position); l !== 0 && (e.firstTabInLine !== -1 && (e.position = e.firstTabInLine, U(e, "tab characters must not be used in indentation")), !(l !== 45 || (o = e.input.charCodeAt(e.position + 1), !Ue(o)))); ) {
    if (s = !0, e.position++, fe(e, !0, -1) && e.lineIndent <= t) {
      a.push(null), l = e.input.charCodeAt(e.position);
      continue;
    }
    if (r = e.line, sr(e, t, Yc, !1, !0), a.push(e.result), fe(e, !0, -1), l = e.input.charCodeAt(e.position), (e.line === r || e.lineIndent > t) && l !== 0)
      U(e, "bad indentation of a sequence entry");
    else if (e.lineIndent < t)
      break;
  }
  return s ? (e.tag = n, e.anchor = i, e.kind = "sequence", e.result = a, !0) : !1;
}
function Ng(e, t, r) {
  var n, i, a, o, s, l, m = e.tag, c = e.anchor, f = {}, h = /* @__PURE__ */ Object.create(null), g = null, _ = null, w = null, S = !1, T = !1, A;
  if (e.firstTabInLine !== -1) return !1;
  for (e.anchor !== null && (e.anchorMap[e.anchor] = f), A = e.input.charCodeAt(e.position); A !== 0; ) {
    if (!S && e.firstTabInLine !== -1 && (e.position = e.firstTabInLine, U(e, "tab characters must not be used in indentation")), n = e.input.charCodeAt(e.position + 1), a = e.line, (A === 63 || A === 58) && Ue(n))
      A === 63 ? (S && (Qt(e, f, h, g, _, null, o, s, l), g = _ = w = null), T = !0, S = !0, i = !0) : S ? (S = !1, i = !0) : U(e, "incomplete explicit mapping pair; a key node is missed; or followed by a non-tabulated empty line"), e.position += 1, A = n;
    else {
      if (o = e.line, s = e.lineStart, l = e.position, !sr(e, r, Vc, !1, !0))
        break;
      if (e.line === a) {
        for (A = e.input.charCodeAt(e.position); Ut(A); )
          A = e.input.charCodeAt(++e.position);
        if (A === 58)
          A = e.input.charCodeAt(++e.position), Ue(A) || U(e, "a whitespace character is expected after the key-value separator within a block mapping"), S && (Qt(e, f, h, g, _, null, o, s, l), g = _ = w = null), T = !0, S = !1, i = !1, g = e.tag, _ = e.result;
        else if (T)
          U(e, "can not read an implicit mapping pair; a colon is missed");
        else
          return e.tag = m, e.anchor = c, !0;
      } else if (T)
        U(e, "can not read a block mapping entry; a multiline key may not be an implicit key");
      else
        return e.tag = m, e.anchor = c, !0;
    }
    if ((e.line === a || e.lineIndent > t) && (S && (o = e.line, s = e.lineStart, l = e.position), sr(e, t, zn, !0, i) && (S ? _ = e.result : w = e.result), S || (Qt(e, f, h, g, _, w, o, s, l), g = _ = w = null), fe(e, !0, -1), A = e.input.charCodeAt(e.position)), (e.line === a || e.lineIndent > t) && A !== 0)
      U(e, "bad indentation of a mapping entry");
    else if (e.lineIndent < t)
      break;
  }
  return S && Qt(e, f, h, g, _, null, o, s, l), T && (e.tag = m, e.anchor = c, e.kind = "mapping", e.result = f), T;
}
function Rg(e) {
  var t, r = !1, n = !1, i, a, o;
  if (o = e.input.charCodeAt(e.position), o !== 33) return !1;
  if (e.tag !== null && U(e, "duplication of a tag property"), o = e.input.charCodeAt(++e.position), o === 60 ? (r = !0, o = e.input.charCodeAt(++e.position)) : o === 33 ? (n = !0, i = "!!", o = e.input.charCodeAt(++e.position)) : i = "!", t = e.position, r) {
    do
      o = e.input.charCodeAt(++e.position);
    while (o !== 0 && o !== 62);
    e.position < e.length ? (a = e.input.slice(t, e.position), o = e.input.charCodeAt(++e.position)) : U(e, "unexpected end of the stream within a verbatim tag");
  } else {
    for (; o !== 0 && !Ue(o); )
      o === 33 && (n ? U(e, "tag suffix cannot contain exclamation marks") : (i = e.input.slice(t - 1, e.position + 1), Xc.test(i) || U(e, "named tag handle cannot contain such characters"), n = !0, t = e.position + 1)), o = e.input.charCodeAt(++e.position);
    a = e.input.slice(t, e.position), _g.test(a) && U(e, "tag suffix cannot contain flow indicator characters");
  }
  a && !Jc.test(a) && U(e, "tag name cannot contain such characters: " + a);
  try {
    a = decodeURIComponent(a);
  } catch {
    U(e, "tag name is malformed: " + a);
  }
  return r ? e.tag = a : vt.call(e.tagMap, i) ? e.tag = e.tagMap[i] + a : i === "!" ? e.tag = "!" + a : i === "!!" ? e.tag = "tag:yaml.org,2002:" + a : U(e, 'undeclared tag handle "' + i + '"'), !0;
}
function Fg(e) {
  var t, r;
  if (r = e.input.charCodeAt(e.position), r !== 38) return !1;
  for (e.anchor !== null && U(e, "duplication of an anchor property"), r = e.input.charCodeAt(++e.position), t = e.position; r !== 0 && !Ue(r) && !Kt(r); )
    r = e.input.charCodeAt(++e.position);
  return e.position === t && U(e, "name of an anchor node must contain at least one character"), e.anchor = e.input.slice(t, e.position), !0;
}
function xg(e) {
  var t, r, n;
  if (n = e.input.charCodeAt(e.position), n !== 42) return !1;
  for (n = e.input.charCodeAt(++e.position), t = e.position; n !== 0 && !Ue(n) && !Kt(n); )
    n = e.input.charCodeAt(++e.position);
  return e.position === t && U(e, "name of an alias node must contain at least one character"), r = e.input.slice(t, e.position), vt.call(e.anchorMap, r) || U(e, 'unidentified alias "' + r + '"'), e.result = e.anchorMap[r], fe(e, !0, -1), !0;
}
function sr(e, t, r, n, i) {
  var a, o, s, l = 1, m = !1, c = !1, f, h, g, _, w, S;
  if (e.listener !== null && e.listener("open", e), e.tag = null, e.anchor = null, e.kind = null, e.result = null, a = o = s = zn === r || Yc === r, n && fe(e, !0, -1) && (m = !0, e.lineIndent > t ? l = 1 : e.lineIndent === t ? l = 0 : e.lineIndent < t && (l = -1)), l === 1)
    for (; Rg(e) || Fg(e); )
      fe(e, !0, -1) ? (m = !0, s = a, e.lineIndent > t ? l = 1 : e.lineIndent === t ? l = 0 : e.lineIndent < t && (l = -1)) : s = !1;
  if (s && (s = m || i), (l === 1 || zn === r) && (Wn === r || Vc === r ? w = t : w = t + 1, S = e.position - e.lineStart, l === 1 ? s && (ss(e, S) || Ng(e, S, w)) || Dg(e, w) ? c = !0 : (o && Pg(e, w) || Ig(e, w) || Og(e, w) ? c = !0 : xg(e) ? (c = !0, (e.tag !== null || e.anchor !== null) && U(e, "alias node should not have any properties")) : bg(e, w, Wn === r) && (c = !0, e.tag === null && (e.tag = "?")), e.anchor !== null && (e.anchorMap[e.anchor] = e.result)) : l === 0 && (c = s && ss(e, S))), e.tag === null)
    e.anchor !== null && (e.anchorMap[e.anchor] = e.result);
  else if (e.tag === "?") {
    for (e.result !== null && e.kind !== "scalar" && U(e, 'unacceptable node kind for !<?> tag; it should be "scalar", not "' + e.kind + '"'), f = 0, h = e.implicitTypes.length; f < h; f += 1)
      if (_ = e.implicitTypes[f], _.resolve(e.result)) {
        e.result = _.construct(e.result), e.tag = _.tag, e.anchor !== null && (e.anchorMap[e.anchor] = e.result);
        break;
      }
  } else if (e.tag !== "!") {
    if (vt.call(e.typeMap[e.kind || "fallback"], e.tag))
      _ = e.typeMap[e.kind || "fallback"][e.tag];
    else
      for (_ = null, g = e.typeMap.multi[e.kind || "fallback"], f = 0, h = g.length; f < h; f += 1)
        if (e.tag.slice(0, g[f].tag.length) === g[f].tag) {
          _ = g[f];
          break;
        }
    _ || U(e, "unknown tag !<" + e.tag + ">"), e.result !== null && _.kind !== e.kind && U(e, "unacceptable node kind for !<" + e.tag + '> tag; it should be "' + _.kind + '", not "' + e.kind + '"'), _.resolve(e.result, e.tag) ? (e.result = _.construct(e.result, e.tag), e.anchor !== null && (e.anchorMap[e.anchor] = e.result)) : U(e, "cannot resolve a node with !<" + e.tag + "> explicit tag");
  }
  return e.listener !== null && e.listener("close", e), e.tag !== null || e.anchor !== null || c;
}
function Lg(e) {
  var t = e.position, r, n, i, a = !1, o;
  for (e.version = null, e.checkLineBreaks = e.legacy, e.tagMap = /* @__PURE__ */ Object.create(null), e.anchorMap = /* @__PURE__ */ Object.create(null); (o = e.input.charCodeAt(e.position)) !== 0 && (fe(e, !0, -1), o = e.input.charCodeAt(e.position), !(e.lineIndent > 0 || o !== 37)); ) {
    for (a = !0, o = e.input.charCodeAt(++e.position), r = e.position; o !== 0 && !Ue(o); )
      o = e.input.charCodeAt(++e.position);
    for (n = e.input.slice(r, e.position), i = [], n.length < 1 && U(e, "directive name must not be less than one character in length"); o !== 0; ) {
      for (; Ut(o); )
        o = e.input.charCodeAt(++e.position);
      if (o === 35) {
        do
          o = e.input.charCodeAt(++e.position);
        while (o !== 0 && !et(o));
        break;
      }
      if (et(o)) break;
      for (r = e.position; o !== 0 && !Ue(o); )
        o = e.input.charCodeAt(++e.position);
      i.push(e.input.slice(r, e.position));
    }
    o !== 0 && qa(e), vt.call(as, n) ? as[n](e, n, i) : Vn(e, 'unknown document directive "' + n + '"');
  }
  if (fe(e, !0, -1), e.lineIndent === 0 && e.input.charCodeAt(e.position) === 45 && e.input.charCodeAt(e.position + 1) === 45 && e.input.charCodeAt(e.position + 2) === 45 ? (e.position += 3, fe(e, !0, -1)) : a && U(e, "directives end mark is expected"), sr(e, e.lineIndent - 1, zn, !1, !0), fe(e, !0, -1), e.checkLineBreaks && vg.test(e.input.slice(t, e.position)) && Vn(e, "non-ASCII line breaks are interpreted as content"), e.documents.push(e.result), e.position === e.lineStart && si(e)) {
    e.input.charCodeAt(e.position) === 46 && (e.position += 3, fe(e, !0, -1));
    return;
  }
  if (e.position < e.length - 1)
    U(e, "end of the stream or a document separator is expected");
  else
    return;
}
function eu(e, t) {
  e = String(e), t = t || {}, e.length !== 0 && (e.charCodeAt(e.length - 1) !== 10 && e.charCodeAt(e.length - 1) !== 13 && (e += `
`), e.charCodeAt(0) === 65279 && (e = e.slice(1)));
  var r = new $g(e, t), n = e.indexOf("\0");
  for (n !== -1 && (r.position = n, U(r, "null byte is not allowed in input")), r.input += "\0"; r.input.charCodeAt(r.position) === 32; )
    r.lineIndent += 1, r.position += 1;
  for (; r.position < r.length - 1; )
    Lg(r);
  return r.documents;
}
function Ug(e, t, r) {
  t !== null && typeof t == "object" && typeof r > "u" && (r = t, t = null);
  var n = eu(e, r);
  if (typeof t != "function")
    return n;
  for (var i = 0, a = n.length; i < a; i += 1)
    t(n[i]);
}
function kg(e, t) {
  var r = eu(e, t);
  if (r.length !== 0) {
    if (r.length === 1)
      return r[0];
    throw new zc("expected a single document in the stream, but found more");
  }
}
ja.loadAll = Ug;
ja.load = kg;
var tu = {}, li = Ye, Zr = Qr, Mg = Ha, ru = Object.prototype.toString, nu = Object.prototype.hasOwnProperty, Wa = 65279, jg = 9, Lr = 10, Bg = 13, Hg = 32, qg = 33, Gg = 34, ga = 35, Wg = 37, zg = 38, Vg = 39, Yg = 42, iu = 44, Xg = 45, Yn = 58, Jg = 61, Kg = 62, Qg = 63, Zg = 64, au = 91, ou = 93, e0 = 96, su = 123, t0 = 124, lu = 125, $e = {};
$e[0] = "\\0";
$e[7] = "\\a";
$e[8] = "\\b";
$e[9] = "\\t";
$e[10] = "\\n";
$e[11] = "\\v";
$e[12] = "\\f";
$e[13] = "\\r";
$e[27] = "\\e";
$e[34] = '\\"';
$e[92] = "\\\\";
$e[133] = "\\N";
$e[160] = "\\_";
$e[8232] = "\\L";
$e[8233] = "\\P";
var r0 = [
  "y",
  "Y",
  "yes",
  "Yes",
  "YES",
  "on",
  "On",
  "ON",
  "n",
  "N",
  "no",
  "No",
  "NO",
  "off",
  "Off",
  "OFF"
], n0 = /^[-+]?[0-9_]+(?::[0-9_]+)+(?:\.[0-9_]*)?$/;
function i0(e, t) {
  var r, n, i, a, o, s, l;
  if (t === null) return {};
  for (r = {}, n = Object.keys(t), i = 0, a = n.length; i < a; i += 1)
    o = n[i], s = String(t[o]), o.slice(0, 2) === "!!" && (o = "tag:yaml.org,2002:" + o.slice(2)), l = e.compiledTypeMap.fallback[o], l && nu.call(l.styleAliases, s) && (s = l.styleAliases[s]), r[o] = s;
  return r;
}
function a0(e) {
  var t, r, n;
  if (t = e.toString(16).toUpperCase(), e <= 255)
    r = "x", n = 2;
  else if (e <= 65535)
    r = "u", n = 4;
  else if (e <= 4294967295)
    r = "U", n = 8;
  else
    throw new Zr("code point within a string may not be greater than 0xFFFFFFFF");
  return "\\" + r + li.repeat("0", n - t.length) + t;
}
var o0 = 1, Ur = 2;
function s0(e) {
  this.schema = e.schema || Mg, this.indent = Math.max(1, e.indent || 2), this.noArrayIndent = e.noArrayIndent || !1, this.skipInvalid = e.skipInvalid || !1, this.flowLevel = li.isNothing(e.flowLevel) ? -1 : e.flowLevel, this.styleMap = i0(this.schema, e.styles || null), this.sortKeys = e.sortKeys || !1, this.lineWidth = e.lineWidth || 80, this.noRefs = e.noRefs || !1, this.noCompatMode = e.noCompatMode || !1, this.condenseFlow = e.condenseFlow || !1, this.quotingType = e.quotingType === '"' ? Ur : o0, this.forceQuotes = e.forceQuotes || !1, this.replacer = typeof e.replacer == "function" ? e.replacer : null, this.implicitTypes = this.schema.compiledImplicit, this.explicitTypes = this.schema.compiledExplicit, this.tag = null, this.result = "", this.duplicates = [], this.usedDuplicates = null;
}
function ls(e, t) {
  for (var r = li.repeat(" ", t), n = 0, i = -1, a = "", o, s = e.length; n < s; )
    i = e.indexOf(`
`, n), i === -1 ? (o = e.slice(n), n = s) : (o = e.slice(n, i + 1), n = i + 1), o.length && o !== `
` && (a += r), a += o;
  return a;
}
function ya(e, t) {
  return `
` + li.repeat(" ", e.indent * t);
}
function l0(e, t) {
  var r, n, i;
  for (r = 0, n = e.implicitTypes.length; r < n; r += 1)
    if (i = e.implicitTypes[r], i.resolve(t))
      return !0;
  return !1;
}
function Xn(e) {
  return e === Hg || e === jg;
}
function kr(e) {
  return 32 <= e && e <= 126 || 161 <= e && e <= 55295 && e !== 8232 && e !== 8233 || 57344 <= e && e <= 65533 && e !== Wa || 65536 <= e && e <= 1114111;
}
function cs(e) {
  return kr(e) && e !== Wa && e !== Bg && e !== Lr;
}
function us(e, t, r) {
  var n = cs(e), i = n && !Xn(e);
  return (
    // ns-plain-safe
    (r ? (
      // c = flow-in
      n
    ) : n && e !== iu && e !== au && e !== ou && e !== su && e !== lu) && e !== ga && !(t === Yn && !i) || cs(t) && !Xn(t) && e === ga || t === Yn && i
  );
}
function c0(e) {
  return kr(e) && e !== Wa && !Xn(e) && e !== Xg && e !== Qg && e !== Yn && e !== iu && e !== au && e !== ou && e !== su && e !== lu && e !== ga && e !== zg && e !== Yg && e !== qg && e !== t0 && e !== Jg && e !== Kg && e !== Vg && e !== Gg && e !== Wg && e !== Zg && e !== e0;
}
function u0(e) {
  return !Xn(e) && e !== Yn;
}
function Cr(e, t) {
  var r = e.charCodeAt(t), n;
  return r >= 55296 && r <= 56319 && t + 1 < e.length && (n = e.charCodeAt(t + 1), n >= 56320 && n <= 57343) ? (r - 55296) * 1024 + n - 56320 + 65536 : r;
}
function cu(e) {
  var t = /^\n* /;
  return t.test(e);
}
var uu = 1, wa = 2, fu = 3, du = 4, Jt = 5;
function f0(e, t, r, n, i, a, o, s) {
  var l, m = 0, c = null, f = !1, h = !1, g = n !== -1, _ = -1, w = c0(Cr(e, 0)) && u0(Cr(e, e.length - 1));
  if (t || o)
    for (l = 0; l < e.length; m >= 65536 ? l += 2 : l++) {
      if (m = Cr(e, l), !kr(m))
        return Jt;
      w = w && us(m, c, s), c = m;
    }
  else {
    for (l = 0; l < e.length; m >= 65536 ? l += 2 : l++) {
      if (m = Cr(e, l), m === Lr)
        f = !0, g && (h = h || // Foldable line = too long, and not more-indented.
        l - _ - 1 > n && e[_ + 1] !== " ", _ = l);
      else if (!kr(m))
        return Jt;
      w = w && us(m, c, s), c = m;
    }
    h = h || g && l - _ - 1 > n && e[_ + 1] !== " ";
  }
  return !f && !h ? w && !o && !i(e) ? uu : a === Ur ? Jt : wa : r > 9 && cu(e) ? Jt : o ? a === Ur ? Jt : wa : h ? du : fu;
}
function d0(e, t, r, n, i) {
  e.dump = function() {
    if (t.length === 0)
      return e.quotingType === Ur ? '""' : "''";
    if (!e.noCompatMode && (r0.indexOf(t) !== -1 || n0.test(t)))
      return e.quotingType === Ur ? '"' + t + '"' : "'" + t + "'";
    var a = e.indent * Math.max(1, r), o = e.lineWidth === -1 ? -1 : Math.max(Math.min(e.lineWidth, 40), e.lineWidth - a), s = n || e.flowLevel > -1 && r >= e.flowLevel;
    function l(m) {
      return l0(e, m);
    }
    switch (f0(
      t,
      s,
      e.indent,
      o,
      l,
      e.quotingType,
      e.forceQuotes && !n,
      i
    )) {
      case uu:
        return t;
      case wa:
        return "'" + t.replace(/'/g, "''") + "'";
      case fu:
        return "|" + fs(t, e.indent) + ds(ls(t, a));
      case du:
        return ">" + fs(t, e.indent) + ds(ls(h0(t, o), a));
      case Jt:
        return '"' + p0(t) + '"';
      default:
        throw new Zr("impossible error: invalid scalar style");
    }
  }();
}
function fs(e, t) {
  var r = cu(e) ? String(t) : "", n = e[e.length - 1] === `
`, i = n && (e[e.length - 2] === `
` || e === `
`), a = i ? "+" : n ? "" : "-";
  return r + a + `
`;
}
function ds(e) {
  return e[e.length - 1] === `
` ? e.slice(0, -1) : e;
}
function h0(e, t) {
  for (var r = /(\n+)([^\n]*)/g, n = function() {
    var m = e.indexOf(`
`);
    return m = m !== -1 ? m : e.length, r.lastIndex = m, hs(e.slice(0, m), t);
  }(), i = e[0] === `
` || e[0] === " ", a, o; o = r.exec(e); ) {
    var s = o[1], l = o[2];
    a = l[0] === " ", n += s + (!i && !a && l !== "" ? `
` : "") + hs(l, t), i = a;
  }
  return n;
}
function hs(e, t) {
  if (e === "" || e[0] === " ") return e;
  for (var r = / [^ ]/g, n, i = 0, a, o = 0, s = 0, l = ""; n = r.exec(e); )
    s = n.index, s - i > t && (a = o > i ? o : s, l += `
` + e.slice(i, a), i = a + 1), o = s;
  return l += `
`, e.length - i > t && o > i ? l += e.slice(i, o) + `
` + e.slice(o + 1) : l += e.slice(i), l.slice(1);
}
function p0(e) {
  for (var t = "", r = 0, n, i = 0; i < e.length; r >= 65536 ? i += 2 : i++)
    r = Cr(e, i), n = $e[r], !n && kr(r) ? (t += e[i], r >= 65536 && (t += e[i + 1])) : t += n || a0(r);
  return t;
}
function m0(e, t, r) {
  var n = "", i = e.tag, a, o, s;
  for (a = 0, o = r.length; a < o; a += 1)
    s = r[a], e.replacer && (s = e.replacer.call(r, String(a), s)), (at(e, t, s, !1, !1) || typeof s > "u" && at(e, t, null, !1, !1)) && (n !== "" && (n += "," + (e.condenseFlow ? "" : " ")), n += e.dump);
  e.tag = i, e.dump = "[" + n + "]";
}
function ps(e, t, r, n) {
  var i = "", a = e.tag, o, s, l;
  for (o = 0, s = r.length; o < s; o += 1)
    l = r[o], e.replacer && (l = e.replacer.call(r, String(o), l)), (at(e, t + 1, l, !0, !0, !1, !0) || typeof l > "u" && at(e, t + 1, null, !0, !0, !1, !0)) && ((!n || i !== "") && (i += ya(e, t)), e.dump && Lr === e.dump.charCodeAt(0) ? i += "-" : i += "- ", i += e.dump);
  e.tag = a, e.dump = i || "[]";
}
function g0(e, t, r) {
  var n = "", i = e.tag, a = Object.keys(r), o, s, l, m, c;
  for (o = 0, s = a.length; o < s; o += 1)
    c = "", n !== "" && (c += ", "), e.condenseFlow && (c += '"'), l = a[o], m = r[l], e.replacer && (m = e.replacer.call(r, l, m)), at(e, t, l, !1, !1) && (e.dump.length > 1024 && (c += "? "), c += e.dump + (e.condenseFlow ? '"' : "") + ":" + (e.condenseFlow ? "" : " "), at(e, t, m, !1, !1) && (c += e.dump, n += c));
  e.tag = i, e.dump = "{" + n + "}";
}
function y0(e, t, r, n) {
  var i = "", a = e.tag, o = Object.keys(r), s, l, m, c, f, h;
  if (e.sortKeys === !0)
    o.sort();
  else if (typeof e.sortKeys == "function")
    o.sort(e.sortKeys);
  else if (e.sortKeys)
    throw new Zr("sortKeys must be a boolean or a function");
  for (s = 0, l = o.length; s < l; s += 1)
    h = "", (!n || i !== "") && (h += ya(e, t)), m = o[s], c = r[m], e.replacer && (c = e.replacer.call(r, m, c)), at(e, t + 1, m, !0, !0, !0) && (f = e.tag !== null && e.tag !== "?" || e.dump && e.dump.length > 1024, f && (e.dump && Lr === e.dump.charCodeAt(0) ? h += "?" : h += "? "), h += e.dump, f && (h += ya(e, t)), at(e, t + 1, c, !0, f) && (e.dump && Lr === e.dump.charCodeAt(0) ? h += ":" : h += ": ", h += e.dump, i += h));
  e.tag = a, e.dump = i || "{}";
}
function ms(e, t, r) {
  var n, i, a, o, s, l;
  for (i = r ? e.explicitTypes : e.implicitTypes, a = 0, o = i.length; a < o; a += 1)
    if (s = i[a], (s.instanceOf || s.predicate) && (!s.instanceOf || typeof t == "object" && t instanceof s.instanceOf) && (!s.predicate || s.predicate(t))) {
      if (r ? s.multi && s.representName ? e.tag = s.representName(t) : e.tag = s.tag : e.tag = "?", s.represent) {
        if (l = e.styleMap[s.tag] || s.defaultStyle, ru.call(s.represent) === "[object Function]")
          n = s.represent(t, l);
        else if (nu.call(s.represent, l))
          n = s.represent[l](t, l);
        else
          throw new Zr("!<" + s.tag + '> tag resolver accepts not "' + l + '" style');
        e.dump = n;
      }
      return !0;
    }
  return !1;
}
function at(e, t, r, n, i, a, o) {
  e.tag = null, e.dump = r, ms(e, r, !1) || ms(e, r, !0);
  var s = ru.call(e.dump), l = n, m;
  n && (n = e.flowLevel < 0 || e.flowLevel > t);
  var c = s === "[object Object]" || s === "[object Array]", f, h;
  if (c && (f = e.duplicates.indexOf(r), h = f !== -1), (e.tag !== null && e.tag !== "?" || h || e.indent !== 2 && t > 0) && (i = !1), h && e.usedDuplicates[f])
    e.dump = "*ref_" + f;
  else {
    if (c && h && !e.usedDuplicates[f] && (e.usedDuplicates[f] = !0), s === "[object Object]")
      n && Object.keys(e.dump).length !== 0 ? (y0(e, t, e.dump, i), h && (e.dump = "&ref_" + f + e.dump)) : (g0(e, t, e.dump), h && (e.dump = "&ref_" + f + " " + e.dump));
    else if (s === "[object Array]")
      n && e.dump.length !== 0 ? (e.noArrayIndent && !o && t > 0 ? ps(e, t - 1, e.dump, i) : ps(e, t, e.dump, i), h && (e.dump = "&ref_" + f + e.dump)) : (m0(e, t, e.dump), h && (e.dump = "&ref_" + f + " " + e.dump));
    else if (s === "[object String]")
      e.tag !== "?" && d0(e, e.dump, t, a, l);
    else {
      if (s === "[object Undefined]")
        return !1;
      if (e.skipInvalid) return !1;
      throw new Zr("unacceptable kind of an object to dump " + s);
    }
    e.tag !== null && e.tag !== "?" && (m = encodeURI(
      e.tag[0] === "!" ? e.tag.slice(1) : e.tag
    ).replace(/!/g, "%21"), e.tag[0] === "!" ? m = "!" + m : m.slice(0, 18) === "tag:yaml.org,2002:" ? m = "!!" + m.slice(18) : m = "!<" + m + ">", e.dump = m + " " + e.dump);
  }
  return !0;
}
function w0(e, t) {
  var r = [], n = [], i, a;
  for (Ea(e, r, n), i = 0, a = n.length; i < a; i += 1)
    t.duplicates.push(r[n[i]]);
  t.usedDuplicates = new Array(a);
}
function Ea(e, t, r) {
  var n, i, a;
  if (e !== null && typeof e == "object")
    if (i = t.indexOf(e), i !== -1)
      r.indexOf(i) === -1 && r.push(i);
    else if (t.push(e), Array.isArray(e))
      for (i = 0, a = e.length; i < a; i += 1)
        Ea(e[i], t, r);
    else
      for (n = Object.keys(e), i = 0, a = n.length; i < a; i += 1)
        Ea(e[n[i]], t, r);
}
function E0(e, t) {
  t = t || {};
  var r = new s0(t);
  r.noRefs || w0(e, r);
  var n = e;
  return r.replacer && (n = r.replacer.call({ "": n }, "", n)), at(r, 0, n, !0, !0) ? r.dump + `
` : "";
}
tu.dump = E0;
var hu = ja, v0 = tu;
function za(e, t) {
  return function() {
    throw new Error("Function yaml." + e + " is removed in js-yaml 4. Use yaml." + t + " instead, which is now safe by default.");
  };
}
Se.Type = Re;
Se.Schema = $c;
Se.FAILSAFE_SCHEMA = Dc;
Se.JSON_SCHEMA = Lc;
Se.CORE_SCHEMA = Uc;
Se.DEFAULT_SCHEMA = Ha;
Se.load = hu.load;
Se.loadAll = hu.loadAll;
Se.dump = v0.dump;
Se.YAMLException = Qr;
Se.types = {
  binary: Hc,
  float: xc,
  map: Oc,
  null: Pc,
  pairs: Gc,
  set: Wc,
  timestamp: jc,
  bool: Nc,
  int: Rc,
  merge: Bc,
  omap: qc,
  seq: Ic,
  str: bc
};
Se.safeLoad = za("safeLoad", "load");
Se.safeLoadAll = za("safeLoadAll", "loadAll");
Se.safeDump = za("safeDump", "dump");
var ci = {};
Object.defineProperty(ci, "__esModule", { value: !0 });
ci.Lazy = void 0;
class _0 {
  constructor(t) {
    this._value = null, this.creator = t;
  }
  get hasValue() {
    return this.creator == null;
  }
  get value() {
    if (this.creator == null)
      return this._value;
    const t = this.creator();
    return this.value = t, t;
  }
  set value(t) {
    this._value = t, this.creator = null;
  }
}
ci.Lazy = _0;
var va = { exports: {} };
const S0 = "2.0.0", pu = 256, A0 = Number.MAX_SAFE_INTEGER || /* istanbul ignore next */
9007199254740991, T0 = 16, C0 = pu - 6, $0 = [
  "major",
  "premajor",
  "minor",
  "preminor",
  "patch",
  "prepatch",
  "prerelease"
];
var ui = {
  MAX_LENGTH: pu,
  MAX_SAFE_COMPONENT_LENGTH: T0,
  MAX_SAFE_BUILD_LENGTH: C0,
  MAX_SAFE_INTEGER: A0,
  RELEASE_TYPES: $0,
  SEMVER_SPEC_VERSION: S0,
  FLAG_INCLUDE_PRERELEASE: 1,
  FLAG_LOOSE: 2
};
const b0 = typeof process == "object" && process.env && process.env.NODE_DEBUG && /\bsemver\b/i.test(process.env.NODE_DEBUG) ? (...e) => console.error("SEMVER", ...e) : () => {
};
var fi = b0;
(function(e, t) {
  const {
    MAX_SAFE_COMPONENT_LENGTH: r,
    MAX_SAFE_BUILD_LENGTH: n,
    MAX_LENGTH: i
  } = ui, a = fi;
  t = e.exports = {};
  const o = t.re = [], s = t.safeRe = [], l = t.src = [], m = t.safeSrc = [], c = t.t = {};
  let f = 0;
  const h = "[a-zA-Z0-9-]", g = [
    ["\\s", 1],
    ["\\d", i],
    [h, n]
  ], _ = (S) => {
    for (const [T, A] of g)
      S = S.split(`${T}*`).join(`${T}{0,${A}}`).split(`${T}+`).join(`${T}{1,${A}}`);
    return S;
  }, w = (S, T, A) => {
    const R = _(T), x = f++;
    a(S, x, T), c[S] = x, l[x] = T, m[x] = R, o[x] = new RegExp(T, A ? "g" : void 0), s[x] = new RegExp(R, A ? "g" : void 0);
  };
  w("NUMERICIDENTIFIER", "0|[1-9]\\d*"), w("NUMERICIDENTIFIERLOOSE", "\\d+"), w("NONNUMERICIDENTIFIER", `\\d*[a-zA-Z-]${h}*`), w("MAINVERSION", `(${l[c.NUMERICIDENTIFIER]})\\.(${l[c.NUMERICIDENTIFIER]})\\.(${l[c.NUMERICIDENTIFIER]})`), w("MAINVERSIONLOOSE", `(${l[c.NUMERICIDENTIFIERLOOSE]})\\.(${l[c.NUMERICIDENTIFIERLOOSE]})\\.(${l[c.NUMERICIDENTIFIERLOOSE]})`), w("PRERELEASEIDENTIFIER", `(?:${l[c.NONNUMERICIDENTIFIER]}|${l[c.NUMERICIDENTIFIER]})`), w("PRERELEASEIDENTIFIERLOOSE", `(?:${l[c.NONNUMERICIDENTIFIER]}|${l[c.NUMERICIDENTIFIERLOOSE]})`), w("PRERELEASE", `(?:-(${l[c.PRERELEASEIDENTIFIER]}(?:\\.${l[c.PRERELEASEIDENTIFIER]})*))`), w("PRERELEASELOOSE", `(?:-?(${l[c.PRERELEASEIDENTIFIERLOOSE]}(?:\\.${l[c.PRERELEASEIDENTIFIERLOOSE]})*))`), w("BUILDIDENTIFIER", `${h}+`), w("BUILD", `(?:\\+(${l[c.BUILDIDENTIFIER]}(?:\\.${l[c.BUILDIDENTIFIER]})*))`), w("FULLPLAIN", `v?${l[c.MAINVERSION]}${l[c.PRERELEASE]}?${l[c.BUILD]}?`), w("FULL", `^${l[c.FULLPLAIN]}$`), w("LOOSEPLAIN", `[v=\\s]*${l[c.MAINVERSIONLOOSE]}${l[c.PRERELEASELOOSE]}?${l[c.BUILD]}?`), w("LOOSE", `^${l[c.LOOSEPLAIN]}$`), w("GTLT", "((?:<|>)?=?)"), w("XRANGEIDENTIFIERLOOSE", `${l[c.NUMERICIDENTIFIERLOOSE]}|x|X|\\*`), w("XRANGEIDENTIFIER", `${l[c.NUMERICIDENTIFIER]}|x|X|\\*`), w("XRANGEPLAIN", `[v=\\s]*(${l[c.XRANGEIDENTIFIER]})(?:\\.(${l[c.XRANGEIDENTIFIER]})(?:\\.(${l[c.XRANGEIDENTIFIER]})(?:${l[c.PRERELEASE]})?${l[c.BUILD]}?)?)?`), w("XRANGEPLAINLOOSE", `[v=\\s]*(${l[c.XRANGEIDENTIFIERLOOSE]})(?:\\.(${l[c.XRANGEIDENTIFIERLOOSE]})(?:\\.(${l[c.XRANGEIDENTIFIERLOOSE]})(?:${l[c.PRERELEASELOOSE]})?${l[c.BUILD]}?)?)?`), w("XRANGE", `^${l[c.GTLT]}\\s*${l[c.XRANGEPLAIN]}$`), w("XRANGELOOSE", `^${l[c.GTLT]}\\s*${l[c.XRANGEPLAINLOOSE]}$`), w("COERCEPLAIN", `(^|[^\\d])(\\d{1,${r}})(?:\\.(\\d{1,${r}}))?(?:\\.(\\d{1,${r}}))?`), w("COERCE", `${l[c.COERCEPLAIN]}(?:$|[^\\d])`), w("COERCEFULL", l[c.COERCEPLAIN] + `(?:${l[c.PRERELEASE]})?(?:${l[c.BUILD]})?(?:$|[^\\d])`), w("COERCERTL", l[c.COERCE], !0), w("COERCERTLFULL", l[c.COERCEFULL], !0), w("LONETILDE", "(?:~>?)"), w("TILDETRIM", `(\\s*)${l[c.LONETILDE]}\\s+`, !0), t.tildeTrimReplace = "$1~", w("TILDE", `^${l[c.LONETILDE]}${l[c.XRANGEPLAIN]}$`), w("TILDELOOSE", `^${l[c.LONETILDE]}${l[c.XRANGEPLAINLOOSE]}$`), w("LONECARET", "(?:\\^)"), w("CARETTRIM", `(\\s*)${l[c.LONECARET]}\\s+`, !0), t.caretTrimReplace = "$1^", w("CARET", `^${l[c.LONECARET]}${l[c.XRANGEPLAIN]}$`), w("CARETLOOSE", `^${l[c.LONECARET]}${l[c.XRANGEPLAINLOOSE]}$`), w("COMPARATORLOOSE", `^${l[c.GTLT]}\\s*(${l[c.LOOSEPLAIN]})$|^$`), w("COMPARATOR", `^${l[c.GTLT]}\\s*(${l[c.FULLPLAIN]})$|^$`), w("COMPARATORTRIM", `(\\s*)${l[c.GTLT]}\\s*(${l[c.LOOSEPLAIN]}|${l[c.XRANGEPLAIN]})`, !0), t.comparatorTrimReplace = "$1$2$3", w("HYPHENRANGE", `^\\s*(${l[c.XRANGEPLAIN]})\\s+-\\s+(${l[c.XRANGEPLAIN]})\\s*$`), w("HYPHENRANGELOOSE", `^\\s*(${l[c.XRANGEPLAINLOOSE]})\\s+-\\s+(${l[c.XRANGEPLAINLOOSE]})\\s*$`), w("STAR", "(<|>)?=?\\s*\\*"), w("GTE0", "^\\s*>=\\s*0\\.0\\.0\\s*$"), w("GTE0PRE", "^\\s*>=\\s*0\\.0\\.0-0\\s*$");
})(va, va.exports);
var en = va.exports;
const I0 = Object.freeze({ loose: !0 }), O0 = Object.freeze({}), D0 = (e) => e ? typeof e != "object" ? I0 : e : O0;
var Va = D0;
const gs = /^[0-9]+$/, mu = (e, t) => {
  if (typeof e == "number" && typeof t == "number")
    return e === t ? 0 : e < t ? -1 : 1;
  const r = gs.test(e), n = gs.test(t);
  return r && n && (e = +e, t = +t), e === t ? 0 : r && !n ? -1 : n && !r ? 1 : e < t ? -1 : 1;
}, P0 = (e, t) => mu(t, e);
var gu = {
  compareIdentifiers: mu,
  rcompareIdentifiers: P0
};
const Tn = fi, { MAX_LENGTH: ys, MAX_SAFE_INTEGER: Cn } = ui, { safeRe: $n, t: bn } = en, N0 = Va, { compareIdentifiers: qi } = gu;
let R0 = class Ze {
  constructor(t, r) {
    if (r = N0(r), t instanceof Ze) {
      if (t.loose === !!r.loose && t.includePrerelease === !!r.includePrerelease)
        return t;
      t = t.version;
    } else if (typeof t != "string")
      throw new TypeError(`Invalid version. Must be a string. Got type "${typeof t}".`);
    if (t.length > ys)
      throw new TypeError(
        `version is longer than ${ys} characters`
      );
    Tn("SemVer", t, r), this.options = r, this.loose = !!r.loose, this.includePrerelease = !!r.includePrerelease;
    const n = t.trim().match(r.loose ? $n[bn.LOOSE] : $n[bn.FULL]);
    if (!n)
      throw new TypeError(`Invalid Version: ${t}`);
    if (this.raw = t, this.major = +n[1], this.minor = +n[2], this.patch = +n[3], this.major > Cn || this.major < 0)
      throw new TypeError("Invalid major version");
    if (this.minor > Cn || this.minor < 0)
      throw new TypeError("Invalid minor version");
    if (this.patch > Cn || this.patch < 0)
      throw new TypeError("Invalid patch version");
    n[4] ? this.prerelease = n[4].split(".").map((i) => {
      if (/^[0-9]+$/.test(i)) {
        const a = +i;
        if (a >= 0 && a < Cn)
          return a;
      }
      return i;
    }) : this.prerelease = [], this.build = n[5] ? n[5].split(".") : [], this.format();
  }
  format() {
    return this.version = `${this.major}.${this.minor}.${this.patch}`, this.prerelease.length && (this.version += `-${this.prerelease.join(".")}`), this.version;
  }
  toString() {
    return this.version;
  }
  compare(t) {
    if (Tn("SemVer.compare", this.version, this.options, t), !(t instanceof Ze)) {
      if (typeof t == "string" && t === this.version)
        return 0;
      t = new Ze(t, this.options);
    }
    return t.version === this.version ? 0 : this.compareMain(t) || this.comparePre(t);
  }
  compareMain(t) {
    return t instanceof Ze || (t = new Ze(t, this.options)), this.major < t.major ? -1 : this.major > t.major ? 1 : this.minor < t.minor ? -1 : this.minor > t.minor ? 1 : this.patch < t.patch ? -1 : this.patch > t.patch ? 1 : 0;
  }
  comparePre(t) {
    if (t instanceof Ze || (t = new Ze(t, this.options)), this.prerelease.length && !t.prerelease.length)
      return -1;
    if (!this.prerelease.length && t.prerelease.length)
      return 1;
    if (!this.prerelease.length && !t.prerelease.length)
      return 0;
    let r = 0;
    do {
      const n = this.prerelease[r], i = t.prerelease[r];
      if (Tn("prerelease compare", r, n, i), n === void 0 && i === void 0)
        return 0;
      if (i === void 0)
        return 1;
      if (n === void 0)
        return -1;
      if (n === i)
        continue;
      return qi(n, i);
    } while (++r);
  }
  compareBuild(t) {
    t instanceof Ze || (t = new Ze(t, this.options));
    let r = 0;
    do {
      const n = this.build[r], i = t.build[r];
      if (Tn("build compare", r, n, i), n === void 0 && i === void 0)
        return 0;
      if (i === void 0)
        return 1;
      if (n === void 0)
        return -1;
      if (n === i)
        continue;
      return qi(n, i);
    } while (++r);
  }
  // preminor will bump the version up to the next minor release, and immediately
  // down to pre-release. premajor and prepatch work the same way.
  inc(t, r, n) {
    if (t.startsWith("pre")) {
      if (!r && n === !1)
        throw new Error("invalid increment argument: identifier is empty");
      if (r) {
        const i = `-${r}`.match(this.options.loose ? $n[bn.PRERELEASELOOSE] : $n[bn.PRERELEASE]);
        if (!i || i[1] !== r)
          throw new Error(`invalid identifier: ${r}`);
      }
    }
    switch (t) {
      case "premajor":
        this.prerelease.length = 0, this.patch = 0, this.minor = 0, this.major++, this.inc("pre", r, n);
        break;
      case "preminor":
        this.prerelease.length = 0, this.patch = 0, this.minor++, this.inc("pre", r, n);
        break;
      case "prepatch":
        this.prerelease.length = 0, this.inc("patch", r, n), this.inc("pre", r, n);
        break;
      case "prerelease":
        this.prerelease.length === 0 && this.inc("patch", r, n), this.inc("pre", r, n);
        break;
      case "release":
        if (this.prerelease.length === 0)
          throw new Error(`version ${this.raw} is not a prerelease`);
        this.prerelease.length = 0;
        break;
      case "major":
        (this.minor !== 0 || this.patch !== 0 || this.prerelease.length === 0) && this.major++, this.minor = 0, this.patch = 0, this.prerelease = [];
        break;
      case "minor":
        (this.patch !== 0 || this.prerelease.length === 0) && this.minor++, this.patch = 0, this.prerelease = [];
        break;
      case "patch":
        this.prerelease.length === 0 && this.patch++, this.prerelease = [];
        break;
      case "pre": {
        const i = Number(n) ? 1 : 0;
        if (this.prerelease.length === 0)
          this.prerelease = [i];
        else {
          let a = this.prerelease.length;
          for (; --a >= 0; )
            typeof this.prerelease[a] == "number" && (this.prerelease[a]++, a = -2);
          if (a === -1) {
            if (r === this.prerelease.join(".") && n === !1)
              throw new Error("invalid increment argument: identifier already exists");
            this.prerelease.push(i);
          }
        }
        if (r) {
          let a = [r, i];
          n === !1 && (a = [r]), qi(this.prerelease[0], r) === 0 ? isNaN(this.prerelease[1]) && (this.prerelease = a) : this.prerelease = a;
        }
        break;
      }
      default:
        throw new Error(`invalid increment argument: ${t}`);
    }
    return this.raw = this.format(), this.build.length && (this.raw += `+${this.build.join(".")}`), this;
  }
};
var Fe = R0;
const ws = Fe, F0 = (e, t, r = !1) => {
  if (e instanceof ws)
    return e;
  try {
    return new ws(e, t);
  } catch (n) {
    if (!r)
      return null;
    throw n;
  }
};
var fr = F0;
const x0 = fr, L0 = (e, t) => {
  const r = x0(e, t);
  return r ? r.version : null;
};
var U0 = L0;
const k0 = fr, M0 = (e, t) => {
  const r = k0(e.trim().replace(/^[=v]+/, ""), t);
  return r ? r.version : null;
};
var j0 = M0;
const Es = Fe, B0 = (e, t, r, n, i) => {
  typeof r == "string" && (i = n, n = r, r = void 0);
  try {
    return new Es(
      e instanceof Es ? e.version : e,
      r
    ).inc(t, n, i).version;
  } catch {
    return null;
  }
};
var H0 = B0;
const vs = fr, q0 = (e, t) => {
  const r = vs(e, null, !0), n = vs(t, null, !0), i = r.compare(n);
  if (i === 0)
    return null;
  const a = i > 0, o = a ? r : n, s = a ? n : r, l = !!o.prerelease.length;
  if (!!s.prerelease.length && !l) {
    if (!s.patch && !s.minor)
      return "major";
    if (s.compareMain(o) === 0)
      return s.minor && !s.patch ? "minor" : "patch";
  }
  const c = l ? "pre" : "";
  return r.major !== n.major ? c + "major" : r.minor !== n.minor ? c + "minor" : r.patch !== n.patch ? c + "patch" : "prerelease";
};
var G0 = q0;
const W0 = Fe, z0 = (e, t) => new W0(e, t).major;
var V0 = z0;
const Y0 = Fe, X0 = (e, t) => new Y0(e, t).minor;
var J0 = X0;
const K0 = Fe, Q0 = (e, t) => new K0(e, t).patch;
var Z0 = Q0;
const ey = fr, ty = (e, t) => {
  const r = ey(e, t);
  return r && r.prerelease.length ? r.prerelease : null;
};
var ry = ty;
const _s = Fe, ny = (e, t, r) => new _s(e, r).compare(new _s(t, r));
var Xe = ny;
const iy = Xe, ay = (e, t, r) => iy(t, e, r);
var oy = ay;
const sy = Xe, ly = (e, t) => sy(e, t, !0);
var cy = ly;
const Ss = Fe, uy = (e, t, r) => {
  const n = new Ss(e, r), i = new Ss(t, r);
  return n.compare(i) || n.compareBuild(i);
};
var Ya = uy;
const fy = Ya, dy = (e, t) => e.sort((r, n) => fy(r, n, t));
var hy = dy;
const py = Ya, my = (e, t) => e.sort((r, n) => py(n, r, t));
var gy = my;
const yy = Xe, wy = (e, t, r) => yy(e, t, r) > 0;
var di = wy;
const Ey = Xe, vy = (e, t, r) => Ey(e, t, r) < 0;
var Xa = vy;
const _y = Xe, Sy = (e, t, r) => _y(e, t, r) === 0;
var yu = Sy;
const Ay = Xe, Ty = (e, t, r) => Ay(e, t, r) !== 0;
var wu = Ty;
const Cy = Xe, $y = (e, t, r) => Cy(e, t, r) >= 0;
var Ja = $y;
const by = Xe, Iy = (e, t, r) => by(e, t, r) <= 0;
var Ka = Iy;
const Oy = yu, Dy = wu, Py = di, Ny = Ja, Ry = Xa, Fy = Ka, xy = (e, t, r, n) => {
  switch (t) {
    case "===":
      return typeof e == "object" && (e = e.version), typeof r == "object" && (r = r.version), e === r;
    case "!==":
      return typeof e == "object" && (e = e.version), typeof r == "object" && (r = r.version), e !== r;
    case "":
    case "=":
    case "==":
      return Oy(e, r, n);
    case "!=":
      return Dy(e, r, n);
    case ">":
      return Py(e, r, n);
    case ">=":
      return Ny(e, r, n);
    case "<":
      return Ry(e, r, n);
    case "<=":
      return Fy(e, r, n);
    default:
      throw new TypeError(`Invalid operator: ${t}`);
  }
};
var Eu = xy;
const Ly = Fe, Uy = fr, { safeRe: In, t: On } = en, ky = (e, t) => {
  if (e instanceof Ly)
    return e;
  if (typeof e == "number" && (e = String(e)), typeof e != "string")
    return null;
  t = t || {};
  let r = null;
  if (!t.rtl)
    r = e.match(t.includePrerelease ? In[On.COERCEFULL] : In[On.COERCE]);
  else {
    const l = t.includePrerelease ? In[On.COERCERTLFULL] : In[On.COERCERTL];
    let m;
    for (; (m = l.exec(e)) && (!r || r.index + r[0].length !== e.length); )
      (!r || m.index + m[0].length !== r.index + r[0].length) && (r = m), l.lastIndex = m.index + m[1].length + m[2].length;
    l.lastIndex = -1;
  }
  if (r === null)
    return null;
  const n = r[2], i = r[3] || "0", a = r[4] || "0", o = t.includePrerelease && r[5] ? `-${r[5]}` : "", s = t.includePrerelease && r[6] ? `+${r[6]}` : "";
  return Uy(`${n}.${i}.${a}${o}${s}`, t);
};
var My = ky;
class jy {
  constructor() {
    this.max = 1e3, this.map = /* @__PURE__ */ new Map();
  }
  get(t) {
    const r = this.map.get(t);
    if (r !== void 0)
      return this.map.delete(t), this.map.set(t, r), r;
  }
  delete(t) {
    return this.map.delete(t);
  }
  set(t, r) {
    if (!this.delete(t) && r !== void 0) {
      if (this.map.size >= this.max) {
        const i = this.map.keys().next().value;
        this.delete(i);
      }
      this.map.set(t, r);
    }
    return this;
  }
}
var By = jy, Gi, As;
function Je() {
  if (As) return Gi;
  As = 1;
  const e = /\s+/g;
  class t {
    constructor(b, P) {
      if (P = i(P), b instanceof t)
        return b.loose === !!P.loose && b.includePrerelease === !!P.includePrerelease ? b : new t(b.raw, P);
      if (b instanceof a)
        return this.raw = b.value, this.set = [[b]], this.formatted = void 0, this;
      if (this.options = P, this.loose = !!P.loose, this.includePrerelease = !!P.includePrerelease, this.raw = b.trim().replace(e, " "), this.set = this.raw.split("||").map(($) => this.parseRange($.trim())).filter(($) => $.length), !this.set.length)
        throw new TypeError(`Invalid SemVer Range: ${this.raw}`);
      if (this.set.length > 1) {
        const $ = this.set[0];
        if (this.set = this.set.filter((N) => !w(N[0])), this.set.length === 0)
          this.set = [$];
        else if (this.set.length > 1) {
          for (const N of this.set)
            if (N.length === 1 && S(N[0])) {
              this.set = [N];
              break;
            }
        }
      }
      this.formatted = void 0;
    }
    get range() {
      if (this.formatted === void 0) {
        this.formatted = "";
        for (let b = 0; b < this.set.length; b++) {
          b > 0 && (this.formatted += "||");
          const P = this.set[b];
          for (let $ = 0; $ < P.length; $++)
            $ > 0 && (this.formatted += " "), this.formatted += P[$].toString().trim();
        }
      }
      return this.formatted;
    }
    format() {
      return this.range;
    }
    toString() {
      return this.range;
    }
    parseRange(b) {
      const $ = ((this.options.includePrerelease && g) | (this.options.loose && _)) + ":" + b, N = n.get($);
      if (N)
        return N;
      const D = this.options.loose, M = D ? l[m.HYPHENRANGELOOSE] : l[m.HYPHENRANGE];
      b = b.replace(M, j(this.options.includePrerelease)), o("hyphen replace", b), b = b.replace(l[m.COMPARATORTRIM], c), o("comparator trim", b), b = b.replace(l[m.TILDETRIM], f), o("tilde trim", b), b = b.replace(l[m.CARETTRIM], h), o("caret trim", b);
      let V = b.split(" ").map((k) => A(k, this.options)).join(" ").split(/\s+/).map((k) => H(k, this.options));
      D && (V = V.filter((k) => (o("loose invalid filter", k, this.options), !!k.match(l[m.COMPARATORLOOSE])))), o("range list", V);
      const q = /* @__PURE__ */ new Map(), Z = V.map((k) => new a(k, this.options));
      for (const k of Z) {
        if (w(k))
          return [k];
        q.set(k.value, k);
      }
      q.size > 1 && q.has("") && q.delete("");
      const pe = [...q.values()];
      return n.set($, pe), pe;
    }
    intersects(b, P) {
      if (!(b instanceof t))
        throw new TypeError("a Range is required");
      return this.set.some(($) => T($, P) && b.set.some((N) => T(N, P) && $.every((D) => N.every((M) => D.intersects(M, P)))));
    }
    // if ANY of the sets match ALL of its comparators, then pass
    test(b) {
      if (!b)
        return !1;
      if (typeof b == "string")
        try {
          b = new s(b, this.options);
        } catch {
          return !1;
        }
      for (let P = 0; P < this.set.length; P++)
        if (Q(this.set[P], b, this.options))
          return !0;
      return !1;
    }
  }
  Gi = t;
  const r = By, n = new r(), i = Va, a = hi(), o = fi, s = Fe, {
    safeRe: l,
    t: m,
    comparatorTrimReplace: c,
    tildeTrimReplace: f,
    caretTrimReplace: h
  } = en, { FLAG_INCLUDE_PRERELEASE: g, FLAG_LOOSE: _ } = ui, w = (O) => O.value === "<0.0.0-0", S = (O) => O.value === "", T = (O, b) => {
    let P = !0;
    const $ = O.slice();
    let N = $.pop();
    for (; P && $.length; )
      P = $.every((D) => N.intersects(D, b)), N = $.pop();
    return P;
  }, A = (O, b) => (O = O.replace(l[m.BUILD], ""), o("comp", O, b), O = ce(O, b), o("caret", O), O = x(O, b), o("tildes", O), O = ke(O, b), o("xrange", O), O = z(O, b), o("stars", O), O), R = (O) => !O || O.toLowerCase() === "x" || O === "*", x = (O, b) => O.trim().split(/\s+/).map((P) => re(P, b)).join(" "), re = (O, b) => {
    const P = b.loose ? l[m.TILDELOOSE] : l[m.TILDE];
    return O.replace(P, ($, N, D, M, V) => {
      o("tilde", O, $, N, D, M, V);
      let q;
      return R(N) ? q = "" : R(D) ? q = `>=${N}.0.0 <${+N + 1}.0.0-0` : R(M) ? q = `>=${N}.${D}.0 <${N}.${+D + 1}.0-0` : V ? (o("replaceTilde pr", V), q = `>=${N}.${D}.${M}-${V} <${N}.${+D + 1}.0-0`) : q = `>=${N}.${D}.${M} <${N}.${+D + 1}.0-0`, o("tilde return", q), q;
    });
  }, ce = (O, b) => O.trim().split(/\s+/).map((P) => X(P, b)).join(" "), X = (O, b) => {
    o("caret", O, b);
    const P = b.loose ? l[m.CARETLOOSE] : l[m.CARET], $ = b.includePrerelease ? "-0" : "";
    return O.replace(P, (N, D, M, V, q) => {
      o("caret", O, N, D, M, V, q);
      let Z;
      return R(D) ? Z = "" : R(M) ? Z = `>=${D}.0.0${$} <${+D + 1}.0.0-0` : R(V) ? D === "0" ? Z = `>=${D}.${M}.0${$} <${D}.${+M + 1}.0-0` : Z = `>=${D}.${M}.0${$} <${+D + 1}.0.0-0` : q ? (o("replaceCaret pr", q), D === "0" ? M === "0" ? Z = `>=${D}.${M}.${V}-${q} <${D}.${M}.${+V + 1}-0` : Z = `>=${D}.${M}.${V}-${q} <${D}.${+M + 1}.0-0` : Z = `>=${D}.${M}.${V}-${q} <${+D + 1}.0.0-0`) : (o("no pr"), D === "0" ? M === "0" ? Z = `>=${D}.${M}.${V}${$} <${D}.${M}.${+V + 1}-0` : Z = `>=${D}.${M}.${V}${$} <${D}.${+M + 1}.0-0` : Z = `>=${D}.${M}.${V} <${+D + 1}.0.0-0`), o("caret return", Z), Z;
    });
  }, ke = (O, b) => (o("replaceXRanges", O, b), O.split(/\s+/).map((P) => y(P, b)).join(" ")), y = (O, b) => {
    O = O.trim();
    const P = b.loose ? l[m.XRANGELOOSE] : l[m.XRANGE];
    return O.replace(P, ($, N, D, M, V, q) => {
      o("xRange", O, $, N, D, M, V, q);
      const Z = R(D), pe = Z || R(M), k = pe || R(V), Ke = k;
      return N === "=" && Ke && (N = ""), q = b.includePrerelease ? "-0" : "", Z ? N === ">" || N === "<" ? $ = "<0.0.0-0" : $ = "*" : N && Ke ? (pe && (M = 0), V = 0, N === ">" ? (N = ">=", pe ? (D = +D + 1, M = 0, V = 0) : (M = +M + 1, V = 0)) : N === "<=" && (N = "<", pe ? D = +D + 1 : M = +M + 1), N === "<" && (q = "-0"), $ = `${N + D}.${M}.${V}${q}`) : pe ? $ = `>=${D}.0.0${q} <${+D + 1}.0.0-0` : k && ($ = `>=${D}.${M}.0${q} <${D}.${+M + 1}.0-0`), o("xRange return", $), $;
    });
  }, z = (O, b) => (o("replaceStars", O, b), O.trim().replace(l[m.STAR], "")), H = (O, b) => (o("replaceGTE0", O, b), O.trim().replace(l[b.includePrerelease ? m.GTE0PRE : m.GTE0], "")), j = (O) => (b, P, $, N, D, M, V, q, Z, pe, k, Ke) => (R($) ? P = "" : R(N) ? P = `>=${$}.0.0${O ? "-0" : ""}` : R(D) ? P = `>=${$}.${N}.0${O ? "-0" : ""}` : M ? P = `>=${P}` : P = `>=${P}${O ? "-0" : ""}`, R(Z) ? q = "" : R(pe) ? q = `<${+Z + 1}.0.0-0` : R(k) ? q = `<${Z}.${+pe + 1}.0-0` : Ke ? q = `<=${Z}.${pe}.${k}-${Ke}` : O ? q = `<${Z}.${pe}.${+k + 1}-0` : q = `<=${q}`, `${P} ${q}`.trim()), Q = (O, b, P) => {
    for (let $ = 0; $ < O.length; $++)
      if (!O[$].test(b))
        return !1;
    if (b.prerelease.length && !P.includePrerelease) {
      for (let $ = 0; $ < O.length; $++)
        if (o(O[$].semver), O[$].semver !== a.ANY && O[$].semver.prerelease.length > 0) {
          const N = O[$].semver;
          if (N.major === b.major && N.minor === b.minor && N.patch === b.patch)
            return !0;
        }
      return !1;
    }
    return !0;
  };
  return Gi;
}
var Wi, Ts;
function hi() {
  if (Ts) return Wi;
  Ts = 1;
  const e = Symbol("SemVer ANY");
  class t {
    static get ANY() {
      return e;
    }
    constructor(c, f) {
      if (f = r(f), c instanceof t) {
        if (c.loose === !!f.loose)
          return c;
        c = c.value;
      }
      c = c.trim().split(/\s+/).join(" "), o("comparator", c, f), this.options = f, this.loose = !!f.loose, this.parse(c), this.semver === e ? this.value = "" : this.value = this.operator + this.semver.version, o("comp", this);
    }
    parse(c) {
      const f = this.options.loose ? n[i.COMPARATORLOOSE] : n[i.COMPARATOR], h = c.match(f);
      if (!h)
        throw new TypeError(`Invalid comparator: ${c}`);
      this.operator = h[1] !== void 0 ? h[1] : "", this.operator === "=" && (this.operator = ""), h[2] ? this.semver = new s(h[2], this.options.loose) : this.semver = e;
    }
    toString() {
      return this.value;
    }
    test(c) {
      if (o("Comparator.test", c, this.options.loose), this.semver === e || c === e)
        return !0;
      if (typeof c == "string")
        try {
          c = new s(c, this.options);
        } catch {
          return !1;
        }
      return a(c, this.operator, this.semver, this.options);
    }
    intersects(c, f) {
      if (!(c instanceof t))
        throw new TypeError("a Comparator is required");
      return this.operator === "" ? this.value === "" ? !0 : new l(c.value, f).test(this.value) : c.operator === "" ? c.value === "" ? !0 : new l(this.value, f).test(c.semver) : (f = r(f), f.includePrerelease && (this.value === "<0.0.0-0" || c.value === "<0.0.0-0") || !f.includePrerelease && (this.value.startsWith("<0.0.0") || c.value.startsWith("<0.0.0")) ? !1 : !!(this.operator.startsWith(">") && c.operator.startsWith(">") || this.operator.startsWith("<") && c.operator.startsWith("<") || this.semver.version === c.semver.version && this.operator.includes("=") && c.operator.includes("=") || a(this.semver, "<", c.semver, f) && this.operator.startsWith(">") && c.operator.startsWith("<") || a(this.semver, ">", c.semver, f) && this.operator.startsWith("<") && c.operator.startsWith(">")));
    }
  }
  Wi = t;
  const r = Va, { safeRe: n, t: i } = en, a = Eu, o = fi, s = Fe, l = Je();
  return Wi;
}
const Hy = Je(), qy = (e, t, r) => {
  try {
    t = new Hy(t, r);
  } catch {
    return !1;
  }
  return t.test(e);
};
var pi = qy;
const Gy = Je(), Wy = (e, t) => new Gy(e, t).set.map((r) => r.map((n) => n.value).join(" ").trim().split(" "));
var zy = Wy;
const Vy = Fe, Yy = Je(), Xy = (e, t, r) => {
  let n = null, i = null, a = null;
  try {
    a = new Yy(t, r);
  } catch {
    return null;
  }
  return e.forEach((o) => {
    a.test(o) && (!n || i.compare(o) === -1) && (n = o, i = new Vy(n, r));
  }), n;
};
var Jy = Xy;
const Ky = Fe, Qy = Je(), Zy = (e, t, r) => {
  let n = null, i = null, a = null;
  try {
    a = new Qy(t, r);
  } catch {
    return null;
  }
  return e.forEach((o) => {
    a.test(o) && (!n || i.compare(o) === 1) && (n = o, i = new Ky(n, r));
  }), n;
};
var ew = Zy;
const zi = Fe, tw = Je(), Cs = di, rw = (e, t) => {
  e = new tw(e, t);
  let r = new zi("0.0.0");
  if (e.test(r) || (r = new zi("0.0.0-0"), e.test(r)))
    return r;
  r = null;
  for (let n = 0; n < e.set.length; ++n) {
    const i = e.set[n];
    let a = null;
    i.forEach((o) => {
      const s = new zi(o.semver.version);
      switch (o.operator) {
        case ">":
          s.prerelease.length === 0 ? s.patch++ : s.prerelease.push(0), s.raw = s.format();
        case "":
        case ">=":
          (!a || Cs(s, a)) && (a = s);
          break;
        case "<":
        case "<=":
          break;
        default:
          throw new Error(`Unexpected operation: ${o.operator}`);
      }
    }), a && (!r || Cs(r, a)) && (r = a);
  }
  return r && e.test(r) ? r : null;
};
var nw = rw;
const iw = Je(), aw = (e, t) => {
  try {
    return new iw(e, t).range || "*";
  } catch {
    return null;
  }
};
var ow = aw;
const sw = Fe, vu = hi(), { ANY: lw } = vu, cw = Je(), uw = pi, $s = di, bs = Xa, fw = Ka, dw = Ja, hw = (e, t, r, n) => {
  e = new sw(e, n), t = new cw(t, n);
  let i, a, o, s, l;
  switch (r) {
    case ">":
      i = $s, a = fw, o = bs, s = ">", l = ">=";
      break;
    case "<":
      i = bs, a = dw, o = $s, s = "<", l = "<=";
      break;
    default:
      throw new TypeError('Must provide a hilo val of "<" or ">"');
  }
  if (uw(e, t, n))
    return !1;
  for (let m = 0; m < t.set.length; ++m) {
    const c = t.set[m];
    let f = null, h = null;
    if (c.forEach((g) => {
      g.semver === lw && (g = new vu(">=0.0.0")), f = f || g, h = h || g, i(g.semver, f.semver, n) ? f = g : o(g.semver, h.semver, n) && (h = g);
    }), f.operator === s || f.operator === l || (!h.operator || h.operator === s) && a(e, h.semver))
      return !1;
    if (h.operator === l && o(e, h.semver))
      return !1;
  }
  return !0;
};
var Qa = hw;
const pw = Qa, mw = (e, t, r) => pw(e, t, ">", r);
var gw = mw;
const yw = Qa, ww = (e, t, r) => yw(e, t, "<", r);
var Ew = ww;
const Is = Je(), vw = (e, t, r) => (e = new Is(e, r), t = new Is(t, r), e.intersects(t, r));
var _w = vw;
const Sw = pi, Aw = Xe;
var Tw = (e, t, r) => {
  const n = [];
  let i = null, a = null;
  const o = e.sort((c, f) => Aw(c, f, r));
  for (const c of o)
    Sw(c, t, r) ? (a = c, i || (i = c)) : (a && n.push([i, a]), a = null, i = null);
  i && n.push([i, null]);
  const s = [];
  for (const [c, f] of n)
    c === f ? s.push(c) : !f && c === o[0] ? s.push("*") : f ? c === o[0] ? s.push(`<=${f}`) : s.push(`${c} - ${f}`) : s.push(`>=${c}`);
  const l = s.join(" || "), m = typeof t.raw == "string" ? t.raw : String(t);
  return l.length < m.length ? l : t;
};
const Os = Je(), Za = hi(), { ANY: Vi } = Za, _r = pi, eo = Xe, Cw = (e, t, r = {}) => {
  if (e === t)
    return !0;
  e = new Os(e, r), t = new Os(t, r);
  let n = !1;
  e: for (const i of e.set) {
    for (const a of t.set) {
      const o = bw(i, a, r);
      if (n = n || o !== null, o)
        continue e;
    }
    if (n)
      return !1;
  }
  return !0;
}, $w = [new Za(">=0.0.0-0")], Ds = [new Za(">=0.0.0")], bw = (e, t, r) => {
  if (e === t)
    return !0;
  if (e.length === 1 && e[0].semver === Vi) {
    if (t.length === 1 && t[0].semver === Vi)
      return !0;
    r.includePrerelease ? e = $w : e = Ds;
  }
  if (t.length === 1 && t[0].semver === Vi) {
    if (r.includePrerelease)
      return !0;
    t = Ds;
  }
  const n = /* @__PURE__ */ new Set();
  let i, a;
  for (const g of e)
    g.operator === ">" || g.operator === ">=" ? i = Ps(i, g, r) : g.operator === "<" || g.operator === "<=" ? a = Ns(a, g, r) : n.add(g.semver);
  if (n.size > 1)
    return null;
  let o;
  if (i && a) {
    if (o = eo(i.semver, a.semver, r), o > 0)
      return null;
    if (o === 0 && (i.operator !== ">=" || a.operator !== "<="))
      return null;
  }
  for (const g of n) {
    if (i && !_r(g, String(i), r) || a && !_r(g, String(a), r))
      return null;
    for (const _ of t)
      if (!_r(g, String(_), r))
        return !1;
    return !0;
  }
  let s, l, m, c, f = a && !r.includePrerelease && a.semver.prerelease.length ? a.semver : !1, h = i && !r.includePrerelease && i.semver.prerelease.length ? i.semver : !1;
  f && f.prerelease.length === 1 && a.operator === "<" && f.prerelease[0] === 0 && (f = !1);
  for (const g of t) {
    if (c = c || g.operator === ">" || g.operator === ">=", m = m || g.operator === "<" || g.operator === "<=", i) {
      if (h && g.semver.prerelease && g.semver.prerelease.length && g.semver.major === h.major && g.semver.minor === h.minor && g.semver.patch === h.patch && (h = !1), g.operator === ">" || g.operator === ">=") {
        if (s = Ps(i, g, r), s === g && s !== i)
          return !1;
      } else if (i.operator === ">=" && !_r(i.semver, String(g), r))
        return !1;
    }
    if (a) {
      if (f && g.semver.prerelease && g.semver.prerelease.length && g.semver.major === f.major && g.semver.minor === f.minor && g.semver.patch === f.patch && (f = !1), g.operator === "<" || g.operator === "<=") {
        if (l = Ns(a, g, r), l === g && l !== a)
          return !1;
      } else if (a.operator === "<=" && !_r(a.semver, String(g), r))
        return !1;
    }
    if (!g.operator && (a || i) && o !== 0)
      return !1;
  }
  return !(i && m && !a && o !== 0 || a && c && !i && o !== 0 || h || f);
}, Ps = (e, t, r) => {
  if (!e)
    return t;
  const n = eo(e.semver, t.semver, r);
  return n > 0 ? e : n < 0 || t.operator === ">" && e.operator === ">=" ? t : e;
}, Ns = (e, t, r) => {
  if (!e)
    return t;
  const n = eo(e.semver, t.semver, r);
  return n < 0 ? e : n > 0 || t.operator === "<" && e.operator === "<=" ? t : e;
};
var Iw = Cw;
const Yi = en, Rs = ui, Ow = Fe, Fs = gu, Dw = fr, Pw = U0, Nw = j0, Rw = H0, Fw = G0, xw = V0, Lw = J0, Uw = Z0, kw = ry, Mw = Xe, jw = oy, Bw = cy, Hw = Ya, qw = hy, Gw = gy, Ww = di, zw = Xa, Vw = yu, Yw = wu, Xw = Ja, Jw = Ka, Kw = Eu, Qw = My, Zw = hi(), eE = Je(), tE = pi, rE = zy, nE = Jy, iE = ew, aE = nw, oE = ow, sE = Qa, lE = gw, cE = Ew, uE = _w, fE = Tw, dE = Iw;
var _u = {
  parse: Dw,
  valid: Pw,
  clean: Nw,
  inc: Rw,
  diff: Fw,
  major: xw,
  minor: Lw,
  patch: Uw,
  prerelease: kw,
  compare: Mw,
  rcompare: jw,
  compareLoose: Bw,
  compareBuild: Hw,
  sort: qw,
  rsort: Gw,
  gt: Ww,
  lt: zw,
  eq: Vw,
  neq: Yw,
  gte: Xw,
  lte: Jw,
  cmp: Kw,
  coerce: Qw,
  Comparator: Zw,
  Range: eE,
  satisfies: tE,
  toComparators: rE,
  maxSatisfying: nE,
  minSatisfying: iE,
  minVersion: aE,
  validRange: oE,
  outside: sE,
  gtr: lE,
  ltr: cE,
  intersects: uE,
  simplifyRange: fE,
  subset: dE,
  SemVer: Ow,
  re: Yi.re,
  src: Yi.src,
  tokens: Yi.t,
  SEMVER_SPEC_VERSION: Rs.SEMVER_SPEC_VERSION,
  RELEASE_TYPES: Rs.RELEASE_TYPES,
  compareIdentifiers: Fs.compareIdentifiers,
  rcompareIdentifiers: Fs.rcompareIdentifiers
}, tn = {}, Jn = { exports: {} };
Jn.exports;
(function(e, t) {
  var r = 200, n = "__lodash_hash_undefined__", i = 1, a = 2, o = 9007199254740991, s = "[object Arguments]", l = "[object Array]", m = "[object AsyncFunction]", c = "[object Boolean]", f = "[object Date]", h = "[object Error]", g = "[object Function]", _ = "[object GeneratorFunction]", w = "[object Map]", S = "[object Number]", T = "[object Null]", A = "[object Object]", R = "[object Promise]", x = "[object Proxy]", re = "[object RegExp]", ce = "[object Set]", X = "[object String]", ke = "[object Symbol]", y = "[object Undefined]", z = "[object WeakMap]", H = "[object ArrayBuffer]", j = "[object DataView]", Q = "[object Float32Array]", O = "[object Float64Array]", b = "[object Int8Array]", P = "[object Int16Array]", $ = "[object Int32Array]", N = "[object Uint8Array]", D = "[object Uint8ClampedArray]", M = "[object Uint16Array]", V = "[object Uint32Array]", q = /[\\^$.*+?()[\]{}|]/g, Z = /^\[object .+?Constructor\]$/, pe = /^(?:0|[1-9]\d*)$/, k = {};
  k[Q] = k[O] = k[b] = k[P] = k[$] = k[N] = k[D] = k[M] = k[V] = !0, k[s] = k[l] = k[H] = k[c] = k[j] = k[f] = k[h] = k[g] = k[w] = k[S] = k[A] = k[re] = k[ce] = k[X] = k[z] = !1;
  var Ke = typeof Ie == "object" && Ie && Ie.Object === Object && Ie, d = typeof self == "object" && self && self.Object === Object && self, u = Ke || d || Function("return this")(), C = t && !t.nodeType && t, v = C && !0 && e && !e.nodeType && e, J = v && v.exports === C, ne = J && Ke.process, se = function() {
    try {
      return ne && ne.binding && ne.binding("util");
    } catch {
    }
  }(), Ee = se && se.isTypedArray;
  function Ae(p, E) {
    for (var I = -1, F = p == null ? 0 : p.length, te = 0, G = []; ++I < F; ) {
      var le = p[I];
      E(le, I, p) && (G[te++] = le);
    }
    return G;
  }
  function lt(p, E) {
    for (var I = -1, F = E.length, te = p.length; ++I < F; )
      p[te + I] = E[I];
    return p;
  }
  function de(p, E) {
    for (var I = -1, F = p == null ? 0 : p.length; ++I < F; )
      if (E(p[I], I, p))
        return !0;
    return !1;
  }
  function We(p, E) {
    for (var I = -1, F = Array(p); ++I < p; )
      F[I] = E(I);
    return F;
  }
  function Ai(p) {
    return function(E) {
      return p(E);
    };
  }
  function ln(p, E) {
    return p.has(E);
  }
  function hr(p, E) {
    return p == null ? void 0 : p[E];
  }
  function cn(p) {
    var E = -1, I = Array(p.size);
    return p.forEach(function(F, te) {
      I[++E] = [te, F];
    }), I;
  }
  function Uu(p, E) {
    return function(I) {
      return p(E(I));
    };
  }
  function ku(p) {
    var E = -1, I = Array(p.size);
    return p.forEach(function(F) {
      I[++E] = F;
    }), I;
  }
  var Mu = Array.prototype, ju = Function.prototype, un = Object.prototype, Ti = u["__core-js_shared__"], io = ju.toString, Qe = un.hasOwnProperty, ao = function() {
    var p = /[^.]+$/.exec(Ti && Ti.keys && Ti.keys.IE_PROTO || "");
    return p ? "Symbol(src)_1." + p : "";
  }(), oo = un.toString, Bu = RegExp(
    "^" + io.call(Qe).replace(q, "\\$&").replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, "$1.*?") + "$"
  ), so = J ? u.Buffer : void 0, fn = u.Symbol, lo = u.Uint8Array, co = un.propertyIsEnumerable, Hu = Mu.splice, $t = fn ? fn.toStringTag : void 0, uo = Object.getOwnPropertySymbols, qu = so ? so.isBuffer : void 0, Gu = Uu(Object.keys, Object), Ci = qt(u, "DataView"), pr = qt(u, "Map"), $i = qt(u, "Promise"), bi = qt(u, "Set"), Ii = qt(u, "WeakMap"), mr = qt(Object, "create"), Wu = Ot(Ci), zu = Ot(pr), Vu = Ot($i), Yu = Ot(bi), Xu = Ot(Ii), fo = fn ? fn.prototype : void 0, Oi = fo ? fo.valueOf : void 0;
  function bt(p) {
    var E = -1, I = p == null ? 0 : p.length;
    for (this.clear(); ++E < I; ) {
      var F = p[E];
      this.set(F[0], F[1]);
    }
  }
  function Ju() {
    this.__data__ = mr ? mr(null) : {}, this.size = 0;
  }
  function Ku(p) {
    var E = this.has(p) && delete this.__data__[p];
    return this.size -= E ? 1 : 0, E;
  }
  function Qu(p) {
    var E = this.__data__;
    if (mr) {
      var I = E[p];
      return I === n ? void 0 : I;
    }
    return Qe.call(E, p) ? E[p] : void 0;
  }
  function Zu(p) {
    var E = this.__data__;
    return mr ? E[p] !== void 0 : Qe.call(E, p);
  }
  function ef(p, E) {
    var I = this.__data__;
    return this.size += this.has(p) ? 0 : 1, I[p] = mr && E === void 0 ? n : E, this;
  }
  bt.prototype.clear = Ju, bt.prototype.delete = Ku, bt.prototype.get = Qu, bt.prototype.has = Zu, bt.prototype.set = ef;
  function rt(p) {
    var E = -1, I = p == null ? 0 : p.length;
    for (this.clear(); ++E < I; ) {
      var F = p[E];
      this.set(F[0], F[1]);
    }
  }
  function tf() {
    this.__data__ = [], this.size = 0;
  }
  function rf(p) {
    var E = this.__data__, I = hn(E, p);
    if (I < 0)
      return !1;
    var F = E.length - 1;
    return I == F ? E.pop() : Hu.call(E, I, 1), --this.size, !0;
  }
  function nf(p) {
    var E = this.__data__, I = hn(E, p);
    return I < 0 ? void 0 : E[I][1];
  }
  function af(p) {
    return hn(this.__data__, p) > -1;
  }
  function of(p, E) {
    var I = this.__data__, F = hn(I, p);
    return F < 0 ? (++this.size, I.push([p, E])) : I[F][1] = E, this;
  }
  rt.prototype.clear = tf, rt.prototype.delete = rf, rt.prototype.get = nf, rt.prototype.has = af, rt.prototype.set = of;
  function It(p) {
    var E = -1, I = p == null ? 0 : p.length;
    for (this.clear(); ++E < I; ) {
      var F = p[E];
      this.set(F[0], F[1]);
    }
  }
  function sf() {
    this.size = 0, this.__data__ = {
      hash: new bt(),
      map: new (pr || rt)(),
      string: new bt()
    };
  }
  function lf(p) {
    var E = pn(this, p).delete(p);
    return this.size -= E ? 1 : 0, E;
  }
  function cf(p) {
    return pn(this, p).get(p);
  }
  function uf(p) {
    return pn(this, p).has(p);
  }
  function ff(p, E) {
    var I = pn(this, p), F = I.size;
    return I.set(p, E), this.size += I.size == F ? 0 : 1, this;
  }
  It.prototype.clear = sf, It.prototype.delete = lf, It.prototype.get = cf, It.prototype.has = uf, It.prototype.set = ff;
  function dn(p) {
    var E = -1, I = p == null ? 0 : p.length;
    for (this.__data__ = new It(); ++E < I; )
      this.add(p[E]);
  }
  function df(p) {
    return this.__data__.set(p, n), this;
  }
  function hf(p) {
    return this.__data__.has(p);
  }
  dn.prototype.add = dn.prototype.push = df, dn.prototype.has = hf;
  function ct(p) {
    var E = this.__data__ = new rt(p);
    this.size = E.size;
  }
  function pf() {
    this.__data__ = new rt(), this.size = 0;
  }
  function mf(p) {
    var E = this.__data__, I = E.delete(p);
    return this.size = E.size, I;
  }
  function gf(p) {
    return this.__data__.get(p);
  }
  function yf(p) {
    return this.__data__.has(p);
  }
  function wf(p, E) {
    var I = this.__data__;
    if (I instanceof rt) {
      var F = I.__data__;
      if (!pr || F.length < r - 1)
        return F.push([p, E]), this.size = ++I.size, this;
      I = this.__data__ = new It(F);
    }
    return I.set(p, E), this.size = I.size, this;
  }
  ct.prototype.clear = pf, ct.prototype.delete = mf, ct.prototype.get = gf, ct.prototype.has = yf, ct.prototype.set = wf;
  function Ef(p, E) {
    var I = mn(p), F = !I && Ff(p), te = !I && !F && Di(p), G = !I && !F && !te && _o(p), le = I || F || te || G, me = le ? We(p.length, String) : [], ve = me.length;
    for (var ie in p)
      Qe.call(p, ie) && !(le && // Safari 9 has enumerable `arguments.length` in strict mode.
      (ie == "length" || // Node.js 0.10 has enumerable non-index properties on buffers.
      te && (ie == "offset" || ie == "parent") || // PhantomJS 2 has enumerable non-index properties on typed arrays.
      G && (ie == "buffer" || ie == "byteLength" || ie == "byteOffset") || // Skip index properties.
      Of(ie, ve))) && me.push(ie);
    return me;
  }
  function hn(p, E) {
    for (var I = p.length; I--; )
      if (yo(p[I][0], E))
        return I;
    return -1;
  }
  function vf(p, E, I) {
    var F = E(p);
    return mn(p) ? F : lt(F, I(p));
  }
  function gr(p) {
    return p == null ? p === void 0 ? y : T : $t && $t in Object(p) ? bf(p) : Rf(p);
  }
  function ho(p) {
    return yr(p) && gr(p) == s;
  }
  function po(p, E, I, F, te) {
    return p === E ? !0 : p == null || E == null || !yr(p) && !yr(E) ? p !== p && E !== E : _f(p, E, I, F, po, te);
  }
  function _f(p, E, I, F, te, G) {
    var le = mn(p), me = mn(E), ve = le ? l : ut(p), ie = me ? l : ut(E);
    ve = ve == s ? A : ve, ie = ie == s ? A : ie;
    var Me = ve == A, ze = ie == A, Te = ve == ie;
    if (Te && Di(p)) {
      if (!Di(E))
        return !1;
      le = !0, Me = !1;
    }
    if (Te && !Me)
      return G || (G = new ct()), le || _o(p) ? mo(p, E, I, F, te, G) : Cf(p, E, ve, I, F, te, G);
    if (!(I & i)) {
      var Be = Me && Qe.call(p, "__wrapped__"), He = ze && Qe.call(E, "__wrapped__");
      if (Be || He) {
        var ft = Be ? p.value() : p, nt = He ? E.value() : E;
        return G || (G = new ct()), te(ft, nt, I, F, G);
      }
    }
    return Te ? (G || (G = new ct()), $f(p, E, I, F, te, G)) : !1;
  }
  function Sf(p) {
    if (!vo(p) || Pf(p))
      return !1;
    var E = wo(p) ? Bu : Z;
    return E.test(Ot(p));
  }
  function Af(p) {
    return yr(p) && Eo(p.length) && !!k[gr(p)];
  }
  function Tf(p) {
    if (!Nf(p))
      return Gu(p);
    var E = [];
    for (var I in Object(p))
      Qe.call(p, I) && I != "constructor" && E.push(I);
    return E;
  }
  function mo(p, E, I, F, te, G) {
    var le = I & i, me = p.length, ve = E.length;
    if (me != ve && !(le && ve > me))
      return !1;
    var ie = G.get(p);
    if (ie && G.get(E))
      return ie == E;
    var Me = -1, ze = !0, Te = I & a ? new dn() : void 0;
    for (G.set(p, E), G.set(E, p); ++Me < me; ) {
      var Be = p[Me], He = E[Me];
      if (F)
        var ft = le ? F(He, Be, Me, E, p, G) : F(Be, He, Me, p, E, G);
      if (ft !== void 0) {
        if (ft)
          continue;
        ze = !1;
        break;
      }
      if (Te) {
        if (!de(E, function(nt, Dt) {
          if (!ln(Te, Dt) && (Be === nt || te(Be, nt, I, F, G)))
            return Te.push(Dt);
        })) {
          ze = !1;
          break;
        }
      } else if (!(Be === He || te(Be, He, I, F, G))) {
        ze = !1;
        break;
      }
    }
    return G.delete(p), G.delete(E), ze;
  }
  function Cf(p, E, I, F, te, G, le) {
    switch (I) {
      case j:
        if (p.byteLength != E.byteLength || p.byteOffset != E.byteOffset)
          return !1;
        p = p.buffer, E = E.buffer;
      case H:
        return !(p.byteLength != E.byteLength || !G(new lo(p), new lo(E)));
      case c:
      case f:
      case S:
        return yo(+p, +E);
      case h:
        return p.name == E.name && p.message == E.message;
      case re:
      case X:
        return p == E + "";
      case w:
        var me = cn;
      case ce:
        var ve = F & i;
        if (me || (me = ku), p.size != E.size && !ve)
          return !1;
        var ie = le.get(p);
        if (ie)
          return ie == E;
        F |= a, le.set(p, E);
        var Me = mo(me(p), me(E), F, te, G, le);
        return le.delete(p), Me;
      case ke:
        if (Oi)
          return Oi.call(p) == Oi.call(E);
    }
    return !1;
  }
  function $f(p, E, I, F, te, G) {
    var le = I & i, me = go(p), ve = me.length, ie = go(E), Me = ie.length;
    if (ve != Me && !le)
      return !1;
    for (var ze = ve; ze--; ) {
      var Te = me[ze];
      if (!(le ? Te in E : Qe.call(E, Te)))
        return !1;
    }
    var Be = G.get(p);
    if (Be && G.get(E))
      return Be == E;
    var He = !0;
    G.set(p, E), G.set(E, p);
    for (var ft = le; ++ze < ve; ) {
      Te = me[ze];
      var nt = p[Te], Dt = E[Te];
      if (F)
        var So = le ? F(Dt, nt, Te, E, p, G) : F(nt, Dt, Te, p, E, G);
      if (!(So === void 0 ? nt === Dt || te(nt, Dt, I, F, G) : So)) {
        He = !1;
        break;
      }
      ft || (ft = Te == "constructor");
    }
    if (He && !ft) {
      var gn = p.constructor, yn = E.constructor;
      gn != yn && "constructor" in p && "constructor" in E && !(typeof gn == "function" && gn instanceof gn && typeof yn == "function" && yn instanceof yn) && (He = !1);
    }
    return G.delete(p), G.delete(E), He;
  }
  function go(p) {
    return vf(p, Uf, If);
  }
  function pn(p, E) {
    var I = p.__data__;
    return Df(E) ? I[typeof E == "string" ? "string" : "hash"] : I.map;
  }
  function qt(p, E) {
    var I = hr(p, E);
    return Sf(I) ? I : void 0;
  }
  function bf(p) {
    var E = Qe.call(p, $t), I = p[$t];
    try {
      p[$t] = void 0;
      var F = !0;
    } catch {
    }
    var te = oo.call(p);
    return F && (E ? p[$t] = I : delete p[$t]), te;
  }
  var If = uo ? function(p) {
    return p == null ? [] : (p = Object(p), Ae(uo(p), function(E) {
      return co.call(p, E);
    }));
  } : kf, ut = gr;
  (Ci && ut(new Ci(new ArrayBuffer(1))) != j || pr && ut(new pr()) != w || $i && ut($i.resolve()) != R || bi && ut(new bi()) != ce || Ii && ut(new Ii()) != z) && (ut = function(p) {
    var E = gr(p), I = E == A ? p.constructor : void 0, F = I ? Ot(I) : "";
    if (F)
      switch (F) {
        case Wu:
          return j;
        case zu:
          return w;
        case Vu:
          return R;
        case Yu:
          return ce;
        case Xu:
          return z;
      }
    return E;
  });
  function Of(p, E) {
    return E = E ?? o, !!E && (typeof p == "number" || pe.test(p)) && p > -1 && p % 1 == 0 && p < E;
  }
  function Df(p) {
    var E = typeof p;
    return E == "string" || E == "number" || E == "symbol" || E == "boolean" ? p !== "__proto__" : p === null;
  }
  function Pf(p) {
    return !!ao && ao in p;
  }
  function Nf(p) {
    var E = p && p.constructor, I = typeof E == "function" && E.prototype || un;
    return p === I;
  }
  function Rf(p) {
    return oo.call(p);
  }
  function Ot(p) {
    if (p != null) {
      try {
        return io.call(p);
      } catch {
      }
      try {
        return p + "";
      } catch {
      }
    }
    return "";
  }
  function yo(p, E) {
    return p === E || p !== p && E !== E;
  }
  var Ff = ho(/* @__PURE__ */ function() {
    return arguments;
  }()) ? ho : function(p) {
    return yr(p) && Qe.call(p, "callee") && !co.call(p, "callee");
  }, mn = Array.isArray;
  function xf(p) {
    return p != null && Eo(p.length) && !wo(p);
  }
  var Di = qu || Mf;
  function Lf(p, E) {
    return po(p, E);
  }
  function wo(p) {
    if (!vo(p))
      return !1;
    var E = gr(p);
    return E == g || E == _ || E == m || E == x;
  }
  function Eo(p) {
    return typeof p == "number" && p > -1 && p % 1 == 0 && p <= o;
  }
  function vo(p) {
    var E = typeof p;
    return p != null && (E == "object" || E == "function");
  }
  function yr(p) {
    return p != null && typeof p == "object";
  }
  var _o = Ee ? Ai(Ee) : Af;
  function Uf(p) {
    return xf(p) ? Ef(p) : Tf(p);
  }
  function kf() {
    return [];
  }
  function Mf() {
    return !1;
  }
  e.exports = Lf;
})(Jn, Jn.exports);
var hE = Jn.exports;
Object.defineProperty(tn, "__esModule", { value: !0 });
tn.DownloadedUpdateHelper = void 0;
tn.createTempUpdateFile = wE;
const pE = Yr, mE = At, xs = hE, Nt = Tt, Or = oe;
class gE {
  constructor(t) {
    this.cacheDir = t, this._file = null, this._packageFile = null, this.versionInfo = null, this.fileInfo = null, this._downloadedFileInfo = null;
  }
  get downloadedFileInfo() {
    return this._downloadedFileInfo;
  }
  get file() {
    return this._file;
  }
  get packageFile() {
    return this._packageFile;
  }
  get cacheDirForPendingUpdate() {
    return Or.join(this.cacheDir, "pending");
  }
  async validateDownloadedPath(t, r, n, i) {
    if (this.versionInfo != null && this.file === t && this.fileInfo != null)
      return xs(this.versionInfo, r) && xs(this.fileInfo.info, n.info) && await (0, Nt.pathExists)(t) ? t : null;
    const a = await this.getValidCachedUpdateFile(n, i);
    return a === null ? null : (i.info(`Update has already been downloaded to ${t}).`), this._file = a, a);
  }
  async setDownloadedFile(t, r, n, i, a, o) {
    this._file = t, this._packageFile = r, this.versionInfo = n, this.fileInfo = i, this._downloadedFileInfo = {
      fileName: a,
      sha512: i.info.sha512,
      isAdminRightsRequired: i.info.isAdminRightsRequired === !0
    }, o && await (0, Nt.outputJson)(this.getUpdateInfoFile(), this._downloadedFileInfo);
  }
  async clear() {
    this._file = null, this._packageFile = null, this.versionInfo = null, this.fileInfo = null, await this.cleanCacheDirForPendingUpdate();
  }
  async cleanCacheDirForPendingUpdate() {
    try {
      await (0, Nt.emptyDir)(this.cacheDirForPendingUpdate);
    } catch {
    }
  }
  /**
   * Returns "update-info.json" which is created in the update cache directory's "pending" subfolder after the first update is downloaded.  If the update file does not exist then the cache is cleared and recreated.  If the update file exists then its properties are validated.
   * @param fileInfo
   * @param logger
   */
  async getValidCachedUpdateFile(t, r) {
    const n = this.getUpdateInfoFile();
    if (!await (0, Nt.pathExists)(n))
      return null;
    let a;
    try {
      a = await (0, Nt.readJson)(n);
    } catch (m) {
      let c = "No cached update info available";
      return m.code !== "ENOENT" && (await this.cleanCacheDirForPendingUpdate(), c += ` (error on read: ${m.message})`), r.info(c), null;
    }
    if (!((a == null ? void 0 : a.fileName) !== null))
      return r.warn("Cached update info is corrupted: no fileName, directory for cached update will be cleaned"), await this.cleanCacheDirForPendingUpdate(), null;
    if (t.info.sha512 !== a.sha512)
      return r.info(`Cached update sha512 checksum doesn't match the latest available update. New update must be downloaded. Cached: ${a.sha512}, expected: ${t.info.sha512}. Directory for cached update will be cleaned`), await this.cleanCacheDirForPendingUpdate(), null;
    const s = Or.join(this.cacheDirForPendingUpdate, a.fileName);
    if (!await (0, Nt.pathExists)(s))
      return r.info("Cached update file doesn't exist"), null;
    const l = await yE(s);
    return t.info.sha512 !== l ? (r.warn(`Sha512 checksum doesn't match the latest available update. New update must be downloaded. Cached: ${l}, expected: ${t.info.sha512}`), await this.cleanCacheDirForPendingUpdate(), null) : (this._downloadedFileInfo = a, s);
  }
  getUpdateInfoFile() {
    return Or.join(this.cacheDirForPendingUpdate, "update-info.json");
  }
}
tn.DownloadedUpdateHelper = gE;
function yE(e, t = "sha512", r = "base64", n) {
  return new Promise((i, a) => {
    const o = (0, pE.createHash)(t);
    o.on("error", a).setEncoding(r), (0, mE.createReadStream)(e, {
      ...n,
      highWaterMark: 1024 * 1024
      /* better to use more memory but hash faster */
    }).on("error", a).on("end", () => {
      o.end(), i(o.read());
    }).pipe(o, { end: !1 });
  });
}
async function wE(e, t, r) {
  let n = 0, i = Or.join(t, e);
  for (let a = 0; a < 3; a++)
    try {
      return await (0, Nt.unlink)(i), i;
    } catch (o) {
      if (o.code === "ENOENT")
        return i;
      r.warn(`Error on remove temp update file: ${o}`), i = Or.join(t, `${n++}-${e}`);
    }
  return i;
}
var mi = {}, to = {};
Object.defineProperty(to, "__esModule", { value: !0 });
to.getAppCacheDir = vE;
const Xi = oe, EE = ei;
function vE() {
  const e = (0, EE.homedir)();
  let t;
  return process.platform === "win32" ? t = process.env.LOCALAPPDATA || Xi.join(e, "AppData", "Local") : process.platform === "darwin" ? t = Xi.join(e, "Library", "Caches") : t = process.env.XDG_CACHE_HOME || Xi.join(e, ".cache"), t;
}
Object.defineProperty(mi, "__esModule", { value: !0 });
mi.ElectronAppAdapter = void 0;
const Ls = oe, _E = to;
class SE {
  constructor(t = kt.app) {
    this.app = t;
  }
  whenReady() {
    return this.app.whenReady();
  }
  get version() {
    return this.app.getVersion();
  }
  get name() {
    return this.app.getName();
  }
  get isPackaged() {
    return this.app.isPackaged === !0;
  }
  get appUpdateConfigPath() {
    return this.isPackaged ? Ls.join(process.resourcesPath, "app-update.yml") : Ls.join(this.app.getAppPath(), "dev-app-update.yml");
  }
  get userDataPath() {
    return this.app.getPath("userData");
  }
  get baseCachePath() {
    return (0, _E.getAppCacheDir)();
  }
  quit() {
    this.app.quit();
  }
  relaunch() {
    this.app.relaunch();
  }
  onQuit(t) {
    this.app.once("quit", (r, n) => t(n));
  }
}
mi.ElectronAppAdapter = SE;
var Su = {};
(function(e) {
  Object.defineProperty(e, "__esModule", { value: !0 }), e.ElectronHttpExecutor = e.NET_SESSION_NAME = void 0, e.getNetSession = r;
  const t = we;
  e.NET_SESSION_NAME = "electron-updater";
  function r() {
    return kt.session.fromPartition(e.NET_SESSION_NAME, {
      cache: !1
    });
  }
  class n extends t.HttpExecutor {
    constructor(a) {
      super(), this.proxyLoginCallback = a, this.cachedSession = null;
    }
    async download(a, o, s) {
      return await s.cancellationToken.createPromise((l, m, c) => {
        const f = {
          headers: s.headers || void 0,
          redirect: "manual"
        };
        (0, t.configureRequestUrl)(a, f), (0, t.configureRequestOptions)(f), this.doDownload(f, {
          destination: o,
          options: s,
          onCancel: c,
          callback: (h) => {
            h == null ? l(o) : m(h);
          },
          responseHandler: null
        }, 0);
      });
    }
    createRequest(a, o) {
      a.headers && a.headers.Host && (a.host = a.headers.Host, delete a.headers.Host), this.cachedSession == null && (this.cachedSession = r());
      const s = kt.net.request({
        ...a,
        session: this.cachedSession
      });
      return s.on("response", o), this.proxyLoginCallback != null && s.on("login", this.proxyLoginCallback), s;
    }
    addRedirectHandlers(a, o, s, l, m) {
      a.on("redirect", (c, f, h) => {
        a.abort(), l > this.maxRedirects ? s(this.createMaxRedirectError()) : m(t.HttpExecutor.prepareRedirectUrlOptions(h, o));
      });
    }
  }
  e.ElectronHttpExecutor = n;
})(Su);
var rn = {}, Ge = {}, AE = "[object Symbol]", Au = /[\\^$.*+?()[\]{}|]/g, TE = RegExp(Au.source), CE = typeof Ie == "object" && Ie && Ie.Object === Object && Ie, $E = typeof self == "object" && self && self.Object === Object && self, bE = CE || $E || Function("return this")(), IE = Object.prototype, OE = IE.toString, Us = bE.Symbol, ks = Us ? Us.prototype : void 0, Ms = ks ? ks.toString : void 0;
function DE(e) {
  if (typeof e == "string")
    return e;
  if (NE(e))
    return Ms ? Ms.call(e) : "";
  var t = e + "";
  return t == "0" && 1 / e == -1 / 0 ? "-0" : t;
}
function PE(e) {
  return !!e && typeof e == "object";
}
function NE(e) {
  return typeof e == "symbol" || PE(e) && OE.call(e) == AE;
}
function RE(e) {
  return e == null ? "" : DE(e);
}
function FE(e) {
  return e = RE(e), e && TE.test(e) ? e.replace(Au, "\\$&") : e;
}
var xE = FE;
Object.defineProperty(Ge, "__esModule", { value: !0 });
Ge.newBaseUrl = UE;
Ge.newUrlFromBase = _a;
Ge.getChannelFilename = kE;
Ge.blockmapFiles = ME;
const Tu = lr, LE = xE;
function UE(e) {
  const t = new Tu.URL(e);
  return t.pathname.endsWith("/") || (t.pathname += "/"), t;
}
function _a(e, t, r = !1) {
  const n = new Tu.URL(e, t), i = t.search;
  return i != null && i.length !== 0 ? n.search = i : r && (n.search = `noCache=${Date.now().toString(32)}`), n;
}
function kE(e) {
  return `${e}.yml`;
}
function ME(e, t, r) {
  const n = _a(`${e.pathname}.blockmap`, e);
  return [_a(`${e.pathname.replace(new RegExp(LE(r), "g"), t)}.blockmap`, e), n];
}
var he = {};
Object.defineProperty(he, "__esModule", { value: !0 });
he.Provider = void 0;
he.findFile = HE;
he.parseUpdateInfo = qE;
he.getFileList = Cu;
he.resolveFiles = GE;
const _t = we, jE = Se, js = Ge;
class BE {
  constructor(t) {
    this.runtimeOptions = t, this.requestHeaders = null, this.executor = t.executor;
  }
  get isUseMultipleRangeRequest() {
    return this.runtimeOptions.isUseMultipleRangeRequest !== !1;
  }
  getChannelFilePrefix() {
    if (this.runtimeOptions.platform === "linux") {
      const t = process.env.TEST_UPDATER_ARCH || process.arch;
      return "-linux" + (t === "x64" ? "" : `-${t}`);
    } else
      return this.runtimeOptions.platform === "darwin" ? "-mac" : "";
  }
  // due to historical reasons for windows we use channel name without platform specifier
  getDefaultChannelName() {
    return this.getCustomChannelName("latest");
  }
  getCustomChannelName(t) {
    return `${t}${this.getChannelFilePrefix()}`;
  }
  get fileExtraDownloadHeaders() {
    return null;
  }
  setRequestHeaders(t) {
    this.requestHeaders = t;
  }
  /**
   * Method to perform API request only to resolve update info, but not to download update.
   */
  httpRequest(t, r, n) {
    return this.executor.request(this.createRequestOptions(t, r), n);
  }
  createRequestOptions(t, r) {
    const n = {};
    return this.requestHeaders == null ? r != null && (n.headers = r) : n.headers = r == null ? this.requestHeaders : { ...this.requestHeaders, ...r }, (0, _t.configureRequestUrl)(t, n), n;
  }
}
he.Provider = BE;
function HE(e, t, r) {
  if (e.length === 0)
    throw (0, _t.newError)("No files provided", "ERR_UPDATER_NO_FILES_PROVIDED");
  const n = e.find((i) => i.url.pathname.toLowerCase().endsWith(`.${t}`));
  return n ?? (r == null ? e[0] : e.find((i) => !r.some((a) => i.url.pathname.toLowerCase().endsWith(`.${a}`))));
}
function qE(e, t, r) {
  if (e == null)
    throw (0, _t.newError)(`Cannot parse update info from ${t} in the latest release artifacts (${r}): rawData: null`, "ERR_UPDATER_INVALID_UPDATE_INFO");
  let n;
  try {
    n = (0, jE.load)(e);
  } catch (i) {
    throw (0, _t.newError)(`Cannot parse update info from ${t} in the latest release artifacts (${r}): ${i.stack || i.message}, rawData: ${e}`, "ERR_UPDATER_INVALID_UPDATE_INFO");
  }
  return n;
}
function Cu(e) {
  const t = e.files;
  if (t != null && t.length > 0)
    return t;
  if (e.path != null)
    return [
      {
        url: e.path,
        sha2: e.sha2,
        sha512: e.sha512
      }
    ];
  throw (0, _t.newError)(`No files provided: ${(0, _t.safeStringifyJson)(e)}`, "ERR_UPDATER_NO_FILES_PROVIDED");
}
function GE(e, t, r = (n) => n) {
  const i = Cu(e).map((s) => {
    if (s.sha2 == null && s.sha512 == null)
      throw (0, _t.newError)(`Update info doesn't contain nor sha256 neither sha512 checksum: ${(0, _t.safeStringifyJson)(s)}`, "ERR_UPDATER_NO_CHECKSUM");
    return {
      url: (0, js.newUrlFromBase)(r(s.url), t),
      info: s
    };
  }), a = e.packages, o = a == null ? null : a[process.arch] || a.ia32;
  return o != null && (i[0].packageInfo = {
    ...o,
    path: (0, js.newUrlFromBase)(r(o.path), t).href
  }), i;
}
Object.defineProperty(rn, "__esModule", { value: !0 });
rn.GenericProvider = void 0;
const Bs = we, Ji = Ge, Ki = he;
class WE extends Ki.Provider {
  constructor(t, r, n) {
    super(n), this.configuration = t, this.updater = r, this.baseUrl = (0, Ji.newBaseUrl)(this.configuration.url);
  }
  get channel() {
    const t = this.updater.channel || this.configuration.channel;
    return t == null ? this.getDefaultChannelName() : this.getCustomChannelName(t);
  }
  async getLatestVersion() {
    const t = (0, Ji.getChannelFilename)(this.channel), r = (0, Ji.newUrlFromBase)(t, this.baseUrl, this.updater.isAddNoCacheQuery);
    for (let n = 0; ; n++)
      try {
        return (0, Ki.parseUpdateInfo)(await this.httpRequest(r), t, r);
      } catch (i) {
        if (i instanceof Bs.HttpError && i.statusCode === 404)
          throw (0, Bs.newError)(`Cannot find channel "${t}" update info: ${i.stack || i.message}`, "ERR_UPDATER_CHANNEL_FILE_NOT_FOUND");
        if (i.code === "ECONNREFUSED" && n < 3) {
          await new Promise((a, o) => {
            try {
              setTimeout(a, 1e3 * n);
            } catch (s) {
              o(s);
            }
          });
          continue;
        }
        throw i;
      }
  }
  resolveFiles(t) {
    return (0, Ki.resolveFiles)(t, this.baseUrl);
  }
}
rn.GenericProvider = WE;
var gi = {}, yi = {};
Object.defineProperty(yi, "__esModule", { value: !0 });
yi.BitbucketProvider = void 0;
const Hs = we, Qi = Ge, Zi = he;
class zE extends Zi.Provider {
  constructor(t, r, n) {
    super({
      ...n,
      isUseMultipleRangeRequest: !1
    }), this.configuration = t, this.updater = r;
    const { owner: i, slug: a } = t;
    this.baseUrl = (0, Qi.newBaseUrl)(`https://api.bitbucket.org/2.0/repositories/${i}/${a}/downloads`);
  }
  get channel() {
    return this.updater.channel || this.configuration.channel || "latest";
  }
  async getLatestVersion() {
    const t = new Hs.CancellationToken(), r = (0, Qi.getChannelFilename)(this.getCustomChannelName(this.channel)), n = (0, Qi.newUrlFromBase)(r, this.baseUrl, this.updater.isAddNoCacheQuery);
    try {
      const i = await this.httpRequest(n, void 0, t);
      return (0, Zi.parseUpdateInfo)(i, r, n);
    } catch (i) {
      throw (0, Hs.newError)(`Unable to find latest version on ${this.toString()}, please ensure release exists: ${i.stack || i.message}`, "ERR_UPDATER_LATEST_VERSION_NOT_FOUND");
    }
  }
  resolveFiles(t) {
    return (0, Zi.resolveFiles)(t, this.baseUrl);
  }
  toString() {
    const { owner: t, slug: r } = this.configuration;
    return `Bitbucket (owner: ${t}, slug: ${r}, channel: ${this.channel})`;
  }
}
yi.BitbucketProvider = zE;
var St = {};
Object.defineProperty(St, "__esModule", { value: !0 });
St.GitHubProvider = St.BaseGitHubProvider = void 0;
St.computeReleaseNotes = bu;
const it = we, Zt = _u, VE = lr, er = Ge, Sa = he, ea = /\/tag\/([^/]+)$/;
class $u extends Sa.Provider {
  constructor(t, r, n) {
    super({
      ...n,
      /* because GitHib uses S3 */
      isUseMultipleRangeRequest: !1
    }), this.options = t, this.baseUrl = (0, er.newBaseUrl)((0, it.githubUrl)(t, r));
    const i = r === "github.com" ? "api.github.com" : r;
    this.baseApiUrl = (0, er.newBaseUrl)((0, it.githubUrl)(t, i));
  }
  computeGithubBasePath(t) {
    const r = this.options.host;
    return r && !["github.com", "api.github.com"].includes(r) ? `/api/v3${t}` : t;
  }
}
St.BaseGitHubProvider = $u;
class YE extends $u {
  constructor(t, r, n) {
    super(t, "github.com", n), this.options = t, this.updater = r;
  }
  get channel() {
    const t = this.updater.channel || this.options.channel;
    return t == null ? this.getDefaultChannelName() : this.getCustomChannelName(t);
  }
  async getLatestVersion() {
    var t, r, n, i, a;
    const o = new it.CancellationToken(), s = await this.httpRequest((0, er.newUrlFromBase)(`${this.basePath}.atom`, this.baseUrl), {
      accept: "application/xml, application/atom+xml, text/xml, */*"
    }, o), l = (0, it.parseXml)(s);
    let m = l.element("entry", !1, "No published versions on GitHub"), c = null;
    try {
      if (this.updater.allowPrerelease) {
        const S = ((t = this.updater) === null || t === void 0 ? void 0 : t.channel) || ((r = Zt.prerelease(this.updater.currentVersion)) === null || r === void 0 ? void 0 : r[0]) || null;
        if (S === null)
          c = ea.exec(m.element("link").attribute("href"))[1];
        else
          for (const T of l.getElements("entry")) {
            const A = ea.exec(T.element("link").attribute("href"));
            if (A === null)
              continue;
            const R = A[1], x = ((n = Zt.prerelease(R)) === null || n === void 0 ? void 0 : n[0]) || null, re = !S || ["alpha", "beta"].includes(S), ce = x !== null && !["alpha", "beta"].includes(String(x));
            if (re && !ce && !(S === "beta" && x === "alpha")) {
              c = R;
              break;
            }
            if (x && x === S) {
              c = R;
              break;
            }
          }
      } else {
        c = await this.getLatestTagName(o);
        for (const S of l.getElements("entry"))
          if (ea.exec(S.element("link").attribute("href"))[1] === c) {
            m = S;
            break;
          }
      }
    } catch (S) {
      throw (0, it.newError)(`Cannot parse releases feed: ${S.stack || S.message},
XML:
${s}`, "ERR_UPDATER_INVALID_RELEASE_FEED");
    }
    if (c == null)
      throw (0, it.newError)("No published versions on GitHub", "ERR_UPDATER_NO_PUBLISHED_VERSIONS");
    let f, h = "", g = "";
    const _ = async (S) => {
      h = (0, er.getChannelFilename)(S), g = (0, er.newUrlFromBase)(this.getBaseDownloadPath(String(c), h), this.baseUrl);
      const T = this.createRequestOptions(g);
      try {
        return await this.executor.request(T, o);
      } catch (A) {
        throw A instanceof it.HttpError && A.statusCode === 404 ? (0, it.newError)(`Cannot find ${h} in the latest release artifacts (${g}): ${A.stack || A.message}`, "ERR_UPDATER_CHANNEL_FILE_NOT_FOUND") : A;
      }
    };
    try {
      let S = this.channel;
      this.updater.allowPrerelease && (!((i = Zt.prerelease(c)) === null || i === void 0) && i[0]) && (S = this.getCustomChannelName(String((a = Zt.prerelease(c)) === null || a === void 0 ? void 0 : a[0]))), f = await _(S);
    } catch (S) {
      if (this.updater.allowPrerelease)
        f = await _(this.getDefaultChannelName());
      else
        throw S;
    }
    const w = (0, Sa.parseUpdateInfo)(f, h, g);
    return w.releaseName == null && (w.releaseName = m.elementValueOrEmpty("title")), w.releaseNotes == null && (w.releaseNotes = bu(this.updater.currentVersion, this.updater.fullChangelog, l, m)), {
      tag: c,
      ...w
    };
  }
  async getLatestTagName(t) {
    const r = this.options, n = r.host == null || r.host === "github.com" ? (0, er.newUrlFromBase)(`${this.basePath}/latest`, this.baseUrl) : new VE.URL(`${this.computeGithubBasePath(`/repos/${r.owner}/${r.repo}/releases`)}/latest`, this.baseApiUrl);
    try {
      const i = await this.httpRequest(n, { Accept: "application/json" }, t);
      return i == null ? null : JSON.parse(i).tag_name;
    } catch (i) {
      throw (0, it.newError)(`Unable to find latest version on GitHub (${n}), please ensure a production release exists: ${i.stack || i.message}`, "ERR_UPDATER_LATEST_VERSION_NOT_FOUND");
    }
  }
  get basePath() {
    return `/${this.options.owner}/${this.options.repo}/releases`;
  }
  resolveFiles(t) {
    return (0, Sa.resolveFiles)(t, this.baseUrl, (r) => this.getBaseDownloadPath(t.tag, r.replace(/ /g, "-")));
  }
  getBaseDownloadPath(t, r) {
    return `${this.basePath}/download/${t}/${r}`;
  }
}
St.GitHubProvider = YE;
function qs(e) {
  const t = e.elementValueOrEmpty("content");
  return t === "No content." ? "" : t;
}
function bu(e, t, r, n) {
  if (!t)
    return qs(n);
  const i = [];
  for (const a of r.getElements("entry")) {
    const o = /\/tag\/v?([^/]+)$/.exec(a.element("link").attribute("href"))[1];
    Zt.lt(e, o) && i.push({
      version: o,
      note: qs(a)
    });
  }
  return i.sort((a, o) => Zt.rcompare(a.version, o.version));
}
var wi = {};
Object.defineProperty(wi, "__esModule", { value: !0 });
wi.KeygenProvider = void 0;
const Gs = we, ta = Ge, ra = he;
class XE extends ra.Provider {
  constructor(t, r, n) {
    super({
      ...n,
      isUseMultipleRangeRequest: !1
    }), this.configuration = t, this.updater = r, this.defaultHostname = "api.keygen.sh";
    const i = this.configuration.host || this.defaultHostname;
    this.baseUrl = (0, ta.newBaseUrl)(`https://${i}/v1/accounts/${this.configuration.account}/artifacts?product=${this.configuration.product}`);
  }
  get channel() {
    return this.updater.channel || this.configuration.channel || "stable";
  }
  async getLatestVersion() {
    const t = new Gs.CancellationToken(), r = (0, ta.getChannelFilename)(this.getCustomChannelName(this.channel)), n = (0, ta.newUrlFromBase)(r, this.baseUrl, this.updater.isAddNoCacheQuery);
    try {
      const i = await this.httpRequest(n, {
        Accept: "application/vnd.api+json",
        "Keygen-Version": "1.1"
      }, t);
      return (0, ra.parseUpdateInfo)(i, r, n);
    } catch (i) {
      throw (0, Gs.newError)(`Unable to find latest version on ${this.toString()}, please ensure release exists: ${i.stack || i.message}`, "ERR_UPDATER_LATEST_VERSION_NOT_FOUND");
    }
  }
  resolveFiles(t) {
    return (0, ra.resolveFiles)(t, this.baseUrl);
  }
  toString() {
    const { account: t, product: r, platform: n } = this.configuration;
    return `Keygen (account: ${t}, product: ${r}, platform: ${n}, channel: ${this.channel})`;
  }
}
wi.KeygenProvider = XE;
var Ei = {};
Object.defineProperty(Ei, "__esModule", { value: !0 });
Ei.PrivateGitHubProvider = void 0;
const zt = we, JE = Se, KE = oe, Ws = lr, zs = Ge, QE = St, ZE = he;
class ev extends QE.BaseGitHubProvider {
  constructor(t, r, n, i) {
    super(t, "api.github.com", i), this.updater = r, this.token = n;
  }
  createRequestOptions(t, r) {
    const n = super.createRequestOptions(t, r);
    return n.redirect = "manual", n;
  }
  async getLatestVersion() {
    const t = new zt.CancellationToken(), r = (0, zs.getChannelFilename)(this.getDefaultChannelName()), n = await this.getLatestVersionInfo(t), i = n.assets.find((s) => s.name === r);
    if (i == null)
      throw (0, zt.newError)(`Cannot find ${r} in the release ${n.html_url || n.name}`, "ERR_UPDATER_CHANNEL_FILE_NOT_FOUND");
    const a = new Ws.URL(i.url);
    let o;
    try {
      o = (0, JE.load)(await this.httpRequest(a, this.configureHeaders("application/octet-stream"), t));
    } catch (s) {
      throw s instanceof zt.HttpError && s.statusCode === 404 ? (0, zt.newError)(`Cannot find ${r} in the latest release artifacts (${a}): ${s.stack || s.message}`, "ERR_UPDATER_CHANNEL_FILE_NOT_FOUND") : s;
    }
    return o.assets = n.assets, o;
  }
  get fileExtraDownloadHeaders() {
    return this.configureHeaders("application/octet-stream");
  }
  configureHeaders(t) {
    return {
      accept: t,
      authorization: `token ${this.token}`
    };
  }
  async getLatestVersionInfo(t) {
    const r = this.updater.allowPrerelease;
    let n = this.basePath;
    r || (n = `${n}/latest`);
    const i = (0, zs.newUrlFromBase)(n, this.baseUrl);
    try {
      const a = JSON.parse(await this.httpRequest(i, this.configureHeaders("application/vnd.github.v3+json"), t));
      return r ? a.find((o) => o.prerelease) || a[0] : a;
    } catch (a) {
      throw (0, zt.newError)(`Unable to find latest version on GitHub (${i}), please ensure a production release exists: ${a.stack || a.message}`, "ERR_UPDATER_LATEST_VERSION_NOT_FOUND");
    }
  }
  get basePath() {
    return this.computeGithubBasePath(`/repos/${this.options.owner}/${this.options.repo}/releases`);
  }
  resolveFiles(t) {
    return (0, ZE.getFileList)(t).map((r) => {
      const n = KE.posix.basename(r.url).replace(/ /g, "-"), i = t.assets.find((a) => a != null && a.name === n);
      if (i == null)
        throw (0, zt.newError)(`Cannot find asset "${n}" in: ${JSON.stringify(t.assets, null, 2)}`, "ERR_UPDATER_ASSET_NOT_FOUND");
      return {
        url: new Ws.URL(i.url),
        info: r
      };
    });
  }
}
Ei.PrivateGitHubProvider = ev;
Object.defineProperty(gi, "__esModule", { value: !0 });
gi.isUrlProbablySupportMultiRangeRequests = Iu;
gi.createClient = av;
const Dn = we, tv = yi, Vs = rn, rv = St, nv = wi, iv = Ei;
function Iu(e) {
  return !e.includes("s3.amazonaws.com");
}
function av(e, t, r) {
  if (typeof e == "string")
    throw (0, Dn.newError)("Please pass PublishConfiguration object", "ERR_UPDATER_INVALID_PROVIDER_CONFIGURATION");
  const n = e.provider;
  switch (n) {
    case "github": {
      const i = e, a = (i.private ? process.env.GH_TOKEN || process.env.GITHUB_TOKEN : null) || i.token;
      return a == null ? new rv.GitHubProvider(i, t, r) : new iv.PrivateGitHubProvider(i, t, a, r);
    }
    case "bitbucket":
      return new tv.BitbucketProvider(e, t, r);
    case "keygen":
      return new nv.KeygenProvider(e, t, r);
    case "s3":
    case "spaces":
      return new Vs.GenericProvider({
        provider: "generic",
        url: (0, Dn.getS3LikeProviderBaseUrl)(e),
        channel: e.channel || null
      }, t, {
        ...r,
        // https://github.com/minio/minio/issues/5285#issuecomment-350428955
        isUseMultipleRangeRequest: !1
      });
    case "generic": {
      const i = e;
      return new Vs.GenericProvider(i, t, {
        ...r,
        isUseMultipleRangeRequest: i.useMultipleRangeRequest !== !1 && Iu(i.url)
      });
    }
    case "custom": {
      const i = e, a = i.updateProvider;
      if (!a)
        throw (0, Dn.newError)("Custom provider not specified", "ERR_UPDATER_INVALID_PROVIDER_CONFIGURATION");
      return new a(i, t, r);
    }
    default:
      throw (0, Dn.newError)(`Unsupported provider: ${n}`, "ERR_UPDATER_UNSUPPORTED_PROVIDER");
  }
}
var vi = {}, nn = {}, dr = {}, Ht = {};
Object.defineProperty(Ht, "__esModule", { value: !0 });
Ht.OperationKind = void 0;
Ht.computeOperations = ov;
var xt;
(function(e) {
  e[e.COPY = 0] = "COPY", e[e.DOWNLOAD = 1] = "DOWNLOAD";
})(xt || (Ht.OperationKind = xt = {}));
function ov(e, t, r) {
  const n = Xs(e.files), i = Xs(t.files);
  let a = null;
  const o = t.files[0], s = [], l = o.name, m = n.get(l);
  if (m == null)
    throw new Error(`no file ${l} in old blockmap`);
  const c = i.get(l);
  let f = 0;
  const { checksumToOffset: h, checksumToOldSize: g } = lv(n.get(l), m.offset, r);
  let _ = o.offset;
  for (let w = 0; w < c.checksums.length; _ += c.sizes[w], w++) {
    const S = c.sizes[w], T = c.checksums[w];
    let A = h.get(T);
    A != null && g.get(T) !== S && (r.warn(`Checksum ("${T}") matches, but size differs (old: ${g.get(T)}, new: ${S})`), A = void 0), A === void 0 ? (f++, a != null && a.kind === xt.DOWNLOAD && a.end === _ ? a.end += S : (a = {
      kind: xt.DOWNLOAD,
      start: _,
      end: _ + S
      // oldBlocks: null,
    }, Ys(a, s, T, w))) : a != null && a.kind === xt.COPY && a.end === A ? a.end += S : (a = {
      kind: xt.COPY,
      start: A,
      end: A + S
      // oldBlocks: [checksum]
    }, Ys(a, s, T, w));
  }
  return f > 0 && r.info(`File${o.name === "file" ? "" : " " + o.name} has ${f} changed blocks`), s;
}
const sv = process.env.DIFFERENTIAL_DOWNLOAD_PLAN_BUILDER_VALIDATE_RANGES === "true";
function Ys(e, t, r, n) {
  if (sv && t.length !== 0) {
    const i = t[t.length - 1];
    if (i.kind === e.kind && e.start < i.end && e.start > i.start) {
      const a = [i.start, i.end, e.start, e.end].reduce((o, s) => o < s ? o : s);
      throw new Error(`operation (block index: ${n}, checksum: ${r}, kind: ${xt[e.kind]}) overlaps previous operation (checksum: ${r}):
abs: ${i.start} until ${i.end} and ${e.start} until ${e.end}
rel: ${i.start - a} until ${i.end - a} and ${e.start - a} until ${e.end - a}`);
    }
  }
  t.push(e);
}
function lv(e, t, r) {
  const n = /* @__PURE__ */ new Map(), i = /* @__PURE__ */ new Map();
  let a = t;
  for (let o = 0; o < e.checksums.length; o++) {
    const s = e.checksums[o], l = e.sizes[o], m = i.get(s);
    if (m === void 0)
      n.set(s, a), i.set(s, l);
    else if (r.debug != null) {
      const c = m === l ? "(same size)" : `(size: ${m}, this size: ${l})`;
      r.debug(`${s} duplicated in blockmap ${c}, it doesn't lead to broken differential downloader, just corresponding block will be skipped)`);
    }
    a += l;
  }
  return { checksumToOffset: n, checksumToOldSize: i };
}
function Xs(e) {
  const t = /* @__PURE__ */ new Map();
  for (const r of e)
    t.set(r.name, r);
  return t;
}
Object.defineProperty(dr, "__esModule", { value: !0 });
dr.DataSplitter = void 0;
dr.copyData = Ou;
const Pn = we, cv = At, uv = Vr, fv = Ht, Js = Buffer.from(`\r
\r
`);
var ht;
(function(e) {
  e[e.INIT = 0] = "INIT", e[e.HEADER = 1] = "HEADER", e[e.BODY = 2] = "BODY";
})(ht || (ht = {}));
function Ou(e, t, r, n, i) {
  const a = (0, cv.createReadStream)("", {
    fd: r,
    autoClose: !1,
    start: e.start,
    // end is inclusive
    end: e.end - 1
  });
  a.on("error", n), a.once("end", i), a.pipe(t, {
    end: !1
  });
}
class dv extends uv.Writable {
  constructor(t, r, n, i, a, o) {
    super(), this.out = t, this.options = r, this.partIndexToTaskIndex = n, this.partIndexToLength = a, this.finishHandler = o, this.partIndex = -1, this.headerListBuffer = null, this.readState = ht.INIT, this.ignoreByteCount = 0, this.remainingPartDataCount = 0, this.actualPartLength = 0, this.boundaryLength = i.length + 4, this.ignoreByteCount = this.boundaryLength - 2;
  }
  get isFinished() {
    return this.partIndex === this.partIndexToLength.length;
  }
  // noinspection JSUnusedGlobalSymbols
  _write(t, r, n) {
    if (this.isFinished) {
      console.error(`Trailing ignored data: ${t.length} bytes`);
      return;
    }
    this.handleData(t).then(n).catch(n);
  }
  async handleData(t) {
    let r = 0;
    if (this.ignoreByteCount !== 0 && this.remainingPartDataCount !== 0)
      throw (0, Pn.newError)("Internal error", "ERR_DATA_SPLITTER_BYTE_COUNT_MISMATCH");
    if (this.ignoreByteCount > 0) {
      const n = Math.min(this.ignoreByteCount, t.length);
      this.ignoreByteCount -= n, r = n;
    } else if (this.remainingPartDataCount > 0) {
      const n = Math.min(this.remainingPartDataCount, t.length);
      this.remainingPartDataCount -= n, await this.processPartData(t, 0, n), r = n;
    }
    if (r !== t.length) {
      if (this.readState === ht.HEADER) {
        const n = this.searchHeaderListEnd(t, r);
        if (n === -1)
          return;
        r = n, this.readState = ht.BODY, this.headerListBuffer = null;
      }
      for (; ; ) {
        if (this.readState === ht.BODY)
          this.readState = ht.INIT;
        else {
          this.partIndex++;
          let o = this.partIndexToTaskIndex.get(this.partIndex);
          if (o == null)
            if (this.isFinished)
              o = this.options.end;
            else
              throw (0, Pn.newError)("taskIndex is null", "ERR_DATA_SPLITTER_TASK_INDEX_IS_NULL");
          const s = this.partIndex === 0 ? this.options.start : this.partIndexToTaskIndex.get(this.partIndex - 1) + 1;
          if (s < o)
            await this.copyExistingData(s, o);
          else if (s > o)
            throw (0, Pn.newError)("prevTaskIndex must be < taskIndex", "ERR_DATA_SPLITTER_TASK_INDEX_ASSERT_FAILED");
          if (this.isFinished) {
            this.onPartEnd(), this.finishHandler();
            return;
          }
          if (r = this.searchHeaderListEnd(t, r), r === -1) {
            this.readState = ht.HEADER;
            return;
          }
        }
        const n = this.partIndexToLength[this.partIndex], i = r + n, a = Math.min(i, t.length);
        if (await this.processPartStarted(t, r, a), this.remainingPartDataCount = n - (a - r), this.remainingPartDataCount > 0)
          return;
        if (r = i + this.boundaryLength, r >= t.length) {
          this.ignoreByteCount = this.boundaryLength - (t.length - i);
          return;
        }
      }
    }
  }
  copyExistingData(t, r) {
    return new Promise((n, i) => {
      const a = () => {
        if (t === r) {
          n();
          return;
        }
        const o = this.options.tasks[t];
        if (o.kind !== fv.OperationKind.COPY) {
          i(new Error("Task kind must be COPY"));
          return;
        }
        Ou(o, this.out, this.options.oldFileFd, i, () => {
          t++, a();
        });
      };
      a();
    });
  }
  searchHeaderListEnd(t, r) {
    const n = t.indexOf(Js, r);
    if (n !== -1)
      return n + Js.length;
    const i = r === 0 ? t : t.slice(r);
    return this.headerListBuffer == null ? this.headerListBuffer = i : this.headerListBuffer = Buffer.concat([this.headerListBuffer, i]), -1;
  }
  onPartEnd() {
    const t = this.partIndexToLength[this.partIndex - 1];
    if (this.actualPartLength !== t)
      throw (0, Pn.newError)(`Expected length: ${t} differs from actual: ${this.actualPartLength}`, "ERR_DATA_SPLITTER_LENGTH_MISMATCH");
    this.actualPartLength = 0;
  }
  processPartStarted(t, r, n) {
    return this.partIndex !== 0 && this.onPartEnd(), this.processPartData(t, r, n);
  }
  processPartData(t, r, n) {
    this.actualPartLength += n - r;
    const i = this.out;
    return i.write(r === 0 && t.length === n ? t : t.slice(r, n)) ? Promise.resolve() : new Promise((a, o) => {
      i.on("error", o), i.once("drain", () => {
        i.removeListener("error", o), a();
      });
    });
  }
}
dr.DataSplitter = dv;
var _i = {};
Object.defineProperty(_i, "__esModule", { value: !0 });
_i.executeTasksUsingMultipleRangeRequests = hv;
_i.checkIsRangesSupported = Ta;
const Aa = we, Ks = dr, Qs = Ht;
function hv(e, t, r, n, i) {
  const a = (o) => {
    if (o >= t.length) {
      e.fileMetadataBuffer != null && r.write(e.fileMetadataBuffer), r.end();
      return;
    }
    const s = o + 1e3;
    pv(e, {
      tasks: t,
      start: o,
      end: Math.min(t.length, s),
      oldFileFd: n
    }, r, () => a(s), i);
  };
  return a;
}
function pv(e, t, r, n, i) {
  let a = "bytes=", o = 0;
  const s = /* @__PURE__ */ new Map(), l = [];
  for (let f = t.start; f < t.end; f++) {
    const h = t.tasks[f];
    h.kind === Qs.OperationKind.DOWNLOAD && (a += `${h.start}-${h.end - 1}, `, s.set(o, f), o++, l.push(h.end - h.start));
  }
  if (o <= 1) {
    const f = (h) => {
      if (h >= t.end) {
        n();
        return;
      }
      const g = t.tasks[h++];
      if (g.kind === Qs.OperationKind.COPY)
        (0, Ks.copyData)(g, r, t.oldFileFd, i, () => f(h));
      else {
        const _ = e.createRequestOptions();
        _.headers.Range = `bytes=${g.start}-${g.end - 1}`;
        const w = e.httpExecutor.createRequest(_, (S) => {
          Ta(S, i) && (S.pipe(r, {
            end: !1
          }), S.once("end", () => f(h)));
        });
        e.httpExecutor.addErrorAndTimeoutHandlers(w, i), w.end();
      }
    };
    f(t.start);
    return;
  }
  const m = e.createRequestOptions();
  m.headers.Range = a.substring(0, a.length - 2);
  const c = e.httpExecutor.createRequest(m, (f) => {
    if (!Ta(f, i))
      return;
    const h = (0, Aa.safeGetHeader)(f, "content-type"), g = /^multipart\/.+?(?:; boundary=(?:(?:"(.+)")|(?:([^\s]+))))$/i.exec(h);
    if (g == null) {
      i(new Error(`Content-Type "multipart/byteranges" is expected, but got "${h}"`));
      return;
    }
    const _ = new Ks.DataSplitter(r, t, s, g[1] || g[2], l, n);
    _.on("error", i), f.pipe(_), f.on("end", () => {
      setTimeout(() => {
        c.abort(), i(new Error("Response ends without calling any handlers"));
      }, 1e4);
    });
  });
  e.httpExecutor.addErrorAndTimeoutHandlers(c, i), c.end();
}
function Ta(e, t) {
  if (e.statusCode >= 400)
    return t((0, Aa.createHttpError)(e)), !1;
  if (e.statusCode !== 206) {
    const r = (0, Aa.safeGetHeader)(e, "accept-ranges");
    if (r == null || r === "none")
      return t(new Error(`Server doesn't support Accept-Ranges (response code ${e.statusCode})`)), !1;
  }
  return !0;
}
var Si = {};
Object.defineProperty(Si, "__esModule", { value: !0 });
Si.ProgressDifferentialDownloadCallbackTransform = void 0;
const mv = Vr;
var tr;
(function(e) {
  e[e.COPY = 0] = "COPY", e[e.DOWNLOAD = 1] = "DOWNLOAD";
})(tr || (tr = {}));
class gv extends mv.Transform {
  constructor(t, r, n) {
    super(), this.progressDifferentialDownloadInfo = t, this.cancellationToken = r, this.onProgress = n, this.start = Date.now(), this.transferred = 0, this.delta = 0, this.expectedBytes = 0, this.index = 0, this.operationType = tr.COPY, this.nextUpdate = this.start + 1e3;
  }
  _transform(t, r, n) {
    if (this.cancellationToken.cancelled) {
      n(new Error("cancelled"), null);
      return;
    }
    if (this.operationType == tr.COPY) {
      n(null, t);
      return;
    }
    this.transferred += t.length, this.delta += t.length;
    const i = Date.now();
    i >= this.nextUpdate && this.transferred !== this.expectedBytes && this.transferred !== this.progressDifferentialDownloadInfo.grandTotal && (this.nextUpdate = i + 1e3, this.onProgress({
      total: this.progressDifferentialDownloadInfo.grandTotal,
      delta: this.delta,
      transferred: this.transferred,
      percent: this.transferred / this.progressDifferentialDownloadInfo.grandTotal * 100,
      bytesPerSecond: Math.round(this.transferred / ((i - this.start) / 1e3))
    }), this.delta = 0), n(null, t);
  }
  beginFileCopy() {
    this.operationType = tr.COPY;
  }
  beginRangeDownload() {
    this.operationType = tr.DOWNLOAD, this.expectedBytes += this.progressDifferentialDownloadInfo.expectedByteCounts[this.index++];
  }
  endRangeDownload() {
    this.transferred !== this.progressDifferentialDownloadInfo.grandTotal && this.onProgress({
      total: this.progressDifferentialDownloadInfo.grandTotal,
      delta: this.delta,
      transferred: this.transferred,
      percent: this.transferred / this.progressDifferentialDownloadInfo.grandTotal * 100,
      bytesPerSecond: Math.round(this.transferred / ((Date.now() - this.start) / 1e3))
    });
  }
  // Called when we are 100% done with the connection/download
  _flush(t) {
    if (this.cancellationToken.cancelled) {
      t(new Error("cancelled"));
      return;
    }
    this.onProgress({
      total: this.progressDifferentialDownloadInfo.grandTotal,
      delta: this.delta,
      transferred: this.transferred,
      percent: 100,
      bytesPerSecond: Math.round(this.transferred / ((Date.now() - this.start) / 1e3))
    }), this.delta = 0, this.transferred = 0, t(null);
  }
}
Si.ProgressDifferentialDownloadCallbackTransform = gv;
Object.defineProperty(nn, "__esModule", { value: !0 });
nn.DifferentialDownloader = void 0;
const Sr = we, na = Tt, yv = At, wv = dr, Ev = lr, Nn = Ht, Zs = _i, vv = Si;
class _v {
  // noinspection TypeScriptAbstractClassConstructorCanBeMadeProtected
  constructor(t, r, n) {
    this.blockAwareFileInfo = t, this.httpExecutor = r, this.options = n, this.fileMetadataBuffer = null, this.logger = n.logger;
  }
  createRequestOptions() {
    const t = {
      headers: {
        ...this.options.requestHeaders,
        accept: "*/*"
      }
    };
    return (0, Sr.configureRequestUrl)(this.options.newUrl, t), (0, Sr.configureRequestOptions)(t), t;
  }
  doDownload(t, r) {
    if (t.version !== r.version)
      throw new Error(`version is different (${t.version} - ${r.version}), full download is required`);
    const n = this.logger, i = (0, Nn.computeOperations)(t, r, n);
    n.debug != null && n.debug(JSON.stringify(i, null, 2));
    let a = 0, o = 0;
    for (const l of i) {
      const m = l.end - l.start;
      l.kind === Nn.OperationKind.DOWNLOAD ? a += m : o += m;
    }
    const s = this.blockAwareFileInfo.size;
    if (a + o + (this.fileMetadataBuffer == null ? 0 : this.fileMetadataBuffer.length) !== s)
      throw new Error(`Internal error, size mismatch: downloadSize: ${a}, copySize: ${o}, newSize: ${s}`);
    return n.info(`Full: ${el(s)}, To download: ${el(a)} (${Math.round(a / (s / 100))}%)`), this.downloadFile(i);
  }
  downloadFile(t) {
    const r = [], n = () => Promise.all(r.map((i) => (0, na.close)(i.descriptor).catch((a) => {
      this.logger.error(`cannot close file "${i.path}": ${a}`);
    })));
    return this.doDownloadFile(t, r).then(n).catch((i) => n().catch((a) => {
      try {
        this.logger.error(`cannot close files: ${a}`);
      } catch (o) {
        try {
          console.error(o);
        } catch {
        }
      }
      throw i;
    }).then(() => {
      throw i;
    }));
  }
  async doDownloadFile(t, r) {
    const n = await (0, na.open)(this.options.oldFile, "r");
    r.push({ descriptor: n, path: this.options.oldFile });
    const i = await (0, na.open)(this.options.newFile, "w");
    r.push({ descriptor: i, path: this.options.newFile });
    const a = (0, yv.createWriteStream)(this.options.newFile, { fd: i });
    await new Promise((o, s) => {
      const l = [];
      let m;
      if (!this.options.isUseMultipleRangeRequest && this.options.onProgress) {
        const T = [];
        let A = 0;
        for (const x of t)
          x.kind === Nn.OperationKind.DOWNLOAD && (T.push(x.end - x.start), A += x.end - x.start);
        const R = {
          expectedByteCounts: T,
          grandTotal: A
        };
        m = new vv.ProgressDifferentialDownloadCallbackTransform(R, this.options.cancellationToken, this.options.onProgress), l.push(m);
      }
      const c = new Sr.DigestTransform(this.blockAwareFileInfo.sha512);
      c.isValidateOnEnd = !1, l.push(c), a.on("finish", () => {
        a.close(() => {
          r.splice(1, 1);
          try {
            c.validate();
          } catch (T) {
            s(T);
            return;
          }
          o(void 0);
        });
      }), l.push(a);
      let f = null;
      for (const T of l)
        T.on("error", s), f == null ? f = T : f = f.pipe(T);
      const h = l[0];
      let g;
      if (this.options.isUseMultipleRangeRequest) {
        g = (0, Zs.executeTasksUsingMultipleRangeRequests)(this, t, h, n, s), g(0);
        return;
      }
      let _ = 0, w = null;
      this.logger.info(`Differential download: ${this.options.newUrl}`);
      const S = this.createRequestOptions();
      S.redirect = "manual", g = (T) => {
        var A, R;
        if (T >= t.length) {
          this.fileMetadataBuffer != null && h.write(this.fileMetadataBuffer), h.end();
          return;
        }
        const x = t[T++];
        if (x.kind === Nn.OperationKind.COPY) {
          m && m.beginFileCopy(), (0, wv.copyData)(x, h, n, s, () => g(T));
          return;
        }
        const re = `bytes=${x.start}-${x.end - 1}`;
        S.headers.range = re, (R = (A = this.logger) === null || A === void 0 ? void 0 : A.debug) === null || R === void 0 || R.call(A, `download range: ${re}`), m && m.beginRangeDownload();
        const ce = this.httpExecutor.createRequest(S, (X) => {
          X.on("error", s), X.on("aborted", () => {
            s(new Error("response has been aborted by the server"));
          }), X.statusCode >= 400 && s((0, Sr.createHttpError)(X)), X.pipe(h, {
            end: !1
          }), X.once("end", () => {
            m && m.endRangeDownload(), ++_ === 100 ? (_ = 0, setTimeout(() => g(T), 1e3)) : g(T);
          });
        });
        ce.on("redirect", (X, ke, y) => {
          this.logger.info(`Redirect to ${Sv(y)}`), w = y, (0, Sr.configureRequestUrl)(new Ev.URL(w), S), ce.followRedirect();
        }), this.httpExecutor.addErrorAndTimeoutHandlers(ce, s), ce.end();
      }, g(0);
    });
  }
  async readRemoteBytes(t, r) {
    const n = Buffer.allocUnsafe(r + 1 - t), i = this.createRequestOptions();
    i.headers.range = `bytes=${t}-${r}`;
    let a = 0;
    if (await this.request(i, (o) => {
      o.copy(n, a), a += o.length;
    }), a !== n.length)
      throw new Error(`Received data length ${a} is not equal to expected ${n.length}`);
    return n;
  }
  request(t, r) {
    return new Promise((n, i) => {
      const a = this.httpExecutor.createRequest(t, (o) => {
        (0, Zs.checkIsRangesSupported)(o, i) && (o.on("error", i), o.on("aborted", () => {
          i(new Error("response has been aborted by the server"));
        }), o.on("data", r), o.on("end", () => n()));
      });
      this.httpExecutor.addErrorAndTimeoutHandlers(a, i), a.end();
    });
  }
}
nn.DifferentialDownloader = _v;
function el(e, t = " KB") {
  return new Intl.NumberFormat("en").format((e / 1024).toFixed(2)) + t;
}
function Sv(e) {
  const t = e.indexOf("?");
  return t < 0 ? e : e.substring(0, t);
}
Object.defineProperty(vi, "__esModule", { value: !0 });
vi.GenericDifferentialDownloader = void 0;
const Av = nn;
class Tv extends Av.DifferentialDownloader {
  download(t, r) {
    return this.doDownload(t, r);
  }
}
vi.GenericDifferentialDownloader = Tv;
var Ct = {};
(function(e) {
  Object.defineProperty(e, "__esModule", { value: !0 }), e.UpdaterSignal = e.UPDATE_DOWNLOADED = e.DOWNLOAD_PROGRESS = e.CancellationToken = void 0, e.addHandler = n;
  const t = we;
  Object.defineProperty(e, "CancellationToken", { enumerable: !0, get: function() {
    return t.CancellationToken;
  } }), e.DOWNLOAD_PROGRESS = "download-progress", e.UPDATE_DOWNLOADED = "update-downloaded";
  class r {
    constructor(a) {
      this.emitter = a;
    }
    /**
     * Emitted when an authenticating proxy is [asking for user credentials](https://github.com/electron/electron/blob/master/docs/api/client-request.md#event-login).
     */
    login(a) {
      n(this.emitter, "login", a);
    }
    progress(a) {
      n(this.emitter, e.DOWNLOAD_PROGRESS, a);
    }
    updateDownloaded(a) {
      n(this.emitter, e.UPDATE_DOWNLOADED, a);
    }
    updateCancelled(a) {
      n(this.emitter, "update-cancelled", a);
    }
  }
  e.UpdaterSignal = r;
  function n(i, a, o) {
    i.on(a, o);
  }
})(Ct);
Object.defineProperty(wt, "__esModule", { value: !0 });
wt.NoOpLogger = wt.AppUpdater = void 0;
const be = we, Cv = Yr, $v = ei, bv = Al, Vt = Tt, Iv = Se, ia = ci, Pt = oe, Rt = _u, tl = tn, Ov = mi, rl = Su, Dv = rn, aa = gi, Pv = Cl, Nv = Ge, Rv = vi, Yt = Ct;
class ro extends bv.EventEmitter {
  /**
   * Get the update channel. Doesn't return `channel` from the update configuration, only if was previously set.
   */
  get channel() {
    return this._channel;
  }
  /**
   * Set the update channel. Overrides `channel` in the update configuration.
   *
   * `allowDowngrade` will be automatically set to `true`. If this behavior is not suitable for you, simple set `allowDowngrade` explicitly after.
   */
  set channel(t) {
    if (this._channel != null) {
      if (typeof t != "string")
        throw (0, be.newError)(`Channel must be a string, but got: ${t}`, "ERR_UPDATER_INVALID_CHANNEL");
      if (t.length === 0)
        throw (0, be.newError)("Channel must be not an empty string", "ERR_UPDATER_INVALID_CHANNEL");
    }
    this._channel = t, this.allowDowngrade = !0;
  }
  /**
   *  Shortcut for explicitly adding auth tokens to request headers
   */
  addAuthHeader(t) {
    this.requestHeaders = Object.assign({}, this.requestHeaders, {
      authorization: t
    });
  }
  // noinspection JSMethodCanBeStatic,JSUnusedGlobalSymbols
  get netSession() {
    return (0, rl.getNetSession)();
  }
  /**
   * The logger. You can pass [electron-log](https://github.com/megahertz/electron-log), [winston](https://github.com/winstonjs/winston) or another logger with the following interface: `{ info(), warn(), error() }`.
   * Set it to `null` if you would like to disable a logging feature.
   */
  get logger() {
    return this._logger;
  }
  set logger(t) {
    this._logger = t ?? new Du();
  }
  // noinspection JSUnusedGlobalSymbols
  /**
   * test only
   * @private
   */
  set updateConfigPath(t) {
    this.clientPromise = null, this._appUpdateConfigPath = t, this.configOnDisk = new ia.Lazy(() => this.loadUpdateConfig());
  }
  /**
   * Allows developer to override default logic for determining if an update is supported.
   * The default logic compares the `UpdateInfo` minimum system version against the `os.release()` with `semver` package
   */
  get isUpdateSupported() {
    return this._isUpdateSupported;
  }
  set isUpdateSupported(t) {
    t && (this._isUpdateSupported = t);
  }
  constructor(t, r) {
    super(), this.autoDownload = !0, this.autoInstallOnAppQuit = !0, this.autoRunAppAfterInstall = !0, this.allowPrerelease = !1, this.fullChangelog = !1, this.allowDowngrade = !1, this.disableWebInstaller = !1, this.disableDifferentialDownload = !1, this.forceDevUpdateConfig = !1, this._channel = null, this.downloadedUpdateHelper = null, this.requestHeaders = null, this._logger = console, this.signals = new Yt.UpdaterSignal(this), this._appUpdateConfigPath = null, this._isUpdateSupported = (a) => this.checkIfUpdateSupported(a), this.clientPromise = null, this.stagingUserIdPromise = new ia.Lazy(() => this.getOrCreateStagingUserId()), this.configOnDisk = new ia.Lazy(() => this.loadUpdateConfig()), this.checkForUpdatesPromise = null, this.downloadPromise = null, this.updateInfoAndProvider = null, this._testOnlyOptions = null, this.on("error", (a) => {
      this._logger.error(`Error: ${a.stack || a.message}`);
    }), r == null ? (this.app = new Ov.ElectronAppAdapter(), this.httpExecutor = new rl.ElectronHttpExecutor((a, o) => this.emit("login", a, o))) : (this.app = r, this.httpExecutor = null);
    const n = this.app.version, i = (0, Rt.parse)(n);
    if (i == null)
      throw (0, be.newError)(`App version is not a valid semver version: "${n}"`, "ERR_UPDATER_INVALID_VERSION");
    this.currentVersion = i, this.allowPrerelease = Fv(i), t != null && (this.setFeedURL(t), typeof t != "string" && t.requestHeaders && (this.requestHeaders = t.requestHeaders));
  }
  //noinspection JSMethodCanBeStatic,JSUnusedGlobalSymbols
  getFeedURL() {
    return "Deprecated. Do not use it.";
  }
  /**
   * Configure update provider. If value is `string`, [GenericServerOptions](./publish.md#genericserveroptions) will be set with value as `url`.
   * @param options If you want to override configuration in the `app-update.yml`.
   */
  setFeedURL(t) {
    const r = this.createProviderRuntimeOptions();
    let n;
    typeof t == "string" ? n = new Dv.GenericProvider({ provider: "generic", url: t }, this, {
      ...r,
      isUseMultipleRangeRequest: (0, aa.isUrlProbablySupportMultiRangeRequests)(t)
    }) : n = (0, aa.createClient)(t, this, r), this.clientPromise = Promise.resolve(n);
  }
  /**
   * Asks the server whether there is an update.
   * @returns null if the updater is disabled, otherwise info about the latest version
   */
  checkForUpdates() {
    if (!this.isUpdaterActive())
      return Promise.resolve(null);
    let t = this.checkForUpdatesPromise;
    if (t != null)
      return this._logger.info("Checking for update (already in progress)"), t;
    const r = () => this.checkForUpdatesPromise = null;
    return this._logger.info("Checking for update"), t = this.doCheckForUpdates().then((n) => (r(), n)).catch((n) => {
      throw r(), this.emit("error", n, `Cannot check for updates: ${(n.stack || n).toString()}`), n;
    }), this.checkForUpdatesPromise = t, t;
  }
  isUpdaterActive() {
    return this.app.isPackaged || this.forceDevUpdateConfig ? !0 : (this._logger.info("Skip checkForUpdates because application is not packed and dev update config is not forced"), !1);
  }
  // noinspection JSUnusedGlobalSymbols
  checkForUpdatesAndNotify(t) {
    return this.checkForUpdates().then((r) => r != null && r.downloadPromise ? (r.downloadPromise.then(() => {
      const n = ro.formatDownloadNotification(r.updateInfo.version, this.app.name, t);
      new kt.Notification(n).show();
    }), r) : (this._logger.debug != null && this._logger.debug("checkForUpdatesAndNotify called, downloadPromise is null"), r));
  }
  static formatDownloadNotification(t, r, n) {
    return n == null && (n = {
      title: "A new update is ready to install",
      body: "{appName} version {version} has been downloaded and will be automatically installed on exit"
    }), n = {
      title: n.title.replace("{appName}", r).replace("{version}", t),
      body: n.body.replace("{appName}", r).replace("{version}", t)
    }, n;
  }
  async isStagingMatch(t) {
    const r = t.stagingPercentage;
    let n = r;
    if (n == null)
      return !0;
    if (n = parseInt(n, 10), isNaN(n))
      return this._logger.warn(`Staging percentage is NaN: ${r}`), !0;
    n = n / 100;
    const i = await this.stagingUserIdPromise.value, o = be.UUID.parse(i).readUInt32BE(12) / 4294967295;
    return this._logger.info(`Staging percentage: ${n}, percentage: ${o}, user id: ${i}`), o < n;
  }
  computeFinalHeaders(t) {
    return this.requestHeaders != null && Object.assign(t, this.requestHeaders), t;
  }
  async isUpdateAvailable(t) {
    const r = (0, Rt.parse)(t.version);
    if (r == null)
      throw (0, be.newError)(`This file could not be downloaded, or the latest version (from update server) does not have a valid semver version: "${t.version}"`, "ERR_UPDATER_INVALID_VERSION");
    const n = this.currentVersion;
    if ((0, Rt.eq)(r, n) || !await Promise.resolve(this.isUpdateSupported(t)) || !await this.isStagingMatch(t))
      return !1;
    const a = (0, Rt.gt)(r, n), o = (0, Rt.lt)(r, n);
    return a ? !0 : this.allowDowngrade && o;
  }
  checkIfUpdateSupported(t) {
    const r = t == null ? void 0 : t.minimumSystemVersion, n = (0, $v.release)();
    if (r)
      try {
        if ((0, Rt.lt)(n, r))
          return this._logger.info(`Current OS version ${n} is less than the minimum OS version required ${r} for version ${n}`), !1;
      } catch (i) {
        this._logger.warn(`Failed to compare current OS version(${n}) with minimum OS version(${r}): ${(i.message || i).toString()}`);
      }
    return !0;
  }
  async getUpdateInfoAndProvider() {
    await this.app.whenReady(), this.clientPromise == null && (this.clientPromise = this.configOnDisk.value.then((n) => (0, aa.createClient)(n, this, this.createProviderRuntimeOptions())));
    const t = await this.clientPromise, r = await this.stagingUserIdPromise.value;
    return t.setRequestHeaders(this.computeFinalHeaders({ "x-user-staging-id": r })), {
      info: await t.getLatestVersion(),
      provider: t
    };
  }
  createProviderRuntimeOptions() {
    return {
      isUseMultipleRangeRequest: !0,
      platform: this._testOnlyOptions == null ? process.platform : this._testOnlyOptions.platform,
      executor: this.httpExecutor
    };
  }
  async doCheckForUpdates() {
    this.emit("checking-for-update");
    const t = await this.getUpdateInfoAndProvider(), r = t.info;
    if (!await this.isUpdateAvailable(r))
      return this._logger.info(`Update for version ${this.currentVersion.format()} is not available (latest version: ${r.version}, downgrade is ${this.allowDowngrade ? "allowed" : "disallowed"}).`), this.emit("update-not-available", r), {
        isUpdateAvailable: !1,
        versionInfo: r,
        updateInfo: r
      };
    this.updateInfoAndProvider = t, this.onUpdateAvailable(r);
    const n = new be.CancellationToken();
    return {
      isUpdateAvailable: !0,
      versionInfo: r,
      updateInfo: r,
      cancellationToken: n,
      downloadPromise: this.autoDownload ? this.downloadUpdate(n) : null
    };
  }
  onUpdateAvailable(t) {
    this._logger.info(`Found version ${t.version} (url: ${(0, be.asArray)(t.files).map((r) => r.url).join(", ")})`), this.emit("update-available", t);
  }
  /**
   * Start downloading update manually. You can use this method if `autoDownload` option is set to `false`.
   * @returns {Promise<Array<string>>} Paths to downloaded files.
   */
  downloadUpdate(t = new be.CancellationToken()) {
    const r = this.updateInfoAndProvider;
    if (r == null) {
      const i = new Error("Please check update first");
      return this.dispatchError(i), Promise.reject(i);
    }
    if (this.downloadPromise != null)
      return this._logger.info("Downloading update (already in progress)"), this.downloadPromise;
    this._logger.info(`Downloading update from ${(0, be.asArray)(r.info.files).map((i) => i.url).join(", ")}`);
    const n = (i) => {
      if (!(i instanceof be.CancellationError))
        try {
          this.dispatchError(i);
        } catch (a) {
          this._logger.warn(`Cannot dispatch error event: ${a.stack || a}`);
        }
      return i;
    };
    return this.downloadPromise = this.doDownloadUpdate({
      updateInfoAndProvider: r,
      requestHeaders: this.computeRequestHeaders(r.provider),
      cancellationToken: t,
      disableWebInstaller: this.disableWebInstaller,
      disableDifferentialDownload: this.disableDifferentialDownload
    }).catch((i) => {
      throw n(i);
    }).finally(() => {
      this.downloadPromise = null;
    }), this.downloadPromise;
  }
  dispatchError(t) {
    this.emit("error", t, (t.stack || t).toString());
  }
  dispatchUpdateDownloaded(t) {
    this.emit(Yt.UPDATE_DOWNLOADED, t);
  }
  async loadUpdateConfig() {
    return this._appUpdateConfigPath == null && (this._appUpdateConfigPath = this.app.appUpdateConfigPath), (0, Iv.load)(await (0, Vt.readFile)(this._appUpdateConfigPath, "utf-8"));
  }
  computeRequestHeaders(t) {
    const r = t.fileExtraDownloadHeaders;
    if (r != null) {
      const n = this.requestHeaders;
      return n == null ? r : {
        ...r,
        ...n
      };
    }
    return this.computeFinalHeaders({ accept: "*/*" });
  }
  async getOrCreateStagingUserId() {
    const t = Pt.join(this.app.userDataPath, ".updaterId");
    try {
      const n = await (0, Vt.readFile)(t, "utf-8");
      if (be.UUID.check(n))
        return n;
      this._logger.warn(`Staging user id file exists, but content was invalid: ${n}`);
    } catch (n) {
      n.code !== "ENOENT" && this._logger.warn(`Couldn't read staging user ID, creating a blank one: ${n}`);
    }
    const r = be.UUID.v5((0, Cv.randomBytes)(4096), be.UUID.OID);
    this._logger.info(`Generated new staging user ID: ${r}`);
    try {
      await (0, Vt.outputFile)(t, r);
    } catch (n) {
      this._logger.warn(`Couldn't write out staging user ID: ${n}`);
    }
    return r;
  }
  /** @internal */
  get isAddNoCacheQuery() {
    const t = this.requestHeaders;
    if (t == null)
      return !0;
    for (const r of Object.keys(t)) {
      const n = r.toLowerCase();
      if (n === "authorization" || n === "private-token")
        return !1;
    }
    return !0;
  }
  async getOrCreateDownloadHelper() {
    let t = this.downloadedUpdateHelper;
    if (t == null) {
      const r = (await this.configOnDisk.value).updaterCacheDirName, n = this._logger;
      r == null && n.error("updaterCacheDirName is not specified in app-update.yml Was app build using at least electron-builder 20.34.0?");
      const i = Pt.join(this.app.baseCachePath, r || this.app.name);
      n.debug != null && n.debug(`updater cache dir: ${i}`), t = new tl.DownloadedUpdateHelper(i), this.downloadedUpdateHelper = t;
    }
    return t;
  }
  async executeDownload(t) {
    const r = t.fileInfo, n = {
      headers: t.downloadUpdateOptions.requestHeaders,
      cancellationToken: t.downloadUpdateOptions.cancellationToken,
      sha2: r.info.sha2,
      sha512: r.info.sha512
    };
    this.listenerCount(Yt.DOWNLOAD_PROGRESS) > 0 && (n.onProgress = (A) => this.emit(Yt.DOWNLOAD_PROGRESS, A));
    const i = t.downloadUpdateOptions.updateInfoAndProvider.info, a = i.version, o = r.packageInfo;
    function s() {
      const A = decodeURIComponent(t.fileInfo.url.pathname);
      return A.endsWith(`.${t.fileExtension}`) ? Pt.basename(A) : t.fileInfo.info.url;
    }
    const l = await this.getOrCreateDownloadHelper(), m = l.cacheDirForPendingUpdate;
    await (0, Vt.mkdir)(m, { recursive: !0 });
    const c = s();
    let f = Pt.join(m, c);
    const h = o == null ? null : Pt.join(m, `package-${a}${Pt.extname(o.path) || ".7z"}`), g = async (A) => (await l.setDownloadedFile(f, h, i, r, c, A), await t.done({
      ...i,
      downloadedFile: f
    }), h == null ? [f] : [f, h]), _ = this._logger, w = await l.validateDownloadedPath(f, i, r, _);
    if (w != null)
      return f = w, await g(!1);
    const S = async () => (await l.clear().catch(() => {
    }), await (0, Vt.unlink)(f).catch(() => {
    })), T = await (0, tl.createTempUpdateFile)(`temp-${c}`, m, _);
    try {
      await t.task(T, n, h, S), await (0, be.retry)(() => (0, Vt.rename)(T, f), 60, 500, 0, 0, (A) => A instanceof Error && /^EBUSY:/.test(A.message));
    } catch (A) {
      throw await S(), A instanceof be.CancellationError && (_.info("cancelled"), this.emit("update-cancelled", i)), A;
    }
    return _.info(`New version ${a} has been downloaded to ${f}`), await g(!0);
  }
  async differentialDownloadInstaller(t, r, n, i, a) {
    try {
      if (this._testOnlyOptions != null && !this._testOnlyOptions.isUseDifferentialDownload)
        return !0;
      const o = (0, Nv.blockmapFiles)(t.url, this.app.version, r.updateInfoAndProvider.info.version);
      this._logger.info(`Download block maps (old: "${o[0]}", new: ${o[1]})`);
      const s = async (c) => {
        const f = await this.httpExecutor.downloadToBuffer(c, {
          headers: r.requestHeaders,
          cancellationToken: r.cancellationToken
        });
        if (f == null || f.length === 0)
          throw new Error(`Blockmap "${c.href}" is empty`);
        try {
          return JSON.parse((0, Pv.gunzipSync)(f).toString());
        } catch (h) {
          throw new Error(`Cannot parse blockmap "${c.href}", error: ${h}`);
        }
      }, l = {
        newUrl: t.url,
        oldFile: Pt.join(this.downloadedUpdateHelper.cacheDir, a),
        logger: this._logger,
        newFile: n,
        isUseMultipleRangeRequest: i.isUseMultipleRangeRequest,
        requestHeaders: r.requestHeaders,
        cancellationToken: r.cancellationToken
      };
      this.listenerCount(Yt.DOWNLOAD_PROGRESS) > 0 && (l.onProgress = (c) => this.emit(Yt.DOWNLOAD_PROGRESS, c));
      const m = await Promise.all(o.map((c) => s(c)));
      return await new Rv.GenericDifferentialDownloader(t.info, this.httpExecutor, l).download(m[0], m[1]), !1;
    } catch (o) {
      if (this._logger.error(`Cannot download differentially, fallback to full download: ${o.stack || o}`), this._testOnlyOptions != null)
        throw o;
      return !0;
    }
  }
}
wt.AppUpdater = ro;
function Fv(e) {
  const t = (0, Rt.prerelease)(e);
  return t != null && t.length > 0;
}
class Du {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  info(t) {
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  warn(t) {
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  error(t) {
  }
}
wt.NoOpLogger = Du;
Object.defineProperty(st, "__esModule", { value: !0 });
st.BaseUpdater = void 0;
const nl = Zn, xv = wt;
class Lv extends xv.AppUpdater {
  constructor(t, r) {
    super(t, r), this.quitAndInstallCalled = !1, this.quitHandlerAdded = !1;
  }
  quitAndInstall(t = !1, r = !1) {
    this._logger.info("Install on explicit quitAndInstall"), this.install(t, t ? r : this.autoRunAppAfterInstall) ? setImmediate(() => {
      kt.autoUpdater.emit("before-quit-for-update"), this.app.quit();
    }) : this.quitAndInstallCalled = !1;
  }
  executeDownload(t) {
    return super.executeDownload({
      ...t,
      done: (r) => (this.dispatchUpdateDownloaded(r), this.addQuitHandler(), Promise.resolve())
    });
  }
  get installerPath() {
    return this.downloadedUpdateHelper == null ? null : this.downloadedUpdateHelper.file;
  }
  // must be sync (because quit even handler is not async)
  install(t = !1, r = !1) {
    if (this.quitAndInstallCalled)
      return this._logger.warn("install call ignored: quitAndInstallCalled is set to true"), !1;
    const n = this.downloadedUpdateHelper, i = this.installerPath, a = n == null ? null : n.downloadedFileInfo;
    if (i == null || a == null)
      return this.dispatchError(new Error("No valid update available, can't quit and install")), !1;
    this.quitAndInstallCalled = !0;
    try {
      return this._logger.info(`Install: isSilent: ${t}, isForceRunAfter: ${r}`), this.doInstall({
        isSilent: t,
        isForceRunAfter: r,
        isAdminRightsRequired: a.isAdminRightsRequired
      });
    } catch (o) {
      return this.dispatchError(o), !1;
    }
  }
  addQuitHandler() {
    this.quitHandlerAdded || !this.autoInstallOnAppQuit || (this.quitHandlerAdded = !0, this.app.onQuit((t) => {
      if (this.quitAndInstallCalled) {
        this._logger.info("Update installer has already been triggered. Quitting application.");
        return;
      }
      if (!this.autoInstallOnAppQuit) {
        this._logger.info("Update will not be installed on quit because autoInstallOnAppQuit is set to false.");
        return;
      }
      if (t !== 0) {
        this._logger.info(`Update will be not installed on quit because application is quitting with exit code ${t}`);
        return;
      }
      this._logger.info("Auto install update on quit"), this.install(!0, !1);
    }));
  }
  wrapSudo() {
    const { name: t } = this.app, r = `"${t} would like to update"`, n = this.spawnSyncLog("which gksudo || which kdesudo || which pkexec || which beesu"), i = [n];
    return /kdesudo/i.test(n) ? (i.push("--comment", r), i.push("-c")) : /gksudo/i.test(n) ? i.push("--message", r) : /pkexec/i.test(n) && i.push("--disable-internal-agent"), i.join(" ");
  }
  spawnSyncLog(t, r = [], n = {}) {
    this._logger.info(`Executing: ${t} with args: ${r}`);
    const i = (0, nl.spawnSync)(t, r, {
      env: { ...process.env, ...n },
      encoding: "utf-8",
      shell: !0
    }), { error: a, status: o, stdout: s, stderr: l } = i;
    if (a != null)
      throw this._logger.error(l), a;
    if (o != null && o !== 0)
      throw this._logger.error(l), new Error(`Command ${t} exited with code ${o}`);
    return s.trim();
  }
  /**
   * This handles both node 8 and node 10 way of emitting error when spawning a process
   *   - node 8: Throws the error
   *   - node 10: Emit the error(Need to listen with on)
   */
  // https://github.com/electron-userland/electron-builder/issues/1129
  // Node 8 sends errors: https://nodejs.org/dist/latest-v8.x/docs/api/errors.html#errors_common_system_errors
  async spawnLog(t, r = [], n = void 0, i = "ignore") {
    return this._logger.info(`Executing: ${t} with args: ${r}`), new Promise((a, o) => {
      try {
        const s = { stdio: i, env: n, detached: !0 }, l = (0, nl.spawn)(t, r, s);
        l.on("error", (m) => {
          o(m);
        }), l.unref(), l.pid !== void 0 && a(!0);
      } catch (s) {
        o(s);
      }
    });
  }
}
st.BaseUpdater = Lv;
var Mr = {}, an = {};
Object.defineProperty(an, "__esModule", { value: !0 });
an.FileWithEmbeddedBlockMapDifferentialDownloader = void 0;
const Xt = Tt, Uv = nn, kv = Cl;
class Mv extends Uv.DifferentialDownloader {
  async download() {
    const t = this.blockAwareFileInfo, r = t.size, n = r - (t.blockMapSize + 4);
    this.fileMetadataBuffer = await this.readRemoteBytes(n, r - 1);
    const i = Pu(this.fileMetadataBuffer.slice(0, this.fileMetadataBuffer.length - 4));
    await this.doDownload(await jv(this.options.oldFile), i);
  }
}
an.FileWithEmbeddedBlockMapDifferentialDownloader = Mv;
function Pu(e) {
  return JSON.parse((0, kv.inflateRawSync)(e).toString());
}
async function jv(e) {
  const t = await (0, Xt.open)(e, "r");
  try {
    const r = (await (0, Xt.fstat)(t)).size, n = Buffer.allocUnsafe(4);
    await (0, Xt.read)(t, n, 0, n.length, r - n.length);
    const i = Buffer.allocUnsafe(n.readUInt32BE(0));
    return await (0, Xt.read)(t, i, 0, i.length, r - n.length - i.length), await (0, Xt.close)(t), Pu(i);
  } catch (r) {
    throw await (0, Xt.close)(t), r;
  }
}
Object.defineProperty(Mr, "__esModule", { value: !0 });
Mr.AppImageUpdater = void 0;
const il = we, al = Zn, Bv = Tt, Hv = At, Ar = oe, qv = st, Gv = an, Wv = he, ol = Ct;
class zv extends qv.BaseUpdater {
  constructor(t, r) {
    super(t, r);
  }
  isUpdaterActive() {
    return process.env.APPIMAGE == null ? (process.env.SNAP == null ? this._logger.warn("APPIMAGE env is not defined, current application is not an AppImage") : this._logger.info("SNAP env is defined, updater is disabled"), !1) : super.isUpdaterActive();
  }
  /*** @private */
  doDownloadUpdate(t) {
    const r = t.updateInfoAndProvider.provider, n = (0, Wv.findFile)(r.resolveFiles(t.updateInfoAndProvider.info), "AppImage", ["rpm", "deb", "pacman"]);
    return this.executeDownload({
      fileExtension: "AppImage",
      fileInfo: n,
      downloadUpdateOptions: t,
      task: async (i, a) => {
        const o = process.env.APPIMAGE;
        if (o == null)
          throw (0, il.newError)("APPIMAGE env is not defined", "ERR_UPDATER_OLD_FILE_NOT_FOUND");
        (t.disableDifferentialDownload || await this.downloadDifferential(n, o, i, r, t)) && await this.httpExecutor.download(n.url, i, a), await (0, Bv.chmod)(i, 493);
      }
    });
  }
  async downloadDifferential(t, r, n, i, a) {
    try {
      const o = {
        newUrl: t.url,
        oldFile: r,
        logger: this._logger,
        newFile: n,
        isUseMultipleRangeRequest: i.isUseMultipleRangeRequest,
        requestHeaders: a.requestHeaders,
        cancellationToken: a.cancellationToken
      };
      return this.listenerCount(ol.DOWNLOAD_PROGRESS) > 0 && (o.onProgress = (s) => this.emit(ol.DOWNLOAD_PROGRESS, s)), await new Gv.FileWithEmbeddedBlockMapDifferentialDownloader(t.info, this.httpExecutor, o).download(), !1;
    } catch (o) {
      return this._logger.error(`Cannot download differentially, fallback to full download: ${o.stack || o}`), process.platform === "linux";
    }
  }
  doInstall(t) {
    const r = process.env.APPIMAGE;
    if (r == null)
      throw (0, il.newError)("APPIMAGE env is not defined", "ERR_UPDATER_OLD_FILE_NOT_FOUND");
    (0, Hv.unlinkSync)(r);
    let n;
    const i = Ar.basename(r), a = this.installerPath;
    if (a == null)
      return this.dispatchError(new Error("No valid update available, can't quit and install")), !1;
    Ar.basename(a) === i || !/\d+\.\d+\.\d+/.test(i) ? n = r : n = Ar.join(Ar.dirname(r), Ar.basename(a)), (0, al.execFileSync)("mv", ["-f", a, n]), n !== r && this.emit("appimage-filename-updated", n);
    const o = {
      ...process.env,
      APPIMAGE_SILENT_INSTALL: "true"
    };
    return t.isForceRunAfter ? this.spawnLog(n, [], o) : (o.APPIMAGE_EXIT_AFTER_INSTALL = "true", (0, al.execFileSync)(n, [], { env: o })), !0;
  }
}
Mr.AppImageUpdater = zv;
var jr = {};
Object.defineProperty(jr, "__esModule", { value: !0 });
jr.DebUpdater = void 0;
const Vv = st, Yv = he, sl = Ct;
class Xv extends Vv.BaseUpdater {
  constructor(t, r) {
    super(t, r);
  }
  /*** @private */
  doDownloadUpdate(t) {
    const r = t.updateInfoAndProvider.provider, n = (0, Yv.findFile)(r.resolveFiles(t.updateInfoAndProvider.info), "deb", ["AppImage", "rpm", "pacman"]);
    return this.executeDownload({
      fileExtension: "deb",
      fileInfo: n,
      downloadUpdateOptions: t,
      task: async (i, a) => {
        this.listenerCount(sl.DOWNLOAD_PROGRESS) > 0 && (a.onProgress = (o) => this.emit(sl.DOWNLOAD_PROGRESS, o)), await this.httpExecutor.download(n.url, i, a);
      }
    });
  }
  get installerPath() {
    var t, r;
    return (r = (t = super.installerPath) === null || t === void 0 ? void 0 : t.replace(/ /g, "\\ ")) !== null && r !== void 0 ? r : null;
  }
  doInstall(t) {
    const r = this.wrapSudo(), n = /pkexec/i.test(r) ? "" : '"', i = this.installerPath;
    if (i == null)
      return this.dispatchError(new Error("No valid update available, can't quit and install")), !1;
    const a = ["dpkg", "-i", i, "||", "apt-get", "install", "-f", "-y"];
    return this.spawnSyncLog(r, [`${n}/bin/bash`, "-c", `'${a.join(" ")}'${n}`]), t.isForceRunAfter && this.app.relaunch(), !0;
  }
}
jr.DebUpdater = Xv;
var Br = {};
Object.defineProperty(Br, "__esModule", { value: !0 });
Br.PacmanUpdater = void 0;
const Jv = st, ll = Ct, Kv = he;
class Qv extends Jv.BaseUpdater {
  constructor(t, r) {
    super(t, r);
  }
  /*** @private */
  doDownloadUpdate(t) {
    const r = t.updateInfoAndProvider.provider, n = (0, Kv.findFile)(r.resolveFiles(t.updateInfoAndProvider.info), "pacman", ["AppImage", "deb", "rpm"]);
    return this.executeDownload({
      fileExtension: "pacman",
      fileInfo: n,
      downloadUpdateOptions: t,
      task: async (i, a) => {
        this.listenerCount(ll.DOWNLOAD_PROGRESS) > 0 && (a.onProgress = (o) => this.emit(ll.DOWNLOAD_PROGRESS, o)), await this.httpExecutor.download(n.url, i, a);
      }
    });
  }
  get installerPath() {
    var t, r;
    return (r = (t = super.installerPath) === null || t === void 0 ? void 0 : t.replace(/ /g, "\\ ")) !== null && r !== void 0 ? r : null;
  }
  doInstall(t) {
    const r = this.wrapSudo(), n = /pkexec/i.test(r) ? "" : '"', i = this.installerPath;
    if (i == null)
      return this.dispatchError(new Error("No valid update available, can't quit and install")), !1;
    const a = ["pacman", "-U", "--noconfirm", i];
    return this.spawnSyncLog(r, [`${n}/bin/bash`, "-c", `'${a.join(" ")}'${n}`]), t.isForceRunAfter && this.app.relaunch(), !0;
  }
}
Br.PacmanUpdater = Qv;
var Hr = {};
Object.defineProperty(Hr, "__esModule", { value: !0 });
Hr.RpmUpdater = void 0;
const Zv = st, cl = Ct, e_ = he;
class t_ extends Zv.BaseUpdater {
  constructor(t, r) {
    super(t, r);
  }
  /*** @private */
  doDownloadUpdate(t) {
    const r = t.updateInfoAndProvider.provider, n = (0, e_.findFile)(r.resolveFiles(t.updateInfoAndProvider.info), "rpm", ["AppImage", "deb", "pacman"]);
    return this.executeDownload({
      fileExtension: "rpm",
      fileInfo: n,
      downloadUpdateOptions: t,
      task: async (i, a) => {
        this.listenerCount(cl.DOWNLOAD_PROGRESS) > 0 && (a.onProgress = (o) => this.emit(cl.DOWNLOAD_PROGRESS, o)), await this.httpExecutor.download(n.url, i, a);
      }
    });
  }
  get installerPath() {
    var t, r;
    return (r = (t = super.installerPath) === null || t === void 0 ? void 0 : t.replace(/ /g, "\\ ")) !== null && r !== void 0 ? r : null;
  }
  doInstall(t) {
    const r = this.wrapSudo(), n = /pkexec/i.test(r) ? "" : '"', i = this.spawnSyncLog("which zypper"), a = this.installerPath;
    if (a == null)
      return this.dispatchError(new Error("No valid update available, can't quit and install")), !1;
    let o;
    return i ? o = [i, "--no-refresh", "install", "--allow-unsigned-rpm", "-y", "-f", a] : o = [this.spawnSyncLog("which dnf || which yum"), "-y", "install", a], this.spawnSyncLog(r, [`${n}/bin/bash`, "-c", `'${o.join(" ")}'${n}`]), t.isForceRunAfter && this.app.relaunch(), !0;
  }
}
Hr.RpmUpdater = t_;
var qr = {};
Object.defineProperty(qr, "__esModule", { value: !0 });
qr.MacUpdater = void 0;
const ul = we, oa = Tt, r_ = At, fl = oe, n_ = Yf, i_ = wt, a_ = he, dl = Zn, hl = Yr;
class o_ extends i_.AppUpdater {
  constructor(t, r) {
    super(t, r), this.nativeUpdater = kt.autoUpdater, this.squirrelDownloadedUpdate = !1, this.nativeUpdater.on("error", (n) => {
      this._logger.warn(n), this.emit("error", n);
    }), this.nativeUpdater.on("update-downloaded", () => {
      this.squirrelDownloadedUpdate = !0, this.debug("nativeUpdater.update-downloaded");
    });
  }
  debug(t) {
    this._logger.debug != null && this._logger.debug(t);
  }
  closeServerIfExists() {
    this.server && (this.debug("Closing proxy server"), this.server.close((t) => {
      t && this.debug("proxy server wasn't already open, probably attempted closing again as a safety check before quit");
    }));
  }
  async doDownloadUpdate(t) {
    let r = t.updateInfoAndProvider.provider.resolveFiles(t.updateInfoAndProvider.info);
    const n = this._logger, i = "sysctl.proc_translated";
    let a = !1;
    try {
      this.debug("Checking for macOS Rosetta environment"), a = (0, dl.execFileSync)("sysctl", [i], { encoding: "utf8" }).includes(`${i}: 1`), n.info(`Checked for macOS Rosetta environment (isRosetta=${a})`);
    } catch (f) {
      n.warn(`sysctl shell command to check for macOS Rosetta environment failed: ${f}`);
    }
    let o = !1;
    try {
      this.debug("Checking for arm64 in uname");
      const h = (0, dl.execFileSync)("uname", ["-a"], { encoding: "utf8" }).includes("ARM");
      n.info(`Checked 'uname -a': arm64=${h}`), o = o || h;
    } catch (f) {
      n.warn(`uname shell command to check for arm64 failed: ${f}`);
    }
    o = o || process.arch === "arm64" || a;
    const s = (f) => {
      var h;
      return f.url.pathname.includes("arm64") || ((h = f.info.url) === null || h === void 0 ? void 0 : h.includes("arm64"));
    };
    o && r.some(s) ? r = r.filter((f) => o === s(f)) : r = r.filter((f) => !s(f));
    const l = (0, a_.findFile)(r, "zip", ["pkg", "dmg"]);
    if (l == null)
      throw (0, ul.newError)(`ZIP file not provided: ${(0, ul.safeStringifyJson)(r)}`, "ERR_UPDATER_ZIP_FILE_NOT_FOUND");
    const m = t.updateInfoAndProvider.provider, c = "update.zip";
    return this.executeDownload({
      fileExtension: "zip",
      fileInfo: l,
      downloadUpdateOptions: t,
      task: async (f, h) => {
        const g = fl.join(this.downloadedUpdateHelper.cacheDir, c), _ = () => (0, oa.pathExistsSync)(g) ? !t.disableDifferentialDownload : (n.info("Unable to locate previous update.zip for differential download (is this first install?), falling back to full download"), !1);
        let w = !0;
        _() && (w = await this.differentialDownloadInstaller(l, t, f, m, c)), w && await this.httpExecutor.download(l.url, f, h);
      },
      done: async (f) => {
        if (!t.disableDifferentialDownload)
          try {
            const h = fl.join(this.downloadedUpdateHelper.cacheDir, c);
            await (0, oa.copyFile)(f.downloadedFile, h);
          } catch (h) {
            this._logger.warn(`Unable to copy file for caching for future differential downloads: ${h.message}`);
          }
        return this.updateDownloaded(l, f);
      }
    });
  }
  async updateDownloaded(t, r) {
    var n;
    const i = r.downloadedFile, a = (n = t.info.size) !== null && n !== void 0 ? n : (await (0, oa.stat)(i)).size, o = this._logger, s = `fileToProxy=${t.url.href}`;
    this.closeServerIfExists(), this.debug(`Creating proxy server for native Squirrel.Mac (${s})`), this.server = (0, n_.createServer)(), this.debug(`Proxy server for native Squirrel.Mac is created (${s})`), this.server.on("close", () => {
      o.info(`Proxy server for native Squirrel.Mac is closed (${s})`);
    });
    const l = (m) => {
      const c = m.address();
      return typeof c == "string" ? c : `http://127.0.0.1:${c == null ? void 0 : c.port}`;
    };
    return await new Promise((m, c) => {
      const f = (0, hl.randomBytes)(64).toString("base64").replace(/\//g, "_").replace(/\+/g, "-"), h = Buffer.from(`autoupdater:${f}`, "ascii"), g = `/${(0, hl.randomBytes)(64).toString("hex")}.zip`;
      this.server.on("request", (_, w) => {
        const S = _.url;
        if (o.info(`${S} requested`), S === "/") {
          if (!_.headers.authorization || _.headers.authorization.indexOf("Basic ") === -1) {
            w.statusCode = 401, w.statusMessage = "Invalid Authentication Credentials", w.end(), o.warn("No authenthication info");
            return;
          }
          const R = _.headers.authorization.split(" ")[1], x = Buffer.from(R, "base64").toString("ascii"), [re, ce] = x.split(":");
          if (re !== "autoupdater" || ce !== f) {
            w.statusCode = 401, w.statusMessage = "Invalid Authentication Credentials", w.end(), o.warn("Invalid authenthication credentials");
            return;
          }
          const X = Buffer.from(`{ "url": "${l(this.server)}${g}" }`);
          w.writeHead(200, { "Content-Type": "application/json", "Content-Length": X.length }), w.end(X);
          return;
        }
        if (!S.startsWith(g)) {
          o.warn(`${S} requested, but not supported`), w.writeHead(404), w.end();
          return;
        }
        o.info(`${g} requested by Squirrel.Mac, pipe ${i}`);
        let T = !1;
        w.on("finish", () => {
          T || (this.nativeUpdater.removeListener("error", c), m([]));
        });
        const A = (0, r_.createReadStream)(i);
        A.on("error", (R) => {
          try {
            w.end();
          } catch (x) {
            o.warn(`cannot end response: ${x}`);
          }
          T = !0, this.nativeUpdater.removeListener("error", c), c(new Error(`Cannot pipe "${i}": ${R}`));
        }), w.writeHead(200, {
          "Content-Type": "application/zip",
          "Content-Length": a
        }), A.pipe(w);
      }), this.debug(`Proxy server for native Squirrel.Mac is starting to listen (${s})`), this.server.listen(0, "127.0.0.1", () => {
        this.debug(`Proxy server for native Squirrel.Mac is listening (address=${l(this.server)}, ${s})`), this.nativeUpdater.setFeedURL({
          url: l(this.server),
          headers: {
            "Cache-Control": "no-cache",
            Authorization: `Basic ${h.toString("base64")}`
          }
        }), this.dispatchUpdateDownloaded(r), this.autoInstallOnAppQuit ? (this.nativeUpdater.once("error", c), this.nativeUpdater.checkForUpdates()) : m([]);
      });
    });
  }
  handleUpdateDownloaded() {
    this.autoRunAppAfterInstall ? this.nativeUpdater.quitAndInstall() : this.app.quit(), this.closeServerIfExists();
  }
  quitAndInstall() {
    this.squirrelDownloadedUpdate ? this.handleUpdateDownloaded() : (this.nativeUpdater.on("update-downloaded", () => this.handleUpdateDownloaded()), this.autoInstallOnAppQuit || this.nativeUpdater.checkForUpdates());
  }
}
qr.MacUpdater = o_;
var Gr = {}, no = {};
Object.defineProperty(no, "__esModule", { value: !0 });
no.verifySignature = l_;
const pl = we, Nu = Zn, s_ = ei, ml = oe;
function l_(e, t, r) {
  return new Promise((n, i) => {
    const a = t.replace(/'/g, "''");
    r.info(`Verifying signature ${a}`), (0, Nu.execFile)('set "PSModulePath=" & chcp 65001 >NUL & powershell.exe', ["-NoProfile", "-NonInteractive", "-InputFormat", "None", "-Command", `"Get-AuthenticodeSignature -LiteralPath '${a}' | ConvertTo-Json -Compress"`], {
      shell: !0,
      timeout: 20 * 1e3
    }, (o, s, l) => {
      var m;
      try {
        if (o != null || l) {
          sa(r, o, l, i), n(null);
          return;
        }
        const c = c_(s);
        if (c.Status === 0) {
          try {
            const _ = ml.normalize(c.Path), w = ml.normalize(t);
            if (r.info(`LiteralPath: ${_}. Update Path: ${w}`), _ !== w) {
              sa(r, new Error(`LiteralPath of ${_} is different than ${w}`), l, i), n(null);
              return;
            }
          } catch (_) {
            r.warn(`Unable to verify LiteralPath of update asset due to missing data.Path. Skipping this step of validation. Message: ${(m = _.message) !== null && m !== void 0 ? m : _.stack}`);
          }
          const h = (0, pl.parseDn)(c.SignerCertificate.Subject);
          let g = !1;
          for (const _ of e) {
            const w = (0, pl.parseDn)(_);
            if (w.size ? g = Array.from(w.keys()).every((T) => w.get(T) === h.get(T)) : _ === h.get("CN") && (r.warn(`Signature validated using only CN ${_}. Please add your full Distinguished Name (DN) to publisherNames configuration`), g = !0), g) {
              n(null);
              return;
            }
          }
        }
        const f = `publisherNames: ${e.join(" | ")}, raw info: ` + JSON.stringify(c, (h, g) => h === "RawData" ? void 0 : g, 2);
        r.warn(`Sign verification failed, installer signed with incorrect certificate: ${f}`), n(f);
      } catch (c) {
        sa(r, c, null, i), n(null);
        return;
      }
    });
  });
}
function c_(e) {
  const t = JSON.parse(e);
  delete t.PrivateKey, delete t.IsOSBinary, delete t.SignatureType;
  const r = t.SignerCertificate;
  return r != null && (delete r.Archived, delete r.Extensions, delete r.Handle, delete r.HasPrivateKey, delete r.SubjectName), t;
}
function sa(e, t, r, n) {
  if (u_()) {
    e.warn(`Cannot execute Get-AuthenticodeSignature: ${t || r}. Ignoring signature validation due to unsupported powershell version. Please upgrade to powershell 3 or higher.`);
    return;
  }
  try {
    (0, Nu.execFileSync)("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", "ConvertTo-Json test"], { timeout: 10 * 1e3 });
  } catch (i) {
    e.warn(`Cannot execute ConvertTo-Json: ${i.message}. Ignoring signature validation due to unsupported powershell version. Please upgrade to powershell 3 or higher.`);
    return;
  }
  t != null && n(t), r && n(new Error(`Cannot execute Get-AuthenticodeSignature, stderr: ${r}. Failing signature validation due to unknown stderr.`));
}
function u_() {
  const e = s_.release();
  return e.startsWith("6.") && !e.startsWith("6.3");
}
Object.defineProperty(Gr, "__esModule", { value: !0 });
Gr.NsisUpdater = void 0;
const Rn = we, gl = oe, f_ = st, d_ = an, yl = Ct, h_ = he, p_ = Tt, m_ = no, wl = lr;
class g_ extends f_.BaseUpdater {
  constructor(t, r) {
    super(t, r), this._verifyUpdateCodeSignature = (n, i) => (0, m_.verifySignature)(n, i, this._logger);
  }
  /**
   * The verifyUpdateCodeSignature. You can pass [win-verify-signature](https://github.com/beyondkmp/win-verify-trust) or another custom verify function: ` (publisherName: string[], path: string) => Promise<string | null>`.
   * The default verify function uses [windowsExecutableCodeSignatureVerifier](https://github.com/electron-userland/electron-builder/blob/master/packages/electron-updater/src/windowsExecutableCodeSignatureVerifier.ts)
   */
  get verifyUpdateCodeSignature() {
    return this._verifyUpdateCodeSignature;
  }
  set verifyUpdateCodeSignature(t) {
    t && (this._verifyUpdateCodeSignature = t);
  }
  /*** @private */
  doDownloadUpdate(t) {
    const r = t.updateInfoAndProvider.provider, n = (0, h_.findFile)(r.resolveFiles(t.updateInfoAndProvider.info), "exe");
    return this.executeDownload({
      fileExtension: "exe",
      downloadUpdateOptions: t,
      fileInfo: n,
      task: async (i, a, o, s) => {
        const l = n.packageInfo, m = l != null && o != null;
        if (m && t.disableWebInstaller)
          throw (0, Rn.newError)(`Unable to download new version ${t.updateInfoAndProvider.info.version}. Web Installers are disabled`, "ERR_UPDATER_WEB_INSTALLER_DISABLED");
        !m && !t.disableWebInstaller && this._logger.warn("disableWebInstaller is set to false, you should set it to true if you do not plan on using a web installer. This will default to true in a future version."), (m || t.disableDifferentialDownload || await this.differentialDownloadInstaller(n, t, i, r, Rn.CURRENT_APP_INSTALLER_FILE_NAME)) && await this.httpExecutor.download(n.url, i, a);
        const c = await this.verifySignature(i);
        if (c != null)
          throw await s(), (0, Rn.newError)(`New version ${t.updateInfoAndProvider.info.version} is not signed by the application owner: ${c}`, "ERR_UPDATER_INVALID_SIGNATURE");
        if (m && await this.differentialDownloadWebPackage(t, l, o, r))
          try {
            await this.httpExecutor.download(new wl.URL(l.path), o, {
              headers: t.requestHeaders,
              cancellationToken: t.cancellationToken,
              sha512: l.sha512
            });
          } catch (f) {
            try {
              await (0, p_.unlink)(o);
            } catch {
            }
            throw f;
          }
      }
    });
  }
  // $certificateInfo = (Get-AuthenticodeSignature 'xxx\yyy.exe'
  // | where {$_.Status.Equals([System.Management.Automation.SignatureStatus]::Valid) -and $_.SignerCertificate.Subject.Contains("CN=siemens.com")})
  // | Out-String ; if ($certificateInfo) { exit 0 } else { exit 1 }
  async verifySignature(t) {
    let r;
    try {
      if (r = (await this.configOnDisk.value).publisherName, r == null)
        return null;
    } catch (n) {
      if (n.code === "ENOENT")
        return null;
      throw n;
    }
    return await this._verifyUpdateCodeSignature(Array.isArray(r) ? r : [r], t);
  }
  doInstall(t) {
    const r = this.installerPath;
    if (r == null)
      return this.dispatchError(new Error("No valid update available, can't quit and install")), !1;
    const n = ["--updated"];
    t.isSilent && n.push("/S"), t.isForceRunAfter && n.push("--force-run"), this.installDirectory && n.push(`/D=${this.installDirectory}`);
    const i = this.downloadedUpdateHelper == null ? null : this.downloadedUpdateHelper.packageFile;
    i != null && n.push(`--package-file=${i}`);
    const a = () => {
      this.spawnLog(gl.join(process.resourcesPath, "elevate.exe"), [r].concat(n)).catch((o) => this.dispatchError(o));
    };
    return t.isAdminRightsRequired ? (this._logger.info("isAdminRightsRequired is set to true, run installer using elevate.exe"), a(), !0) : (this.spawnLog(r, n).catch((o) => {
      const s = o.code;
      this._logger.info(`Cannot run installer: error code: ${s}, error message: "${o.message}", will be executed again using elevate if EACCES, and will try to use electron.shell.openItem if ENOENT`), s === "UNKNOWN" || s === "EACCES" ? a() : s === "ENOENT" ? kt.shell.openPath(r).catch((l) => this.dispatchError(l)) : this.dispatchError(o);
    }), !0);
  }
  async differentialDownloadWebPackage(t, r, n, i) {
    if (r.blockMapSize == null)
      return !0;
    try {
      const a = {
        newUrl: new wl.URL(r.path),
        oldFile: gl.join(this.downloadedUpdateHelper.cacheDir, Rn.CURRENT_APP_PACKAGE_FILE_NAME),
        logger: this._logger,
        newFile: n,
        requestHeaders: this.requestHeaders,
        isUseMultipleRangeRequest: i.isUseMultipleRangeRequest,
        cancellationToken: t.cancellationToken
      };
      this.listenerCount(yl.DOWNLOAD_PROGRESS) > 0 && (a.onProgress = (o) => this.emit(yl.DOWNLOAD_PROGRESS, o)), await new d_.FileWithEmbeddedBlockMapDifferentialDownloader(r, this.httpExecutor, a).download();
    } catch (a) {
      return this._logger.error(`Cannot download differentially, fallback to full download: ${a.stack || a}`), process.platform === "win32";
    }
    return !1;
  }
}
Gr.NsisUpdater = g_;
(function(e) {
  var t = Ie && Ie.__createBinding || (Object.create ? function(S, T, A, R) {
    R === void 0 && (R = A);
    var x = Object.getOwnPropertyDescriptor(T, A);
    (!x || ("get" in x ? !T.__esModule : x.writable || x.configurable)) && (x = { enumerable: !0, get: function() {
      return T[A];
    } }), Object.defineProperty(S, R, x);
  } : function(S, T, A, R) {
    R === void 0 && (R = A), S[R] = T[A];
  }), r = Ie && Ie.__exportStar || function(S, T) {
    for (var A in S) A !== "default" && !Object.prototype.hasOwnProperty.call(T, A) && t(T, S, A);
  };
  Object.defineProperty(e, "__esModule", { value: !0 }), e.NsisUpdater = e.MacUpdater = e.RpmUpdater = e.PacmanUpdater = e.DebUpdater = e.AppImageUpdater = e.Provider = e.NoOpLogger = e.AppUpdater = e.BaseUpdater = void 0;
  const n = Tt, i = oe;
  var a = st;
  Object.defineProperty(e, "BaseUpdater", { enumerable: !0, get: function() {
    return a.BaseUpdater;
  } });
  var o = wt;
  Object.defineProperty(e, "AppUpdater", { enumerable: !0, get: function() {
    return o.AppUpdater;
  } }), Object.defineProperty(e, "NoOpLogger", { enumerable: !0, get: function() {
    return o.NoOpLogger;
  } });
  var s = he;
  Object.defineProperty(e, "Provider", { enumerable: !0, get: function() {
    return s.Provider;
  } });
  var l = Mr;
  Object.defineProperty(e, "AppImageUpdater", { enumerable: !0, get: function() {
    return l.AppImageUpdater;
  } });
  var m = jr;
  Object.defineProperty(e, "DebUpdater", { enumerable: !0, get: function() {
    return m.DebUpdater;
  } });
  var c = Br;
  Object.defineProperty(e, "PacmanUpdater", { enumerable: !0, get: function() {
    return c.PacmanUpdater;
  } });
  var f = Hr;
  Object.defineProperty(e, "RpmUpdater", { enumerable: !0, get: function() {
    return f.RpmUpdater;
  } });
  var h = qr;
  Object.defineProperty(e, "MacUpdater", { enumerable: !0, get: function() {
    return h.MacUpdater;
  } });
  var g = Gr;
  Object.defineProperty(e, "NsisUpdater", { enumerable: !0, get: function() {
    return g.NsisUpdater;
  } }), r(Ct, e);
  let _;
  function w() {
    if (process.platform === "win32")
      _ = new Gr.NsisUpdater();
    else if (process.platform === "darwin")
      _ = new qr.MacUpdater();
    else {
      _ = new Mr.AppImageUpdater();
      try {
        const S = i.join(process.resourcesPath, "package-type");
        if (!(0, n.existsSync)(S))
          return _;
        console.info("Checking for beta autoupdate feature for deb/rpm distributions");
        const T = (0, n.readFileSync)(S).toString().trim();
        switch (console.info("Found package-type:", T), T) {
          case "deb":
            _ = new jr.DebUpdater();
            break;
          case "rpm":
            _ = new Hr.RpmUpdater();
            break;
          case "pacman":
            _ = new Br.PacmanUpdater();
            break;
          default:
            break;
        }
      } catch (S) {
        console.warn("Unable to detect 'package-type' for autoUpdater (beta rpm/deb support). If you'd like to expand support, please consider contributing to electron-builder", S.message);
      }
    }
    return _;
  }
  Object.defineProperty(e, "autoUpdater", {
    enumerable: !0,
    get: () => _ || w()
  });
})(xe);
const y_ = "updater:status";
let Kn = { state: je.isPackaged ? "idle" : "disabled" }, El = !1, la = !1;
const vl = (e) => Array.isArray(e) ? e.map((t) => typeof t == "string" ? t : typeof t == "object" && t !== null ? t.note ?? t.version ?? "" : "").filter(Boolean).join(`
`) : e && typeof e == "object" ? e.note ?? null : e ?? null, w_ = (e) => (t) => {
  Kn = t;
  const r = e();
  r && !r.isDestroyed() && r.webContents.send(y_, t);
}, E_ = (e) => (t) => {
  e({
    state: "downloading",
    percent: Math.round(t.percent * 10) / 10,
    transferredBytes: t.transferred,
    totalBytes: t.total,
    version: Kn.version
  });
};
function v_(e) {
  if (El) return;
  El = !0;
  const t = w_(e);
  if (W.handle("updater:last-status", async () => Kn), !je.isPackaged) {
    W.handle("updater:check-now", async () => ({ skipped: !0, reason: "dev" })), W.handle("updater:install-now", async () => ({ skipped: !0, reason: "dev" })), t({ state: "disabled" });
    return;
  }
  const r = process.env.INFINITY_UPDATER_URL;
  if (r)
    try {
      xe.autoUpdater.setFeedURL({ provider: "generic", url: r });
    } catch (s) {
      t({
        state: "error",
        errorMessage: s instanceof Error ? s.message : typeof s == "string" ? s : "无法设置更新源"
      });
    }
  xe.autoUpdater.autoDownload = !1, xe.autoUpdater.autoInstallOnAppQuit = !1, xe.autoUpdater.fullChangelog = !0;
  const n = async () => {
    if (la)
      return { skipped: !0 };
    la = !0;
    try {
      return await xe.autoUpdater.checkForUpdates(), { ok: !0 };
    } catch (s) {
      return t({
        state: "error",
        errorMessage: s instanceof Error ? s.message : typeof s == "string" ? s : "检查更新失败"
      }), { ok: !1 };
    } finally {
      la = !1;
    }
  };
  xe.autoUpdater.on("checking-for-update", () => {
    t({ state: "checking", version: Kn.version });
  }), xe.autoUpdater.on("update-available", (s) => {
    t({
      state: "available",
      version: s == null ? void 0 : s.version,
      releaseNotes: vl(s == null ? void 0 : s.releaseNotes)
    }), xe.autoUpdater.downloadUpdate().catch((l) => {
      t({
        state: "error",
        errorMessage: l instanceof Error ? l.message : typeof l == "string" ? l : "下载更新失败"
      });
    });
  }), xe.autoUpdater.on("update-not-available", () => {
    t({ state: "idle" });
  }), xe.autoUpdater.on("error", (s) => {
    t({
      state: "error",
      errorMessage: s instanceof Error ? s.message : String(s)
    });
  }), xe.autoUpdater.on("download-progress", E_(t)), xe.autoUpdater.on("update-downloaded", (s) => {
    t({
      state: "downloaded",
      version: s == null ? void 0 : s.version,
      releaseNotes: vl(s == null ? void 0 : s.releaseNotes)
    });
  }), W.handle("updater:check-now", async () => n()), W.handle("updater:install-now", async () => (setImmediate(() => {
    xe.autoUpdater.quitAndInstall(!0, !0);
  }), { ok: !0 }));
  const i = (s, l) => {
    const m = s ? Number(s) : NaN;
    return Number.isFinite(m) && m > 0 ? m : l;
  }, a = i(process.env.INFINITY_UPDATER_INITIAL_DELAY_MS, 15e3), o = i(process.env.INFINITY_UPDATER_INTERVAL_MS, 6 * 60 * 60 * 1e3);
  setTimeout(() => {
    n(), setInterval(() => {
      n();
    }, o);
  }, a);
}
const on = B.dirname(Gf(import.meta.url));
process.env.APP_ROOT = B.join(on, "..");
const ot = process.env.VITE_DEV_SERVER_URL, W_ = B.join(process.env.APP_ROOT, "dist-electron"), sn = B.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = ot ? B.join(process.env.APP_ROOT, "public") : sn;
let L, Ru = !1;
const qe = /* @__PURE__ */ new Map(), Qn = /* @__PURE__ */ new Map(), Ca = /* @__PURE__ */ new Map(), _l = { width: 130, height: 48 };
let Wr = {
  width: 400,
  height: 400
};
function Fu() {
  return B.join(je.getPath("userData"), "window-state.json");
}
function __() {
  try {
    const e = Fu();
    if (kn.existsSync(e)) {
      const t = kn.readFileSync(e, "utf-8");
      return JSON.parse(t);
    }
  } catch (e) {
    console.error("[Window] Failed to load window state:", e);
  }
  return null;
}
function xu() {
  if (!(!L || L.isDestroyed()))
    try {
      const e = {
        width: L.getSize()[0],
        height: L.getSize()[1],
        isMaximized: L.isMaximized()
      };
      if (!e.isMaximized) {
        const [r, n] = L.getPosition();
        e.x = r, e.y = n;
      }
      const t = Fu();
      kn.writeFileSync(t, JSON.stringify(e), "utf-8");
    } catch (e) {
      console.error("[Window] Failed to save window state:", e);
    }
}
function Lu() {
  const e = __(), t = {
    width: (e == null ? void 0 : e.width) ?? 700,
    height: (e == null ? void 0 : e.height) ?? 560,
    x: e == null ? void 0 : e.x,
    y: e == null ? void 0 : e.y,
    minWidth: 700,
    minHeight: 560,
    icon: B.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    frame: !1,
    titleBarStyle: "hidden",
    trafficLightPosition: { x: 12, y: 10 },
    show: !1,
    backgroundColor: "#FFFFFF",
    webPreferences: {
      preload: B.join(on, "preload.mjs")
    }
  };
  L = new zr(t), L.webContents.on("did-finish-load", () => {
    L == null || L.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  }), L.once("ready-to-show", () => {
    L == null || L.show(), e != null && e.isMaximized && (L == null || L.maximize());
  }), L.on("close", (r) => {
    if (process.platform === "darwin" && !Ru) {
      r.preventDefault(), L == null || L.hide();
      return;
    }
    xu(), L = null;
  }), ot ? L.loadURL(ot) : L.loadFile(B.join(sn, "index.html"));
}
je.on("window-all-closed", () => {
  process.platform !== "darwin" && (je.quit(), L = null);
});
je.on("activate", () => {
  L ? L.show() : zr.getAllWindows().length === 0 && Lu();
});
W.on("window-minimize", () => {
  L && L.minimize();
});
W.on("window-maximize", () => {
  L && (L.isMaximized() ? L.unmaximize() : L.maximize());
});
W.on("window-close", () => {
  L && (process.platform === "darwin" ? L.hide() : L.close());
});
W.handle("window-is-maximized", () => (L == null ? void 0 : L.isMaximized()) ?? !1);
W.on("window-double-click-titlebar", () => {
  L && (L.isMaximized() ? L.unmaximize() : L.maximize());
});
const S_ = je.requestSingleInstanceLock();
S_ ? je.on("second-instance", () => {
  L && (L.isMinimized() && L.restore(), L.show(), L.focus());
}) : je.quit();
je.on("before-quit", () => {
  Ru = !0, xu();
});
je.whenReady().then(async () => {
  await ue.initialize(), Lu(), v_(() => L ?? null);
});
W.handle("app:getVersion", () => je.getVersion());
W.handle("storage:getDefaultPath", () => ue.getDefaultPath());
W.handle("storage:getCurrentPath", () => ue.getCurrentPath());
W.handle("storage:isFirstLaunch", async () => await ue.isFirstLaunch());
W.handle("storage:markInitialized", async () => {
  await ue.markInitialized();
});
W.handle(
  "storage:setStoragePath",
  async (e, t, r) => {
    await ue.setStoragePath(t, r);
  }
);
W.handle("storage:healthCheck", async () => await ue.healthCheck());
W.handle("storage:openInFinder", async () => {
  await ue.openInFinder();
});
W.handle("storage:getStats", async () => await ue.getStats());
W.handle("storage:createBackup", async () => await ue.createBackup());
W.handle("storage:exportData", async (e, t) => {
  await ue.exportData(t);
});
W.handle("storage:resetAllData", async () => {
  await ue.resetAllData();
});
W.handle("storage:listFolders", async () => await ue.listFolders());
W.handle("storage:createFolder", async (e, t) => await ue.createFolder(t));
W.handle("storage:renameFolder", async (e, t, r) => await ue.renameFolder(t, r));
W.handle("storage:deleteFolder", async (e, t) => {
  await ue.deleteFolder(t);
});
W.handle("storage:listNotes", async (e, t) => await ue.listNotes(t));
W.handle("storage:createNote", async (e, t, r) => await ue.createNote(t, r));
W.handle("storage:getNote", async (e, t) => await ue.getNote(t));
W.handle("storage:updateNote", async (e, t, r) => await ue.updateNote(t, r));
W.handle("storage:deleteNote", async (e, t) => {
  await ue.deleteNote(t);
});
W.handle("dialog:showOpenDialog", async (e, t) => await qf.showOpenDialog(t));
W.handle("floating:createWindow", async (e, t) => {
  if (qe.has(t)) {
    const n = qe.get(t);
    if (n && !n.isDestroyed())
      return n.focus(), { success: !0, message: "窗口已存在" };
  }
  const r = new zr({
    width: Wr.width,
    height: Wr.height,
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
      preload: B.join(on, "preload.mjs")
    }
  });
  return ot ? r.loadURL(`${ot}#/floating/${t}`) : r.loadFile(B.join(sn, "index.html"), {
    hash: `/floating/${t}`
  }), r.once("ready-to-show", () => {
    r.show();
  }), r.on("closed", () => {
    qe.delete(t);
  }), qe.set(t, r), { success: !0, message: "创建成功" };
});
W.handle("floating:minimizeWindow", async (e, t) => {
  const r = qe.get(t);
  if (!r || r.isDestroyed())
    return { success: !1, message: "窗口不存在" };
  const n = r.getBounds();
  Ca.set(t, n);
  const i = new zr({
    width: _l.width,
    height: _l.height,
    x: n.x,
    y: n.y,
    frame: !1,
    transparent: !1,
    hasShadow: !0,
    alwaysOnTop: !0,
    resizable: !1,
    show: !1,
    backgroundColor: "#ffffff",
    webPreferences: {
      preload: B.join(on, "preload.mjs")
    }
  });
  return ot ? i.loadURL(`${ot}#/pill/${t}`) : i.loadFile(B.join(sn, "index.html"), {
    hash: `/pill/${t}`
  }), i.once("ready-to-show", () => {
    i.show(), r.close();
  }), i.on("closed", () => {
    Qn.delete(t);
  }), Qn.set(t, i), { success: !0 };
});
W.handle("floating:restoreWindow", async (e, t) => {
  const r = Qn.get(t);
  if (!r || r.isDestroyed())
    return { success: !1, message: "药丸窗口不存在" };
  const n = Ca.get(t);
  if (!n)
    return { success: !1, message: "未找到保存的窗口尺寸" };
  const i = new zr({
    width: n.width,
    height: n.height,
    x: n.x,
    y: n.y,
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
      preload: B.join(on, "preload.mjs")
    }
  });
  return ot ? i.loadURL(`${ot}#/floating/${t}`) : i.loadFile(B.join(sn, "index.html"), {
    hash: `/floating/${t}`
  }), i.once("ready-to-show", () => {
    i.show(), r.close();
  }), i.on("closed", () => {
    qe.delete(t);
  }), qe.set(t, i), Ca.delete(t), { success: !0 };
});
W.handle("floating:closeWindow", async (e, t) => {
  const r = qe.get(t);
  return r && !r.isDestroyed() ? (r.close(), qe.delete(t), { success: !0 }) : { success: !1, message: "窗口不存在" };
});
W.handle("floating:listWindows", async () => Array.from(qe.keys()).filter((t) => {
  const r = qe.get(t);
  return r && !r.isDestroyed();
}));
W.on("note:changed", (e, t) => {
  const r = Qn.get(t);
  r && !r.isDestroyed() && r.webContents.send("note:updated", t);
  const n = qe.get(t);
  n && !n.isDestroyed() && n.webContents.send("note:updated", t), L && !L.isDestroyed() && L.webContents.send("note:updated", t);
});
W.on("floating-note:changed", (e, t) => {
  L && !L.isDestroyed() && L.webContents.send("floating-note:updated", t);
});
W.handle("config:getDefaultFloatingWindowSize", async () => Wr);
W.handle(
  "config:setDefaultFloatingWindowSize",
  async (e, t) => (t.width && t.height && (Wr = {
    width: t.width,
    height: t.height
  }), Wr)
);
export {
  W_ as MAIN_DIST,
  sn as RENDERER_DIST,
  ot as VITE_DEV_SERVER_URL
};
