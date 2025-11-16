var qf = Object.defineProperty;
var Gf = (e, t, r) => t in e ? qf(e, t, { enumerable: !0, configurable: !0, writable: !0, value: r }) : e[t] = r;
var Gt = (e, t, r) => Gf(e, typeof t != "symbol" ? t + "" : t, r);
import kt, { app as ke, shell as Wf, ipcMain as j, BrowserWindow as zr, dialog as zf } from "electron";
import { fileURLToPath as Vf } from "node:url";
import B from "node:path";
import kn from "node:fs";
import Q from "node:fs/promises";
import { randomBytes as Yf } from "node:crypto";
import At from "fs";
import Xf from "constants";
import Vr from "stream";
import ba from "util";
import Tl from "assert";
import se from "path";
import Zn from "child_process";
import Cl from "events";
import Yr from "crypto";
import $l from "tty";
import ei from "os";
import cr from "url";
import Jf from "string_decoder";
import bl from "zlib";
import Kf from "http";
class ge extends Error {
  constructor(t, r, n) {
    super(r), this.code = t, this.details = n, this.name = "StorageError";
  }
}
class Qf {
  constructor() {
    Gt(this, "currentPath");
    Gt(this, "foldersCache", null);
    Gt(this, "notesIndexCache", null);
    Gt(this, "defaultPath");
    this.defaultPath = B.join(ke.getPath("userData"), "data-v1"), this.currentPath = this.defaultPath;
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
    console.log(`[Storage] First-time initialization at: ${t}`), await Q.mkdir(t, { recursive: !0 }), await Q.mkdir(B.join(t, "notes"), { recursive: !0 }), await Q.mkdir(B.join(t, "temp"), { recursive: !0 }), await Q.mkdir(B.join(t, "backups"), { recursive: !0 });
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
      const n = await Q.readdir(t);
      let i = 0;
      for (const a of n) {
        if (!a.endsWith(".tmp"))
          continue;
        const o = B.join(t, a), s = a.replace(".tmp", "");
        let l;
        if (s.startsWith("note-")) {
          const p = s.replace("note-", "").replace(".json", "");
          l = B.join(this.currentPath, "notes", `${p}.json`);
        } else
          l = B.join(this.currentPath, s);
        try {
          const p = await Q.readFile(o, "utf-8");
          JSON.parse(p), await Q.rename(o, l), i++, console.log(`[Storage] Recovered temp file: ${a}`);
        } catch (p) {
          console.warn(`[Storage] Removing corrupted temp file: ${a}`, p), await Q.unlink(o);
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
        if ((await Q.readdir(t)).length > 0)
          throw new Error("Target directory is not empty");
      } else
        await Q.mkdir(t, { recursive: !0 });
      await Q.access(t, kn.constants.W_OK);
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
    await Q.mkdir(r, { recursive: !0 });
    const n = await Q.readdir(t, { withFileTypes: !0 });
    for (const i of n) {
      const a = B.join(t, i.name), o = B.join(r, i.name);
      if (i.isDirectory()) {
        if (i.name === "temp" || i.name === "backups")
          continue;
        await this.copyDirectory(a, o);
      } else
        await Q.copyFile(a, o);
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
    await Wf.openPath(this.currentPath);
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
      console.log(`[Storage] Exporting data to: ${t}`), await Q.mkdir(t, { recursive: !0 }), await this.copyDirectory(this.currentPath, t), console.log("[Storage] Data exported successfully");
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
      const t = await Q.readdir(this.currentPath, { withFileTypes: !0 });
      for (const r of t) {
        const n = B.join(this.currentPath, r.name);
        r.isDirectory() ? await this.deleteDirectory(n) : await Q.unlink(n);
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
      const r = await Q.readdir(t, { withFileTypes: !0 });
      for (const n of r) {
        const i = B.join(t, n.name);
        n.isDirectory() ? await this.deleteDirectory(i) : await Q.unlink(i);
      }
      await Q.rmdir(t);
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
      const n = await Q.readdir(t, { withFileTypes: !0 });
      for (const i of n) {
        const a = B.join(t, i.name);
        if (i.isDirectory())
          r += await this.calculateDirectorySize(a);
        else {
          const o = await Q.stat(a);
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
    await Q.unlink(r);
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
    return Yf(8).toString("hex");
  }
  /**
   * 检查文件是否存在
   */
  async fileExists(t) {
    try {
      return await Q.access(t), !0;
    } catch {
      return !1;
    }
  }
  /**
   * 读取 JSON 文件
   */
  async readJsonFile(t, r) {
    try {
      const n = await Q.readFile(t, "utf-8");
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
      await Q.writeFile(t, n, "utf-8");
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
      await Q.writeFile(o, s, "utf-8"), await Q.rename(o, t);
    } catch (s) {
      try {
        await Q.unlink(o);
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
const ue = new Qf();
var Ie = typeof globalThis < "u" ? globalThis : typeof window < "u" ? window : typeof global < "u" ? global : typeof self < "u" ? self : {}, xe = {}, Bt = {}, De = {};
De.fromCallback = function(e) {
  return Object.defineProperty(function(...t) {
    if (typeof t[t.length - 1] == "function") e.apply(this, t);
    else
      return new Promise((r, n) => {
        t.push((i, a) => i != null ? n(i) : r(a)), e.apply(this, t);
      });
  }, "name", { value: e.name });
};
De.fromPromise = function(e) {
  return Object.defineProperty(function(...t) {
    const r = t[t.length - 1];
    if (typeof r != "function") return e.apply(this, t);
    t.pop(), e.apply(this, t).then((n) => r(null, n), r);
  }, "name", { value: e.name });
};
var dt = Xf, Zf = process.cwd, Fn = null, ed = process.env.GRACEFUL_FS_PLATFORM || process.platform;
process.cwd = function() {
  return Fn || (Fn = Zf.call(process)), Fn;
};
try {
  process.cwd();
} catch {
}
if (typeof process.chdir == "function") {
  var Co = process.chdir;
  process.chdir = function(e) {
    Fn = null, Co.call(process, e);
  }, Object.setPrototypeOf && Object.setPrototypeOf(process.chdir, Co);
}
var td = rd;
function rd(e) {
  dt.hasOwnProperty("O_SYMLINK") && process.version.match(/^v0\.6\.[0-2]|^v0\.5\./) && t(e), e.lutimes || r(e), e.chown = a(e.chown), e.fchown = a(e.fchown), e.lchown = a(e.lchown), e.chmod = n(e.chmod), e.fchmod = n(e.fchmod), e.lchmod = n(e.lchmod), e.chownSync = o(e.chownSync), e.fchownSync = o(e.fchownSync), e.lchownSync = o(e.lchownSync), e.chmodSync = i(e.chmodSync), e.fchmodSync = i(e.fchmodSync), e.lchmodSync = i(e.lchmodSync), e.stat = s(e.stat), e.fstat = s(e.fstat), e.lstat = s(e.lstat), e.statSync = l(e.statSync), e.fstatSync = l(e.fstatSync), e.lstatSync = l(e.lstatSync), e.chmod && !e.lchmod && (e.lchmod = function(c, f, h) {
    h && process.nextTick(h);
  }, e.lchmodSync = function() {
  }), e.chown && !e.lchown && (e.lchown = function(c, f, h, g) {
    g && process.nextTick(g);
  }, e.lchownSync = function() {
  }), ed === "win32" && (e.rename = typeof e.rename != "function" ? e.rename : function(c) {
    function f(h, g, v) {
      var w = Date.now(), S = 0;
      c(h, g, function T(A) {
        if (A && (A.code === "EACCES" || A.code === "EPERM" || A.code === "EBUSY") && Date.now() - w < 6e4) {
          setTimeout(function() {
            e.stat(g, function(F, N) {
              F && F.code === "ENOENT" ? c(h, g, T) : v(A);
            });
          }, S), S < 100 && (S += 10);
          return;
        }
        v && v(A);
      });
    }
    return Object.setPrototypeOf && Object.setPrototypeOf(f, c), f;
  }(e.rename)), e.read = typeof e.read != "function" ? e.read : function(c) {
    function f(h, g, v, w, S, T) {
      var A;
      if (T && typeof T == "function") {
        var F = 0;
        A = function(N, K, ne) {
          if (N && N.code === "EAGAIN" && F < 10)
            return F++, c.call(e, h, g, v, w, S, A);
          T.apply(this, arguments);
        };
      }
      return c.call(e, h, g, v, w, S, A);
    }
    return Object.setPrototypeOf && Object.setPrototypeOf(f, c), f;
  }(e.read), e.readSync = typeof e.readSync != "function" ? e.readSync : /* @__PURE__ */ function(c) {
    return function(f, h, g, v, w) {
      for (var S = 0; ; )
        try {
          return c.call(e, f, h, g, v, w);
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
        function(v, w) {
          if (v) {
            g && g(v);
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
      var g = c.openSync(f, dt.O_WRONLY | dt.O_SYMLINK, h), v = !0, w;
      try {
        w = c.fchmodSync(g, h), v = !1;
      } finally {
        if (v)
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
    dt.hasOwnProperty("O_SYMLINK") && c.futimes ? (c.lutimes = function(f, h, g, v) {
      c.open(f, dt.O_SYMLINK, function(w, S) {
        if (w) {
          v && v(w);
          return;
        }
        c.futimes(S, h, g, function(T) {
          c.close(S, function(A) {
            v && v(T || A);
          });
        });
      });
    }, c.lutimesSync = function(f, h, g) {
      var v = c.openSync(f, dt.O_SYMLINK), w, S = !0;
      try {
        w = c.futimesSync(v, h, g), S = !1;
      } finally {
        if (S)
          try {
            c.closeSync(v);
          } catch {
          }
        else
          c.closeSync(v);
      }
      return w;
    }) : c.futimes && (c.lutimes = function(f, h, g, v) {
      v && process.nextTick(v);
    }, c.lutimesSync = function() {
    });
  }
  function n(c) {
    return c && function(f, h, g) {
      return c.call(e, f, h, function(v) {
        p(v) && (v = null), g && g.apply(this, arguments);
      });
    };
  }
  function i(c) {
    return c && function(f, h) {
      try {
        return c.call(e, f, h);
      } catch (g) {
        if (!p(g)) throw g;
      }
    };
  }
  function a(c) {
    return c && function(f, h, g, v) {
      return c.call(e, f, h, g, function(w) {
        p(w) && (w = null), v && v.apply(this, arguments);
      });
    };
  }
  function o(c) {
    return c && function(f, h, g) {
      try {
        return c.call(e, f, h, g);
      } catch (v) {
        if (!p(v)) throw v;
      }
    };
  }
  function s(c) {
    return c && function(f, h, g) {
      typeof h == "function" && (g = h, h = null);
      function v(w, S) {
        S && (S.uid < 0 && (S.uid += 4294967296), S.gid < 0 && (S.gid += 4294967296)), g && g.apply(this, arguments);
      }
      return h ? c.call(e, f, h, v) : c.call(e, f, v);
    };
  }
  function l(c) {
    return c && function(f, h) {
      var g = h ? c.call(e, f, h) : c.call(e, f);
      return g && (g.uid < 0 && (g.uid += 4294967296), g.gid < 0 && (g.gid += 4294967296)), g;
    };
  }
  function p(c) {
    if (!c || c.code === "ENOSYS")
      return !0;
    var f = !process.getuid || process.getuid() !== 0;
    return !!(f && (c.code === "EINVAL" || c.code === "EPERM"));
  }
}
var $o = Vr.Stream, nd = id;
function id(e) {
  return {
    ReadStream: t,
    WriteStream: r
  };
  function t(n, i) {
    if (!(this instanceof t)) return new t(n, i);
    $o.call(this);
    var a = this;
    this.path = n, this.fd = null, this.readable = !0, this.paused = !1, this.flags = "r", this.mode = 438, this.bufferSize = 64 * 1024, i = i || {};
    for (var o = Object.keys(i), s = 0, l = o.length; s < l; s++) {
      var p = o[s];
      this[p] = i[p];
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
    $o.call(this), this.path = n, this.fd = null, this.writable = !0, this.flags = "w", this.encoding = "binary", this.mode = 438, this.bytesWritten = 0, i = i || {};
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
var ad = sd, od = Object.getPrototypeOf || function(e) {
  return e.__proto__;
};
function sd(e) {
  if (e === null || typeof e != "object")
    return e;
  if (e instanceof Object)
    var t = { __proto__: od(e) };
  else
    var t = /* @__PURE__ */ Object.create(null);
  return Object.getOwnPropertyNames(e).forEach(function(r) {
    Object.defineProperty(t, r, Object.getOwnPropertyDescriptor(e, r));
  }), t;
}
var oe = At, ld = td, cd = nd, ud = ad, wn = ba, _e, Mn;
typeof Symbol == "function" && typeof Symbol.for == "function" ? (_e = Symbol.for("graceful-fs.queue"), Mn = Symbol.for("graceful-fs.previous")) : (_e = "___graceful-fs.queue", Mn = "___graceful-fs.previous");
function fd() {
}
function Il(e, t) {
  Object.defineProperty(e, _e, {
    get: function() {
      return t;
    }
  });
}
var Lt = fd;
wn.debuglog ? Lt = wn.debuglog("gfs4") : /\bgfs4\b/i.test(process.env.NODE_DEBUG || "") && (Lt = function() {
  var e = wn.format.apply(wn, arguments);
  e = "GFS4: " + e.split(/\n/).join(`
GFS4: `), console.error(e);
});
if (!oe[_e]) {
  var dd = Ie[_e] || [];
  Il(oe, dd), oe.close = function(e) {
    function t(r, n) {
      return e.call(oe, r, function(i) {
        i || bo(), typeof n == "function" && n.apply(this, arguments);
      });
    }
    return Object.defineProperty(t, Mn, {
      value: e
    }), t;
  }(oe.close), oe.closeSync = function(e) {
    function t(r) {
      e.apply(oe, arguments), bo();
    }
    return Object.defineProperty(t, Mn, {
      value: e
    }), t;
  }(oe.closeSync), /\bgfs4\b/i.test(process.env.NODE_DEBUG || "") && process.on("exit", function() {
    Lt(oe[_e]), Tl.equal(oe[_e].length, 0);
  });
}
Ie[_e] || Il(Ie, oe[_e]);
var Ne = Ia(ud(oe));
process.env.TEST_GRACEFUL_FS_GLOBAL_PATCH && !oe.__patched && (Ne = Ia(oe), oe.__patched = !0);
function Ia(e) {
  ld(e), e.gracefulify = Ia, e.createReadStream = K, e.createWriteStream = ne;
  var t = e.readFile;
  e.readFile = r;
  function r(y, z, q) {
    return typeof z == "function" && (q = z, z = null), H(y, z, q);
    function H(Z, O, b, D) {
      return t(Z, O, function($) {
        $ && ($.code === "EMFILE" || $.code === "ENFILE") ? Wt([H, [Z, O, b], $, D || Date.now(), Date.now()]) : typeof b == "function" && b.apply(this, arguments);
      });
    }
  }
  var n = e.writeFile;
  e.writeFile = i;
  function i(y, z, q, H) {
    return typeof q == "function" && (H = q, q = null), Z(y, z, q, H);
    function Z(O, b, D, $, R) {
      return n(O, b, D, function(P) {
        P && (P.code === "EMFILE" || P.code === "ENFILE") ? Wt([Z, [O, b, D, $], P, R || Date.now(), Date.now()]) : typeof $ == "function" && $.apply(this, arguments);
      });
    }
  }
  var a = e.appendFile;
  a && (e.appendFile = o);
  function o(y, z, q, H) {
    return typeof q == "function" && (H = q, q = null), Z(y, z, q, H);
    function Z(O, b, D, $, R) {
      return a(O, b, D, function(P) {
        P && (P.code === "EMFILE" || P.code === "ENFILE") ? Wt([Z, [O, b, D, $], P, R || Date.now(), Date.now()]) : typeof $ == "function" && $.apply(this, arguments);
      });
    }
  }
  var s = e.copyFile;
  s && (e.copyFile = l);
  function l(y, z, q, H) {
    return typeof q == "function" && (H = q, q = 0), Z(y, z, q, H);
    function Z(O, b, D, $, R) {
      return s(O, b, D, function(P) {
        P && (P.code === "EMFILE" || P.code === "ENFILE") ? Wt([Z, [O, b, D, $], P, R || Date.now(), Date.now()]) : typeof $ == "function" && $.apply(this, arguments);
      });
    }
  }
  var p = e.readdir;
  e.readdir = f;
  var c = /^v[0-5]\./;
  function f(y, z, q) {
    typeof z == "function" && (q = z, z = null);
    var H = c.test(process.version) ? function(b, D, $, R) {
      return p(b, Z(
        b,
        D,
        $,
        R
      ));
    } : function(b, D, $, R) {
      return p(b, D, Z(
        b,
        D,
        $,
        R
      ));
    };
    return H(y, z, q);
    function Z(O, b, D, $) {
      return function(R, P) {
        R && (R.code === "EMFILE" || R.code === "ENFILE") ? Wt([
          H,
          [O, b, D],
          R,
          $ || Date.now(),
          Date.now()
        ]) : (P && P.sort && P.sort(), typeof D == "function" && D.call(this, R, P));
      };
    }
  }
  if (process.version.substr(0, 4) === "v0.8") {
    var h = cd(e);
    T = h.ReadStream, F = h.WriteStream;
  }
  var g = e.ReadStream;
  g && (T.prototype = Object.create(g.prototype), T.prototype.open = A);
  var v = e.WriteStream;
  v && (F.prototype = Object.create(v.prototype), F.prototype.open = N), Object.defineProperty(e, "ReadStream", {
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
      return F;
    },
    set: function(y) {
      F = y;
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
  var S = F;
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
    Me(y.path, y.flags, y.mode, function(z, q) {
      z ? (y.autoClose && y.destroy(), y.emit("error", z)) : (y.fd = q, y.emit("open", q), y.read());
    });
  }
  function F(y, z) {
    return this instanceof F ? (v.apply(this, arguments), this) : F.apply(Object.create(F.prototype), arguments);
  }
  function N() {
    var y = this;
    Me(y.path, y.flags, y.mode, function(z, q) {
      z ? (y.destroy(), y.emit("error", z)) : (y.fd = q, y.emit("open", q));
    });
  }
  function K(y, z) {
    return new e.ReadStream(y, z);
  }
  function ne(y, z) {
    return new e.WriteStream(y, z);
  }
  var Y = e.open;
  e.open = Me;
  function Me(y, z, q, H) {
    return typeof q == "function" && (H = q, q = null), Z(y, z, q, H);
    function Z(O, b, D, $, R) {
      return Y(O, b, D, function(P, M) {
        P && (P.code === "EMFILE" || P.code === "ENFILE") ? Wt([Z, [O, b, D, $], P, R || Date.now(), Date.now()]) : typeof $ == "function" && $.apply(this, arguments);
      });
    }
  }
  return e;
}
function Wt(e) {
  Lt("ENQUEUE", e[0].name, e[1]), oe[_e].push(e), Oa();
}
var En;
function bo() {
  for (var e = Date.now(), t = 0; t < oe[_e].length; ++t)
    oe[_e][t].length > 2 && (oe[_e][t][3] = e, oe[_e][t][4] = e);
  Oa();
}
function Oa() {
  if (clearTimeout(En), En = void 0, oe[_e].length !== 0) {
    var e = oe[_e].shift(), t = e[0], r = e[1], n = e[2], i = e[3], a = e[4];
    if (i === void 0)
      Lt("RETRY", t.name, r), t.apply(null, r);
    else if (Date.now() - i >= 6e4) {
      Lt("TIMEOUT", t.name, r);
      var o = r.pop();
      typeof o == "function" && o.call(null, n);
    } else {
      var s = Date.now() - a, l = Math.max(a - i, 1), p = Math.min(l * 1.2, 100);
      s >= p ? (Lt("RETRY", t.name, r), t.apply(null, r.concat([i]))) : oe[_e].push(e);
    }
    En === void 0 && (En = setTimeout(Oa, 0));
  }
}
(function(e) {
  const t = De.fromCallback, r = Ne, n = [
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
  }, e.read = function(i, a, o, s, l, p) {
    return typeof p == "function" ? r.read(i, a, o, s, l, p) : new Promise((c, f) => {
      r.read(i, a, o, s, l, (h, g, v) => {
        if (h) return f(h);
        c({ bytesRead: g, buffer: v });
      });
    });
  }, e.write = function(i, a, ...o) {
    return typeof o[o.length - 1] == "function" ? r.write(i, a, ...o) : new Promise((s, l) => {
      r.write(i, a, ...o, (p, c, f) => {
        if (p) return l(p);
        s({ bytesWritten: c, buffer: f });
      });
    });
  }, typeof r.writev == "function" && (e.writev = function(i, a, ...o) {
    return typeof o[o.length - 1] == "function" ? r.writev(i, a, ...o) : new Promise((s, l) => {
      r.writev(i, a, ...o, (p, c, f) => {
        if (p) return l(p);
        s({ bytesWritten: c, buffers: f });
      });
    });
  }), typeof r.realpath.native == "function" ? e.realpath.native = t(r.realpath.native) : process.emitWarning(
    "fs.realpath.native is not a function. Is fs being monkey-patched?",
    "Warning",
    "fs-extra-WARN0003"
  );
})(Bt);
var Pa = {}, Ol = {};
const hd = se;
Ol.checkPath = function(t) {
  if (process.platform === "win32" && /[<>:"|?*]/.test(t.replace(hd.parse(t).root, ""))) {
    const n = new Error(`Path contains invalid characters: ${t}`);
    throw n.code = "EINVAL", n;
  }
};
const Pl = Bt, { checkPath: Dl } = Ol, Nl = (e) => {
  const t = { mode: 511 };
  return typeof e == "number" ? e : { ...t, ...e }.mode;
};
Pa.makeDir = async (e, t) => (Dl(e), Pl.mkdir(e, {
  mode: Nl(t),
  recursive: !0
}));
Pa.makeDirSync = (e, t) => (Dl(e), Pl.mkdirSync(e, {
  mode: Nl(t),
  recursive: !0
}));
const pd = De.fromPromise, { makeDir: md, makeDirSync: Ni } = Pa, Ri = pd(md);
var tt = {
  mkdirs: Ri,
  mkdirsSync: Ni,
  // alias
  mkdirp: Ri,
  mkdirpSync: Ni,
  ensureDir: Ri,
  ensureDirSync: Ni
};
const gd = De.fromPromise, Rl = Bt;
function yd(e) {
  return Rl.access(e).then(() => !0).catch(() => !1);
}
var jt = {
  pathExists: gd(yd),
  pathExistsSync: Rl.existsSync
};
const nr = Ne;
function wd(e, t, r, n) {
  nr.open(e, "r+", (i, a) => {
    if (i) return n(i);
    nr.futimes(a, t, r, (o) => {
      nr.close(a, (s) => {
        n && n(o || s);
      });
    });
  });
}
function Ed(e, t, r) {
  const n = nr.openSync(e, "r+");
  return nr.futimesSync(n, t, r), nr.closeSync(n);
}
var Fl = {
  utimesMillis: wd,
  utimesMillisSync: Ed
};
const ar = Bt, ye = se, vd = ba;
function _d(e, t, r) {
  const n = r.dereference ? (i) => ar.stat(i, { bigint: !0 }) : (i) => ar.lstat(i, { bigint: !0 });
  return Promise.all([
    n(e),
    n(t).catch((i) => {
      if (i.code === "ENOENT") return null;
      throw i;
    })
  ]).then(([i, a]) => ({ srcStat: i, destStat: a }));
}
function Sd(e, t, r) {
  let n;
  const i = r.dereference ? (o) => ar.statSync(o, { bigint: !0 }) : (o) => ar.lstatSync(o, { bigint: !0 }), a = i(e);
  try {
    n = i(t);
  } catch (o) {
    if (o.code === "ENOENT") return { srcStat: a, destStat: null };
    throw o;
  }
  return { srcStat: a, destStat: n };
}
function Ad(e, t, r, n, i) {
  vd.callbackify(_d)(e, t, n, (a, o) => {
    if (a) return i(a);
    const { srcStat: s, destStat: l } = o;
    if (l) {
      if (Xr(s, l)) {
        const p = ye.basename(e), c = ye.basename(t);
        return r === "move" && p !== c && p.toLowerCase() === c.toLowerCase() ? i(null, { srcStat: s, destStat: l, isChangingCase: !0 }) : i(new Error("Source and destination must not be the same."));
      }
      if (s.isDirectory() && !l.isDirectory())
        return i(new Error(`Cannot overwrite non-directory '${t}' with directory '${e}'.`));
      if (!s.isDirectory() && l.isDirectory())
        return i(new Error(`Cannot overwrite directory '${t}' with non-directory '${e}'.`));
    }
    return s.isDirectory() && Da(e, t) ? i(new Error(ti(e, t, r))) : i(null, { srcStat: s, destStat: l });
  });
}
function Td(e, t, r, n) {
  const { srcStat: i, destStat: a } = Sd(e, t, n);
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
function xl(e, t, r, n, i) {
  const a = ye.resolve(ye.dirname(e)), o = ye.resolve(ye.dirname(r));
  if (o === a || o === ye.parse(o).root) return i();
  ar.stat(o, { bigint: !0 }, (s, l) => s ? s.code === "ENOENT" ? i() : i(s) : Xr(t, l) ? i(new Error(ti(e, r, n))) : xl(e, t, o, n, i));
}
function Ll(e, t, r, n) {
  const i = ye.resolve(ye.dirname(e)), a = ye.resolve(ye.dirname(r));
  if (a === i || a === ye.parse(a).root) return;
  let o;
  try {
    o = ar.statSync(a, { bigint: !0 });
  } catch (s) {
    if (s.code === "ENOENT") return;
    throw s;
  }
  if (Xr(t, o))
    throw new Error(ti(e, r, n));
  return Ll(e, t, a, n);
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
var ur = {
  checkPaths: Ad,
  checkPathsSync: Td,
  checkParentPaths: xl,
  checkParentPathsSync: Ll,
  isSrcSubdir: Da,
  areIdentical: Xr
};
const Le = Ne, Pr = se, Cd = tt.mkdirs, $d = jt.pathExists, bd = Fl.utimesMillis, Dr = ur;
function Id(e, t, r, n) {
  typeof r == "function" && !n ? (n = r, r = {}) : typeof r == "function" && (r = { filter: r }), n = n || function() {
  }, r = r || {}, r.clobber = "clobber" in r ? !!r.clobber : !0, r.overwrite = "overwrite" in r ? !!r.overwrite : r.clobber, r.preserveTimestamps && process.arch === "ia32" && process.emitWarning(
    `Using the preserveTimestamps option in 32-bit node is not recommended;

	see https://github.com/jprichardson/node-fs-extra/issues/269`,
    "Warning",
    "fs-extra-WARN0001"
  ), Dr.checkPaths(e, t, "copy", r, (i, a) => {
    if (i) return n(i);
    const { srcStat: o, destStat: s } = a;
    Dr.checkParentPaths(e, o, t, "copy", (l) => l ? n(l) : r.filter ? Ul(Io, s, e, t, r, n) : Io(s, e, t, r, n));
  });
}
function Io(e, t, r, n, i) {
  const a = Pr.dirname(r);
  $d(a, (o, s) => {
    if (o) return i(o);
    if (s) return Bn(e, t, r, n, i);
    Cd(a, (l) => l ? i(l) : Bn(e, t, r, n, i));
  });
}
function Ul(e, t, r, n, i, a) {
  Promise.resolve(i.filter(r, n)).then((o) => o ? e(t, r, n, i, a) : a(), (o) => a(o));
}
function Od(e, t, r, n, i) {
  return n.filter ? Ul(Bn, e, t, r, n, i) : Bn(e, t, r, n, i);
}
function Bn(e, t, r, n, i) {
  (n.dereference ? Le.stat : Le.lstat)(t, (o, s) => o ? i(o) : s.isDirectory() ? Ld(s, e, t, r, n, i) : s.isFile() || s.isCharacterDevice() || s.isBlockDevice() ? Pd(s, e, t, r, n, i) : s.isSymbolicLink() ? Md(e, t, r, n, i) : s.isSocket() ? i(new Error(`Cannot copy a socket file: ${t}`)) : s.isFIFO() ? i(new Error(`Cannot copy a FIFO pipe: ${t}`)) : i(new Error(`Unknown file: ${t}`)));
}
function Pd(e, t, r, n, i, a) {
  return t ? Dd(e, r, n, i, a) : kl(e, r, n, i, a);
}
function Dd(e, t, r, n, i) {
  if (n.overwrite)
    Le.unlink(r, (a) => a ? i(a) : kl(e, t, r, n, i));
  else return n.errorOnExist ? i(new Error(`'${r}' already exists`)) : i();
}
function kl(e, t, r, n, i) {
  Le.copyFile(t, r, (a) => a ? i(a) : n.preserveTimestamps ? Nd(e.mode, t, r, i) : ri(r, e.mode, i));
}
function Nd(e, t, r, n) {
  return Rd(e) ? Fd(r, e, (i) => i ? n(i) : Oo(e, t, r, n)) : Oo(e, t, r, n);
}
function Rd(e) {
  return (e & 128) === 0;
}
function Fd(e, t, r) {
  return ri(e, t | 128, r);
}
function Oo(e, t, r, n) {
  xd(t, r, (i) => i ? n(i) : ri(r, e, n));
}
function ri(e, t, r) {
  return Le.chmod(e, t, r);
}
function xd(e, t, r) {
  Le.stat(e, (n, i) => n ? r(n) : bd(t, i.atime, i.mtime, r));
}
function Ld(e, t, r, n, i, a) {
  return t ? Ml(r, n, i, a) : Ud(e.mode, r, n, i, a);
}
function Ud(e, t, r, n, i) {
  Le.mkdir(r, (a) => {
    if (a) return i(a);
    Ml(t, r, n, (o) => o ? i(o) : ri(r, e, i));
  });
}
function Ml(e, t, r, n) {
  Le.readdir(e, (i, a) => i ? n(i) : Bl(a, e, t, r, n));
}
function Bl(e, t, r, n, i) {
  const a = e.pop();
  return a ? kd(e, a, t, r, n, i) : i();
}
function kd(e, t, r, n, i, a) {
  const o = Pr.join(r, t), s = Pr.join(n, t);
  Dr.checkPaths(o, s, "copy", i, (l, p) => {
    if (l) return a(l);
    const { destStat: c } = p;
    Od(c, o, s, i, (f) => f ? a(f) : Bl(e, r, n, i, a));
  });
}
function Md(e, t, r, n, i) {
  Le.readlink(t, (a, o) => {
    if (a) return i(a);
    if (n.dereference && (o = Pr.resolve(process.cwd(), o)), e)
      Le.readlink(r, (s, l) => s ? s.code === "EINVAL" || s.code === "UNKNOWN" ? Le.symlink(o, r, i) : i(s) : (n.dereference && (l = Pr.resolve(process.cwd(), l)), Dr.isSrcSubdir(o, l) ? i(new Error(`Cannot copy '${o}' to a subdirectory of itself, '${l}'.`)) : e.isDirectory() && Dr.isSrcSubdir(l, o) ? i(new Error(`Cannot overwrite '${l}' with '${o}'.`)) : Bd(o, r, i)));
    else
      return Le.symlink(o, r, i);
  });
}
function Bd(e, t, r) {
  Le.unlink(t, (n) => n ? r(n) : Le.symlink(e, t, r));
}
var jd = Id;
const Ce = Ne, Nr = se, Hd = tt.mkdirsSync, qd = Fl.utimesMillisSync, Rr = ur;
function Gd(e, t, r) {
  typeof r == "function" && (r = { filter: r }), r = r || {}, r.clobber = "clobber" in r ? !!r.clobber : !0, r.overwrite = "overwrite" in r ? !!r.overwrite : r.clobber, r.preserveTimestamps && process.arch === "ia32" && process.emitWarning(
    `Using the preserveTimestamps option in 32-bit node is not recommended;

	see https://github.com/jprichardson/node-fs-extra/issues/269`,
    "Warning",
    "fs-extra-WARN0002"
  );
  const { srcStat: n, destStat: i } = Rr.checkPathsSync(e, t, "copy", r);
  return Rr.checkParentPathsSync(e, n, t, "copy"), Wd(i, e, t, r);
}
function Wd(e, t, r, n) {
  if (n.filter && !n.filter(t, r)) return;
  const i = Nr.dirname(r);
  return Ce.existsSync(i) || Hd(i), jl(e, t, r, n);
}
function zd(e, t, r, n) {
  if (!(n.filter && !n.filter(t, r)))
    return jl(e, t, r, n);
}
function jl(e, t, r, n) {
  const a = (n.dereference ? Ce.statSync : Ce.lstatSync)(t);
  if (a.isDirectory()) return Zd(a, e, t, r, n);
  if (a.isFile() || a.isCharacterDevice() || a.isBlockDevice()) return Vd(a, e, t, r, n);
  if (a.isSymbolicLink()) return rh(e, t, r, n);
  throw a.isSocket() ? new Error(`Cannot copy a socket file: ${t}`) : a.isFIFO() ? new Error(`Cannot copy a FIFO pipe: ${t}`) : new Error(`Unknown file: ${t}`);
}
function Vd(e, t, r, n, i) {
  return t ? Yd(e, r, n, i) : Hl(e, r, n, i);
}
function Yd(e, t, r, n) {
  if (n.overwrite)
    return Ce.unlinkSync(r), Hl(e, t, r, n);
  if (n.errorOnExist)
    throw new Error(`'${r}' already exists`);
}
function Hl(e, t, r, n) {
  return Ce.copyFileSync(t, r), n.preserveTimestamps && Xd(e.mode, t, r), Na(r, e.mode);
}
function Xd(e, t, r) {
  return Jd(e) && Kd(r, e), Qd(t, r);
}
function Jd(e) {
  return (e & 128) === 0;
}
function Kd(e, t) {
  return Na(e, t | 128);
}
function Na(e, t) {
  return Ce.chmodSync(e, t);
}
function Qd(e, t) {
  const r = Ce.statSync(e);
  return qd(t, r.atime, r.mtime);
}
function Zd(e, t, r, n, i) {
  return t ? ql(r, n, i) : eh(e.mode, r, n, i);
}
function eh(e, t, r, n) {
  return Ce.mkdirSync(r), ql(t, r, n), Na(r, e);
}
function ql(e, t, r) {
  Ce.readdirSync(e).forEach((n) => th(n, e, t, r));
}
function th(e, t, r, n) {
  const i = Nr.join(t, e), a = Nr.join(r, e), { destStat: o } = Rr.checkPathsSync(i, a, "copy", n);
  return zd(o, i, a, n);
}
function rh(e, t, r, n) {
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
    return nh(i, r);
  } else
    return Ce.symlinkSync(i, r);
}
function nh(e, t) {
  return Ce.unlinkSync(t), Ce.symlinkSync(e, t);
}
var ih = Gd;
const ah = De.fromCallback;
var Ra = {
  copy: ah(jd),
  copySync: ih
};
const Po = Ne, Gl = se, te = Tl, Fr = process.platform === "win32";
function Wl(e) {
  [
    "unlink",
    "chmod",
    "stat",
    "lstat",
    "rmdir",
    "readdir"
  ].forEach((r) => {
    e[r] = e[r] || Po[r], r = r + "Sync", e[r] = e[r] || Po[r];
  }), e.maxBusyTries = e.maxBusyTries || 3;
}
function Fa(e, t, r) {
  let n = 0;
  typeof t == "function" && (r = t, t = {}), te(e, "rimraf: missing path"), te.strictEqual(typeof e, "string", "rimraf: path should be a string"), te.strictEqual(typeof r, "function", "rimraf: callback function required"), te(t, "rimraf: invalid options argument provided"), te.strictEqual(typeof t, "object", "rimraf: options should be object"), Wl(t), Do(e, t, function i(a) {
    if (a) {
      if ((a.code === "EBUSY" || a.code === "ENOTEMPTY" || a.code === "EPERM") && n < t.maxBusyTries) {
        n++;
        const o = n * 100;
        return setTimeout(() => Do(e, t, i), o);
      }
      a.code === "ENOENT" && (a = null);
    }
    r(a);
  });
}
function Do(e, t, r) {
  te(e), te(t), te(typeof r == "function"), t.lstat(e, (n, i) => {
    if (n && n.code === "ENOENT")
      return r(null);
    if (n && n.code === "EPERM" && Fr)
      return No(e, t, n, r);
    if (i && i.isDirectory())
      return xn(e, t, n, r);
    t.unlink(e, (a) => {
      if (a) {
        if (a.code === "ENOENT")
          return r(null);
        if (a.code === "EPERM")
          return Fr ? No(e, t, a, r) : xn(e, t, a, r);
        if (a.code === "EISDIR")
          return xn(e, t, a, r);
      }
      return r(a);
    });
  });
}
function No(e, t, r, n) {
  te(e), te(t), te(typeof n == "function"), t.chmod(e, 438, (i) => {
    i ? n(i.code === "ENOENT" ? null : r) : t.stat(e, (a, o) => {
      a ? n(a.code === "ENOENT" ? null : r) : o.isDirectory() ? xn(e, t, r, n) : t.unlink(e, n);
    });
  });
}
function Ro(e, t, r) {
  let n;
  te(e), te(t);
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
  te(e), te(t), te(typeof n == "function"), t.rmdir(e, (i) => {
    i && (i.code === "ENOTEMPTY" || i.code === "EEXIST" || i.code === "EPERM") ? oh(e, t, n) : i && i.code === "ENOTDIR" ? n(r) : n(i);
  });
}
function oh(e, t, r) {
  te(e), te(t), te(typeof r == "function"), t.readdir(e, (n, i) => {
    if (n) return r(n);
    let a = i.length, o;
    if (a === 0) return t.rmdir(e, r);
    i.forEach((s) => {
      Fa(Gl.join(e, s), t, (l) => {
        if (!o) {
          if (l) return r(o = l);
          --a === 0 && t.rmdir(e, r);
        }
      });
    });
  });
}
function zl(e, t) {
  let r;
  t = t || {}, Wl(t), te(e, "rimraf: missing path"), te.strictEqual(typeof e, "string", "rimraf: path should be a string"), te(t, "rimraf: missing options"), te.strictEqual(typeof t, "object", "rimraf: options should be object");
  try {
    r = t.lstatSync(e);
  } catch (n) {
    if (n.code === "ENOENT")
      return;
    n.code === "EPERM" && Fr && Ro(e, t, n);
  }
  try {
    r && r.isDirectory() ? Ln(e, t, null) : t.unlinkSync(e);
  } catch (n) {
    if (n.code === "ENOENT")
      return;
    if (n.code === "EPERM")
      return Fr ? Ro(e, t, n) : Ln(e, t, n);
    if (n.code !== "EISDIR")
      throw n;
    Ln(e, t, n);
  }
}
function Ln(e, t, r) {
  te(e), te(t);
  try {
    t.rmdirSync(e);
  } catch (n) {
    if (n.code === "ENOTDIR")
      throw r;
    if (n.code === "ENOTEMPTY" || n.code === "EEXIST" || n.code === "EPERM")
      sh(e, t);
    else if (n.code !== "ENOENT")
      throw n;
  }
}
function sh(e, t) {
  if (te(e), te(t), t.readdirSync(e).forEach((r) => zl(Gl.join(e, r), t)), Fr) {
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
var lh = Fa;
Fa.sync = zl;
const jn = Ne, ch = De.fromCallback, Vl = lh;
function uh(e, t) {
  if (jn.rm) return jn.rm(e, { recursive: !0, force: !0 }, t);
  Vl(e, t);
}
function fh(e) {
  if (jn.rmSync) return jn.rmSync(e, { recursive: !0, force: !0 });
  Vl.sync(e);
}
var ni = {
  remove: ch(uh),
  removeSync: fh
};
const dh = De.fromPromise, Yl = Bt, Xl = se, Jl = tt, Kl = ni, Fo = dh(async function(t) {
  let r;
  try {
    r = await Yl.readdir(t);
  } catch {
    return Jl.mkdirs(t);
  }
  return Promise.all(r.map((n) => Kl.remove(Xl.join(t, n))));
});
function xo(e) {
  let t;
  try {
    t = Yl.readdirSync(e);
  } catch {
    return Jl.mkdirsSync(e);
  }
  t.forEach((r) => {
    r = Xl.join(e, r), Kl.removeSync(r);
  });
}
var hh = {
  emptyDirSync: xo,
  emptydirSync: xo,
  emptyDir: Fo,
  emptydir: Fo
};
const ph = De.fromCallback, Ql = se, mt = Ne, Zl = tt;
function mh(e, t) {
  function r() {
    mt.writeFile(e, "", (n) => {
      if (n) return t(n);
      t();
    });
  }
  mt.stat(e, (n, i) => {
    if (!n && i.isFile()) return t();
    const a = Ql.dirname(e);
    mt.stat(a, (o, s) => {
      if (o)
        return o.code === "ENOENT" ? Zl.mkdirs(a, (l) => {
          if (l) return t(l);
          r();
        }) : t(o);
      s.isDirectory() ? r() : mt.readdir(a, (l) => {
        if (l) return t(l);
      });
    });
  });
}
function gh(e) {
  let t;
  try {
    t = mt.statSync(e);
  } catch {
  }
  if (t && t.isFile()) return;
  const r = Ql.dirname(e);
  try {
    mt.statSync(r).isDirectory() || mt.readdirSync(r);
  } catch (n) {
    if (n && n.code === "ENOENT") Zl.mkdirsSync(r);
    else throw n;
  }
  mt.writeFileSync(e, "");
}
var yh = {
  createFile: ph(mh),
  createFileSync: gh
};
const wh = De.fromCallback, ec = se, pt = Ne, tc = tt, Eh = jt.pathExists, { areIdentical: rc } = ur;
function vh(e, t, r) {
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
      if (a && rc(s, a)) return r(null);
      const l = ec.dirname(t);
      Eh(l, (p, c) => {
        if (p) return r(p);
        if (c) return n(e, t);
        tc.mkdirs(l, (f) => {
          if (f) return r(f);
          n(e, t);
        });
      });
    });
  });
}
function _h(e, t) {
  let r;
  try {
    r = pt.lstatSync(t);
  } catch {
  }
  try {
    const a = pt.lstatSync(e);
    if (r && rc(a, r)) return;
  } catch (a) {
    throw a.message = a.message.replace("lstat", "ensureLink"), a;
  }
  const n = ec.dirname(t);
  return pt.existsSync(n) || tc.mkdirsSync(n), pt.linkSync(e, t);
}
var Sh = {
  createLink: wh(vh),
  createLinkSync: _h
};
const gt = se, $r = Ne, Ah = jt.pathExists;
function Th(e, t, r) {
  if (gt.isAbsolute(e))
    return $r.lstat(e, (n) => n ? (n.message = n.message.replace("lstat", "ensureSymlink"), r(n)) : r(null, {
      toCwd: e,
      toDst: e
    }));
  {
    const n = gt.dirname(t), i = gt.join(n, e);
    return Ah(i, (a, o) => a ? r(a) : o ? r(null, {
      toCwd: i,
      toDst: e
    }) : $r.lstat(e, (s) => s ? (s.message = s.message.replace("lstat", "ensureSymlink"), r(s)) : r(null, {
      toCwd: e,
      toDst: gt.relative(n, e)
    })));
  }
}
function Ch(e, t) {
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
var $h = {
  symlinkPaths: Th,
  symlinkPathsSync: Ch
};
const nc = Ne;
function bh(e, t, r) {
  if (r = typeof t == "function" ? t : r, t = typeof t == "function" ? !1 : t, t) return r(null, t);
  nc.lstat(e, (n, i) => {
    if (n) return r(null, "file");
    t = i && i.isDirectory() ? "dir" : "file", r(null, t);
  });
}
function Ih(e, t) {
  let r;
  if (t) return t;
  try {
    r = nc.lstatSync(e);
  } catch {
    return "file";
  }
  return r && r.isDirectory() ? "dir" : "file";
}
var Oh = {
  symlinkType: bh,
  symlinkTypeSync: Ih
};
const Ph = De.fromCallback, ic = se, Ve = Bt, ac = tt, Dh = ac.mkdirs, Nh = ac.mkdirsSync, oc = $h, Rh = oc.symlinkPaths, Fh = oc.symlinkPathsSync, sc = Oh, xh = sc.symlinkType, Lh = sc.symlinkTypeSync, Uh = jt.pathExists, { areIdentical: lc } = ur;
function kh(e, t, r, n) {
  n = typeof r == "function" ? r : n, r = typeof r == "function" ? !1 : r, Ve.lstat(t, (i, a) => {
    !i && a.isSymbolicLink() ? Promise.all([
      Ve.stat(e),
      Ve.stat(t)
    ]).then(([o, s]) => {
      if (lc(o, s)) return n(null);
      Lo(e, t, r, n);
    }) : Lo(e, t, r, n);
  });
}
function Lo(e, t, r, n) {
  Rh(e, t, (i, a) => {
    if (i) return n(i);
    e = a.toDst, xh(a.toCwd, r, (o, s) => {
      if (o) return n(o);
      const l = ic.dirname(t);
      Uh(l, (p, c) => {
        if (p) return n(p);
        if (c) return Ve.symlink(e, t, s, n);
        Dh(l, (f) => {
          if (f) return n(f);
          Ve.symlink(e, t, s, n);
        });
      });
    });
  });
}
function Mh(e, t, r) {
  let n;
  try {
    n = Ve.lstatSync(t);
  } catch {
  }
  if (n && n.isSymbolicLink()) {
    const s = Ve.statSync(e), l = Ve.statSync(t);
    if (lc(s, l)) return;
  }
  const i = Fh(e, t);
  e = i.toDst, r = Lh(i.toCwd, r);
  const a = ic.dirname(t);
  return Ve.existsSync(a) || Nh(a), Ve.symlinkSync(e, t, r);
}
var Bh = {
  createSymlink: Ph(kh),
  createSymlinkSync: Mh
};
const { createFile: Uo, createFileSync: ko } = yh, { createLink: Mo, createLinkSync: Bo } = Sh, { createSymlink: jo, createSymlinkSync: Ho } = Bh;
var jh = {
  // file
  createFile: Uo,
  createFileSync: ko,
  ensureFile: Uo,
  ensureFileSync: ko,
  // link
  createLink: Mo,
  createLinkSync: Bo,
  ensureLink: Mo,
  ensureLinkSync: Bo,
  // symlink
  createSymlink: jo,
  createSymlinkSync: Ho,
  ensureSymlink: jo,
  ensureSymlinkSync: Ho
};
function Hh(e, { EOL: t = `
`, finalEOL: r = !0, replacer: n = null, spaces: i } = {}) {
  const a = r ? t : "";
  return JSON.stringify(e, n, i).replace(/\n/g, t) + a;
}
function qh(e) {
  return Buffer.isBuffer(e) && (e = e.toString("utf8")), e.replace(/^\uFEFF/, "");
}
var xa = { stringify: Hh, stripBom: qh };
let or;
try {
  or = Ne;
} catch {
  or = At;
}
const ii = De, { stringify: cc, stripBom: uc } = xa;
async function Gh(e, t = {}) {
  typeof t == "string" && (t = { encoding: t });
  const r = t.fs || or, n = "throws" in t ? t.throws : !0;
  let i = await ii.fromCallback(r.readFile)(e, t);
  i = uc(i);
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
const Wh = ii.fromPromise(Gh);
function zh(e, t = {}) {
  typeof t == "string" && (t = { encoding: t });
  const r = t.fs || or, n = "throws" in t ? t.throws : !0;
  try {
    let i = r.readFileSync(e, t);
    return i = uc(i), JSON.parse(i, t.reviver);
  } catch (i) {
    if (n)
      throw i.message = `${e}: ${i.message}`, i;
    return null;
  }
}
async function Vh(e, t, r = {}) {
  const n = r.fs || or, i = cc(t, r);
  await ii.fromCallback(n.writeFile)(e, i, r);
}
const Yh = ii.fromPromise(Vh);
function Xh(e, t, r = {}) {
  const n = r.fs || or, i = cc(t, r);
  return n.writeFileSync(e, i, r);
}
var Jh = {
  readFile: Wh,
  readFileSync: zh,
  writeFile: Yh,
  writeFileSync: Xh
};
const vn = Jh;
var Kh = {
  // jsonfile exports
  readJson: vn.readFile,
  readJsonSync: vn.readFileSync,
  writeJson: vn.writeFile,
  writeJsonSync: vn.writeFileSync
};
const Qh = De.fromCallback, br = Ne, fc = se, dc = tt, Zh = jt.pathExists;
function ep(e, t, r, n) {
  typeof r == "function" && (n = r, r = "utf8");
  const i = fc.dirname(e);
  Zh(i, (a, o) => {
    if (a) return n(a);
    if (o) return br.writeFile(e, t, r, n);
    dc.mkdirs(i, (s) => {
      if (s) return n(s);
      br.writeFile(e, t, r, n);
    });
  });
}
function tp(e, ...t) {
  const r = fc.dirname(e);
  if (br.existsSync(r))
    return br.writeFileSync(e, ...t);
  dc.mkdirsSync(r), br.writeFileSync(e, ...t);
}
var La = {
  outputFile: Qh(ep),
  outputFileSync: tp
};
const { stringify: rp } = xa, { outputFile: np } = La;
async function ip(e, t, r = {}) {
  const n = rp(t, r);
  await np(e, n, r);
}
var ap = ip;
const { stringify: op } = xa, { outputFileSync: sp } = La;
function lp(e, t, r) {
  const n = op(t, r);
  sp(e, n, r);
}
var cp = lp;
const up = De.fromPromise, Pe = Kh;
Pe.outputJson = up(ap);
Pe.outputJsonSync = cp;
Pe.outputJSON = Pe.outputJson;
Pe.outputJSONSync = Pe.outputJsonSync;
Pe.writeJSON = Pe.writeJson;
Pe.writeJSONSync = Pe.writeJsonSync;
Pe.readJSON = Pe.readJson;
Pe.readJSONSync = Pe.readJsonSync;
var fp = Pe;
const dp = Ne, ua = se, hp = Ra.copy, hc = ni.remove, pp = tt.mkdirp, mp = jt.pathExists, qo = ur;
function gp(e, t, r, n) {
  typeof r == "function" && (n = r, r = {}), r = r || {};
  const i = r.overwrite || r.clobber || !1;
  qo.checkPaths(e, t, "move", r, (a, o) => {
    if (a) return n(a);
    const { srcStat: s, isChangingCase: l = !1 } = o;
    qo.checkParentPaths(e, s, t, "move", (p) => {
      if (p) return n(p);
      if (yp(t)) return Go(e, t, i, l, n);
      pp(ua.dirname(t), (c) => c ? n(c) : Go(e, t, i, l, n));
    });
  });
}
function yp(e) {
  const t = ua.dirname(e);
  return ua.parse(t).root === t;
}
function Go(e, t, r, n, i) {
  if (n) return Fi(e, t, r, i);
  if (r)
    return hc(t, (a) => a ? i(a) : Fi(e, t, r, i));
  mp(t, (a, o) => a ? i(a) : o ? i(new Error("dest already exists.")) : Fi(e, t, r, i));
}
function Fi(e, t, r, n) {
  dp.rename(e, t, (i) => i ? i.code !== "EXDEV" ? n(i) : wp(e, t, r, n) : n());
}
function wp(e, t, r, n) {
  hp(e, t, {
    overwrite: r,
    errorOnExist: !0
  }, (a) => a ? n(a) : hc(e, n));
}
var Ep = gp;
const pc = Ne, fa = se, vp = Ra.copySync, mc = ni.removeSync, _p = tt.mkdirpSync, Wo = ur;
function Sp(e, t, r) {
  r = r || {};
  const n = r.overwrite || r.clobber || !1, { srcStat: i, isChangingCase: a = !1 } = Wo.checkPathsSync(e, t, "move", r);
  return Wo.checkParentPathsSync(e, i, t, "move"), Ap(t) || _p(fa.dirname(t)), Tp(e, t, n, a);
}
function Ap(e) {
  const t = fa.dirname(e);
  return fa.parse(t).root === t;
}
function Tp(e, t, r, n) {
  if (n) return xi(e, t, r);
  if (r)
    return mc(t), xi(e, t, r);
  if (pc.existsSync(t)) throw new Error("dest already exists.");
  return xi(e, t, r);
}
function xi(e, t, r) {
  try {
    pc.renameSync(e, t);
  } catch (n) {
    if (n.code !== "EXDEV") throw n;
    return Cp(e, t, r);
  }
}
function Cp(e, t, r) {
  return vp(e, t, {
    overwrite: r,
    errorOnExist: !0
  }), mc(e);
}
var $p = Sp;
const bp = De.fromCallback;
var Ip = {
  move: bp(Ep),
  moveSync: $p
}, Tt = {
  // Export promiseified graceful-fs:
  ...Bt,
  // Export extra methods:
  ...Ra,
  ...hh,
  ...jh,
  ...fp,
  ...tt,
  ...Ip,
  ...La,
  ...jt,
  ...ni
}, st = {}, wt = {}, we = {}, Et = {};
Object.defineProperty(Et, "__esModule", { value: !0 });
Et.CancellationError = Et.CancellationToken = void 0;
const Op = Cl;
class Pp extends Op.EventEmitter {
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
      return Promise.reject(new da());
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
          a(new da());
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
Et.CancellationToken = Pp;
class da extends Error {
  constructor() {
    super("cancelled");
  }
}
Et.CancellationError = da;
var fr = {};
Object.defineProperty(fr, "__esModule", { value: !0 });
fr.newError = Dp;
function Dp(e, t) {
  const r = new Error(e);
  return r.code = t, r;
}
var Oe = {}, ha = { exports: {} }, _n = { exports: {} }, Li, zo;
function Np() {
  if (zo) return Li;
  zo = 1;
  var e = 1e3, t = e * 60, r = t * 60, n = r * 24, i = n * 7, a = n * 365.25;
  Li = function(c, f) {
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
    return f >= n ? p(c, f, n, "day") : f >= r ? p(c, f, r, "hour") : f >= t ? p(c, f, t, "minute") : f >= e ? p(c, f, e, "second") : c + " ms";
  }
  function p(c, f, h, g) {
    var v = f >= h * 1.5;
    return Math.round(c / h) + " " + g + (v ? "s" : "");
  }
  return Li;
}
var Ui, Vo;
function gc() {
  if (Vo) return Ui;
  Vo = 1;
  function e(t) {
    n.debug = n, n.default = n, n.coerce = p, n.disable = s, n.enable = a, n.enabled = l, n.humanize = Np(), n.destroy = c, Object.keys(t).forEach((f) => {
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
      let h, g = null, v, w;
      function S(...T) {
        if (!S.enabled)
          return;
        const A = S, F = Number(/* @__PURE__ */ new Date()), N = F - (h || F);
        A.diff = N, A.prev = h, A.curr = F, h = F, T[0] = n.coerce(T[0]), typeof T[0] != "string" && T.unshift("%O");
        let K = 0;
        T[0] = T[0].replace(/%([a-zA-Z%])/g, (Y, Me) => {
          if (Y === "%%")
            return "%";
          K++;
          const y = n.formatters[Me];
          if (typeof y == "function") {
            const z = T[K];
            Y = y.call(A, z), T.splice(K, 1), K--;
          }
          return Y;
        }), n.formatArgs.call(A, T), (A.log || n.log).apply(A, T);
      }
      return S.namespace = f, S.useColors = n.useColors(), S.color = n.selectColor(f), S.extend = i, S.destroy = n.destroy, Object.defineProperty(S, "enabled", {
        enumerable: !0,
        configurable: !1,
        get: () => g !== null ? g : (v !== n.namespaces && (v = n.namespaces, w = n.enabled(f)), w),
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
      let g = 0, v = 0, w = -1, S = 0;
      for (; g < f.length; )
        if (v < h.length && (h[v] === f[g] || h[v] === "*"))
          h[v] === "*" ? (w = v, S = g, v++) : (g++, v++);
        else if (w !== -1)
          v = w + 1, S++, g = S;
        else
          return !1;
      for (; v < h.length && h[v] === "*"; )
        v++;
      return v === h.length;
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
    function p(f) {
      return f instanceof Error ? f.stack || f.message : f;
    }
    function c() {
      console.warn("Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.");
    }
    return n.enable(n.load()), n;
  }
  return Ui = e, Ui;
}
var Yo;
function Rp() {
  return Yo || (Yo = 1, function(e, t) {
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
      const p = "color: " + this.color;
      l.splice(1, 0, p, "color: inherit");
      let c = 0, f = 0;
      l[0].replace(/%[a-zA-Z%]/g, (h) => {
        h !== "%%" && (c++, h === "%c" && (f = c));
      }), l.splice(f, 0, p);
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
    e.exports = gc()(t);
    const { formatters: s } = e.exports;
    s.j = function(l) {
      try {
        return JSON.stringify(l);
      } catch (p) {
        return "[UnexpectedJSONParseError]: " + p.message;
      }
    };
  }(_n, _n.exports)), _n.exports;
}
var Sn = { exports: {} }, ki, Xo;
function Fp() {
  return Xo || (Xo = 1, ki = (e, t = process.argv) => {
    const r = e.startsWith("-") ? "" : e.length === 1 ? "-" : "--", n = t.indexOf(r + e), i = t.indexOf("--");
    return n !== -1 && (i === -1 || n < i);
  }), ki;
}
var Mi, Jo;
function xp() {
  if (Jo) return Mi;
  Jo = 1;
  const e = ei, t = $l, r = Fp(), { env: n } = process;
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
  function o(l, p) {
    if (i === 0)
      return 0;
    if (r("color=16m") || r("color=full") || r("color=truecolor"))
      return 3;
    if (r("color=256"))
      return 2;
    if (l && !p && i === void 0)
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
    const p = o(l, l && l.isTTY);
    return a(p);
  }
  return Mi = {
    supportsColor: s,
    stdout: a(o(!0, t.isatty(1))),
    stderr: a(o(!0, t.isatty(2)))
  }, Mi;
}
var Ko;
function Lp() {
  return Ko || (Ko = 1, function(e, t) {
    const r = $l, n = ba;
    t.init = c, t.log = s, t.formatArgs = a, t.save = l, t.load = p, t.useColors = i, t.destroy = n.deprecate(
      () => {
      },
      "Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`."
    ), t.colors = [6, 2, 3, 4, 5, 1];
    try {
      const h = xp();
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
      const v = g.substring(6).toLowerCase().replace(/_([a-z])/g, (S, T) => T.toUpperCase());
      let w = process.env[g];
      return /^(yes|on|true|enabled)$/i.test(w) ? w = !0 : /^(no|off|false|disabled)$/i.test(w) ? w = !1 : w === "null" ? w = null : w = Number(w), h[v] = w, h;
    }, {});
    function i() {
      return "colors" in t.inspectOpts ? !!t.inspectOpts.colors : r.isatty(process.stderr.fd);
    }
    function a(h) {
      const { namespace: g, useColors: v } = this;
      if (v) {
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
    function p() {
      return process.env.DEBUG;
    }
    function c(h) {
      h.inspectOpts = {};
      const g = Object.keys(t.inspectOpts);
      for (let v = 0; v < g.length; v++)
        h.inspectOpts[g[v]] = t.inspectOpts[g[v]];
    }
    e.exports = gc()(t);
    const { formatters: f } = e.exports;
    f.o = function(h) {
      return this.inspectOpts.colors = this.useColors, n.inspect(h, this.inspectOpts).split(`
`).map((g) => g.trim()).join(" ");
    }, f.O = function(h) {
      return this.inspectOpts.colors = this.useColors, n.inspect(h, this.inspectOpts);
    };
  }(Sn, Sn.exports)), Sn.exports;
}
typeof process > "u" || process.type === "renderer" || process.browser === !0 || process.__nwjs ? ha.exports = Rp() : ha.exports = Lp();
var Up = ha.exports, Jr = {};
Object.defineProperty(Jr, "__esModule", { value: !0 });
Jr.ProgressCallbackTransform = void 0;
const kp = Vr;
class Mp extends kp.Transform {
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
Jr.ProgressCallbackTransform = Mp;
Object.defineProperty(Oe, "__esModule", { value: !0 });
Oe.DigestTransform = Oe.HttpExecutor = Oe.HttpError = void 0;
Oe.createHttpError = pa;
Oe.parseJson = Vp;
Oe.configureRequestOptionsFromUrl = wc;
Oe.configureRequestUrl = ka;
Oe.safeGetHeader = ir;
Oe.configureRequestOptions = qn;
Oe.safeStringifyJson = Gn;
const Bp = Yr, jp = Up, Hp = At, qp = Vr, yc = cr, Gp = Et, Qo = fr, Wp = Jr, Er = (0, jp.default)("electron-builder");
function pa(e, t = null) {
  return new Ua(e.statusCode || -1, `${e.statusCode} ${e.statusMessage}` + (t == null ? "" : `
` + JSON.stringify(t, null, "  ")) + `
Headers: ` + Gn(e.headers), t);
}
const zp = /* @__PURE__ */ new Map([
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
class Ua extends Error {
  constructor(t, r = `HTTP error: ${zp.get(t) || t}`, n = null) {
    super(r), this.statusCode = t, this.description = n, this.name = "HttpError", this.code = `HTTP_ERROR_${t}`;
  }
  isServerError() {
    return this.statusCode >= 500 && this.statusCode <= 599;
  }
}
Oe.HttpError = Ua;
function Vp(e) {
  return e.then((t) => t == null || t.length === 0 ? null : JSON.parse(t));
}
class Hn {
  constructor() {
    this.maxRedirects = 10;
  }
  request(t, r = new Gp.CancellationToken(), n) {
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
      const l = this.createRequest(t, (p) => {
        try {
          this.handleResponse(p, t, r, a, o, i, n);
        } catch (c) {
          o(c);
        }
      });
      this.addErrorAndTimeoutHandlers(l, o, t.timeout), this.addRedirectHandlers(l, t, o, i, (p) => {
        this.doApiRequest(p, r, n, i).then(a).catch(o);
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
      a(pa(t, `method: ${r.method || "GET"} url: ${r.protocol || "https:"}//${r.hostname}${r.port ? `:${r.port}` : ""}${r.path}

Please double check that your authentication token is correct. Due to security reasons, actual status maybe not reported, but 404.
`));
      return;
    } else if (t.statusCode === 204) {
      i();
      return;
    }
    const p = (l = t.statusCode) !== null && l !== void 0 ? l : 0, c = p >= 300 && p < 400, f = ir(t, "location");
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
          const g = ir(t, "content-type"), v = g != null && (Array.isArray(g) ? g.find((w) => w.includes("json")) != null : g.includes("json"));
          a(pa(t, `method: ${r.method || "GET"} url: ${r.protocol || "https:"}//${r.hostname}${r.port ? `:${r.port}` : ""}${r.path}

          Data:
          ${v ? JSON.stringify(JSON.parse(h)) : h}
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
      ka(t, s), qn(s), this.doDownload(s, {
        destination: null,
        options: r,
        onCancel: a,
        callback: (l) => {
          l == null ? n(Buffer.concat(o)) : i(l);
        },
        responseHandler: (l, p) => {
          let c = 0;
          l.on("data", (f) => {
            if (c += f.length, c > 524288e3) {
              p(new Error("Maximum allowed size is 500 MB"));
              return;
            }
            o.push(f);
          }), l.on("end", () => {
            p(null);
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
      const o = ir(a, "location");
      if (o != null) {
        n < this.maxRedirects ? this.doDownload(Hn.prepareRedirectUrlOptions(o, t), r, n++) : r.callback(this.createMaxRedirectError());
        return;
      }
      r.responseHandler == null ? Xp(r, a) : r.responseHandler(a, r.callback);
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
    const n = wc(t, { ...r }), i = n.headers;
    if (i != null && i.authorization) {
      const a = new yc.URL(t);
      (a.hostname.endsWith(".amazonaws.com") || a.searchParams.has("X-Amz-Credential")) && delete i.authorization;
    }
    return n;
  }
  static retryOnServerError(t, r = 3) {
    for (let n = 0; ; n++)
      try {
        return t();
      } catch (i) {
        if (n < r && (i instanceof Ua && i.isServerError() || i.code === "EPIPE"))
          continue;
        throw i;
      }
  }
}
Oe.HttpExecutor = Hn;
function wc(e, t) {
  const r = qn(t);
  return ka(new yc.URL(e), r), r;
}
function ka(e, t) {
  t.protocol = e.protocol, t.hostname = e.hostname, e.port ? t.port = e.port : t.port && delete t.port, t.path = e.pathname + e.search;
}
class ma extends qp.Transform {
  // noinspection JSUnusedGlobalSymbols
  get actual() {
    return this._actual;
  }
  constructor(t, r = "sha512", n = "base64") {
    super(), this.expected = t, this.algorithm = r, this.encoding = n, this._actual = null, this.isValidateOnEnd = !0, this.digester = (0, Bp.createHash)(r);
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
      throw (0, Qo.newError)("Not finished yet", "ERR_STREAM_NOT_FINISHED");
    if (this._actual !== this.expected)
      throw (0, Qo.newError)(`${this.algorithm} checksum mismatch, expected ${this.expected}, got ${this._actual}`, "ERR_CHECKSUM_MISMATCH");
    return null;
  }
}
Oe.DigestTransform = ma;
function Yp(e, t, r) {
  return e != null && t != null && e !== t ? (r(new Error(`checksum mismatch: expected ${t} but got ${e} (X-Checksum-Sha2 header)`)), !1) : !0;
}
function ir(e, t) {
  const r = e.headers[t];
  return r == null ? null : Array.isArray(r) ? r.length === 0 ? null : r[r.length - 1] : r;
}
function Xp(e, t) {
  if (!Yp(ir(t, "X-Checksum-Sha2"), e.options.sha2, e.callback))
    return;
  const r = [];
  if (e.options.onProgress != null) {
    const o = ir(t, "content-length");
    o != null && r.push(new Wp.ProgressCallbackTransform(parseInt(o, 10), e.options.cancellationToken, e.options.onProgress));
  }
  const n = e.options.sha512;
  n != null ? r.push(new ma(n, "sha512", n.length === 128 && !n.includes("+") && !n.includes("Z") && !n.includes("=") ? "hex" : "base64")) : e.options.sha2 != null && r.push(new ma(e.options.sha2, "sha256", "hex"));
  const i = (0, Hp.createWriteStream)(e.destination);
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
class Jp {
  constructor(t, r) {
    this.selector = t, this.creator = r, this.selected = void 0, this._value = void 0;
  }
  get hasValue() {
    return this._value !== void 0;
  }
  get value() {
    const t = this.selector();
    if (this._value !== void 0 && Ec(this.selected, t))
      return this._value;
    this.selected = t;
    const r = this.creator(t);
    return this.value = r, r;
  }
  set value(t) {
    this._value = t;
  }
}
ai.MemoLazy = Jp;
function Ec(e, t) {
  if (typeof e == "object" && e !== null && (typeof t == "object" && t !== null)) {
    const i = Object.keys(e), a = Object.keys(t);
    return i.length === a.length && i.every((o) => Ec(e[o], t[o]));
  }
  return e === t;
}
var oi = {};
Object.defineProperty(oi, "__esModule", { value: !0 });
oi.githubUrl = Kp;
oi.getS3LikeProviderBaseUrl = Qp;
function Kp(e, t = "github.com") {
  return `${e.protocol || "https"}://${e.host || t}`;
}
function Qp(e) {
  const t = e.provider;
  if (t === "s3")
    return Zp(e);
  if (t === "spaces")
    return em(e);
  throw new Error(`Not supported provider: ${t}`);
}
function Zp(e) {
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
  return vc(t, e.path);
}
function vc(e, t) {
  return t != null && t.length > 0 && (t.startsWith("/") || (e += "/"), e += t), e;
}
function em(e) {
  if (e.name == null)
    throw new Error("name is missing");
  if (e.region == null)
    throw new Error("region is missing");
  return vc(`https://${e.name}.${e.region}.digitaloceanspaces.com`, e.path);
}
var Ma = {};
Object.defineProperty(Ma, "__esModule", { value: !0 });
Ma.retry = _c;
const tm = Et;
async function _c(e, t, r, n = 0, i = 0, a) {
  var o;
  const s = new tm.CancellationToken();
  try {
    return await e();
  } catch (l) {
    if ((!((o = a == null ? void 0 : a(l)) !== null && o !== void 0) || o) && t > 0 && !s.cancelled)
      return await new Promise((p) => setTimeout(p, r + n * i)), await _c(e, t - 1, r, n, i + 1, a);
    throw l;
  }
}
var Ba = {};
Object.defineProperty(Ba, "__esModule", { value: !0 });
Ba.parseDn = rm;
function rm(e) {
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
var sr = {};
Object.defineProperty(sr, "__esModule", { value: !0 });
sr.nil = sr.UUID = void 0;
const Sc = Yr, Ac = fr, nm = "options.name must be either a string or a Buffer", Zo = (0, Sc.randomBytes)(16);
Zo[0] = Zo[0] | 1;
const Un = {}, X = [];
for (let e = 0; e < 256; e++) {
  const t = (e + 256).toString(16).substr(1);
  Un[t] = e, X[e] = t;
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
    return im(t, "sha1", 80, r);
  }
  toString() {
    return this.ascii == null && (this.ascii = am(this.binary)), this.ascii;
  }
  inspect() {
    return `UUID v${this.version} ${this.toString()}`;
  }
  static check(t, r = 0) {
    if (typeof t == "string")
      return t = t.toLowerCase(), /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-([a-f0-9]{12})$/.test(t) ? t === "00000000-0000-0000-0000-000000000000" ? { version: void 0, variant: "nil", format: "ascii" } : {
        version: (Un[t[14] + t[15]] & 240) >> 4,
        variant: es((Un[t[19] + t[20]] & 224) >> 5),
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
        variant: es((t[r + 8] & 224) >> 5),
        format: "binary"
      };
    }
    throw (0, Ac.newError)("Unknown type of uuid", "ERR_UNKNOWN_UUID_TYPE");
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
sr.UUID = Mt;
Mt.OID = Mt.parse("6ba7b812-9dad-11d1-80b4-00c04fd430c8");
function es(e) {
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
function im(e, t, r, n, i = Ir.ASCII) {
  const a = (0, Sc.createHash)(t);
  if (typeof e != "string" && !Buffer.isBuffer(e))
    throw (0, Ac.newError)(nm, "ERR_INVALID_UUID_NAME");
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
      l = X[s[0]] + X[s[1]] + X[s[2]] + X[s[3]] + "-" + X[s[4]] + X[s[5]] + "-" + X[s[6] & 15 | r] + X[s[7]] + "-" + X[s[8] & 63 | 128] + X[s[9]] + "-" + X[s[10]] + X[s[11]] + X[s[12]] + X[s[13]] + X[s[14]] + X[s[15]];
      break;
  }
  return l;
}
function am(e) {
  return X[e[0]] + X[e[1]] + X[e[2]] + X[e[3]] + "-" + X[e[4]] + X[e[5]] + "-" + X[e[6]] + X[e[7]] + "-" + X[e[8]] + X[e[9]] + "-" + X[e[10]] + X[e[11]] + X[e[12]] + X[e[13]] + X[e[14]] + X[e[15]];
}
sr.nil = new Mt("00000000-0000-0000-0000-000000000000");
var Kr = {}, Tc = {};
(function(e) {
  (function(t) {
    t.parser = function(d, u) {
      return new n(d, u);
    }, t.SAXParser = n, t.SAXStream = c, t.createStream = p, t.MAX_BUFFER_LENGTH = 64 * 1024;
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
      a(C), C.q = C.c = "", C.bufferCheckPosition = t.MAX_BUFFER_LENGTH, C.opt = u || {}, C.opt.lowercase = C.opt.lowercase || C.opt.lowercasetags, C.looseCase = C.opt.lowercase ? "toLowerCase" : "toUpperCase", C.tags = [], C.closed = C.closedRoot = C.sawRoot = !1, C.tag = C.error = null, C.strict = !!d, C.noscript = !!(d || C.opt.noscript), C.state = y.BEGIN, C.strictEntities = C.opt.strictEntities, C.ENTITIES = C.strictEntities ? Object.create(t.XML_ENTITIES) : Object.create(t.ENTITIES), C.attribList = [], C.opt.xmlns && (C.ns = Object.create(w)), C.opt.unquotedAttributeValues === void 0 && (C.opt.unquotedAttributeValues = !d), C.trackPosition = C.opt.position !== !1, C.trackPosition && (C.position = C.line = C.column = 0), q(C, "onready");
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
      for (var u = Math.max(t.MAX_BUFFER_LENGTH, 10), C = 0, _ = 0, J = r.length; _ < J; _++) {
        var ie = d[r[_]].length;
        if (ie > u)
          switch (r[_]) {
            case "textNode":
              Z(d);
              break;
            case "cdata":
              H(d, "oncdata", d.cdata), d.cdata = "";
              break;
            case "script":
              H(d, "onscript", d.script), d.script = "";
              break;
            default:
              b(d, "Max buffer length exceeded: " + r[_]);
          }
        C = Math.max(C, ie);
      }
      var le = t.MAX_BUFFER_LENGTH - C;
      d.bufferCheckPosition = le + d.position;
    }
    function a(d) {
      for (var u = 0, C = r.length; u < C; u++)
        d[r[u]] = "";
    }
    function o(d) {
      Z(d), d.cdata !== "" && (H(d, "oncdata", d.cdata), d.cdata = ""), d.script !== "" && (H(d, "onscript", d.script), d.script = "");
    }
    n.prototype = {
      end: function() {
        D(this);
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
    function p(d, u) {
      return new c(d, u);
    }
    function c(d, u) {
      if (!(this instanceof c))
        return new c(d, u);
      s.apply(this), this._parser = new n(d, u), this.writable = !0, this.readable = !0;
      var C = this;
      this._parser.onend = function() {
        C.emit("end");
      }, this._parser.onerror = function(_) {
        C.emit("error", _), C._parser.error = null;
      }, this._decoder = null, l.forEach(function(_) {
        Object.defineProperty(C, "on" + _, {
          get: function() {
            return C._parser["on" + _];
          },
          set: function(J) {
            if (!J)
              return C.removeAllListeners(_), C._parser["on" + _] = J, J;
            C.on(_, J);
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
          var u = Jf.StringDecoder;
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
        var _ = arguments.length === 1 ? [arguments[0]] : Array.apply(null, arguments);
        _.splice(0, 0, d), C.emit.apply(C, _);
      }), s.prototype.on.call(C, d, u);
    };
    var f = "[CDATA[", h = "DOCTYPE", g = "http://www.w3.org/XML/1998/namespace", v = "http://www.w3.org/2000/xmlns/", w = { xml: g, xmlns: v }, S = /[:_A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD]/, T = /[:_A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\u00B7\u0300-\u036F\u203F-\u2040.\d-]/, A = /[#:_A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD]/, F = /[#:_A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\u00B7\u0300-\u036F\u203F-\u2040.\d-]/;
    function N(d) {
      return d === " " || d === `
` || d === "\r" || d === "	";
    }
    function K(d) {
      return d === '"' || d === "'";
    }
    function ne(d) {
      return d === ">" || N(d);
    }
    function Y(d, u) {
      return d.test(u);
    }
    function Me(d, u) {
      return !Y(d, u);
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
    function q(d, u, C) {
      d[u] && d[u](C);
    }
    function H(d, u, C) {
      d.textNode && Z(d), q(d, u, C);
    }
    function Z(d) {
      d.textNode = O(d.opt, d.textNode), d.textNode && q(d, "ontext", d.textNode), d.textNode = "";
    }
    function O(d, u) {
      return d.trim && (u = u.trim()), d.normalize && (u = u.replace(/\s+/g, " ")), u;
    }
    function b(d, u) {
      return Z(d), d.trackPosition && (u += `
Line: ` + d.line + `
Column: ` + d.column + `
Char: ` + d.c), u = new Error(u), d.error = u, q(d, "onerror", u), d;
    }
    function D(d) {
      return d.sawRoot && !d.closedRoot && $(d, "Unclosed root tag"), d.state !== y.BEGIN && d.state !== y.BEGIN_WHITESPACE && d.state !== y.TEXT && b(d, "Unexpected end"), Z(d), d.c = "", d.closed = !0, q(d, "onend"), n.call(d, d.strict, d.opt), d;
    }
    function $(d, u) {
      if (typeof d != "object" || !(d instanceof n))
        throw new Error("bad call to strictFail");
      d.strict && b(d, u);
    }
    function R(d) {
      d.strict || (d.tagName = d.tagName[d.looseCase]());
      var u = d.tags[d.tags.length - 1] || d, C = d.tag = { name: d.tagName, attributes: {} };
      d.opt.xmlns && (C.ns = u.ns), d.attribList.length = 0, H(d, "onopentagstart", C);
    }
    function P(d, u) {
      var C = d.indexOf(":"), _ = C < 0 ? ["", d] : d.split(":"), J = _[0], ie = _[1];
      return u && d === "xmlns" && (J = "xmlns", ie = ""), { prefix: J, local: ie };
    }
    function M(d) {
      if (d.strict || (d.attribName = d.attribName[d.looseCase]()), d.attribList.indexOf(d.attribName) !== -1 || d.tag.attributes.hasOwnProperty(d.attribName)) {
        d.attribName = d.attribValue = "";
        return;
      }
      if (d.opt.xmlns) {
        var u = P(d.attribName, !0), C = u.prefix, _ = u.local;
        if (C === "xmlns")
          if (_ === "xml" && d.attribValue !== g)
            $(
              d,
              "xml: prefix must be bound to " + g + `
Actual: ` + d.attribValue
            );
          else if (_ === "xmlns" && d.attribValue !== v)
            $(
              d,
              "xmlns: prefix must be bound to " + v + `
Actual: ` + d.attribValue
            );
          else {
            var J = d.tag, ie = d.tags[d.tags.length - 1] || d;
            J.ns === ie.ns && (J.ns = Object.create(ie.ns)), J.ns[_] = d.attribValue;
          }
        d.attribList.push([d.attribName, d.attribValue]);
      } else
        d.tag.attributes[d.attribName] = d.attribValue, H(d, "onattribute", {
          name: d.attribName,
          value: d.attribValue
        });
      d.attribName = d.attribValue = "";
    }
    function V(d, u) {
      if (d.opt.xmlns) {
        var C = d.tag, _ = P(d.tagName);
        C.prefix = _.prefix, C.local = _.local, C.uri = C.ns[_.prefix] || "", C.prefix && !C.uri && ($(d, "Unbound namespace prefix: " + JSON.stringify(d.tagName)), C.uri = _.prefix);
        var J = d.tags[d.tags.length - 1] || d;
        C.ns && J.ns !== C.ns && Object.keys(C.ns).forEach(function(cn) {
          H(d, "onopennamespace", {
            prefix: cn,
            uri: C.ns[cn]
          });
        });
        for (var ie = 0, le = d.attribList.length; ie < le; ie++) {
          var Ee = d.attribList[ie], Ae = Ee[0], lt = Ee[1], de = P(Ae, !0), We = de.prefix, Ti = de.local, ln = We === "" ? "" : C.ns[We] || "", pr = {
            name: Ae,
            value: lt,
            prefix: We,
            local: Ti,
            uri: ln
          };
          We && We !== "xmlns" && !ln && ($(d, "Unbound namespace prefix: " + JSON.stringify(We)), pr.uri = We), d.tag.attributes[Ae] = pr, H(d, "onattribute", pr);
        }
        d.attribList.length = 0;
      }
      d.tag.isSelfClosing = !!u, d.sawRoot = !0, d.tags.push(d.tag), H(d, "onopentag", d.tag), u || (!d.noscript && d.tagName.toLowerCase() === "script" ? d.state = y.SCRIPT : d.state = y.TEXT, d.tag = null, d.tagName = ""), d.attribName = d.attribValue = "", d.attribList.length = 0;
    }
    function G(d) {
      if (!d.tagName) {
        $(d, "Weird empty close tag."), d.textNode += "</>", d.state = y.TEXT;
        return;
      }
      if (d.script) {
        if (d.tagName !== "script") {
          d.script += "</" + d.tagName + ">", d.tagName = "", d.state = y.SCRIPT;
          return;
        }
        H(d, "onscript", d.script), d.script = "";
      }
      var u = d.tags.length, C = d.tagName;
      d.strict || (C = C[d.looseCase]());
      for (var _ = C; u--; ) {
        var J = d.tags[u];
        if (J.name !== _)
          $(d, "Unexpected close tag");
        else
          break;
      }
      if (u < 0) {
        $(d, "Unmatched closing tag: " + d.tagName), d.textNode += "</" + d.tagName + ">", d.state = y.TEXT;
        return;
      }
      d.tagName = C;
      for (var ie = d.tags.length; ie-- > u; ) {
        var le = d.tag = d.tags.pop();
        d.tagName = d.tag.name, H(d, "onclosetag", d.tagName);
        var Ee = {};
        for (var Ae in le.ns)
          Ee[Ae] = le.ns[Ae];
        var lt = d.tags[d.tags.length - 1] || d;
        d.opt.xmlns && le.ns !== lt.ns && Object.keys(le.ns).forEach(function(de) {
          var We = le.ns[de];
          H(d, "onclosenamespace", { prefix: de, uri: We });
        });
      }
      u === 0 && (d.closedRoot = !0), d.tagName = d.attribValue = d.attribName = "", d.attribList.length = 0, d.state = y.TEXT;
    }
    function ee(d) {
      var u = d.entity, C = u.toLowerCase(), _, J = "";
      return d.ENTITIES[u] ? d.ENTITIES[u] : d.ENTITIES[C] ? d.ENTITIES[C] : (u = C, u.charAt(0) === "#" && (u.charAt(1) === "x" ? (u = u.slice(2), _ = parseInt(u, 16), J = _.toString(16)) : (u = u.slice(1), _ = parseInt(u, 10), J = _.toString(10))), u = u.replace(/^0+/, ""), isNaN(_) || J.toLowerCase() !== u ? ($(d, "Invalid character entity"), "&" + d.entity + ";") : String.fromCodePoint(_));
    }
    function pe(d, u) {
      u === "<" ? (d.state = y.OPEN_WAKA, d.startTagPosition = d.position) : N(u) || ($(d, "Non-whitespace before first tag."), d.textNode = u, d.state = y.TEXT);
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
        return D(u);
      typeof d == "object" && (d = d.toString());
      for (var C = 0, _ = ""; _ = k(d, C++), u.c = _, !!_; )
        switch (u.trackPosition && (u.position++, _ === `
` ? (u.line++, u.column = 0) : u.column++), u.state) {
          case y.BEGIN:
            if (u.state = y.BEGIN_WHITESPACE, _ === "\uFEFF")
              continue;
            pe(u, _);
            continue;
          case y.BEGIN_WHITESPACE:
            pe(u, _);
            continue;
          case y.TEXT:
            if (u.sawRoot && !u.closedRoot) {
              for (var J = C - 1; _ && _ !== "<" && _ !== "&"; )
                _ = k(d, C++), _ && u.trackPosition && (u.position++, _ === `
` ? (u.line++, u.column = 0) : u.column++);
              u.textNode += d.substring(J, C - 1);
            }
            _ === "<" && !(u.sawRoot && u.closedRoot && !u.strict) ? (u.state = y.OPEN_WAKA, u.startTagPosition = u.position) : (!N(_) && (!u.sawRoot || u.closedRoot) && $(u, "Text data outside of root node."), _ === "&" ? u.state = y.TEXT_ENTITY : u.textNode += _);
            continue;
          case y.SCRIPT:
            _ === "<" ? u.state = y.SCRIPT_ENDING : u.script += _;
            continue;
          case y.SCRIPT_ENDING:
            _ === "/" ? u.state = y.CLOSE_TAG : (u.script += "<" + _, u.state = y.SCRIPT);
            continue;
          case y.OPEN_WAKA:
            if (_ === "!")
              u.state = y.SGML_DECL, u.sgmlDecl = "";
            else if (!N(_)) if (Y(S, _))
              u.state = y.OPEN_TAG, u.tagName = _;
            else if (_ === "/")
              u.state = y.CLOSE_TAG, u.tagName = "";
            else if (_ === "?")
              u.state = y.PROC_INST, u.procInstName = u.procInstBody = "";
            else {
              if ($(u, "Unencoded <"), u.startTagPosition + 1 < u.position) {
                var ie = u.position - u.startTagPosition;
                _ = new Array(ie).join(" ") + _;
              }
              u.textNode += "<" + _, u.state = y.TEXT;
            }
            continue;
          case y.SGML_DECL:
            if (u.sgmlDecl + _ === "--") {
              u.state = y.COMMENT, u.comment = "", u.sgmlDecl = "";
              continue;
            }
            u.doctype && u.doctype !== !0 && u.sgmlDecl ? (u.state = y.DOCTYPE_DTD, u.doctype += "<!" + u.sgmlDecl + _, u.sgmlDecl = "") : (u.sgmlDecl + _).toUpperCase() === f ? (H(u, "onopencdata"), u.state = y.CDATA, u.sgmlDecl = "", u.cdata = "") : (u.sgmlDecl + _).toUpperCase() === h ? (u.state = y.DOCTYPE, (u.doctype || u.sawRoot) && $(
              u,
              "Inappropriately located doctype declaration"
            ), u.doctype = "", u.sgmlDecl = "") : _ === ">" ? (H(u, "onsgmldeclaration", u.sgmlDecl), u.sgmlDecl = "", u.state = y.TEXT) : (K(_) && (u.state = y.SGML_DECL_QUOTED), u.sgmlDecl += _);
            continue;
          case y.SGML_DECL_QUOTED:
            _ === u.q && (u.state = y.SGML_DECL, u.q = ""), u.sgmlDecl += _;
            continue;
          case y.DOCTYPE:
            _ === ">" ? (u.state = y.TEXT, H(u, "ondoctype", u.doctype), u.doctype = !0) : (u.doctype += _, _ === "[" ? u.state = y.DOCTYPE_DTD : K(_) && (u.state = y.DOCTYPE_QUOTED, u.q = _));
            continue;
          case y.DOCTYPE_QUOTED:
            u.doctype += _, _ === u.q && (u.q = "", u.state = y.DOCTYPE);
            continue;
          case y.DOCTYPE_DTD:
            _ === "]" ? (u.doctype += _, u.state = y.DOCTYPE) : _ === "<" ? (u.state = y.OPEN_WAKA, u.startTagPosition = u.position) : K(_) ? (u.doctype += _, u.state = y.DOCTYPE_DTD_QUOTED, u.q = _) : u.doctype += _;
            continue;
          case y.DOCTYPE_DTD_QUOTED:
            u.doctype += _, _ === u.q && (u.state = y.DOCTYPE_DTD, u.q = "");
            continue;
          case y.COMMENT:
            _ === "-" ? u.state = y.COMMENT_ENDING : u.comment += _;
            continue;
          case y.COMMENT_ENDING:
            _ === "-" ? (u.state = y.COMMENT_ENDED, u.comment = O(u.opt, u.comment), u.comment && H(u, "oncomment", u.comment), u.comment = "") : (u.comment += "-" + _, u.state = y.COMMENT);
            continue;
          case y.COMMENT_ENDED:
            _ !== ">" ? ($(u, "Malformed comment"), u.comment += "--" + _, u.state = y.COMMENT) : u.doctype && u.doctype !== !0 ? u.state = y.DOCTYPE_DTD : u.state = y.TEXT;
            continue;
          case y.CDATA:
            _ === "]" ? u.state = y.CDATA_ENDING : u.cdata += _;
            continue;
          case y.CDATA_ENDING:
            _ === "]" ? u.state = y.CDATA_ENDING_2 : (u.cdata += "]" + _, u.state = y.CDATA);
            continue;
          case y.CDATA_ENDING_2:
            _ === ">" ? (u.cdata && H(u, "oncdata", u.cdata), H(u, "onclosecdata"), u.cdata = "", u.state = y.TEXT) : _ === "]" ? u.cdata += "]" : (u.cdata += "]]" + _, u.state = y.CDATA);
            continue;
          case y.PROC_INST:
            _ === "?" ? u.state = y.PROC_INST_ENDING : N(_) ? u.state = y.PROC_INST_BODY : u.procInstName += _;
            continue;
          case y.PROC_INST_BODY:
            if (!u.procInstBody && N(_))
              continue;
            _ === "?" ? u.state = y.PROC_INST_ENDING : u.procInstBody += _;
            continue;
          case y.PROC_INST_ENDING:
            _ === ">" ? (H(u, "onprocessinginstruction", {
              name: u.procInstName,
              body: u.procInstBody
            }), u.procInstName = u.procInstBody = "", u.state = y.TEXT) : (u.procInstBody += "?" + _, u.state = y.PROC_INST_BODY);
            continue;
          case y.OPEN_TAG:
            Y(T, _) ? u.tagName += _ : (R(u), _ === ">" ? V(u) : _ === "/" ? u.state = y.OPEN_TAG_SLASH : (N(_) || $(u, "Invalid character in tag name"), u.state = y.ATTRIB));
            continue;
          case y.OPEN_TAG_SLASH:
            _ === ">" ? (V(u, !0), G(u)) : ($(u, "Forward-slash in opening tag not followed by >"), u.state = y.ATTRIB);
            continue;
          case y.ATTRIB:
            if (N(_))
              continue;
            _ === ">" ? V(u) : _ === "/" ? u.state = y.OPEN_TAG_SLASH : Y(S, _) ? (u.attribName = _, u.attribValue = "", u.state = y.ATTRIB_NAME) : $(u, "Invalid attribute name");
            continue;
          case y.ATTRIB_NAME:
            _ === "=" ? u.state = y.ATTRIB_VALUE : _ === ">" ? ($(u, "Attribute without value"), u.attribValue = u.attribName, M(u), V(u)) : N(_) ? u.state = y.ATTRIB_NAME_SAW_WHITE : Y(T, _) ? u.attribName += _ : $(u, "Invalid attribute name");
            continue;
          case y.ATTRIB_NAME_SAW_WHITE:
            if (_ === "=")
              u.state = y.ATTRIB_VALUE;
            else {
              if (N(_))
                continue;
              $(u, "Attribute without value"), u.tag.attributes[u.attribName] = "", u.attribValue = "", H(u, "onattribute", {
                name: u.attribName,
                value: ""
              }), u.attribName = "", _ === ">" ? V(u) : Y(S, _) ? (u.attribName = _, u.state = y.ATTRIB_NAME) : ($(u, "Invalid attribute name"), u.state = y.ATTRIB);
            }
            continue;
          case y.ATTRIB_VALUE:
            if (N(_))
              continue;
            K(_) ? (u.q = _, u.state = y.ATTRIB_VALUE_QUOTED) : (u.opt.unquotedAttributeValues || b(u, "Unquoted attribute value"), u.state = y.ATTRIB_VALUE_UNQUOTED, u.attribValue = _);
            continue;
          case y.ATTRIB_VALUE_QUOTED:
            if (_ !== u.q) {
              _ === "&" ? u.state = y.ATTRIB_VALUE_ENTITY_Q : u.attribValue += _;
              continue;
            }
            M(u), u.q = "", u.state = y.ATTRIB_VALUE_CLOSED;
            continue;
          case y.ATTRIB_VALUE_CLOSED:
            N(_) ? u.state = y.ATTRIB : _ === ">" ? V(u) : _ === "/" ? u.state = y.OPEN_TAG_SLASH : Y(S, _) ? ($(u, "No whitespace between attributes"), u.attribName = _, u.attribValue = "", u.state = y.ATTRIB_NAME) : $(u, "Invalid attribute name");
            continue;
          case y.ATTRIB_VALUE_UNQUOTED:
            if (!ne(_)) {
              _ === "&" ? u.state = y.ATTRIB_VALUE_ENTITY_U : u.attribValue += _;
              continue;
            }
            M(u), _ === ">" ? V(u) : u.state = y.ATTRIB;
            continue;
          case y.CLOSE_TAG:
            if (u.tagName)
              _ === ">" ? G(u) : Y(T, _) ? u.tagName += _ : u.script ? (u.script += "</" + u.tagName, u.tagName = "", u.state = y.SCRIPT) : (N(_) || $(u, "Invalid tagname in closing tag"), u.state = y.CLOSE_TAG_SAW_WHITE);
            else {
              if (N(_))
                continue;
              Me(S, _) ? u.script ? (u.script += "</" + _, u.state = y.SCRIPT) : $(u, "Invalid tagname in closing tag.") : u.tagName = _;
            }
            continue;
          case y.CLOSE_TAG_SAW_WHITE:
            if (N(_))
              continue;
            _ === ">" ? G(u) : $(u, "Invalid characters in closing tag");
            continue;
          case y.TEXT_ENTITY:
          case y.ATTRIB_VALUE_ENTITY_Q:
          case y.ATTRIB_VALUE_ENTITY_U:
            var le, Ee;
            switch (u.state) {
              case y.TEXT_ENTITY:
                le = y.TEXT, Ee = "textNode";
                break;
              case y.ATTRIB_VALUE_ENTITY_Q:
                le = y.ATTRIB_VALUE_QUOTED, Ee = "attribValue";
                break;
              case y.ATTRIB_VALUE_ENTITY_U:
                le = y.ATTRIB_VALUE_UNQUOTED, Ee = "attribValue";
                break;
            }
            if (_ === ";") {
              var Ae = ee(u);
              u.opt.unparsedEntities && !Object.values(t.XML_ENTITIES).includes(Ae) ? (u.entity = "", u.state = le, u.write(Ae)) : (u[Ee] += Ae, u.entity = "", u.state = le);
            } else Y(u.entity.length ? F : A, _) ? u.entity += _ : ($(u, "Invalid character in entity name"), u[Ee] += "&" + u.entity + _, u.entity = "", u.state = le);
            continue;
          default:
            throw new Error(u, "Unknown state: " + u.state);
        }
      return u.position >= u.bufferCheckPosition && i(u), u;
    }
    /*! http://mths.be/fromcodepoint v0.1.0 by @mathias */
    String.fromCodePoint || function() {
      var d = String.fromCharCode, u = Math.floor, C = function() {
        var _ = 16384, J = [], ie, le, Ee = -1, Ae = arguments.length;
        if (!Ae)
          return "";
        for (var lt = ""; ++Ee < Ae; ) {
          var de = Number(arguments[Ee]);
          if (!isFinite(de) || // `NaN`, `+Infinity`, or `-Infinity`
          de < 0 || // not a valid Unicode code point
          de > 1114111 || // not a valid Unicode code point
          u(de) !== de)
            throw RangeError("Invalid code point: " + de);
          de <= 65535 ? J.push(de) : (de -= 65536, ie = (de >> 10) + 55296, le = de % 1024 + 56320, J.push(ie, le)), (Ee + 1 === Ae || J.length > _) && (lt += d.apply(null, J), J.length = 0);
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
})(Tc);
Object.defineProperty(Kr, "__esModule", { value: !0 });
Kr.XElement = void 0;
Kr.parseXml = cm;
const om = Tc, An = fr;
class Cc {
  constructor(t) {
    if (this.name = t, this.value = "", this.attributes = null, this.isCData = !1, this.elements = null, !t)
      throw (0, An.newError)("Element name cannot be empty", "ERR_XML_ELEMENT_NAME_EMPTY");
    if (!lm(t))
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
      if (ts(n, t, r))
        return n;
    return null;
  }
  getElements(t, r = !1) {
    return this.elements === null ? [] : this.elements.filter((n) => ts(n, t, r));
  }
  elementValueOrEmpty(t, r = !1) {
    const n = this.elementOrNull(t, r);
    return n === null ? "" : n.value;
  }
}
Kr.XElement = Cc;
const sm = new RegExp(/^[A-Za-z_][:A-Za-z0-9_-]*$/i);
function lm(e) {
  return sm.test(e);
}
function ts(e, t, r) {
  const n = e.name;
  return n === t || r === !0 && n.length === t.length && n.toLowerCase() === t.toLowerCase();
}
function cm(e) {
  let t = null;
  const r = om.parser(!0, {}), n = [];
  return r.onopentag = (i) => {
    const a = new Cc(i.name);
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
  var r = fr;
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
  var s = Ma;
  Object.defineProperty(e, "retry", { enumerable: !0, get: function() {
    return s.retry;
  } });
  var l = Ba;
  Object.defineProperty(e, "parseDn", { enumerable: !0, get: function() {
    return l.parseDn;
  } });
  var p = sr;
  Object.defineProperty(e, "UUID", { enumerable: !0, get: function() {
    return p.UUID;
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
function $c(e) {
  return typeof e > "u" || e === null;
}
function um(e) {
  return typeof e == "object" && e !== null;
}
function fm(e) {
  return Array.isArray(e) ? e : $c(e) ? [] : [e];
}
function dm(e, t) {
  var r, n, i, a;
  if (t)
    for (a = Object.keys(t), r = 0, n = a.length; r < n; r += 1)
      i = a[r], e[i] = t[i];
  return e;
}
function hm(e, t) {
  var r = "", n;
  for (n = 0; n < t; n += 1)
    r += e;
  return r;
}
function pm(e) {
  return e === 0 && Number.NEGATIVE_INFINITY === 1 / e;
}
Ye.isNothing = $c;
Ye.isObject = um;
Ye.toArray = fm;
Ye.repeat = hm;
Ye.isNegativeZero = pm;
Ye.extend = dm;
function bc(e, t) {
  var r = "", n = e.reason || "(unknown reason)";
  return e.mark ? (e.mark.name && (r += 'in "' + e.mark.name + '" '), r += "(" + (e.mark.line + 1) + ":" + (e.mark.column + 1) + ")", !t && e.mark.snippet && (r += `

` + e.mark.snippet), n + " " + r) : n;
}
function xr(e, t) {
  Error.call(this), this.name = "YAMLException", this.reason = e, this.mark = t, this.message = bc(this, !1), Error.captureStackTrace ? Error.captureStackTrace(this, this.constructor) : this.stack = new Error().stack || "";
}
xr.prototype = Object.create(Error.prototype);
xr.prototype.constructor = xr;
xr.prototype.toString = function(t) {
  return this.name + ": " + bc(this, t);
};
var Qr = xr, Tr = Ye;
function Bi(e, t, r, n, i) {
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
function mm(e, t) {
  if (t = Object.create(t || null), !e.buffer) return null;
  t.maxLength || (t.maxLength = 79), typeof t.indent != "number" && (t.indent = 1), typeof t.linesBefore != "number" && (t.linesBefore = 3), typeof t.linesAfter != "number" && (t.linesAfter = 2);
  for (var r = /\r?\n|\r|\0/g, n = [0], i = [], a, o = -1; a = r.exec(e.buffer); )
    i.push(a.index), n.push(a.index + a[0].length), e.position <= a.index && o < 0 && (o = n.length - 2);
  o < 0 && (o = n.length - 1);
  var s = "", l, p, c = Math.min(e.line + t.linesAfter, i.length).toString().length, f = t.maxLength - (t.indent + c + 3);
  for (l = 1; l <= t.linesBefore && !(o - l < 0); l++)
    p = Bi(
      e.buffer,
      n[o - l],
      i[o - l],
      e.position - (n[o] - n[o - l]),
      f
    ), s = Tr.repeat(" ", t.indent) + ji((e.line - l + 1).toString(), c) + " | " + p.str + `
` + s;
  for (p = Bi(e.buffer, n[o], i[o], e.position, f), s += Tr.repeat(" ", t.indent) + ji((e.line + 1).toString(), c) + " | " + p.str + `
`, s += Tr.repeat("-", t.indent + c + 3 + p.pos) + `^
`, l = 1; l <= t.linesAfter && !(o + l >= i.length); l++)
    p = Bi(
      e.buffer,
      n[o + l],
      i[o + l],
      e.position - (n[o] - n[o + l]),
      f
    ), s += Tr.repeat(" ", t.indent) + ji((e.line + l + 1).toString(), c) + " | " + p.str + `
`;
  return s.replace(/\n$/, "");
}
var gm = mm, rs = Qr, ym = [
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
], wm = [
  "scalar",
  "sequence",
  "mapping"
];
function Em(e) {
  var t = {};
  return e !== null && Object.keys(e).forEach(function(r) {
    e[r].forEach(function(n) {
      t[String(n)] = r;
    });
  }), t;
}
function vm(e, t) {
  if (t = t || {}, Object.keys(t).forEach(function(r) {
    if (ym.indexOf(r) === -1)
      throw new rs('Unknown option "' + r + '" is met in definition of "' + e + '" YAML type.');
  }), this.options = t, this.tag = e, this.kind = t.kind || null, this.resolve = t.resolve || function() {
    return !0;
  }, this.construct = t.construct || function(r) {
    return r;
  }, this.instanceOf = t.instanceOf || null, this.predicate = t.predicate || null, this.represent = t.represent || null, this.representName = t.representName || null, this.defaultStyle = t.defaultStyle || null, this.multi = t.multi || !1, this.styleAliases = Em(t.styleAliases || null), wm.indexOf(this.kind) === -1)
    throw new rs('Unknown kind "' + this.kind + '" is specified for "' + e + '" YAML type.');
}
var Re = vm, vr = Qr, Hi = Re;
function ns(e, t) {
  var r = [];
  return e[t].forEach(function(n) {
    var i = r.length;
    r.forEach(function(a, o) {
      a.tag === n.tag && a.kind === n.kind && a.multi === n.multi && (i = o);
    }), r[i] = n;
  }), r;
}
function _m() {
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
function ga(e) {
  return this.extend(e);
}
ga.prototype.extend = function(t) {
  var r = [], n = [];
  if (t instanceof Hi)
    n.push(t);
  else if (Array.isArray(t))
    n = n.concat(t);
  else if (t && (Array.isArray(t.implicit) || Array.isArray(t.explicit)))
    t.implicit && (r = r.concat(t.implicit)), t.explicit && (n = n.concat(t.explicit));
  else
    throw new vr("Schema.extend argument should be a Type, [ Type ], or a schema definition ({ implicit: [...], explicit: [...] })");
  r.forEach(function(a) {
    if (!(a instanceof Hi))
      throw new vr("Specified list of YAML types (or a single Type object) contains a non-Type object.");
    if (a.loadKind && a.loadKind !== "scalar")
      throw new vr("There is a non-scalar type in the implicit list of a schema. Implicit resolving of such types is not supported.");
    if (a.multi)
      throw new vr("There is a multi type in the implicit list of a schema. Multi tags can only be listed as explicit.");
  }), n.forEach(function(a) {
    if (!(a instanceof Hi))
      throw new vr("Specified list of YAML types (or a single Type object) contains a non-Type object.");
  });
  var i = Object.create(ga.prototype);
  return i.implicit = (this.implicit || []).concat(r), i.explicit = (this.explicit || []).concat(n), i.compiledImplicit = ns(i, "implicit"), i.compiledExplicit = ns(i, "explicit"), i.compiledTypeMap = _m(i.compiledImplicit, i.compiledExplicit), i;
};
var Ic = ga, Sm = Re, Oc = new Sm("tag:yaml.org,2002:str", {
  kind: "scalar",
  construct: function(e) {
    return e !== null ? e : "";
  }
}), Am = Re, Pc = new Am("tag:yaml.org,2002:seq", {
  kind: "sequence",
  construct: function(e) {
    return e !== null ? e : [];
  }
}), Tm = Re, Dc = new Tm("tag:yaml.org,2002:map", {
  kind: "mapping",
  construct: function(e) {
    return e !== null ? e : {};
  }
}), Cm = Ic, Nc = new Cm({
  explicit: [
    Oc,
    Pc,
    Dc
  ]
}), $m = Re;
function bm(e) {
  if (e === null) return !0;
  var t = e.length;
  return t === 1 && e === "~" || t === 4 && (e === "null" || e === "Null" || e === "NULL");
}
function Im() {
  return null;
}
function Om(e) {
  return e === null;
}
var Rc = new $m("tag:yaml.org,2002:null", {
  kind: "scalar",
  resolve: bm,
  construct: Im,
  predicate: Om,
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
}), Pm = Re;
function Dm(e) {
  if (e === null) return !1;
  var t = e.length;
  return t === 4 && (e === "true" || e === "True" || e === "TRUE") || t === 5 && (e === "false" || e === "False" || e === "FALSE");
}
function Nm(e) {
  return e === "true" || e === "True" || e === "TRUE";
}
function Rm(e) {
  return Object.prototype.toString.call(e) === "[object Boolean]";
}
var Fc = new Pm("tag:yaml.org,2002:bool", {
  kind: "scalar",
  resolve: Dm,
  construct: Nm,
  predicate: Rm,
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
}), Fm = Ye, xm = Re;
function Lm(e) {
  return 48 <= e && e <= 57 || 65 <= e && e <= 70 || 97 <= e && e <= 102;
}
function Um(e) {
  return 48 <= e && e <= 55;
}
function km(e) {
  return 48 <= e && e <= 57;
}
function Mm(e) {
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
          if (!Lm(e.charCodeAt(r))) return !1;
          n = !0;
        }
      return n && i !== "_";
    }
    if (i === "o") {
      for (r++; r < t; r++)
        if (i = e[r], i !== "_") {
          if (!Um(e.charCodeAt(r))) return !1;
          n = !0;
        }
      return n && i !== "_";
    }
  }
  if (i === "_") return !1;
  for (; r < t; r++)
    if (i = e[r], i !== "_") {
      if (!km(e.charCodeAt(r)))
        return !1;
      n = !0;
    }
  return !(!n || i === "_");
}
function Bm(e) {
  var t = e, r = 1, n;
  if (t.indexOf("_") !== -1 && (t = t.replace(/_/g, "")), n = t[0], (n === "-" || n === "+") && (n === "-" && (r = -1), t = t.slice(1), n = t[0]), t === "0") return 0;
  if (n === "0") {
    if (t[1] === "b") return r * parseInt(t.slice(2), 2);
    if (t[1] === "x") return r * parseInt(t.slice(2), 16);
    if (t[1] === "o") return r * parseInt(t.slice(2), 8);
  }
  return r * parseInt(t, 10);
}
function jm(e) {
  return Object.prototype.toString.call(e) === "[object Number]" && e % 1 === 0 && !Fm.isNegativeZero(e);
}
var xc = new xm("tag:yaml.org,2002:int", {
  kind: "scalar",
  resolve: Mm,
  construct: Bm,
  predicate: jm,
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
}), Lc = Ye, Hm = Re, qm = new RegExp(
  // 2.5e4, 2.5 and integers
  "^(?:[-+]?(?:[0-9][0-9_]*)(?:\\.[0-9_]*)?(?:[eE][-+]?[0-9]+)?|\\.[0-9_]+(?:[eE][-+]?[0-9]+)?|[-+]?\\.(?:inf|Inf|INF)|\\.(?:nan|NaN|NAN))$"
);
function Gm(e) {
  return !(e === null || !qm.test(e) || // Quick hack to not allow integers end with `_`
  // Probably should update regexp & check speed
  e[e.length - 1] === "_");
}
function Wm(e) {
  var t, r;
  return t = e.replace(/_/g, "").toLowerCase(), r = t[0] === "-" ? -1 : 1, "+-".indexOf(t[0]) >= 0 && (t = t.slice(1)), t === ".inf" ? r === 1 ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY : t === ".nan" ? NaN : r * parseFloat(t, 10);
}
var zm = /^[-+]?[0-9]+e/;
function Vm(e, t) {
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
  else if (Lc.isNegativeZero(e))
    return "-0.0";
  return r = e.toString(10), zm.test(r) ? r.replace("e", ".e") : r;
}
function Ym(e) {
  return Object.prototype.toString.call(e) === "[object Number]" && (e % 1 !== 0 || Lc.isNegativeZero(e));
}
var Uc = new Hm("tag:yaml.org,2002:float", {
  kind: "scalar",
  resolve: Gm,
  construct: Wm,
  predicate: Ym,
  represent: Vm,
  defaultStyle: "lowercase"
}), kc = Nc.extend({
  implicit: [
    Rc,
    Fc,
    xc,
    Uc
  ]
}), Mc = kc, Xm = Re, Bc = new RegExp(
  "^([0-9][0-9][0-9][0-9])-([0-9][0-9])-([0-9][0-9])$"
), jc = new RegExp(
  "^([0-9][0-9][0-9][0-9])-([0-9][0-9]?)-([0-9][0-9]?)(?:[Tt]|[ \\t]+)([0-9][0-9]?):([0-9][0-9]):([0-9][0-9])(?:\\.([0-9]*))?(?:[ \\t]*(Z|([-+])([0-9][0-9]?)(?::([0-9][0-9]))?))?$"
);
function Jm(e) {
  return e === null ? !1 : Bc.exec(e) !== null || jc.exec(e) !== null;
}
function Km(e) {
  var t, r, n, i, a, o, s, l = 0, p = null, c, f, h;
  if (t = Bc.exec(e), t === null && (t = jc.exec(e)), t === null) throw new Error("Date resolve error");
  if (r = +t[1], n = +t[2] - 1, i = +t[3], !t[4])
    return new Date(Date.UTC(r, n, i));
  if (a = +t[4], o = +t[5], s = +t[6], t[7]) {
    for (l = t[7].slice(0, 3); l.length < 3; )
      l += "0";
    l = +l;
  }
  return t[9] && (c = +t[10], f = +(t[11] || 0), p = (c * 60 + f) * 6e4, t[9] === "-" && (p = -p)), h = new Date(Date.UTC(r, n, i, a, o, s, l)), p && h.setTime(h.getTime() - p), h;
}
function Qm(e) {
  return e.toISOString();
}
var Hc = new Xm("tag:yaml.org,2002:timestamp", {
  kind: "scalar",
  resolve: Jm,
  construct: Km,
  instanceOf: Date,
  represent: Qm
}), Zm = Re;
function eg(e) {
  return e === "<<" || e === null;
}
var qc = new Zm("tag:yaml.org,2002:merge", {
  kind: "scalar",
  resolve: eg
}), tg = Re, Ha = `ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=
\r`;
function rg(e) {
  if (e === null) return !1;
  var t, r, n = 0, i = e.length, a = Ha;
  for (r = 0; r < i; r++)
    if (t = a.indexOf(e.charAt(r)), !(t > 64)) {
      if (t < 0) return !1;
      n += 6;
    }
  return n % 8 === 0;
}
function ng(e) {
  var t, r, n = e.replace(/[\r\n=]/g, ""), i = n.length, a = Ha, o = 0, s = [];
  for (t = 0; t < i; t++)
    t % 4 === 0 && t && (s.push(o >> 16 & 255), s.push(o >> 8 & 255), s.push(o & 255)), o = o << 6 | a.indexOf(n.charAt(t));
  return r = i % 4 * 6, r === 0 ? (s.push(o >> 16 & 255), s.push(o >> 8 & 255), s.push(o & 255)) : r === 18 ? (s.push(o >> 10 & 255), s.push(o >> 2 & 255)) : r === 12 && s.push(o >> 4 & 255), new Uint8Array(s);
}
function ig(e) {
  var t = "", r = 0, n, i, a = e.length, o = Ha;
  for (n = 0; n < a; n++)
    n % 3 === 0 && n && (t += o[r >> 18 & 63], t += o[r >> 12 & 63], t += o[r >> 6 & 63], t += o[r & 63]), r = (r << 8) + e[n];
  return i = a % 3, i === 0 ? (t += o[r >> 18 & 63], t += o[r >> 12 & 63], t += o[r >> 6 & 63], t += o[r & 63]) : i === 2 ? (t += o[r >> 10 & 63], t += o[r >> 4 & 63], t += o[r << 2 & 63], t += o[64]) : i === 1 && (t += o[r >> 2 & 63], t += o[r << 4 & 63], t += o[64], t += o[64]), t;
}
function ag(e) {
  return Object.prototype.toString.call(e) === "[object Uint8Array]";
}
var Gc = new tg("tag:yaml.org,2002:binary", {
  kind: "scalar",
  resolve: rg,
  construct: ng,
  predicate: ag,
  represent: ig
}), og = Re, sg = Object.prototype.hasOwnProperty, lg = Object.prototype.toString;
function cg(e) {
  if (e === null) return !0;
  var t = [], r, n, i, a, o, s = e;
  for (r = 0, n = s.length; r < n; r += 1) {
    if (i = s[r], o = !1, lg.call(i) !== "[object Object]") return !1;
    for (a in i)
      if (sg.call(i, a))
        if (!o) o = !0;
        else return !1;
    if (!o) return !1;
    if (t.indexOf(a) === -1) t.push(a);
    else return !1;
  }
  return !0;
}
function ug(e) {
  return e !== null ? e : [];
}
var Wc = new og("tag:yaml.org,2002:omap", {
  kind: "sequence",
  resolve: cg,
  construct: ug
}), fg = Re, dg = Object.prototype.toString;
function hg(e) {
  if (e === null) return !0;
  var t, r, n, i, a, o = e;
  for (a = new Array(o.length), t = 0, r = o.length; t < r; t += 1) {
    if (n = o[t], dg.call(n) !== "[object Object]" || (i = Object.keys(n), i.length !== 1)) return !1;
    a[t] = [i[0], n[i[0]]];
  }
  return !0;
}
function pg(e) {
  if (e === null) return [];
  var t, r, n, i, a, o = e;
  for (a = new Array(o.length), t = 0, r = o.length; t < r; t += 1)
    n = o[t], i = Object.keys(n), a[t] = [i[0], n[i[0]]];
  return a;
}
var zc = new fg("tag:yaml.org,2002:pairs", {
  kind: "sequence",
  resolve: hg,
  construct: pg
}), mg = Re, gg = Object.prototype.hasOwnProperty;
function yg(e) {
  if (e === null) return !0;
  var t, r = e;
  for (t in r)
    if (gg.call(r, t) && r[t] !== null)
      return !1;
  return !0;
}
function wg(e) {
  return e !== null ? e : {};
}
var Vc = new mg("tag:yaml.org,2002:set", {
  kind: "mapping",
  resolve: yg,
  construct: wg
}), qa = Mc.extend({
  implicit: [
    Hc,
    qc
  ],
  explicit: [
    Gc,
    Wc,
    zc,
    Vc
  ]
}), Ft = Ye, Yc = Qr, Eg = gm, vg = qa, vt = Object.prototype.hasOwnProperty, Wn = 1, Xc = 2, Jc = 3, zn = 4, qi = 1, _g = 2, is = 3, Sg = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x84\x86-\x9F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]/, Ag = /[\x85\u2028\u2029]/, Tg = /[,\[\]\{\}]/, Kc = /^(?:!|!!|![a-z\-]+!)$/i, Qc = /^(?:!|[^,\[\]\{\}])(?:%[0-9a-f]{2}|[0-9a-z\-#;\/\?:@&=\+\$,_\.!~\*'\(\)\[\]])*$/i;
function as(e) {
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
function Qt(e) {
  return e === 44 || e === 91 || e === 93 || e === 123 || e === 125;
}
function Cg(e) {
  var t;
  return 48 <= e && e <= 57 ? e - 48 : (t = e | 32, 97 <= t && t <= 102 ? t - 97 + 10 : -1);
}
function $g(e) {
  return e === 120 ? 2 : e === 117 ? 4 : e === 85 ? 8 : 0;
}
function bg(e) {
  return 48 <= e && e <= 57 ? e - 48 : -1;
}
function os(e) {
  return e === 48 ? "\0" : e === 97 ? "\x07" : e === 98 ? "\b" : e === 116 || e === 9 ? "	" : e === 110 ? `
` : e === 118 ? "\v" : e === 102 ? "\f" : e === 114 ? "\r" : e === 101 ? "\x1B" : e === 32 ? " " : e === 34 ? '"' : e === 47 ? "/" : e === 92 ? "\\" : e === 78 ? "" : e === 95 ? " " : e === 76 ? "\u2028" : e === 80 ? "\u2029" : "";
}
function Ig(e) {
  return e <= 65535 ? String.fromCharCode(e) : String.fromCharCode(
    (e - 65536 >> 10) + 55296,
    (e - 65536 & 1023) + 56320
  );
}
var Zc = new Array(256), eu = new Array(256);
for (var zt = 0; zt < 256; zt++)
  Zc[zt] = os(zt) ? 1 : 0, eu[zt] = os(zt);
function Og(e, t) {
  this.input = e, this.filename = t.filename || null, this.schema = t.schema || vg, this.onWarning = t.onWarning || null, this.legacy = t.legacy || !1, this.json = t.json || !1, this.listener = t.listener || null, this.implicitTypes = this.schema.compiledImplicit, this.typeMap = this.schema.compiledTypeMap, this.length = e.length, this.position = 0, this.line = 0, this.lineStart = 0, this.lineIndent = 0, this.firstTabInLine = -1, this.documents = [];
}
function tu(e, t) {
  var r = {
    name: e.filename,
    buffer: e.input.slice(0, -1),
    // omit trailing \0
    position: e.position,
    line: e.line,
    column: e.position - e.lineStart
  };
  return r.snippet = Eg(r), new Yc(t, r);
}
function U(e, t) {
  throw tu(e, t);
}
function Vn(e, t) {
  e.onWarning && e.onWarning.call(null, tu(e, t));
}
var ss = {
  YAML: function(t, r, n) {
    var i, a, o;
    t.version !== null && U(t, "duplication of %YAML directive"), n.length !== 1 && U(t, "YAML directive accepts exactly one argument"), i = /^([0-9]+)\.([0-9]+)$/.exec(n[0]), i === null && U(t, "ill-formed argument of the YAML directive"), a = parseInt(i[1], 10), o = parseInt(i[2], 10), a !== 1 && U(t, "unacceptable YAML version of the document"), t.version = n[0], t.checkLineBreaks = o < 2, o !== 1 && o !== 2 && Vn(t, "unsupported YAML version of the document");
  },
  TAG: function(t, r, n) {
    var i, a;
    n.length !== 2 && U(t, "TAG directive accepts exactly two arguments"), i = n[0], a = n[1], Kc.test(i) || U(t, "ill-formed tag handle (first argument) of the TAG directive"), vt.call(t.tagMap, i) && U(t, 'there is a previously declared suffix for "' + i + '" tag handle'), Qc.test(a) || U(t, "ill-formed tag prefix (second argument) of the TAG directive");
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
    else Sg.test(s) && U(e, "the stream contains non-printable characters");
    e.result += s;
  }
}
function ls(e, t, r, n) {
  var i, a, o, s;
  for (Ft.isObject(r) || U(e, "cannot merge mappings; the provided source object is unacceptable"), i = Object.keys(r), o = 0, s = i.length; o < s; o += 1)
    a = i[o], vt.call(t, a) || (t[a] = r[a], n[a] = !0);
}
function Zt(e, t, r, n, i, a, o, s, l) {
  var p, c;
  if (Array.isArray(i))
    for (i = Array.prototype.slice.call(i), p = 0, c = i.length; p < c; p += 1)
      Array.isArray(i[p]) && U(e, "nested arrays are not supported inside keys"), typeof i == "object" && as(i[p]) === "[object Object]" && (i[p] = "[object Object]");
  if (typeof i == "object" && as(i) === "[object Object]" && (i = "[object Object]"), i = String(i), t === null && (t = {}), n === "tag:yaml.org,2002:merge")
    if (Array.isArray(a))
      for (p = 0, c = a.length; p < c; p += 1)
        ls(e, t, a[p], r);
    else
      ls(e, t, a, r);
  else
    !e.json && !vt.call(r, i) && vt.call(t, i) && (e.line = o || e.line, e.lineStart = s || e.lineStart, e.position = l || e.position, U(e, "duplicated mapping key")), i === "__proto__" ? Object.defineProperty(t, i, {
      configurable: !0,
      enumerable: !0,
      writable: !0,
      value: a
    }) : t[i] = a, delete r[i];
  return t;
}
function Ga(e) {
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
      for (Ga(e), i = e.input.charCodeAt(e.position), n++, e.lineIndent = 0; i === 32; )
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
function Wa(e, t) {
  t === 1 ? e.result += " " : t > 1 && (e.result += Ft.repeat(`
`, t - 1));
}
function Pg(e, t, r) {
  var n, i, a, o, s, l, p, c, f = e.kind, h = e.result, g;
  if (g = e.input.charCodeAt(e.position), Ue(g) || Qt(g) || g === 35 || g === 38 || g === 42 || g === 33 || g === 124 || g === 62 || g === 39 || g === 34 || g === 37 || g === 64 || g === 96 || (g === 63 || g === 45) && (i = e.input.charCodeAt(e.position + 1), Ue(i) || r && Qt(i)))
    return !1;
  for (e.kind = "scalar", e.result = "", a = o = e.position, s = !1; g !== 0; ) {
    if (g === 58) {
      if (i = e.input.charCodeAt(e.position + 1), Ue(i) || r && Qt(i))
        break;
    } else if (g === 35) {
      if (n = e.input.charCodeAt(e.position - 1), Ue(n))
        break;
    } else {
      if (e.position === e.lineStart && si(e) || r && Qt(g))
        break;
      if (et(g))
        if (l = e.line, p = e.lineStart, c = e.lineIndent, fe(e, !1, -1), e.lineIndent >= t) {
          s = !0, g = e.input.charCodeAt(e.position);
          continue;
        } else {
          e.position = o, e.line = l, e.lineStart = p, e.lineIndent = c;
          break;
        }
    }
    s && (yt(e, a, o, !1), Wa(e, e.line - l), a = o = e.position, s = !1), Ut(g) || (o = e.position + 1), g = e.input.charCodeAt(++e.position);
  }
  return yt(e, a, o, !1), e.result ? !0 : (e.kind = f, e.result = h, !1);
}
function Dg(e, t) {
  var r, n, i;
  if (r = e.input.charCodeAt(e.position), r !== 39)
    return !1;
  for (e.kind = "scalar", e.result = "", e.position++, n = i = e.position; (r = e.input.charCodeAt(e.position)) !== 0; )
    if (r === 39)
      if (yt(e, n, e.position, !0), r = e.input.charCodeAt(++e.position), r === 39)
        n = e.position, e.position++, i = e.position;
      else
        return !0;
    else et(r) ? (yt(e, n, i, !0), Wa(e, fe(e, !1, t)), n = i = e.position) : e.position === e.lineStart && si(e) ? U(e, "unexpected end of the document within a single quoted scalar") : (e.position++, i = e.position);
  U(e, "unexpected end of the stream within a single quoted scalar");
}
function Ng(e, t) {
  var r, n, i, a, o, s;
  if (s = e.input.charCodeAt(e.position), s !== 34)
    return !1;
  for (e.kind = "scalar", e.result = "", e.position++, r = n = e.position; (s = e.input.charCodeAt(e.position)) !== 0; ) {
    if (s === 34)
      return yt(e, r, e.position, !0), e.position++, !0;
    if (s === 92) {
      if (yt(e, r, e.position, !0), s = e.input.charCodeAt(++e.position), et(s))
        fe(e, !1, t);
      else if (s < 256 && Zc[s])
        e.result += eu[s], e.position++;
      else if ((o = $g(s)) > 0) {
        for (i = o, a = 0; i > 0; i--)
          s = e.input.charCodeAt(++e.position), (o = Cg(s)) >= 0 ? a = (a << 4) + o : U(e, "expected hexadecimal character");
        e.result += Ig(a), e.position++;
      } else
        U(e, "unknown escape sequence");
      r = n = e.position;
    } else et(s) ? (yt(e, r, n, !0), Wa(e, fe(e, !1, t)), r = n = e.position) : e.position === e.lineStart && si(e) ? U(e, "unexpected end of the document within a double quoted scalar") : (e.position++, n = e.position);
  }
  U(e, "unexpected end of the stream within a double quoted scalar");
}
function Rg(e, t) {
  var r = !0, n, i, a, o = e.tag, s, l = e.anchor, p, c, f, h, g, v = /* @__PURE__ */ Object.create(null), w, S, T, A;
  if (A = e.input.charCodeAt(e.position), A === 91)
    c = 93, g = !1, s = [];
  else if (A === 123)
    c = 125, g = !0, s = {};
  else
    return !1;
  for (e.anchor !== null && (e.anchorMap[e.anchor] = s), A = e.input.charCodeAt(++e.position); A !== 0; ) {
    if (fe(e, !0, t), A = e.input.charCodeAt(e.position), A === c)
      return e.position++, e.tag = o, e.anchor = l, e.kind = g ? "mapping" : "sequence", e.result = s, !0;
    r ? A === 44 && U(e, "expected the node content, but found ','") : U(e, "missed comma between flow collection entries"), S = w = T = null, f = h = !1, A === 63 && (p = e.input.charCodeAt(e.position + 1), Ue(p) && (f = h = !0, e.position++, fe(e, !0, t))), n = e.line, i = e.lineStart, a = e.position, lr(e, t, Wn, !1, !0), S = e.tag, w = e.result, fe(e, !0, t), A = e.input.charCodeAt(e.position), (h || e.line === n) && A === 58 && (f = !0, A = e.input.charCodeAt(++e.position), fe(e, !0, t), lr(e, t, Wn, !1, !0), T = e.result), g ? Zt(e, s, v, S, w, T, n, i, a) : f ? s.push(Zt(e, null, v, S, w, T, n, i, a)) : s.push(w), fe(e, !0, t), A = e.input.charCodeAt(e.position), A === 44 ? (r = !0, A = e.input.charCodeAt(++e.position)) : r = !1;
  }
  U(e, "unexpected end of the stream within a flow collection");
}
function Fg(e, t) {
  var r, n, i = qi, a = !1, o = !1, s = t, l = 0, p = !1, c, f;
  if (f = e.input.charCodeAt(e.position), f === 124)
    n = !1;
  else if (f === 62)
    n = !0;
  else
    return !1;
  for (e.kind = "scalar", e.result = ""; f !== 0; )
    if (f = e.input.charCodeAt(++e.position), f === 43 || f === 45)
      qi === i ? i = f === 43 ? is : _g : U(e, "repeat of a chomping mode identifier");
    else if ((c = bg(f)) >= 0)
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
    for (Ga(e), e.lineIndent = 0, f = e.input.charCodeAt(e.position); (!o || e.lineIndent < s) && f === 32; )
      e.lineIndent++, f = e.input.charCodeAt(++e.position);
    if (!o && e.lineIndent > s && (s = e.lineIndent), et(f)) {
      l++;
      continue;
    }
    if (e.lineIndent < s) {
      i === is ? e.result += Ft.repeat(`
`, a ? 1 + l : l) : i === qi && a && (e.result += `
`);
      break;
    }
    for (n ? Ut(f) ? (p = !0, e.result += Ft.repeat(`
`, a ? 1 + l : l)) : p ? (p = !1, e.result += Ft.repeat(`
`, l + 1)) : l === 0 ? a && (e.result += " ") : e.result += Ft.repeat(`
`, l) : e.result += Ft.repeat(`
`, a ? 1 + l : l), a = !0, o = !0, l = 0, r = e.position; !et(f) && f !== 0; )
      f = e.input.charCodeAt(++e.position);
    yt(e, r, e.position, !1);
  }
  return !0;
}
function cs(e, t) {
  var r, n = e.tag, i = e.anchor, a = [], o, s = !1, l;
  if (e.firstTabInLine !== -1) return !1;
  for (e.anchor !== null && (e.anchorMap[e.anchor] = a), l = e.input.charCodeAt(e.position); l !== 0 && (e.firstTabInLine !== -1 && (e.position = e.firstTabInLine, U(e, "tab characters must not be used in indentation")), !(l !== 45 || (o = e.input.charCodeAt(e.position + 1), !Ue(o)))); ) {
    if (s = !0, e.position++, fe(e, !0, -1) && e.lineIndent <= t) {
      a.push(null), l = e.input.charCodeAt(e.position);
      continue;
    }
    if (r = e.line, lr(e, t, Jc, !1, !0), a.push(e.result), fe(e, !0, -1), l = e.input.charCodeAt(e.position), (e.line === r || e.lineIndent > t) && l !== 0)
      U(e, "bad indentation of a sequence entry");
    else if (e.lineIndent < t)
      break;
  }
  return s ? (e.tag = n, e.anchor = i, e.kind = "sequence", e.result = a, !0) : !1;
}
function xg(e, t, r) {
  var n, i, a, o, s, l, p = e.tag, c = e.anchor, f = {}, h = /* @__PURE__ */ Object.create(null), g = null, v = null, w = null, S = !1, T = !1, A;
  if (e.firstTabInLine !== -1) return !1;
  for (e.anchor !== null && (e.anchorMap[e.anchor] = f), A = e.input.charCodeAt(e.position); A !== 0; ) {
    if (!S && e.firstTabInLine !== -1 && (e.position = e.firstTabInLine, U(e, "tab characters must not be used in indentation")), n = e.input.charCodeAt(e.position + 1), a = e.line, (A === 63 || A === 58) && Ue(n))
      A === 63 ? (S && (Zt(e, f, h, g, v, null, o, s, l), g = v = w = null), T = !0, S = !0, i = !0) : S ? (S = !1, i = !0) : U(e, "incomplete explicit mapping pair; a key node is missed; or followed by a non-tabulated empty line"), e.position += 1, A = n;
    else {
      if (o = e.line, s = e.lineStart, l = e.position, !lr(e, r, Xc, !1, !0))
        break;
      if (e.line === a) {
        for (A = e.input.charCodeAt(e.position); Ut(A); )
          A = e.input.charCodeAt(++e.position);
        if (A === 58)
          A = e.input.charCodeAt(++e.position), Ue(A) || U(e, "a whitespace character is expected after the key-value separator within a block mapping"), S && (Zt(e, f, h, g, v, null, o, s, l), g = v = w = null), T = !0, S = !1, i = !1, g = e.tag, v = e.result;
        else if (T)
          U(e, "can not read an implicit mapping pair; a colon is missed");
        else
          return e.tag = p, e.anchor = c, !0;
      } else if (T)
        U(e, "can not read a block mapping entry; a multiline key may not be an implicit key");
      else
        return e.tag = p, e.anchor = c, !0;
    }
    if ((e.line === a || e.lineIndent > t) && (S && (o = e.line, s = e.lineStart, l = e.position), lr(e, t, zn, !0, i) && (S ? v = e.result : w = e.result), S || (Zt(e, f, h, g, v, w, o, s, l), g = v = w = null), fe(e, !0, -1), A = e.input.charCodeAt(e.position)), (e.line === a || e.lineIndent > t) && A !== 0)
      U(e, "bad indentation of a mapping entry");
    else if (e.lineIndent < t)
      break;
  }
  return S && Zt(e, f, h, g, v, null, o, s, l), T && (e.tag = p, e.anchor = c, e.kind = "mapping", e.result = f), T;
}
function Lg(e) {
  var t, r = !1, n = !1, i, a, o;
  if (o = e.input.charCodeAt(e.position), o !== 33) return !1;
  if (e.tag !== null && U(e, "duplication of a tag property"), o = e.input.charCodeAt(++e.position), o === 60 ? (r = !0, o = e.input.charCodeAt(++e.position)) : o === 33 ? (n = !0, i = "!!", o = e.input.charCodeAt(++e.position)) : i = "!", t = e.position, r) {
    do
      o = e.input.charCodeAt(++e.position);
    while (o !== 0 && o !== 62);
    e.position < e.length ? (a = e.input.slice(t, e.position), o = e.input.charCodeAt(++e.position)) : U(e, "unexpected end of the stream within a verbatim tag");
  } else {
    for (; o !== 0 && !Ue(o); )
      o === 33 && (n ? U(e, "tag suffix cannot contain exclamation marks") : (i = e.input.slice(t - 1, e.position + 1), Kc.test(i) || U(e, "named tag handle cannot contain such characters"), n = !0, t = e.position + 1)), o = e.input.charCodeAt(++e.position);
    a = e.input.slice(t, e.position), Tg.test(a) && U(e, "tag suffix cannot contain flow indicator characters");
  }
  a && !Qc.test(a) && U(e, "tag name cannot contain such characters: " + a);
  try {
    a = decodeURIComponent(a);
  } catch {
    U(e, "tag name is malformed: " + a);
  }
  return r ? e.tag = a : vt.call(e.tagMap, i) ? e.tag = e.tagMap[i] + a : i === "!" ? e.tag = "!" + a : i === "!!" ? e.tag = "tag:yaml.org,2002:" + a : U(e, 'undeclared tag handle "' + i + '"'), !0;
}
function Ug(e) {
  var t, r;
  if (r = e.input.charCodeAt(e.position), r !== 38) return !1;
  for (e.anchor !== null && U(e, "duplication of an anchor property"), r = e.input.charCodeAt(++e.position), t = e.position; r !== 0 && !Ue(r) && !Qt(r); )
    r = e.input.charCodeAt(++e.position);
  return e.position === t && U(e, "name of an anchor node must contain at least one character"), e.anchor = e.input.slice(t, e.position), !0;
}
function kg(e) {
  var t, r, n;
  if (n = e.input.charCodeAt(e.position), n !== 42) return !1;
  for (n = e.input.charCodeAt(++e.position), t = e.position; n !== 0 && !Ue(n) && !Qt(n); )
    n = e.input.charCodeAt(++e.position);
  return e.position === t && U(e, "name of an alias node must contain at least one character"), r = e.input.slice(t, e.position), vt.call(e.anchorMap, r) || U(e, 'unidentified alias "' + r + '"'), e.result = e.anchorMap[r], fe(e, !0, -1), !0;
}
function lr(e, t, r, n, i) {
  var a, o, s, l = 1, p = !1, c = !1, f, h, g, v, w, S;
  if (e.listener !== null && e.listener("open", e), e.tag = null, e.anchor = null, e.kind = null, e.result = null, a = o = s = zn === r || Jc === r, n && fe(e, !0, -1) && (p = !0, e.lineIndent > t ? l = 1 : e.lineIndent === t ? l = 0 : e.lineIndent < t && (l = -1)), l === 1)
    for (; Lg(e) || Ug(e); )
      fe(e, !0, -1) ? (p = !0, s = a, e.lineIndent > t ? l = 1 : e.lineIndent === t ? l = 0 : e.lineIndent < t && (l = -1)) : s = !1;
  if (s && (s = p || i), (l === 1 || zn === r) && (Wn === r || Xc === r ? w = t : w = t + 1, S = e.position - e.lineStart, l === 1 ? s && (cs(e, S) || xg(e, S, w)) || Rg(e, w) ? c = !0 : (o && Fg(e, w) || Dg(e, w) || Ng(e, w) ? c = !0 : kg(e) ? (c = !0, (e.tag !== null || e.anchor !== null) && U(e, "alias node should not have any properties")) : Pg(e, w, Wn === r) && (c = !0, e.tag === null && (e.tag = "?")), e.anchor !== null && (e.anchorMap[e.anchor] = e.result)) : l === 0 && (c = s && cs(e, S))), e.tag === null)
    e.anchor !== null && (e.anchorMap[e.anchor] = e.result);
  else if (e.tag === "?") {
    for (e.result !== null && e.kind !== "scalar" && U(e, 'unacceptable node kind for !<?> tag; it should be "scalar", not "' + e.kind + '"'), f = 0, h = e.implicitTypes.length; f < h; f += 1)
      if (v = e.implicitTypes[f], v.resolve(e.result)) {
        e.result = v.construct(e.result), e.tag = v.tag, e.anchor !== null && (e.anchorMap[e.anchor] = e.result);
        break;
      }
  } else if (e.tag !== "!") {
    if (vt.call(e.typeMap[e.kind || "fallback"], e.tag))
      v = e.typeMap[e.kind || "fallback"][e.tag];
    else
      for (v = null, g = e.typeMap.multi[e.kind || "fallback"], f = 0, h = g.length; f < h; f += 1)
        if (e.tag.slice(0, g[f].tag.length) === g[f].tag) {
          v = g[f];
          break;
        }
    v || U(e, "unknown tag !<" + e.tag + ">"), e.result !== null && v.kind !== e.kind && U(e, "unacceptable node kind for !<" + e.tag + '> tag; it should be "' + v.kind + '", not "' + e.kind + '"'), v.resolve(e.result, e.tag) ? (e.result = v.construct(e.result, e.tag), e.anchor !== null && (e.anchorMap[e.anchor] = e.result)) : U(e, "cannot resolve a node with !<" + e.tag + "> explicit tag");
  }
  return e.listener !== null && e.listener("close", e), e.tag !== null || e.anchor !== null || c;
}
function Mg(e) {
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
    o !== 0 && Ga(e), vt.call(ss, n) ? ss[n](e, n, i) : Vn(e, 'unknown document directive "' + n + '"');
  }
  if (fe(e, !0, -1), e.lineIndent === 0 && e.input.charCodeAt(e.position) === 45 && e.input.charCodeAt(e.position + 1) === 45 && e.input.charCodeAt(e.position + 2) === 45 ? (e.position += 3, fe(e, !0, -1)) : a && U(e, "directives end mark is expected"), lr(e, e.lineIndent - 1, zn, !1, !0), fe(e, !0, -1), e.checkLineBreaks && Ag.test(e.input.slice(t, e.position)) && Vn(e, "non-ASCII line breaks are interpreted as content"), e.documents.push(e.result), e.position === e.lineStart && si(e)) {
    e.input.charCodeAt(e.position) === 46 && (e.position += 3, fe(e, !0, -1));
    return;
  }
  if (e.position < e.length - 1)
    U(e, "end of the stream or a document separator is expected");
  else
    return;
}
function ru(e, t) {
  e = String(e), t = t || {}, e.length !== 0 && (e.charCodeAt(e.length - 1) !== 10 && e.charCodeAt(e.length - 1) !== 13 && (e += `
`), e.charCodeAt(0) === 65279 && (e = e.slice(1)));
  var r = new Og(e, t), n = e.indexOf("\0");
  for (n !== -1 && (r.position = n, U(r, "null byte is not allowed in input")), r.input += "\0"; r.input.charCodeAt(r.position) === 32; )
    r.lineIndent += 1, r.position += 1;
  for (; r.position < r.length - 1; )
    Mg(r);
  return r.documents;
}
function Bg(e, t, r) {
  t !== null && typeof t == "object" && typeof r > "u" && (r = t, t = null);
  var n = ru(e, r);
  if (typeof t != "function")
    return n;
  for (var i = 0, a = n.length; i < a; i += 1)
    t(n[i]);
}
function jg(e, t) {
  var r = ru(e, t);
  if (r.length !== 0) {
    if (r.length === 1)
      return r[0];
    throw new Yc("expected a single document in the stream, but found more");
  }
}
ja.loadAll = Bg;
ja.load = jg;
var nu = {}, li = Ye, Zr = Qr, Hg = qa, iu = Object.prototype.toString, au = Object.prototype.hasOwnProperty, za = 65279, qg = 9, Lr = 10, Gg = 13, Wg = 32, zg = 33, Vg = 34, ya = 35, Yg = 37, Xg = 38, Jg = 39, Kg = 42, ou = 44, Qg = 45, Yn = 58, Zg = 61, e0 = 62, t0 = 63, r0 = 64, su = 91, lu = 93, n0 = 96, cu = 123, i0 = 124, uu = 125, $e = {};
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
var a0 = [
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
], o0 = /^[-+]?[0-9_]+(?::[0-9_]+)+(?:\.[0-9_]*)?$/;
function s0(e, t) {
  var r, n, i, a, o, s, l;
  if (t === null) return {};
  for (r = {}, n = Object.keys(t), i = 0, a = n.length; i < a; i += 1)
    o = n[i], s = String(t[o]), o.slice(0, 2) === "!!" && (o = "tag:yaml.org,2002:" + o.slice(2)), l = e.compiledTypeMap.fallback[o], l && au.call(l.styleAliases, s) && (s = l.styleAliases[s]), r[o] = s;
  return r;
}
function l0(e) {
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
var c0 = 1, Ur = 2;
function u0(e) {
  this.schema = e.schema || Hg, this.indent = Math.max(1, e.indent || 2), this.noArrayIndent = e.noArrayIndent || !1, this.skipInvalid = e.skipInvalid || !1, this.flowLevel = li.isNothing(e.flowLevel) ? -1 : e.flowLevel, this.styleMap = s0(this.schema, e.styles || null), this.sortKeys = e.sortKeys || !1, this.lineWidth = e.lineWidth || 80, this.noRefs = e.noRefs || !1, this.noCompatMode = e.noCompatMode || !1, this.condenseFlow = e.condenseFlow || !1, this.quotingType = e.quotingType === '"' ? Ur : c0, this.forceQuotes = e.forceQuotes || !1, this.replacer = typeof e.replacer == "function" ? e.replacer : null, this.implicitTypes = this.schema.compiledImplicit, this.explicitTypes = this.schema.compiledExplicit, this.tag = null, this.result = "", this.duplicates = [], this.usedDuplicates = null;
}
function us(e, t) {
  for (var r = li.repeat(" ", t), n = 0, i = -1, a = "", o, s = e.length; n < s; )
    i = e.indexOf(`
`, n), i === -1 ? (o = e.slice(n), n = s) : (o = e.slice(n, i + 1), n = i + 1), o.length && o !== `
` && (a += r), a += o;
  return a;
}
function wa(e, t) {
  return `
` + li.repeat(" ", e.indent * t);
}
function f0(e, t) {
  var r, n, i;
  for (r = 0, n = e.implicitTypes.length; r < n; r += 1)
    if (i = e.implicitTypes[r], i.resolve(t))
      return !0;
  return !1;
}
function Xn(e) {
  return e === Wg || e === qg;
}
function kr(e) {
  return 32 <= e && e <= 126 || 161 <= e && e <= 55295 && e !== 8232 && e !== 8233 || 57344 <= e && e <= 65533 && e !== za || 65536 <= e && e <= 1114111;
}
function fs(e) {
  return kr(e) && e !== za && e !== Gg && e !== Lr;
}
function ds(e, t, r) {
  var n = fs(e), i = n && !Xn(e);
  return (
    // ns-plain-safe
    (r ? (
      // c = flow-in
      n
    ) : n && e !== ou && e !== su && e !== lu && e !== cu && e !== uu) && e !== ya && !(t === Yn && !i) || fs(t) && !Xn(t) && e === ya || t === Yn && i
  );
}
function d0(e) {
  return kr(e) && e !== za && !Xn(e) && e !== Qg && e !== t0 && e !== Yn && e !== ou && e !== su && e !== lu && e !== cu && e !== uu && e !== ya && e !== Xg && e !== Kg && e !== zg && e !== i0 && e !== Zg && e !== e0 && e !== Jg && e !== Vg && e !== Yg && e !== r0 && e !== n0;
}
function h0(e) {
  return !Xn(e) && e !== Yn;
}
function Cr(e, t) {
  var r = e.charCodeAt(t), n;
  return r >= 55296 && r <= 56319 && t + 1 < e.length && (n = e.charCodeAt(t + 1), n >= 56320 && n <= 57343) ? (r - 55296) * 1024 + n - 56320 + 65536 : r;
}
function fu(e) {
  var t = /^\n* /;
  return t.test(e);
}
var du = 1, Ea = 2, hu = 3, pu = 4, Kt = 5;
function p0(e, t, r, n, i, a, o, s) {
  var l, p = 0, c = null, f = !1, h = !1, g = n !== -1, v = -1, w = d0(Cr(e, 0)) && h0(Cr(e, e.length - 1));
  if (t || o)
    for (l = 0; l < e.length; p >= 65536 ? l += 2 : l++) {
      if (p = Cr(e, l), !kr(p))
        return Kt;
      w = w && ds(p, c, s), c = p;
    }
  else {
    for (l = 0; l < e.length; p >= 65536 ? l += 2 : l++) {
      if (p = Cr(e, l), p === Lr)
        f = !0, g && (h = h || // Foldable line = too long, and not more-indented.
        l - v - 1 > n && e[v + 1] !== " ", v = l);
      else if (!kr(p))
        return Kt;
      w = w && ds(p, c, s), c = p;
    }
    h = h || g && l - v - 1 > n && e[v + 1] !== " ";
  }
  return !f && !h ? w && !o && !i(e) ? du : a === Ur ? Kt : Ea : r > 9 && fu(e) ? Kt : o ? a === Ur ? Kt : Ea : h ? pu : hu;
}
function m0(e, t, r, n, i) {
  e.dump = function() {
    if (t.length === 0)
      return e.quotingType === Ur ? '""' : "''";
    if (!e.noCompatMode && (a0.indexOf(t) !== -1 || o0.test(t)))
      return e.quotingType === Ur ? '"' + t + '"' : "'" + t + "'";
    var a = e.indent * Math.max(1, r), o = e.lineWidth === -1 ? -1 : Math.max(Math.min(e.lineWidth, 40), e.lineWidth - a), s = n || e.flowLevel > -1 && r >= e.flowLevel;
    function l(p) {
      return f0(e, p);
    }
    switch (p0(
      t,
      s,
      e.indent,
      o,
      l,
      e.quotingType,
      e.forceQuotes && !n,
      i
    )) {
      case du:
        return t;
      case Ea:
        return "'" + t.replace(/'/g, "''") + "'";
      case hu:
        return "|" + hs(t, e.indent) + ps(us(t, a));
      case pu:
        return ">" + hs(t, e.indent) + ps(us(g0(t, o), a));
      case Kt:
        return '"' + y0(t) + '"';
      default:
        throw new Zr("impossible error: invalid scalar style");
    }
  }();
}
function hs(e, t) {
  var r = fu(e) ? String(t) : "", n = e[e.length - 1] === `
`, i = n && (e[e.length - 2] === `
` || e === `
`), a = i ? "+" : n ? "" : "-";
  return r + a + `
`;
}
function ps(e) {
  return e[e.length - 1] === `
` ? e.slice(0, -1) : e;
}
function g0(e, t) {
  for (var r = /(\n+)([^\n]*)/g, n = function() {
    var p = e.indexOf(`
`);
    return p = p !== -1 ? p : e.length, r.lastIndex = p, ms(e.slice(0, p), t);
  }(), i = e[0] === `
` || e[0] === " ", a, o; o = r.exec(e); ) {
    var s = o[1], l = o[2];
    a = l[0] === " ", n += s + (!i && !a && l !== "" ? `
` : "") + ms(l, t), i = a;
  }
  return n;
}
function ms(e, t) {
  if (e === "" || e[0] === " ") return e;
  for (var r = / [^ ]/g, n, i = 0, a, o = 0, s = 0, l = ""; n = r.exec(e); )
    s = n.index, s - i > t && (a = o > i ? o : s, l += `
` + e.slice(i, a), i = a + 1), o = s;
  return l += `
`, e.length - i > t && o > i ? l += e.slice(i, o) + `
` + e.slice(o + 1) : l += e.slice(i), l.slice(1);
}
function y0(e) {
  for (var t = "", r = 0, n, i = 0; i < e.length; r >= 65536 ? i += 2 : i++)
    r = Cr(e, i), n = $e[r], !n && kr(r) ? (t += e[i], r >= 65536 && (t += e[i + 1])) : t += n || l0(r);
  return t;
}
function w0(e, t, r) {
  var n = "", i = e.tag, a, o, s;
  for (a = 0, o = r.length; a < o; a += 1)
    s = r[a], e.replacer && (s = e.replacer.call(r, String(a), s)), (at(e, t, s, !1, !1) || typeof s > "u" && at(e, t, null, !1, !1)) && (n !== "" && (n += "," + (e.condenseFlow ? "" : " ")), n += e.dump);
  e.tag = i, e.dump = "[" + n + "]";
}
function gs(e, t, r, n) {
  var i = "", a = e.tag, o, s, l;
  for (o = 0, s = r.length; o < s; o += 1)
    l = r[o], e.replacer && (l = e.replacer.call(r, String(o), l)), (at(e, t + 1, l, !0, !0, !1, !0) || typeof l > "u" && at(e, t + 1, null, !0, !0, !1, !0)) && ((!n || i !== "") && (i += wa(e, t)), e.dump && Lr === e.dump.charCodeAt(0) ? i += "-" : i += "- ", i += e.dump);
  e.tag = a, e.dump = i || "[]";
}
function E0(e, t, r) {
  var n = "", i = e.tag, a = Object.keys(r), o, s, l, p, c;
  for (o = 0, s = a.length; o < s; o += 1)
    c = "", n !== "" && (c += ", "), e.condenseFlow && (c += '"'), l = a[o], p = r[l], e.replacer && (p = e.replacer.call(r, l, p)), at(e, t, l, !1, !1) && (e.dump.length > 1024 && (c += "? "), c += e.dump + (e.condenseFlow ? '"' : "") + ":" + (e.condenseFlow ? "" : " "), at(e, t, p, !1, !1) && (c += e.dump, n += c));
  e.tag = i, e.dump = "{" + n + "}";
}
function v0(e, t, r, n) {
  var i = "", a = e.tag, o = Object.keys(r), s, l, p, c, f, h;
  if (e.sortKeys === !0)
    o.sort();
  else if (typeof e.sortKeys == "function")
    o.sort(e.sortKeys);
  else if (e.sortKeys)
    throw new Zr("sortKeys must be a boolean or a function");
  for (s = 0, l = o.length; s < l; s += 1)
    h = "", (!n || i !== "") && (h += wa(e, t)), p = o[s], c = r[p], e.replacer && (c = e.replacer.call(r, p, c)), at(e, t + 1, p, !0, !0, !0) && (f = e.tag !== null && e.tag !== "?" || e.dump && e.dump.length > 1024, f && (e.dump && Lr === e.dump.charCodeAt(0) ? h += "?" : h += "? "), h += e.dump, f && (h += wa(e, t)), at(e, t + 1, c, !0, f) && (e.dump && Lr === e.dump.charCodeAt(0) ? h += ":" : h += ": ", h += e.dump, i += h));
  e.tag = a, e.dump = i || "{}";
}
function ys(e, t, r) {
  var n, i, a, o, s, l;
  for (i = r ? e.explicitTypes : e.implicitTypes, a = 0, o = i.length; a < o; a += 1)
    if (s = i[a], (s.instanceOf || s.predicate) && (!s.instanceOf || typeof t == "object" && t instanceof s.instanceOf) && (!s.predicate || s.predicate(t))) {
      if (r ? s.multi && s.representName ? e.tag = s.representName(t) : e.tag = s.tag : e.tag = "?", s.represent) {
        if (l = e.styleMap[s.tag] || s.defaultStyle, iu.call(s.represent) === "[object Function]")
          n = s.represent(t, l);
        else if (au.call(s.represent, l))
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
  e.tag = null, e.dump = r, ys(e, r, !1) || ys(e, r, !0);
  var s = iu.call(e.dump), l = n, p;
  n && (n = e.flowLevel < 0 || e.flowLevel > t);
  var c = s === "[object Object]" || s === "[object Array]", f, h;
  if (c && (f = e.duplicates.indexOf(r), h = f !== -1), (e.tag !== null && e.tag !== "?" || h || e.indent !== 2 && t > 0) && (i = !1), h && e.usedDuplicates[f])
    e.dump = "*ref_" + f;
  else {
    if (c && h && !e.usedDuplicates[f] && (e.usedDuplicates[f] = !0), s === "[object Object]")
      n && Object.keys(e.dump).length !== 0 ? (v0(e, t, e.dump, i), h && (e.dump = "&ref_" + f + e.dump)) : (E0(e, t, e.dump), h && (e.dump = "&ref_" + f + " " + e.dump));
    else if (s === "[object Array]")
      n && e.dump.length !== 0 ? (e.noArrayIndent && !o && t > 0 ? gs(e, t - 1, e.dump, i) : gs(e, t, e.dump, i), h && (e.dump = "&ref_" + f + e.dump)) : (w0(e, t, e.dump), h && (e.dump = "&ref_" + f + " " + e.dump));
    else if (s === "[object String]")
      e.tag !== "?" && m0(e, e.dump, t, a, l);
    else {
      if (s === "[object Undefined]")
        return !1;
      if (e.skipInvalid) return !1;
      throw new Zr("unacceptable kind of an object to dump " + s);
    }
    e.tag !== null && e.tag !== "?" && (p = encodeURI(
      e.tag[0] === "!" ? e.tag.slice(1) : e.tag
    ).replace(/!/g, "%21"), e.tag[0] === "!" ? p = "!" + p : p.slice(0, 18) === "tag:yaml.org,2002:" ? p = "!!" + p.slice(18) : p = "!<" + p + ">", e.dump = p + " " + e.dump);
  }
  return !0;
}
function _0(e, t) {
  var r = [], n = [], i, a;
  for (va(e, r, n), i = 0, a = n.length; i < a; i += 1)
    t.duplicates.push(r[n[i]]);
  t.usedDuplicates = new Array(a);
}
function va(e, t, r) {
  var n, i, a;
  if (e !== null && typeof e == "object")
    if (i = t.indexOf(e), i !== -1)
      r.indexOf(i) === -1 && r.push(i);
    else if (t.push(e), Array.isArray(e))
      for (i = 0, a = e.length; i < a; i += 1)
        va(e[i], t, r);
    else
      for (n = Object.keys(e), i = 0, a = n.length; i < a; i += 1)
        va(e[n[i]], t, r);
}
function S0(e, t) {
  t = t || {};
  var r = new u0(t);
  r.noRefs || _0(e, r);
  var n = e;
  return r.replacer && (n = r.replacer.call({ "": n }, "", n)), at(r, 0, n, !0, !0) ? r.dump + `
` : "";
}
nu.dump = S0;
var mu = ja, A0 = nu;
function Va(e, t) {
  return function() {
    throw new Error("Function yaml." + e + " is removed in js-yaml 4. Use yaml." + t + " instead, which is now safe by default.");
  };
}
Se.Type = Re;
Se.Schema = Ic;
Se.FAILSAFE_SCHEMA = Nc;
Se.JSON_SCHEMA = kc;
Se.CORE_SCHEMA = Mc;
Se.DEFAULT_SCHEMA = qa;
Se.load = mu.load;
Se.loadAll = mu.loadAll;
Se.dump = A0.dump;
Se.YAMLException = Qr;
Se.types = {
  binary: Gc,
  float: Uc,
  map: Dc,
  null: Rc,
  pairs: zc,
  set: Vc,
  timestamp: Hc,
  bool: Fc,
  int: xc,
  merge: qc,
  omap: Wc,
  seq: Pc,
  str: Oc
};
Se.safeLoad = Va("safeLoad", "load");
Se.safeLoadAll = Va("safeLoadAll", "loadAll");
Se.safeDump = Va("safeDump", "dump");
var ci = {};
Object.defineProperty(ci, "__esModule", { value: !0 });
ci.Lazy = void 0;
class T0 {
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
ci.Lazy = T0;
var _a = { exports: {} };
const C0 = "2.0.0", gu = 256, $0 = Number.MAX_SAFE_INTEGER || /* istanbul ignore next */
9007199254740991, b0 = 16, I0 = gu - 6, O0 = [
  "major",
  "premajor",
  "minor",
  "preminor",
  "patch",
  "prepatch",
  "prerelease"
];
var ui = {
  MAX_LENGTH: gu,
  MAX_SAFE_COMPONENT_LENGTH: b0,
  MAX_SAFE_BUILD_LENGTH: I0,
  MAX_SAFE_INTEGER: $0,
  RELEASE_TYPES: O0,
  SEMVER_SPEC_VERSION: C0,
  FLAG_INCLUDE_PRERELEASE: 1,
  FLAG_LOOSE: 2
};
const P0 = typeof process == "object" && process.env && process.env.NODE_DEBUG && /\bsemver\b/i.test(process.env.NODE_DEBUG) ? (...e) => console.error("SEMVER", ...e) : () => {
};
var fi = P0;
(function(e, t) {
  const {
    MAX_SAFE_COMPONENT_LENGTH: r,
    MAX_SAFE_BUILD_LENGTH: n,
    MAX_LENGTH: i
  } = ui, a = fi;
  t = e.exports = {};
  const o = t.re = [], s = t.safeRe = [], l = t.src = [], p = t.safeSrc = [], c = t.t = {};
  let f = 0;
  const h = "[a-zA-Z0-9-]", g = [
    ["\\s", 1],
    ["\\d", i],
    [h, n]
  ], v = (S) => {
    for (const [T, A] of g)
      S = S.split(`${T}*`).join(`${T}{0,${A}}`).split(`${T}+`).join(`${T}{1,${A}}`);
    return S;
  }, w = (S, T, A) => {
    const F = v(T), N = f++;
    a(S, N, T), c[S] = N, l[N] = T, p[N] = F, o[N] = new RegExp(T, A ? "g" : void 0), s[N] = new RegExp(F, A ? "g" : void 0);
  };
  w("NUMERICIDENTIFIER", "0|[1-9]\\d*"), w("NUMERICIDENTIFIERLOOSE", "\\d+"), w("NONNUMERICIDENTIFIER", `\\d*[a-zA-Z-]${h}*`), w("MAINVERSION", `(${l[c.NUMERICIDENTIFIER]})\\.(${l[c.NUMERICIDENTIFIER]})\\.(${l[c.NUMERICIDENTIFIER]})`), w("MAINVERSIONLOOSE", `(${l[c.NUMERICIDENTIFIERLOOSE]})\\.(${l[c.NUMERICIDENTIFIERLOOSE]})\\.(${l[c.NUMERICIDENTIFIERLOOSE]})`), w("PRERELEASEIDENTIFIER", `(?:${l[c.NONNUMERICIDENTIFIER]}|${l[c.NUMERICIDENTIFIER]})`), w("PRERELEASEIDENTIFIERLOOSE", `(?:${l[c.NONNUMERICIDENTIFIER]}|${l[c.NUMERICIDENTIFIERLOOSE]})`), w("PRERELEASE", `(?:-(${l[c.PRERELEASEIDENTIFIER]}(?:\\.${l[c.PRERELEASEIDENTIFIER]})*))`), w("PRERELEASELOOSE", `(?:-?(${l[c.PRERELEASEIDENTIFIERLOOSE]}(?:\\.${l[c.PRERELEASEIDENTIFIERLOOSE]})*))`), w("BUILDIDENTIFIER", `${h}+`), w("BUILD", `(?:\\+(${l[c.BUILDIDENTIFIER]}(?:\\.${l[c.BUILDIDENTIFIER]})*))`), w("FULLPLAIN", `v?${l[c.MAINVERSION]}${l[c.PRERELEASE]}?${l[c.BUILD]}?`), w("FULL", `^${l[c.FULLPLAIN]}$`), w("LOOSEPLAIN", `[v=\\s]*${l[c.MAINVERSIONLOOSE]}${l[c.PRERELEASELOOSE]}?${l[c.BUILD]}?`), w("LOOSE", `^${l[c.LOOSEPLAIN]}$`), w("GTLT", "((?:<|>)?=?)"), w("XRANGEIDENTIFIERLOOSE", `${l[c.NUMERICIDENTIFIERLOOSE]}|x|X|\\*`), w("XRANGEIDENTIFIER", `${l[c.NUMERICIDENTIFIER]}|x|X|\\*`), w("XRANGEPLAIN", `[v=\\s]*(${l[c.XRANGEIDENTIFIER]})(?:\\.(${l[c.XRANGEIDENTIFIER]})(?:\\.(${l[c.XRANGEIDENTIFIER]})(?:${l[c.PRERELEASE]})?${l[c.BUILD]}?)?)?`), w("XRANGEPLAINLOOSE", `[v=\\s]*(${l[c.XRANGEIDENTIFIERLOOSE]})(?:\\.(${l[c.XRANGEIDENTIFIERLOOSE]})(?:\\.(${l[c.XRANGEIDENTIFIERLOOSE]})(?:${l[c.PRERELEASELOOSE]})?${l[c.BUILD]}?)?)?`), w("XRANGE", `^${l[c.GTLT]}\\s*${l[c.XRANGEPLAIN]}$`), w("XRANGELOOSE", `^${l[c.GTLT]}\\s*${l[c.XRANGEPLAINLOOSE]}$`), w("COERCEPLAIN", `(^|[^\\d])(\\d{1,${r}})(?:\\.(\\d{1,${r}}))?(?:\\.(\\d{1,${r}}))?`), w("COERCE", `${l[c.COERCEPLAIN]}(?:$|[^\\d])`), w("COERCEFULL", l[c.COERCEPLAIN] + `(?:${l[c.PRERELEASE]})?(?:${l[c.BUILD]})?(?:$|[^\\d])`), w("COERCERTL", l[c.COERCE], !0), w("COERCERTLFULL", l[c.COERCEFULL], !0), w("LONETILDE", "(?:~>?)"), w("TILDETRIM", `(\\s*)${l[c.LONETILDE]}\\s+`, !0), t.tildeTrimReplace = "$1~", w("TILDE", `^${l[c.LONETILDE]}${l[c.XRANGEPLAIN]}$`), w("TILDELOOSE", `^${l[c.LONETILDE]}${l[c.XRANGEPLAINLOOSE]}$`), w("LONECARET", "(?:\\^)"), w("CARETTRIM", `(\\s*)${l[c.LONECARET]}\\s+`, !0), t.caretTrimReplace = "$1^", w("CARET", `^${l[c.LONECARET]}${l[c.XRANGEPLAIN]}$`), w("CARETLOOSE", `^${l[c.LONECARET]}${l[c.XRANGEPLAINLOOSE]}$`), w("COMPARATORLOOSE", `^${l[c.GTLT]}\\s*(${l[c.LOOSEPLAIN]})$|^$`), w("COMPARATOR", `^${l[c.GTLT]}\\s*(${l[c.FULLPLAIN]})$|^$`), w("COMPARATORTRIM", `(\\s*)${l[c.GTLT]}\\s*(${l[c.LOOSEPLAIN]}|${l[c.XRANGEPLAIN]})`, !0), t.comparatorTrimReplace = "$1$2$3", w("HYPHENRANGE", `^\\s*(${l[c.XRANGEPLAIN]})\\s+-\\s+(${l[c.XRANGEPLAIN]})\\s*$`), w("HYPHENRANGELOOSE", `^\\s*(${l[c.XRANGEPLAINLOOSE]})\\s+-\\s+(${l[c.XRANGEPLAINLOOSE]})\\s*$`), w("STAR", "(<|>)?=?\\s*\\*"), w("GTE0", "^\\s*>=\\s*0\\.0\\.0\\s*$"), w("GTE0PRE", "^\\s*>=\\s*0\\.0\\.0-0\\s*$");
})(_a, _a.exports);
var en = _a.exports;
const D0 = Object.freeze({ loose: !0 }), N0 = Object.freeze({}), R0 = (e) => e ? typeof e != "object" ? D0 : e : N0;
var Ya = R0;
const ws = /^[0-9]+$/, yu = (e, t) => {
  if (typeof e == "number" && typeof t == "number")
    return e === t ? 0 : e < t ? -1 : 1;
  const r = ws.test(e), n = ws.test(t);
  return r && n && (e = +e, t = +t), e === t ? 0 : r && !n ? -1 : n && !r ? 1 : e < t ? -1 : 1;
}, F0 = (e, t) => yu(t, e);
var wu = {
  compareIdentifiers: yu,
  rcompareIdentifiers: F0
};
const Tn = fi, { MAX_LENGTH: Es, MAX_SAFE_INTEGER: Cn } = ui, { safeRe: $n, t: bn } = en, x0 = Ya, { compareIdentifiers: Gi } = wu;
let L0 = class Ze {
  constructor(t, r) {
    if (r = x0(r), t instanceof Ze) {
      if (t.loose === !!r.loose && t.includePrerelease === !!r.includePrerelease)
        return t;
      t = t.version;
    } else if (typeof t != "string")
      throw new TypeError(`Invalid version. Must be a string. Got type "${typeof t}".`);
    if (t.length > Es)
      throw new TypeError(
        `version is longer than ${Es} characters`
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
      return Gi(n, i);
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
      return Gi(n, i);
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
          n === !1 && (a = [r]), Gi(this.prerelease[0], r) === 0 ? isNaN(this.prerelease[1]) && (this.prerelease = a) : this.prerelease = a;
        }
        break;
      }
      default:
        throw new Error(`invalid increment argument: ${t}`);
    }
    return this.raw = this.format(), this.build.length && (this.raw += `+${this.build.join(".")}`), this;
  }
};
var Fe = L0;
const vs = Fe, U0 = (e, t, r = !1) => {
  if (e instanceof vs)
    return e;
  try {
    return new vs(e, t);
  } catch (n) {
    if (!r)
      return null;
    throw n;
  }
};
var dr = U0;
const k0 = dr, M0 = (e, t) => {
  const r = k0(e, t);
  return r ? r.version : null;
};
var B0 = M0;
const j0 = dr, H0 = (e, t) => {
  const r = j0(e.trim().replace(/^[=v]+/, ""), t);
  return r ? r.version : null;
};
var q0 = H0;
const _s = Fe, G0 = (e, t, r, n, i) => {
  typeof r == "string" && (i = n, n = r, r = void 0);
  try {
    return new _s(
      e instanceof _s ? e.version : e,
      r
    ).inc(t, n, i).version;
  } catch {
    return null;
  }
};
var W0 = G0;
const Ss = dr, z0 = (e, t) => {
  const r = Ss(e, null, !0), n = Ss(t, null, !0), i = r.compare(n);
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
var V0 = z0;
const Y0 = Fe, X0 = (e, t) => new Y0(e, t).major;
var J0 = X0;
const K0 = Fe, Q0 = (e, t) => new K0(e, t).minor;
var Z0 = Q0;
const ey = Fe, ty = (e, t) => new ey(e, t).patch;
var ry = ty;
const ny = dr, iy = (e, t) => {
  const r = ny(e, t);
  return r && r.prerelease.length ? r.prerelease : null;
};
var ay = iy;
const As = Fe, oy = (e, t, r) => new As(e, r).compare(new As(t, r));
var Xe = oy;
const sy = Xe, ly = (e, t, r) => sy(t, e, r);
var cy = ly;
const uy = Xe, fy = (e, t) => uy(e, t, !0);
var dy = fy;
const Ts = Fe, hy = (e, t, r) => {
  const n = new Ts(e, r), i = new Ts(t, r);
  return n.compare(i) || n.compareBuild(i);
};
var Xa = hy;
const py = Xa, my = (e, t) => e.sort((r, n) => py(r, n, t));
var gy = my;
const yy = Xa, wy = (e, t) => e.sort((r, n) => yy(n, r, t));
var Ey = wy;
const vy = Xe, _y = (e, t, r) => vy(e, t, r) > 0;
var di = _y;
const Sy = Xe, Ay = (e, t, r) => Sy(e, t, r) < 0;
var Ja = Ay;
const Ty = Xe, Cy = (e, t, r) => Ty(e, t, r) === 0;
var Eu = Cy;
const $y = Xe, by = (e, t, r) => $y(e, t, r) !== 0;
var vu = by;
const Iy = Xe, Oy = (e, t, r) => Iy(e, t, r) >= 0;
var Ka = Oy;
const Py = Xe, Dy = (e, t, r) => Py(e, t, r) <= 0;
var Qa = Dy;
const Ny = Eu, Ry = vu, Fy = di, xy = Ka, Ly = Ja, Uy = Qa, ky = (e, t, r, n) => {
  switch (t) {
    case "===":
      return typeof e == "object" && (e = e.version), typeof r == "object" && (r = r.version), e === r;
    case "!==":
      return typeof e == "object" && (e = e.version), typeof r == "object" && (r = r.version), e !== r;
    case "":
    case "=":
    case "==":
      return Ny(e, r, n);
    case "!=":
      return Ry(e, r, n);
    case ">":
      return Fy(e, r, n);
    case ">=":
      return xy(e, r, n);
    case "<":
      return Ly(e, r, n);
    case "<=":
      return Uy(e, r, n);
    default:
      throw new TypeError(`Invalid operator: ${t}`);
  }
};
var _u = ky;
const My = Fe, By = dr, { safeRe: In, t: On } = en, jy = (e, t) => {
  if (e instanceof My)
    return e;
  if (typeof e == "number" && (e = String(e)), typeof e != "string")
    return null;
  t = t || {};
  let r = null;
  if (!t.rtl)
    r = e.match(t.includePrerelease ? In[On.COERCEFULL] : In[On.COERCE]);
  else {
    const l = t.includePrerelease ? In[On.COERCERTLFULL] : In[On.COERCERTL];
    let p;
    for (; (p = l.exec(e)) && (!r || r.index + r[0].length !== e.length); )
      (!r || p.index + p[0].length !== r.index + r[0].length) && (r = p), l.lastIndex = p.index + p[1].length + p[2].length;
    l.lastIndex = -1;
  }
  if (r === null)
    return null;
  const n = r[2], i = r[3] || "0", a = r[4] || "0", o = t.includePrerelease && r[5] ? `-${r[5]}` : "", s = t.includePrerelease && r[6] ? `+${r[6]}` : "";
  return By(`${n}.${i}.${a}${o}${s}`, t);
};
var Hy = jy;
class qy {
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
var Gy = qy, Wi, Cs;
function Je() {
  if (Cs) return Wi;
  Cs = 1;
  const e = /\s+/g;
  class t {
    constructor(b, D) {
      if (D = i(D), b instanceof t)
        return b.loose === !!D.loose && b.includePrerelease === !!D.includePrerelease ? b : new t(b.raw, D);
      if (b instanceof a)
        return this.raw = b.value, this.set = [[b]], this.formatted = void 0, this;
      if (this.options = D, this.loose = !!D.loose, this.includePrerelease = !!D.includePrerelease, this.raw = b.trim().replace(e, " "), this.set = this.raw.split("||").map(($) => this.parseRange($.trim())).filter(($) => $.length), !this.set.length)
        throw new TypeError(`Invalid SemVer Range: ${this.raw}`);
      if (this.set.length > 1) {
        const $ = this.set[0];
        if (this.set = this.set.filter((R) => !w(R[0])), this.set.length === 0)
          this.set = [$];
        else if (this.set.length > 1) {
          for (const R of this.set)
            if (R.length === 1 && S(R[0])) {
              this.set = [R];
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
          const D = this.set[b];
          for (let $ = 0; $ < D.length; $++)
            $ > 0 && (this.formatted += " "), this.formatted += D[$].toString().trim();
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
      const $ = ((this.options.includePrerelease && g) | (this.options.loose && v)) + ":" + b, R = n.get($);
      if (R)
        return R;
      const P = this.options.loose, M = P ? l[p.HYPHENRANGELOOSE] : l[p.HYPHENRANGE];
      b = b.replace(M, H(this.options.includePrerelease)), o("hyphen replace", b), b = b.replace(l[p.COMPARATORTRIM], c), o("comparator trim", b), b = b.replace(l[p.TILDETRIM], f), o("tilde trim", b), b = b.replace(l[p.CARETTRIM], h), o("caret trim", b);
      let V = b.split(" ").map((k) => A(k, this.options)).join(" ").split(/\s+/).map((k) => q(k, this.options));
      P && (V = V.filter((k) => (o("loose invalid filter", k, this.options), !!k.match(l[p.COMPARATORLOOSE])))), o("range list", V);
      const G = /* @__PURE__ */ new Map(), ee = V.map((k) => new a(k, this.options));
      for (const k of ee) {
        if (w(k))
          return [k];
        G.set(k.value, k);
      }
      G.size > 1 && G.has("") && G.delete("");
      const pe = [...G.values()];
      return n.set($, pe), pe;
    }
    intersects(b, D) {
      if (!(b instanceof t))
        throw new TypeError("a Range is required");
      return this.set.some(($) => T($, D) && b.set.some((R) => T(R, D) && $.every((P) => R.every((M) => P.intersects(M, D)))));
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
      for (let D = 0; D < this.set.length; D++)
        if (Z(this.set[D], b, this.options))
          return !0;
      return !1;
    }
  }
  Wi = t;
  const r = Gy, n = new r(), i = Ya, a = hi(), o = fi, s = Fe, {
    safeRe: l,
    t: p,
    comparatorTrimReplace: c,
    tildeTrimReplace: f,
    caretTrimReplace: h
  } = en, { FLAG_INCLUDE_PRERELEASE: g, FLAG_LOOSE: v } = ui, w = (O) => O.value === "<0.0.0-0", S = (O) => O.value === "", T = (O, b) => {
    let D = !0;
    const $ = O.slice();
    let R = $.pop();
    for (; D && $.length; )
      D = $.every((P) => R.intersects(P, b)), R = $.pop();
    return D;
  }, A = (O, b) => (O = O.replace(l[p.BUILD], ""), o("comp", O, b), O = ne(O, b), o("caret", O), O = N(O, b), o("tildes", O), O = Me(O, b), o("xrange", O), O = z(O, b), o("stars", O), O), F = (O) => !O || O.toLowerCase() === "x" || O === "*", N = (O, b) => O.trim().split(/\s+/).map((D) => K(D, b)).join(" "), K = (O, b) => {
    const D = b.loose ? l[p.TILDELOOSE] : l[p.TILDE];
    return O.replace(D, ($, R, P, M, V) => {
      o("tilde", O, $, R, P, M, V);
      let G;
      return F(R) ? G = "" : F(P) ? G = `>=${R}.0.0 <${+R + 1}.0.0-0` : F(M) ? G = `>=${R}.${P}.0 <${R}.${+P + 1}.0-0` : V ? (o("replaceTilde pr", V), G = `>=${R}.${P}.${M}-${V} <${R}.${+P + 1}.0-0`) : G = `>=${R}.${P}.${M} <${R}.${+P + 1}.0-0`, o("tilde return", G), G;
    });
  }, ne = (O, b) => O.trim().split(/\s+/).map((D) => Y(D, b)).join(" "), Y = (O, b) => {
    o("caret", O, b);
    const D = b.loose ? l[p.CARETLOOSE] : l[p.CARET], $ = b.includePrerelease ? "-0" : "";
    return O.replace(D, (R, P, M, V, G) => {
      o("caret", O, R, P, M, V, G);
      let ee;
      return F(P) ? ee = "" : F(M) ? ee = `>=${P}.0.0${$} <${+P + 1}.0.0-0` : F(V) ? P === "0" ? ee = `>=${P}.${M}.0${$} <${P}.${+M + 1}.0-0` : ee = `>=${P}.${M}.0${$} <${+P + 1}.0.0-0` : G ? (o("replaceCaret pr", G), P === "0" ? M === "0" ? ee = `>=${P}.${M}.${V}-${G} <${P}.${M}.${+V + 1}-0` : ee = `>=${P}.${M}.${V}-${G} <${P}.${+M + 1}.0-0` : ee = `>=${P}.${M}.${V}-${G} <${+P + 1}.0.0-0`) : (o("no pr"), P === "0" ? M === "0" ? ee = `>=${P}.${M}.${V}${$} <${P}.${M}.${+V + 1}-0` : ee = `>=${P}.${M}.${V}${$} <${P}.${+M + 1}.0-0` : ee = `>=${P}.${M}.${V} <${+P + 1}.0.0-0`), o("caret return", ee), ee;
    });
  }, Me = (O, b) => (o("replaceXRanges", O, b), O.split(/\s+/).map((D) => y(D, b)).join(" ")), y = (O, b) => {
    O = O.trim();
    const D = b.loose ? l[p.XRANGELOOSE] : l[p.XRANGE];
    return O.replace(D, ($, R, P, M, V, G) => {
      o("xRange", O, $, R, P, M, V, G);
      const ee = F(P), pe = ee || F(M), k = pe || F(V), Ke = k;
      return R === "=" && Ke && (R = ""), G = b.includePrerelease ? "-0" : "", ee ? R === ">" || R === "<" ? $ = "<0.0.0-0" : $ = "*" : R && Ke ? (pe && (M = 0), V = 0, R === ">" ? (R = ">=", pe ? (P = +P + 1, M = 0, V = 0) : (M = +M + 1, V = 0)) : R === "<=" && (R = "<", pe ? P = +P + 1 : M = +M + 1), R === "<" && (G = "-0"), $ = `${R + P}.${M}.${V}${G}`) : pe ? $ = `>=${P}.0.0${G} <${+P + 1}.0.0-0` : k && ($ = `>=${P}.${M}.0${G} <${P}.${+M + 1}.0-0`), o("xRange return", $), $;
    });
  }, z = (O, b) => (o("replaceStars", O, b), O.trim().replace(l[p.STAR], "")), q = (O, b) => (o("replaceGTE0", O, b), O.trim().replace(l[b.includePrerelease ? p.GTE0PRE : p.GTE0], "")), H = (O) => (b, D, $, R, P, M, V, G, ee, pe, k, Ke) => (F($) ? D = "" : F(R) ? D = `>=${$}.0.0${O ? "-0" : ""}` : F(P) ? D = `>=${$}.${R}.0${O ? "-0" : ""}` : M ? D = `>=${D}` : D = `>=${D}${O ? "-0" : ""}`, F(ee) ? G = "" : F(pe) ? G = `<${+ee + 1}.0.0-0` : F(k) ? G = `<${ee}.${+pe + 1}.0-0` : Ke ? G = `<=${ee}.${pe}.${k}-${Ke}` : O ? G = `<${ee}.${pe}.${+k + 1}-0` : G = `<=${G}`, `${D} ${G}`.trim()), Z = (O, b, D) => {
    for (let $ = 0; $ < O.length; $++)
      if (!O[$].test(b))
        return !1;
    if (b.prerelease.length && !D.includePrerelease) {
      for (let $ = 0; $ < O.length; $++)
        if (o(O[$].semver), O[$].semver !== a.ANY && O[$].semver.prerelease.length > 0) {
          const R = O[$].semver;
          if (R.major === b.major && R.minor === b.minor && R.patch === b.patch)
            return !0;
        }
      return !1;
    }
    return !0;
  };
  return Wi;
}
var zi, $s;
function hi() {
  if ($s) return zi;
  $s = 1;
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
  zi = t;
  const r = Ya, { safeRe: n, t: i } = en, a = _u, o = fi, s = Fe, l = Je();
  return zi;
}
const Wy = Je(), zy = (e, t, r) => {
  try {
    t = new Wy(t, r);
  } catch {
    return !1;
  }
  return t.test(e);
};
var pi = zy;
const Vy = Je(), Yy = (e, t) => new Vy(e, t).set.map((r) => r.map((n) => n.value).join(" ").trim().split(" "));
var Xy = Yy;
const Jy = Fe, Ky = Je(), Qy = (e, t, r) => {
  let n = null, i = null, a = null;
  try {
    a = new Ky(t, r);
  } catch {
    return null;
  }
  return e.forEach((o) => {
    a.test(o) && (!n || i.compare(o) === -1) && (n = o, i = new Jy(n, r));
  }), n;
};
var Zy = Qy;
const ew = Fe, tw = Je(), rw = (e, t, r) => {
  let n = null, i = null, a = null;
  try {
    a = new tw(t, r);
  } catch {
    return null;
  }
  return e.forEach((o) => {
    a.test(o) && (!n || i.compare(o) === 1) && (n = o, i = new ew(n, r));
  }), n;
};
var nw = rw;
const Vi = Fe, iw = Je(), bs = di, aw = (e, t) => {
  e = new iw(e, t);
  let r = new Vi("0.0.0");
  if (e.test(r) || (r = new Vi("0.0.0-0"), e.test(r)))
    return r;
  r = null;
  for (let n = 0; n < e.set.length; ++n) {
    const i = e.set[n];
    let a = null;
    i.forEach((o) => {
      const s = new Vi(o.semver.version);
      switch (o.operator) {
        case ">":
          s.prerelease.length === 0 ? s.patch++ : s.prerelease.push(0), s.raw = s.format();
        case "":
        case ">=":
          (!a || bs(s, a)) && (a = s);
          break;
        case "<":
        case "<=":
          break;
        default:
          throw new Error(`Unexpected operation: ${o.operator}`);
      }
    }), a && (!r || bs(r, a)) && (r = a);
  }
  return r && e.test(r) ? r : null;
};
var ow = aw;
const sw = Je(), lw = (e, t) => {
  try {
    return new sw(e, t).range || "*";
  } catch {
    return null;
  }
};
var cw = lw;
const uw = Fe, Su = hi(), { ANY: fw } = Su, dw = Je(), hw = pi, Is = di, Os = Ja, pw = Qa, mw = Ka, gw = (e, t, r, n) => {
  e = new uw(e, n), t = new dw(t, n);
  let i, a, o, s, l;
  switch (r) {
    case ">":
      i = Is, a = pw, o = Os, s = ">", l = ">=";
      break;
    case "<":
      i = Os, a = mw, o = Is, s = "<", l = "<=";
      break;
    default:
      throw new TypeError('Must provide a hilo val of "<" or ">"');
  }
  if (hw(e, t, n))
    return !1;
  for (let p = 0; p < t.set.length; ++p) {
    const c = t.set[p];
    let f = null, h = null;
    if (c.forEach((g) => {
      g.semver === fw && (g = new Su(">=0.0.0")), f = f || g, h = h || g, i(g.semver, f.semver, n) ? f = g : o(g.semver, h.semver, n) && (h = g);
    }), f.operator === s || f.operator === l || (!h.operator || h.operator === s) && a(e, h.semver))
      return !1;
    if (h.operator === l && o(e, h.semver))
      return !1;
  }
  return !0;
};
var Za = gw;
const yw = Za, ww = (e, t, r) => yw(e, t, ">", r);
var Ew = ww;
const vw = Za, _w = (e, t, r) => vw(e, t, "<", r);
var Sw = _w;
const Ps = Je(), Aw = (e, t, r) => (e = new Ps(e, r), t = new Ps(t, r), e.intersects(t, r));
var Tw = Aw;
const Cw = pi, $w = Xe;
var bw = (e, t, r) => {
  const n = [];
  let i = null, a = null;
  const o = e.sort((c, f) => $w(c, f, r));
  for (const c of o)
    Cw(c, t, r) ? (a = c, i || (i = c)) : (a && n.push([i, a]), a = null, i = null);
  i && n.push([i, null]);
  const s = [];
  for (const [c, f] of n)
    c === f ? s.push(c) : !f && c === o[0] ? s.push("*") : f ? c === o[0] ? s.push(`<=${f}`) : s.push(`${c} - ${f}`) : s.push(`>=${c}`);
  const l = s.join(" || "), p = typeof t.raw == "string" ? t.raw : String(t);
  return l.length < p.length ? l : t;
};
const Ds = Je(), eo = hi(), { ANY: Yi } = eo, _r = pi, to = Xe, Iw = (e, t, r = {}) => {
  if (e === t)
    return !0;
  e = new Ds(e, r), t = new Ds(t, r);
  let n = !1;
  e: for (const i of e.set) {
    for (const a of t.set) {
      const o = Pw(i, a, r);
      if (n = n || o !== null, o)
        continue e;
    }
    if (n)
      return !1;
  }
  return !0;
}, Ow = [new eo(">=0.0.0-0")], Ns = [new eo(">=0.0.0")], Pw = (e, t, r) => {
  if (e === t)
    return !0;
  if (e.length === 1 && e[0].semver === Yi) {
    if (t.length === 1 && t[0].semver === Yi)
      return !0;
    r.includePrerelease ? e = Ow : e = Ns;
  }
  if (t.length === 1 && t[0].semver === Yi) {
    if (r.includePrerelease)
      return !0;
    t = Ns;
  }
  const n = /* @__PURE__ */ new Set();
  let i, a;
  for (const g of e)
    g.operator === ">" || g.operator === ">=" ? i = Rs(i, g, r) : g.operator === "<" || g.operator === "<=" ? a = Fs(a, g, r) : n.add(g.semver);
  if (n.size > 1)
    return null;
  let o;
  if (i && a) {
    if (o = to(i.semver, a.semver, r), o > 0)
      return null;
    if (o === 0 && (i.operator !== ">=" || a.operator !== "<="))
      return null;
  }
  for (const g of n) {
    if (i && !_r(g, String(i), r) || a && !_r(g, String(a), r))
      return null;
    for (const v of t)
      if (!_r(g, String(v), r))
        return !1;
    return !0;
  }
  let s, l, p, c, f = a && !r.includePrerelease && a.semver.prerelease.length ? a.semver : !1, h = i && !r.includePrerelease && i.semver.prerelease.length ? i.semver : !1;
  f && f.prerelease.length === 1 && a.operator === "<" && f.prerelease[0] === 0 && (f = !1);
  for (const g of t) {
    if (c = c || g.operator === ">" || g.operator === ">=", p = p || g.operator === "<" || g.operator === "<=", i) {
      if (h && g.semver.prerelease && g.semver.prerelease.length && g.semver.major === h.major && g.semver.minor === h.minor && g.semver.patch === h.patch && (h = !1), g.operator === ">" || g.operator === ">=") {
        if (s = Rs(i, g, r), s === g && s !== i)
          return !1;
      } else if (i.operator === ">=" && !_r(i.semver, String(g), r))
        return !1;
    }
    if (a) {
      if (f && g.semver.prerelease && g.semver.prerelease.length && g.semver.major === f.major && g.semver.minor === f.minor && g.semver.patch === f.patch && (f = !1), g.operator === "<" || g.operator === "<=") {
        if (l = Fs(a, g, r), l === g && l !== a)
          return !1;
      } else if (a.operator === "<=" && !_r(a.semver, String(g), r))
        return !1;
    }
    if (!g.operator && (a || i) && o !== 0)
      return !1;
  }
  return !(i && p && !a && o !== 0 || a && c && !i && o !== 0 || h || f);
}, Rs = (e, t, r) => {
  if (!e)
    return t;
  const n = to(e.semver, t.semver, r);
  return n > 0 ? e : n < 0 || t.operator === ">" && e.operator === ">=" ? t : e;
}, Fs = (e, t, r) => {
  if (!e)
    return t;
  const n = to(e.semver, t.semver, r);
  return n < 0 ? e : n > 0 || t.operator === "<" && e.operator === "<=" ? t : e;
};
var Dw = Iw;
const Xi = en, xs = ui, Nw = Fe, Ls = wu, Rw = dr, Fw = B0, xw = q0, Lw = W0, Uw = V0, kw = J0, Mw = Z0, Bw = ry, jw = ay, Hw = Xe, qw = cy, Gw = dy, Ww = Xa, zw = gy, Vw = Ey, Yw = di, Xw = Ja, Jw = Eu, Kw = vu, Qw = Ka, Zw = Qa, eE = _u, tE = Hy, rE = hi(), nE = Je(), iE = pi, aE = Xy, oE = Zy, sE = nw, lE = ow, cE = cw, uE = Za, fE = Ew, dE = Sw, hE = Tw, pE = bw, mE = Dw;
var Au = {
  parse: Rw,
  valid: Fw,
  clean: xw,
  inc: Lw,
  diff: Uw,
  major: kw,
  minor: Mw,
  patch: Bw,
  prerelease: jw,
  compare: Hw,
  rcompare: qw,
  compareLoose: Gw,
  compareBuild: Ww,
  sort: zw,
  rsort: Vw,
  gt: Yw,
  lt: Xw,
  eq: Jw,
  neq: Kw,
  gte: Qw,
  lte: Zw,
  cmp: eE,
  coerce: tE,
  Comparator: rE,
  Range: nE,
  satisfies: iE,
  toComparators: aE,
  maxSatisfying: oE,
  minSatisfying: sE,
  minVersion: lE,
  validRange: cE,
  outside: uE,
  gtr: fE,
  ltr: dE,
  intersects: hE,
  simplifyRange: pE,
  subset: mE,
  SemVer: Nw,
  re: Xi.re,
  src: Xi.src,
  tokens: Xi.t,
  SEMVER_SPEC_VERSION: xs.SEMVER_SPEC_VERSION,
  RELEASE_TYPES: xs.RELEASE_TYPES,
  compareIdentifiers: Ls.compareIdentifiers,
  rcompareIdentifiers: Ls.rcompareIdentifiers
}, tn = {}, Jn = { exports: {} };
Jn.exports;
(function(e, t) {
  var r = 200, n = "__lodash_hash_undefined__", i = 1, a = 2, o = 9007199254740991, s = "[object Arguments]", l = "[object Array]", p = "[object AsyncFunction]", c = "[object Boolean]", f = "[object Date]", h = "[object Error]", g = "[object Function]", v = "[object GeneratorFunction]", w = "[object Map]", S = "[object Number]", T = "[object Null]", A = "[object Object]", F = "[object Promise]", N = "[object Proxy]", K = "[object RegExp]", ne = "[object Set]", Y = "[object String]", Me = "[object Symbol]", y = "[object Undefined]", z = "[object WeakMap]", q = "[object ArrayBuffer]", H = "[object DataView]", Z = "[object Float32Array]", O = "[object Float64Array]", b = "[object Int8Array]", D = "[object Int16Array]", $ = "[object Int32Array]", R = "[object Uint8Array]", P = "[object Uint8ClampedArray]", M = "[object Uint16Array]", V = "[object Uint32Array]", G = /[\\^$.*+?()[\]{}|]/g, ee = /^\[object .+?Constructor\]$/, pe = /^(?:0|[1-9]\d*)$/, k = {};
  k[Z] = k[O] = k[b] = k[D] = k[$] = k[R] = k[P] = k[M] = k[V] = !0, k[s] = k[l] = k[q] = k[c] = k[H] = k[f] = k[h] = k[g] = k[w] = k[S] = k[A] = k[K] = k[ne] = k[Y] = k[z] = !1;
  var Ke = typeof Ie == "object" && Ie && Ie.Object === Object && Ie, d = typeof self == "object" && self && self.Object === Object && self, u = Ke || d || Function("return this")(), C = t && !t.nodeType && t, _ = C && !0 && e && !e.nodeType && e, J = _ && _.exports === C, ie = J && Ke.process, le = function() {
    try {
      return ie && ie.binding && ie.binding("util");
    } catch {
    }
  }(), Ee = le && le.isTypedArray;
  function Ae(m, E) {
    for (var I = -1, x = m == null ? 0 : m.length, re = 0, W = []; ++I < x; ) {
      var ce = m[I];
      E(ce, I, m) && (W[re++] = ce);
    }
    return W;
  }
  function lt(m, E) {
    for (var I = -1, x = E.length, re = m.length; ++I < x; )
      m[re + I] = E[I];
    return m;
  }
  function de(m, E) {
    for (var I = -1, x = m == null ? 0 : m.length; ++I < x; )
      if (E(m[I], I, m))
        return !0;
    return !1;
  }
  function We(m, E) {
    for (var I = -1, x = Array(m); ++I < m; )
      x[I] = E(I);
    return x;
  }
  function Ti(m) {
    return function(E) {
      return m(E);
    };
  }
  function ln(m, E) {
    return m.has(E);
  }
  function pr(m, E) {
    return m == null ? void 0 : m[E];
  }
  function cn(m) {
    var E = -1, I = Array(m.size);
    return m.forEach(function(x, re) {
      I[++E] = [re, x];
    }), I;
  }
  function Bu(m, E) {
    return function(I) {
      return m(E(I));
    };
  }
  function ju(m) {
    var E = -1, I = Array(m.size);
    return m.forEach(function(x) {
      I[++E] = x;
    }), I;
  }
  var Hu = Array.prototype, qu = Function.prototype, un = Object.prototype, Ci = u["__core-js_shared__"], oo = qu.toString, Qe = un.hasOwnProperty, so = function() {
    var m = /[^.]+$/.exec(Ci && Ci.keys && Ci.keys.IE_PROTO || "");
    return m ? "Symbol(src)_1." + m : "";
  }(), lo = un.toString, Gu = RegExp(
    "^" + oo.call(Qe).replace(G, "\\$&").replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, "$1.*?") + "$"
  ), co = J ? u.Buffer : void 0, fn = u.Symbol, uo = u.Uint8Array, fo = un.propertyIsEnumerable, Wu = Hu.splice, $t = fn ? fn.toStringTag : void 0, ho = Object.getOwnPropertySymbols, zu = co ? co.isBuffer : void 0, Vu = Bu(Object.keys, Object), $i = qt(u, "DataView"), mr = qt(u, "Map"), bi = qt(u, "Promise"), Ii = qt(u, "Set"), Oi = qt(u, "WeakMap"), gr = qt(Object, "create"), Yu = Ot($i), Xu = Ot(mr), Ju = Ot(bi), Ku = Ot(Ii), Qu = Ot(Oi), po = fn ? fn.prototype : void 0, Pi = po ? po.valueOf : void 0;
  function bt(m) {
    var E = -1, I = m == null ? 0 : m.length;
    for (this.clear(); ++E < I; ) {
      var x = m[E];
      this.set(x[0], x[1]);
    }
  }
  function Zu() {
    this.__data__ = gr ? gr(null) : {}, this.size = 0;
  }
  function ef(m) {
    var E = this.has(m) && delete this.__data__[m];
    return this.size -= E ? 1 : 0, E;
  }
  function tf(m) {
    var E = this.__data__;
    if (gr) {
      var I = E[m];
      return I === n ? void 0 : I;
    }
    return Qe.call(E, m) ? E[m] : void 0;
  }
  function rf(m) {
    var E = this.__data__;
    return gr ? E[m] !== void 0 : Qe.call(E, m);
  }
  function nf(m, E) {
    var I = this.__data__;
    return this.size += this.has(m) ? 0 : 1, I[m] = gr && E === void 0 ? n : E, this;
  }
  bt.prototype.clear = Zu, bt.prototype.delete = ef, bt.prototype.get = tf, bt.prototype.has = rf, bt.prototype.set = nf;
  function rt(m) {
    var E = -1, I = m == null ? 0 : m.length;
    for (this.clear(); ++E < I; ) {
      var x = m[E];
      this.set(x[0], x[1]);
    }
  }
  function af() {
    this.__data__ = [], this.size = 0;
  }
  function of(m) {
    var E = this.__data__, I = hn(E, m);
    if (I < 0)
      return !1;
    var x = E.length - 1;
    return I == x ? E.pop() : Wu.call(E, I, 1), --this.size, !0;
  }
  function sf(m) {
    var E = this.__data__, I = hn(E, m);
    return I < 0 ? void 0 : E[I][1];
  }
  function lf(m) {
    return hn(this.__data__, m) > -1;
  }
  function cf(m, E) {
    var I = this.__data__, x = hn(I, m);
    return x < 0 ? (++this.size, I.push([m, E])) : I[x][1] = E, this;
  }
  rt.prototype.clear = af, rt.prototype.delete = of, rt.prototype.get = sf, rt.prototype.has = lf, rt.prototype.set = cf;
  function It(m) {
    var E = -1, I = m == null ? 0 : m.length;
    for (this.clear(); ++E < I; ) {
      var x = m[E];
      this.set(x[0], x[1]);
    }
  }
  function uf() {
    this.size = 0, this.__data__ = {
      hash: new bt(),
      map: new (mr || rt)(),
      string: new bt()
    };
  }
  function ff(m) {
    var E = pn(this, m).delete(m);
    return this.size -= E ? 1 : 0, E;
  }
  function df(m) {
    return pn(this, m).get(m);
  }
  function hf(m) {
    return pn(this, m).has(m);
  }
  function pf(m, E) {
    var I = pn(this, m), x = I.size;
    return I.set(m, E), this.size += I.size == x ? 0 : 1, this;
  }
  It.prototype.clear = uf, It.prototype.delete = ff, It.prototype.get = df, It.prototype.has = hf, It.prototype.set = pf;
  function dn(m) {
    var E = -1, I = m == null ? 0 : m.length;
    for (this.__data__ = new It(); ++E < I; )
      this.add(m[E]);
  }
  function mf(m) {
    return this.__data__.set(m, n), this;
  }
  function gf(m) {
    return this.__data__.has(m);
  }
  dn.prototype.add = dn.prototype.push = mf, dn.prototype.has = gf;
  function ct(m) {
    var E = this.__data__ = new rt(m);
    this.size = E.size;
  }
  function yf() {
    this.__data__ = new rt(), this.size = 0;
  }
  function wf(m) {
    var E = this.__data__, I = E.delete(m);
    return this.size = E.size, I;
  }
  function Ef(m) {
    return this.__data__.get(m);
  }
  function vf(m) {
    return this.__data__.has(m);
  }
  function _f(m, E) {
    var I = this.__data__;
    if (I instanceof rt) {
      var x = I.__data__;
      if (!mr || x.length < r - 1)
        return x.push([m, E]), this.size = ++I.size, this;
      I = this.__data__ = new It(x);
    }
    return I.set(m, E), this.size = I.size, this;
  }
  ct.prototype.clear = yf, ct.prototype.delete = wf, ct.prototype.get = Ef, ct.prototype.has = vf, ct.prototype.set = _f;
  function Sf(m, E) {
    var I = mn(m), x = !I && Uf(m), re = !I && !x && Di(m), W = !I && !x && !re && Ao(m), ce = I || x || re || W, me = ce ? We(m.length, String) : [], ve = me.length;
    for (var ae in m)
      Qe.call(m, ae) && !(ce && // Safari 9 has enumerable `arguments.length` in strict mode.
      (ae == "length" || // Node.js 0.10 has enumerable non-index properties on buffers.
      re && (ae == "offset" || ae == "parent") || // PhantomJS 2 has enumerable non-index properties on typed arrays.
      W && (ae == "buffer" || ae == "byteLength" || ae == "byteOffset") || // Skip index properties.
      Nf(ae, ve))) && me.push(ae);
    return me;
  }
  function hn(m, E) {
    for (var I = m.length; I--; )
      if (Eo(m[I][0], E))
        return I;
    return -1;
  }
  function Af(m, E, I) {
    var x = E(m);
    return mn(m) ? x : lt(x, I(m));
  }
  function yr(m) {
    return m == null ? m === void 0 ? y : T : $t && $t in Object(m) ? Pf(m) : Lf(m);
  }
  function mo(m) {
    return wr(m) && yr(m) == s;
  }
  function go(m, E, I, x, re) {
    return m === E ? !0 : m == null || E == null || !wr(m) && !wr(E) ? m !== m && E !== E : Tf(m, E, I, x, go, re);
  }
  function Tf(m, E, I, x, re, W) {
    var ce = mn(m), me = mn(E), ve = ce ? l : ut(m), ae = me ? l : ut(E);
    ve = ve == s ? A : ve, ae = ae == s ? A : ae;
    var Be = ve == A, ze = ae == A, Te = ve == ae;
    if (Te && Di(m)) {
      if (!Di(E))
        return !1;
      ce = !0, Be = !1;
    }
    if (Te && !Be)
      return W || (W = new ct()), ce || Ao(m) ? yo(m, E, I, x, re, W) : If(m, E, ve, I, x, re, W);
    if (!(I & i)) {
      var je = Be && Qe.call(m, "__wrapped__"), He = ze && Qe.call(E, "__wrapped__");
      if (je || He) {
        var ft = je ? m.value() : m, nt = He ? E.value() : E;
        return W || (W = new ct()), re(ft, nt, I, x, W);
      }
    }
    return Te ? (W || (W = new ct()), Of(m, E, I, x, re, W)) : !1;
  }
  function Cf(m) {
    if (!So(m) || Ff(m))
      return !1;
    var E = vo(m) ? Gu : ee;
    return E.test(Ot(m));
  }
  function $f(m) {
    return wr(m) && _o(m.length) && !!k[yr(m)];
  }
  function bf(m) {
    if (!xf(m))
      return Vu(m);
    var E = [];
    for (var I in Object(m))
      Qe.call(m, I) && I != "constructor" && E.push(I);
    return E;
  }
  function yo(m, E, I, x, re, W) {
    var ce = I & i, me = m.length, ve = E.length;
    if (me != ve && !(ce && ve > me))
      return !1;
    var ae = W.get(m);
    if (ae && W.get(E))
      return ae == E;
    var Be = -1, ze = !0, Te = I & a ? new dn() : void 0;
    for (W.set(m, E), W.set(E, m); ++Be < me; ) {
      var je = m[Be], He = E[Be];
      if (x)
        var ft = ce ? x(He, je, Be, E, m, W) : x(je, He, Be, m, E, W);
      if (ft !== void 0) {
        if (ft)
          continue;
        ze = !1;
        break;
      }
      if (Te) {
        if (!de(E, function(nt, Pt) {
          if (!ln(Te, Pt) && (je === nt || re(je, nt, I, x, W)))
            return Te.push(Pt);
        })) {
          ze = !1;
          break;
        }
      } else if (!(je === He || re(je, He, I, x, W))) {
        ze = !1;
        break;
      }
    }
    return W.delete(m), W.delete(E), ze;
  }
  function If(m, E, I, x, re, W, ce) {
    switch (I) {
      case H:
        if (m.byteLength != E.byteLength || m.byteOffset != E.byteOffset)
          return !1;
        m = m.buffer, E = E.buffer;
      case q:
        return !(m.byteLength != E.byteLength || !W(new uo(m), new uo(E)));
      case c:
      case f:
      case S:
        return Eo(+m, +E);
      case h:
        return m.name == E.name && m.message == E.message;
      case K:
      case Y:
        return m == E + "";
      case w:
        var me = cn;
      case ne:
        var ve = x & i;
        if (me || (me = ju), m.size != E.size && !ve)
          return !1;
        var ae = ce.get(m);
        if (ae)
          return ae == E;
        x |= a, ce.set(m, E);
        var Be = yo(me(m), me(E), x, re, W, ce);
        return ce.delete(m), Be;
      case Me:
        if (Pi)
          return Pi.call(m) == Pi.call(E);
    }
    return !1;
  }
  function Of(m, E, I, x, re, W) {
    var ce = I & i, me = wo(m), ve = me.length, ae = wo(E), Be = ae.length;
    if (ve != Be && !ce)
      return !1;
    for (var ze = ve; ze--; ) {
      var Te = me[ze];
      if (!(ce ? Te in E : Qe.call(E, Te)))
        return !1;
    }
    var je = W.get(m);
    if (je && W.get(E))
      return je == E;
    var He = !0;
    W.set(m, E), W.set(E, m);
    for (var ft = ce; ++ze < ve; ) {
      Te = me[ze];
      var nt = m[Te], Pt = E[Te];
      if (x)
        var To = ce ? x(Pt, nt, Te, E, m, W) : x(nt, Pt, Te, m, E, W);
      if (!(To === void 0 ? nt === Pt || re(nt, Pt, I, x, W) : To)) {
        He = !1;
        break;
      }
      ft || (ft = Te == "constructor");
    }
    if (He && !ft) {
      var gn = m.constructor, yn = E.constructor;
      gn != yn && "constructor" in m && "constructor" in E && !(typeof gn == "function" && gn instanceof gn && typeof yn == "function" && yn instanceof yn) && (He = !1);
    }
    return W.delete(m), W.delete(E), He;
  }
  function wo(m) {
    return Af(m, Bf, Df);
  }
  function pn(m, E) {
    var I = m.__data__;
    return Rf(E) ? I[typeof E == "string" ? "string" : "hash"] : I.map;
  }
  function qt(m, E) {
    var I = pr(m, E);
    return Cf(I) ? I : void 0;
  }
  function Pf(m) {
    var E = Qe.call(m, $t), I = m[$t];
    try {
      m[$t] = void 0;
      var x = !0;
    } catch {
    }
    var re = lo.call(m);
    return x && (E ? m[$t] = I : delete m[$t]), re;
  }
  var Df = ho ? function(m) {
    return m == null ? [] : (m = Object(m), Ae(ho(m), function(E) {
      return fo.call(m, E);
    }));
  } : jf, ut = yr;
  ($i && ut(new $i(new ArrayBuffer(1))) != H || mr && ut(new mr()) != w || bi && ut(bi.resolve()) != F || Ii && ut(new Ii()) != ne || Oi && ut(new Oi()) != z) && (ut = function(m) {
    var E = yr(m), I = E == A ? m.constructor : void 0, x = I ? Ot(I) : "";
    if (x)
      switch (x) {
        case Yu:
          return H;
        case Xu:
          return w;
        case Ju:
          return F;
        case Ku:
          return ne;
        case Qu:
          return z;
      }
    return E;
  });
  function Nf(m, E) {
    return E = E ?? o, !!E && (typeof m == "number" || pe.test(m)) && m > -1 && m % 1 == 0 && m < E;
  }
  function Rf(m) {
    var E = typeof m;
    return E == "string" || E == "number" || E == "symbol" || E == "boolean" ? m !== "__proto__" : m === null;
  }
  function Ff(m) {
    return !!so && so in m;
  }
  function xf(m) {
    var E = m && m.constructor, I = typeof E == "function" && E.prototype || un;
    return m === I;
  }
  function Lf(m) {
    return lo.call(m);
  }
  function Ot(m) {
    if (m != null) {
      try {
        return oo.call(m);
      } catch {
      }
      try {
        return m + "";
      } catch {
      }
    }
    return "";
  }
  function Eo(m, E) {
    return m === E || m !== m && E !== E;
  }
  var Uf = mo(/* @__PURE__ */ function() {
    return arguments;
  }()) ? mo : function(m) {
    return wr(m) && Qe.call(m, "callee") && !fo.call(m, "callee");
  }, mn = Array.isArray;
  function kf(m) {
    return m != null && _o(m.length) && !vo(m);
  }
  var Di = zu || Hf;
  function Mf(m, E) {
    return go(m, E);
  }
  function vo(m) {
    if (!So(m))
      return !1;
    var E = yr(m);
    return E == g || E == v || E == p || E == N;
  }
  function _o(m) {
    return typeof m == "number" && m > -1 && m % 1 == 0 && m <= o;
  }
  function So(m) {
    var E = typeof m;
    return m != null && (E == "object" || E == "function");
  }
  function wr(m) {
    return m != null && typeof m == "object";
  }
  var Ao = Ee ? Ti(Ee) : $f;
  function Bf(m) {
    return kf(m) ? Sf(m) : bf(m);
  }
  function jf() {
    return [];
  }
  function Hf() {
    return !1;
  }
  e.exports = Mf;
})(Jn, Jn.exports);
var gE = Jn.exports;
Object.defineProperty(tn, "__esModule", { value: !0 });
tn.DownloadedUpdateHelper = void 0;
tn.createTempUpdateFile = _E;
const yE = Yr, wE = At, Us = gE, Nt = Tt, Or = se;
class EE {
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
      return Us(this.versionInfo, r) && Us(this.fileInfo.info, n.info) && await (0, Nt.pathExists)(t) ? t : null;
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
    } catch (p) {
      let c = "No cached update info available";
      return p.code !== "ENOENT" && (await this.cleanCacheDirForPendingUpdate(), c += ` (error on read: ${p.message})`), r.info(c), null;
    }
    if (!((a == null ? void 0 : a.fileName) !== null))
      return r.warn("Cached update info is corrupted: no fileName, directory for cached update will be cleaned"), await this.cleanCacheDirForPendingUpdate(), null;
    if (t.info.sha512 !== a.sha512)
      return r.info(`Cached update sha512 checksum doesn't match the latest available update. New update must be downloaded. Cached: ${a.sha512}, expected: ${t.info.sha512}. Directory for cached update will be cleaned`), await this.cleanCacheDirForPendingUpdate(), null;
    const s = Or.join(this.cacheDirForPendingUpdate, a.fileName);
    if (!await (0, Nt.pathExists)(s))
      return r.info("Cached update file doesn't exist"), null;
    const l = await vE(s);
    return t.info.sha512 !== l ? (r.warn(`Sha512 checksum doesn't match the latest available update. New update must be downloaded. Cached: ${l}, expected: ${t.info.sha512}`), await this.cleanCacheDirForPendingUpdate(), null) : (this._downloadedFileInfo = a, s);
  }
  getUpdateInfoFile() {
    return Or.join(this.cacheDirForPendingUpdate, "update-info.json");
  }
}
tn.DownloadedUpdateHelper = EE;
function vE(e, t = "sha512", r = "base64", n) {
  return new Promise((i, a) => {
    const o = (0, yE.createHash)(t);
    o.on("error", a).setEncoding(r), (0, wE.createReadStream)(e, {
      ...n,
      highWaterMark: 1024 * 1024
      /* better to use more memory but hash faster */
    }).on("error", a).on("end", () => {
      o.end(), i(o.read());
    }).pipe(o, { end: !1 });
  });
}
async function _E(e, t, r) {
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
var mi = {}, ro = {};
Object.defineProperty(ro, "__esModule", { value: !0 });
ro.getAppCacheDir = AE;
const Ji = se, SE = ei;
function AE() {
  const e = (0, SE.homedir)();
  let t;
  return process.platform === "win32" ? t = process.env.LOCALAPPDATA || Ji.join(e, "AppData", "Local") : process.platform === "darwin" ? t = Ji.join(e, "Library", "Caches") : t = process.env.XDG_CACHE_HOME || Ji.join(e, ".cache"), t;
}
Object.defineProperty(mi, "__esModule", { value: !0 });
mi.ElectronAppAdapter = void 0;
const ks = se, TE = ro;
class CE {
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
    return this.isPackaged ? ks.join(process.resourcesPath, "app-update.yml") : ks.join(this.app.getAppPath(), "dev-app-update.yml");
  }
  get userDataPath() {
    return this.app.getPath("userData");
  }
  get baseCachePath() {
    return (0, TE.getAppCacheDir)();
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
mi.ElectronAppAdapter = CE;
var Tu = {};
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
      return await s.cancellationToken.createPromise((l, p, c) => {
        const f = {
          headers: s.headers || void 0,
          redirect: "manual"
        };
        (0, t.configureRequestUrl)(a, f), (0, t.configureRequestOptions)(f), this.doDownload(f, {
          destination: o,
          options: s,
          onCancel: c,
          callback: (h) => {
            h == null ? l(o) : p(h);
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
    addRedirectHandlers(a, o, s, l, p) {
      a.on("redirect", (c, f, h) => {
        a.abort(), l > this.maxRedirects ? s(this.createMaxRedirectError()) : p(t.HttpExecutor.prepareRedirectUrlOptions(h, o));
      });
    }
  }
  e.ElectronHttpExecutor = n;
})(Tu);
var rn = {}, Ge = {}, $E = "[object Symbol]", Cu = /[\\^$.*+?()[\]{}|]/g, bE = RegExp(Cu.source), IE = typeof Ie == "object" && Ie && Ie.Object === Object && Ie, OE = typeof self == "object" && self && self.Object === Object && self, PE = IE || OE || Function("return this")(), DE = Object.prototype, NE = DE.toString, Ms = PE.Symbol, Bs = Ms ? Ms.prototype : void 0, js = Bs ? Bs.toString : void 0;
function RE(e) {
  if (typeof e == "string")
    return e;
  if (xE(e))
    return js ? js.call(e) : "";
  var t = e + "";
  return t == "0" && 1 / e == -1 / 0 ? "-0" : t;
}
function FE(e) {
  return !!e && typeof e == "object";
}
function xE(e) {
  return typeof e == "symbol" || FE(e) && NE.call(e) == $E;
}
function LE(e) {
  return e == null ? "" : RE(e);
}
function UE(e) {
  return e = LE(e), e && bE.test(e) ? e.replace(Cu, "\\$&") : e;
}
var kE = UE;
Object.defineProperty(Ge, "__esModule", { value: !0 });
Ge.newBaseUrl = BE;
Ge.newUrlFromBase = Sa;
Ge.getChannelFilename = jE;
Ge.blockmapFiles = HE;
const $u = cr, ME = kE;
function BE(e) {
  const t = new $u.URL(e);
  return t.pathname.endsWith("/") || (t.pathname += "/"), t;
}
function Sa(e, t, r = !1) {
  const n = new $u.URL(e, t), i = t.search;
  return i != null && i.length !== 0 ? n.search = i : r && (n.search = `noCache=${Date.now().toString(32)}`), n;
}
function jE(e) {
  return `${e}.yml`;
}
function HE(e, t, r) {
  const n = Sa(`${e.pathname}.blockmap`, e);
  return [Sa(`${e.pathname.replace(new RegExp(ME(r), "g"), t)}.blockmap`, e), n];
}
var he = {};
Object.defineProperty(he, "__esModule", { value: !0 });
he.Provider = void 0;
he.findFile = WE;
he.parseUpdateInfo = zE;
he.getFileList = bu;
he.resolveFiles = VE;
const _t = we, qE = Se, Hs = Ge;
class GE {
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
he.Provider = GE;
function WE(e, t, r) {
  if (e.length === 0)
    throw (0, _t.newError)("No files provided", "ERR_UPDATER_NO_FILES_PROVIDED");
  const n = e.find((i) => i.url.pathname.toLowerCase().endsWith(`.${t}`));
  return n ?? (r == null ? e[0] : e.find((i) => !r.some((a) => i.url.pathname.toLowerCase().endsWith(`.${a}`))));
}
function zE(e, t, r) {
  if (e == null)
    throw (0, _t.newError)(`Cannot parse update info from ${t} in the latest release artifacts (${r}): rawData: null`, "ERR_UPDATER_INVALID_UPDATE_INFO");
  let n;
  try {
    n = (0, qE.load)(e);
  } catch (i) {
    throw (0, _t.newError)(`Cannot parse update info from ${t} in the latest release artifacts (${r}): ${i.stack || i.message}, rawData: ${e}`, "ERR_UPDATER_INVALID_UPDATE_INFO");
  }
  return n;
}
function bu(e) {
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
function VE(e, t, r = (n) => n) {
  const i = bu(e).map((s) => {
    if (s.sha2 == null && s.sha512 == null)
      throw (0, _t.newError)(`Update info doesn't contain nor sha256 neither sha512 checksum: ${(0, _t.safeStringifyJson)(s)}`, "ERR_UPDATER_NO_CHECKSUM");
    return {
      url: (0, Hs.newUrlFromBase)(r(s.url), t),
      info: s
    };
  }), a = e.packages, o = a == null ? null : a[process.arch] || a.ia32;
  return o != null && (i[0].packageInfo = {
    ...o,
    path: (0, Hs.newUrlFromBase)(r(o.path), t).href
  }), i;
}
Object.defineProperty(rn, "__esModule", { value: !0 });
rn.GenericProvider = void 0;
const qs = we, Ki = Ge, Qi = he;
class YE extends Qi.Provider {
  constructor(t, r, n) {
    super(n), this.configuration = t, this.updater = r, this.baseUrl = (0, Ki.newBaseUrl)(this.configuration.url);
  }
  get channel() {
    const t = this.updater.channel || this.configuration.channel;
    return t == null ? this.getDefaultChannelName() : this.getCustomChannelName(t);
  }
  async getLatestVersion() {
    const t = (0, Ki.getChannelFilename)(this.channel), r = (0, Ki.newUrlFromBase)(t, this.baseUrl, this.updater.isAddNoCacheQuery);
    for (let n = 0; ; n++)
      try {
        return (0, Qi.parseUpdateInfo)(await this.httpRequest(r), t, r);
      } catch (i) {
        if (i instanceof qs.HttpError && i.statusCode === 404)
          throw (0, qs.newError)(`Cannot find channel "${t}" update info: ${i.stack || i.message}`, "ERR_UPDATER_CHANNEL_FILE_NOT_FOUND");
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
    return (0, Qi.resolveFiles)(t, this.baseUrl);
  }
}
rn.GenericProvider = YE;
var gi = {}, yi = {};
Object.defineProperty(yi, "__esModule", { value: !0 });
yi.BitbucketProvider = void 0;
const Gs = we, Zi = Ge, ea = he;
class XE extends ea.Provider {
  constructor(t, r, n) {
    super({
      ...n,
      isUseMultipleRangeRequest: !1
    }), this.configuration = t, this.updater = r;
    const { owner: i, slug: a } = t;
    this.baseUrl = (0, Zi.newBaseUrl)(`https://api.bitbucket.org/2.0/repositories/${i}/${a}/downloads`);
  }
  get channel() {
    return this.updater.channel || this.configuration.channel || "latest";
  }
  async getLatestVersion() {
    const t = new Gs.CancellationToken(), r = (0, Zi.getChannelFilename)(this.getCustomChannelName(this.channel)), n = (0, Zi.newUrlFromBase)(r, this.baseUrl, this.updater.isAddNoCacheQuery);
    try {
      const i = await this.httpRequest(n, void 0, t);
      return (0, ea.parseUpdateInfo)(i, r, n);
    } catch (i) {
      throw (0, Gs.newError)(`Unable to find latest version on ${this.toString()}, please ensure release exists: ${i.stack || i.message}`, "ERR_UPDATER_LATEST_VERSION_NOT_FOUND");
    }
  }
  resolveFiles(t) {
    return (0, ea.resolveFiles)(t, this.baseUrl);
  }
  toString() {
    const { owner: t, slug: r } = this.configuration;
    return `Bitbucket (owner: ${t}, slug: ${r}, channel: ${this.channel})`;
  }
}
yi.BitbucketProvider = XE;
var St = {};
Object.defineProperty(St, "__esModule", { value: !0 });
St.GitHubProvider = St.BaseGitHubProvider = void 0;
St.computeReleaseNotes = Ou;
const it = we, er = Au, JE = cr, tr = Ge, Aa = he, ta = /\/tag\/([^/]+)$/;
class Iu extends Aa.Provider {
  constructor(t, r, n) {
    super({
      ...n,
      /* because GitHib uses S3 */
      isUseMultipleRangeRequest: !1
    }), this.options = t, this.baseUrl = (0, tr.newBaseUrl)((0, it.githubUrl)(t, r));
    const i = r === "github.com" ? "api.github.com" : r;
    this.baseApiUrl = (0, tr.newBaseUrl)((0, it.githubUrl)(t, i));
  }
  computeGithubBasePath(t) {
    const r = this.options.host;
    return r && !["github.com", "api.github.com"].includes(r) ? `/api/v3${t}` : t;
  }
}
St.BaseGitHubProvider = Iu;
class KE extends Iu {
  constructor(t, r, n) {
    super(t, "github.com", n), this.options = t, this.updater = r;
  }
  get channel() {
    const t = this.updater.channel || this.options.channel;
    return t == null ? this.getDefaultChannelName() : this.getCustomChannelName(t);
  }
  async getLatestVersion() {
    var t, r, n, i, a;
    const o = new it.CancellationToken(), s = await this.httpRequest((0, tr.newUrlFromBase)(`${this.basePath}.atom`, this.baseUrl), {
      accept: "application/xml, application/atom+xml, text/xml, */*"
    }, o), l = (0, it.parseXml)(s);
    let p = l.element("entry", !1, "No published versions on GitHub"), c = null;
    try {
      if (this.updater.allowPrerelease) {
        const S = ((t = this.updater) === null || t === void 0 ? void 0 : t.channel) || ((r = er.prerelease(this.updater.currentVersion)) === null || r === void 0 ? void 0 : r[0]) || null;
        if (S === null)
          c = ta.exec(p.element("link").attribute("href"))[1];
        else
          for (const T of l.getElements("entry")) {
            const A = ta.exec(T.element("link").attribute("href"));
            if (A === null)
              continue;
            const F = A[1], N = ((n = er.prerelease(F)) === null || n === void 0 ? void 0 : n[0]) || null, K = !S || ["alpha", "beta"].includes(S), ne = N !== null && !["alpha", "beta"].includes(String(N));
            if (K && !ne && !(S === "beta" && N === "alpha")) {
              c = F;
              break;
            }
            if (N && N === S) {
              c = F;
              break;
            }
          }
      } else {
        c = await this.getLatestTagName(o);
        for (const S of l.getElements("entry"))
          if (ta.exec(S.element("link").attribute("href"))[1] === c) {
            p = S;
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
    const v = async (S) => {
      h = (0, tr.getChannelFilename)(S), g = (0, tr.newUrlFromBase)(this.getBaseDownloadPath(String(c), h), this.baseUrl);
      const T = this.createRequestOptions(g);
      try {
        return await this.executor.request(T, o);
      } catch (A) {
        throw A instanceof it.HttpError && A.statusCode === 404 ? (0, it.newError)(`Cannot find ${h} in the latest release artifacts (${g}): ${A.stack || A.message}`, "ERR_UPDATER_CHANNEL_FILE_NOT_FOUND") : A;
      }
    };
    try {
      let S = this.channel;
      this.updater.allowPrerelease && (!((i = er.prerelease(c)) === null || i === void 0) && i[0]) && (S = this.getCustomChannelName(String((a = er.prerelease(c)) === null || a === void 0 ? void 0 : a[0]))), f = await v(S);
    } catch (S) {
      if (this.updater.allowPrerelease)
        f = await v(this.getDefaultChannelName());
      else
        throw S;
    }
    const w = (0, Aa.parseUpdateInfo)(f, h, g);
    return w.releaseName == null && (w.releaseName = p.elementValueOrEmpty("title")), w.releaseNotes == null && (w.releaseNotes = Ou(this.updater.currentVersion, this.updater.fullChangelog, l, p)), {
      tag: c,
      ...w
    };
  }
  async getLatestTagName(t) {
    const r = this.options, n = r.host == null || r.host === "github.com" ? (0, tr.newUrlFromBase)(`${this.basePath}/latest`, this.baseUrl) : new JE.URL(`${this.computeGithubBasePath(`/repos/${r.owner}/${r.repo}/releases`)}/latest`, this.baseApiUrl);
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
    return (0, Aa.resolveFiles)(t, this.baseUrl, (r) => this.getBaseDownloadPath(t.tag, r.replace(/ /g, "-")));
  }
  getBaseDownloadPath(t, r) {
    return `${this.basePath}/download/${t}/${r}`;
  }
}
St.GitHubProvider = KE;
function Ws(e) {
  const t = e.elementValueOrEmpty("content");
  return t === "No content." ? "" : t;
}
function Ou(e, t, r, n) {
  if (!t)
    return Ws(n);
  const i = [];
  for (const a of r.getElements("entry")) {
    const o = /\/tag\/v?([^/]+)$/.exec(a.element("link").attribute("href"))[1];
    er.lt(e, o) && i.push({
      version: o,
      note: Ws(a)
    });
  }
  return i.sort((a, o) => er.rcompare(a.version, o.version));
}
var wi = {};
Object.defineProperty(wi, "__esModule", { value: !0 });
wi.KeygenProvider = void 0;
const zs = we, ra = Ge, na = he;
class QE extends na.Provider {
  constructor(t, r, n) {
    super({
      ...n,
      isUseMultipleRangeRequest: !1
    }), this.configuration = t, this.updater = r, this.defaultHostname = "api.keygen.sh";
    const i = this.configuration.host || this.defaultHostname;
    this.baseUrl = (0, ra.newBaseUrl)(`https://${i}/v1/accounts/${this.configuration.account}/artifacts?product=${this.configuration.product}`);
  }
  get channel() {
    return this.updater.channel || this.configuration.channel || "stable";
  }
  async getLatestVersion() {
    const t = new zs.CancellationToken(), r = (0, ra.getChannelFilename)(this.getCustomChannelName(this.channel)), n = (0, ra.newUrlFromBase)(r, this.baseUrl, this.updater.isAddNoCacheQuery);
    try {
      const i = await this.httpRequest(n, {
        Accept: "application/vnd.api+json",
        "Keygen-Version": "1.1"
      }, t);
      return (0, na.parseUpdateInfo)(i, r, n);
    } catch (i) {
      throw (0, zs.newError)(`Unable to find latest version on ${this.toString()}, please ensure release exists: ${i.stack || i.message}`, "ERR_UPDATER_LATEST_VERSION_NOT_FOUND");
    }
  }
  resolveFiles(t) {
    return (0, na.resolveFiles)(t, this.baseUrl);
  }
  toString() {
    const { account: t, product: r, platform: n } = this.configuration;
    return `Keygen (account: ${t}, product: ${r}, platform: ${n}, channel: ${this.channel})`;
  }
}
wi.KeygenProvider = QE;
var Ei = {};
Object.defineProperty(Ei, "__esModule", { value: !0 });
Ei.PrivateGitHubProvider = void 0;
const Vt = we, ZE = Se, ev = se, Vs = cr, Ys = Ge, tv = St, rv = he;
class nv extends tv.BaseGitHubProvider {
  constructor(t, r, n, i) {
    super(t, "api.github.com", i), this.updater = r, this.token = n;
  }
  createRequestOptions(t, r) {
    const n = super.createRequestOptions(t, r);
    return n.redirect = "manual", n;
  }
  async getLatestVersion() {
    const t = new Vt.CancellationToken(), r = (0, Ys.getChannelFilename)(this.getDefaultChannelName()), n = await this.getLatestVersionInfo(t), i = n.assets.find((s) => s.name === r);
    if (i == null)
      throw (0, Vt.newError)(`Cannot find ${r} in the release ${n.html_url || n.name}`, "ERR_UPDATER_CHANNEL_FILE_NOT_FOUND");
    const a = new Vs.URL(i.url);
    let o;
    try {
      o = (0, ZE.load)(await this.httpRequest(a, this.configureHeaders("application/octet-stream"), t));
    } catch (s) {
      throw s instanceof Vt.HttpError && s.statusCode === 404 ? (0, Vt.newError)(`Cannot find ${r} in the latest release artifacts (${a}): ${s.stack || s.message}`, "ERR_UPDATER_CHANNEL_FILE_NOT_FOUND") : s;
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
    const i = (0, Ys.newUrlFromBase)(n, this.baseUrl);
    try {
      const a = JSON.parse(await this.httpRequest(i, this.configureHeaders("application/vnd.github.v3+json"), t));
      return r ? a.find((o) => o.prerelease) || a[0] : a;
    } catch (a) {
      throw (0, Vt.newError)(`Unable to find latest version on GitHub (${i}), please ensure a production release exists: ${a.stack || a.message}`, "ERR_UPDATER_LATEST_VERSION_NOT_FOUND");
    }
  }
  get basePath() {
    return this.computeGithubBasePath(`/repos/${this.options.owner}/${this.options.repo}/releases`);
  }
  resolveFiles(t) {
    return (0, rv.getFileList)(t).map((r) => {
      const n = ev.posix.basename(r.url).replace(/ /g, "-"), i = t.assets.find((a) => a != null && a.name === n);
      if (i == null)
        throw (0, Vt.newError)(`Cannot find asset "${n}" in: ${JSON.stringify(t.assets, null, 2)}`, "ERR_UPDATER_ASSET_NOT_FOUND");
      return {
        url: new Vs.URL(i.url),
        info: r
      };
    });
  }
}
Ei.PrivateGitHubProvider = nv;
Object.defineProperty(gi, "__esModule", { value: !0 });
gi.isUrlProbablySupportMultiRangeRequests = Pu;
gi.createClient = lv;
const Pn = we, iv = yi, Xs = rn, av = St, ov = wi, sv = Ei;
function Pu(e) {
  return !e.includes("s3.amazonaws.com");
}
function lv(e, t, r) {
  if (typeof e == "string")
    throw (0, Pn.newError)("Please pass PublishConfiguration object", "ERR_UPDATER_INVALID_PROVIDER_CONFIGURATION");
  const n = e.provider;
  switch (n) {
    case "github": {
      const i = e, a = (i.private ? process.env.GH_TOKEN || process.env.GITHUB_TOKEN : null) || i.token;
      return a == null ? new av.GitHubProvider(i, t, r) : new sv.PrivateGitHubProvider(i, t, a, r);
    }
    case "bitbucket":
      return new iv.BitbucketProvider(e, t, r);
    case "keygen":
      return new ov.KeygenProvider(e, t, r);
    case "s3":
    case "spaces":
      return new Xs.GenericProvider({
        provider: "generic",
        url: (0, Pn.getS3LikeProviderBaseUrl)(e),
        channel: e.channel || null
      }, t, {
        ...r,
        // https://github.com/minio/minio/issues/5285#issuecomment-350428955
        isUseMultipleRangeRequest: !1
      });
    case "generic": {
      const i = e;
      return new Xs.GenericProvider(i, t, {
        ...r,
        isUseMultipleRangeRequest: i.useMultipleRangeRequest !== !1 && Pu(i.url)
      });
    }
    case "custom": {
      const i = e, a = i.updateProvider;
      if (!a)
        throw (0, Pn.newError)("Custom provider not specified", "ERR_UPDATER_INVALID_PROVIDER_CONFIGURATION");
      return new a(i, t, r);
    }
    default:
      throw (0, Pn.newError)(`Unsupported provider: ${n}`, "ERR_UPDATER_UNSUPPORTED_PROVIDER");
  }
}
var vi = {}, nn = {}, hr = {}, Ht = {};
Object.defineProperty(Ht, "__esModule", { value: !0 });
Ht.OperationKind = void 0;
Ht.computeOperations = cv;
var xt;
(function(e) {
  e[e.COPY = 0] = "COPY", e[e.DOWNLOAD = 1] = "DOWNLOAD";
})(xt || (Ht.OperationKind = xt = {}));
function cv(e, t, r) {
  const n = Ks(e.files), i = Ks(t.files);
  let a = null;
  const o = t.files[0], s = [], l = o.name, p = n.get(l);
  if (p == null)
    throw new Error(`no file ${l} in old blockmap`);
  const c = i.get(l);
  let f = 0;
  const { checksumToOffset: h, checksumToOldSize: g } = fv(n.get(l), p.offset, r);
  let v = o.offset;
  for (let w = 0; w < c.checksums.length; v += c.sizes[w], w++) {
    const S = c.sizes[w], T = c.checksums[w];
    let A = h.get(T);
    A != null && g.get(T) !== S && (r.warn(`Checksum ("${T}") matches, but size differs (old: ${g.get(T)}, new: ${S})`), A = void 0), A === void 0 ? (f++, a != null && a.kind === xt.DOWNLOAD && a.end === v ? a.end += S : (a = {
      kind: xt.DOWNLOAD,
      start: v,
      end: v + S
      // oldBlocks: null,
    }, Js(a, s, T, w))) : a != null && a.kind === xt.COPY && a.end === A ? a.end += S : (a = {
      kind: xt.COPY,
      start: A,
      end: A + S
      // oldBlocks: [checksum]
    }, Js(a, s, T, w));
  }
  return f > 0 && r.info(`File${o.name === "file" ? "" : " " + o.name} has ${f} changed blocks`), s;
}
const uv = process.env.DIFFERENTIAL_DOWNLOAD_PLAN_BUILDER_VALIDATE_RANGES === "true";
function Js(e, t, r, n) {
  if (uv && t.length !== 0) {
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
function fv(e, t, r) {
  const n = /* @__PURE__ */ new Map(), i = /* @__PURE__ */ new Map();
  let a = t;
  for (let o = 0; o < e.checksums.length; o++) {
    const s = e.checksums[o], l = e.sizes[o], p = i.get(s);
    if (p === void 0)
      n.set(s, a), i.set(s, l);
    else if (r.debug != null) {
      const c = p === l ? "(same size)" : `(size: ${p}, this size: ${l})`;
      r.debug(`${s} duplicated in blockmap ${c}, it doesn't lead to broken differential downloader, just corresponding block will be skipped)`);
    }
    a += l;
  }
  return { checksumToOffset: n, checksumToOldSize: i };
}
function Ks(e) {
  const t = /* @__PURE__ */ new Map();
  for (const r of e)
    t.set(r.name, r);
  return t;
}
Object.defineProperty(hr, "__esModule", { value: !0 });
hr.DataSplitter = void 0;
hr.copyData = Du;
const Dn = we, dv = At, hv = Vr, pv = Ht, Qs = Buffer.from(`\r
\r
`);
var ht;
(function(e) {
  e[e.INIT = 0] = "INIT", e[e.HEADER = 1] = "HEADER", e[e.BODY = 2] = "BODY";
})(ht || (ht = {}));
function Du(e, t, r, n, i) {
  const a = (0, dv.createReadStream)("", {
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
class mv extends hv.Writable {
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
      throw (0, Dn.newError)("Internal error", "ERR_DATA_SPLITTER_BYTE_COUNT_MISMATCH");
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
              throw (0, Dn.newError)("taskIndex is null", "ERR_DATA_SPLITTER_TASK_INDEX_IS_NULL");
          const s = this.partIndex === 0 ? this.options.start : this.partIndexToTaskIndex.get(this.partIndex - 1) + 1;
          if (s < o)
            await this.copyExistingData(s, o);
          else if (s > o)
            throw (0, Dn.newError)("prevTaskIndex must be < taskIndex", "ERR_DATA_SPLITTER_TASK_INDEX_ASSERT_FAILED");
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
        if (o.kind !== pv.OperationKind.COPY) {
          i(new Error("Task kind must be COPY"));
          return;
        }
        Du(o, this.out, this.options.oldFileFd, i, () => {
          t++, a();
        });
      };
      a();
    });
  }
  searchHeaderListEnd(t, r) {
    const n = t.indexOf(Qs, r);
    if (n !== -1)
      return n + Qs.length;
    const i = r === 0 ? t : t.slice(r);
    return this.headerListBuffer == null ? this.headerListBuffer = i : this.headerListBuffer = Buffer.concat([this.headerListBuffer, i]), -1;
  }
  onPartEnd() {
    const t = this.partIndexToLength[this.partIndex - 1];
    if (this.actualPartLength !== t)
      throw (0, Dn.newError)(`Expected length: ${t} differs from actual: ${this.actualPartLength}`, "ERR_DATA_SPLITTER_LENGTH_MISMATCH");
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
hr.DataSplitter = mv;
var _i = {};
Object.defineProperty(_i, "__esModule", { value: !0 });
_i.executeTasksUsingMultipleRangeRequests = gv;
_i.checkIsRangesSupported = Ca;
const Ta = we, Zs = hr, el = Ht;
function gv(e, t, r, n, i) {
  const a = (o) => {
    if (o >= t.length) {
      e.fileMetadataBuffer != null && r.write(e.fileMetadataBuffer), r.end();
      return;
    }
    const s = o + 1e3;
    yv(e, {
      tasks: t,
      start: o,
      end: Math.min(t.length, s),
      oldFileFd: n
    }, r, () => a(s), i);
  };
  return a;
}
function yv(e, t, r, n, i) {
  let a = "bytes=", o = 0;
  const s = /* @__PURE__ */ new Map(), l = [];
  for (let f = t.start; f < t.end; f++) {
    const h = t.tasks[f];
    h.kind === el.OperationKind.DOWNLOAD && (a += `${h.start}-${h.end - 1}, `, s.set(o, f), o++, l.push(h.end - h.start));
  }
  if (o <= 1) {
    const f = (h) => {
      if (h >= t.end) {
        n();
        return;
      }
      const g = t.tasks[h++];
      if (g.kind === el.OperationKind.COPY)
        (0, Zs.copyData)(g, r, t.oldFileFd, i, () => f(h));
      else {
        const v = e.createRequestOptions();
        v.headers.Range = `bytes=${g.start}-${g.end - 1}`;
        const w = e.httpExecutor.createRequest(v, (S) => {
          Ca(S, i) && (S.pipe(r, {
            end: !1
          }), S.once("end", () => f(h)));
        });
        e.httpExecutor.addErrorAndTimeoutHandlers(w, i), w.end();
      }
    };
    f(t.start);
    return;
  }
  const p = e.createRequestOptions();
  p.headers.Range = a.substring(0, a.length - 2);
  const c = e.httpExecutor.createRequest(p, (f) => {
    if (!Ca(f, i))
      return;
    const h = (0, Ta.safeGetHeader)(f, "content-type"), g = /^multipart\/.+?(?:; boundary=(?:(?:"(.+)")|(?:([^\s]+))))$/i.exec(h);
    if (g == null) {
      i(new Error(`Content-Type "multipart/byteranges" is expected, but got "${h}"`));
      return;
    }
    const v = new Zs.DataSplitter(r, t, s, g[1] || g[2], l, n);
    v.on("error", i), f.pipe(v), f.on("end", () => {
      setTimeout(() => {
        c.abort(), i(new Error("Response ends without calling any handlers"));
      }, 1e4);
    });
  });
  e.httpExecutor.addErrorAndTimeoutHandlers(c, i), c.end();
}
function Ca(e, t) {
  if (e.statusCode >= 400)
    return t((0, Ta.createHttpError)(e)), !1;
  if (e.statusCode !== 206) {
    const r = (0, Ta.safeGetHeader)(e, "accept-ranges");
    if (r == null || r === "none")
      return t(new Error(`Server doesn't support Accept-Ranges (response code ${e.statusCode})`)), !1;
  }
  return !0;
}
var Si = {};
Object.defineProperty(Si, "__esModule", { value: !0 });
Si.ProgressDifferentialDownloadCallbackTransform = void 0;
const wv = Vr;
var rr;
(function(e) {
  e[e.COPY = 0] = "COPY", e[e.DOWNLOAD = 1] = "DOWNLOAD";
})(rr || (rr = {}));
class Ev extends wv.Transform {
  constructor(t, r, n) {
    super(), this.progressDifferentialDownloadInfo = t, this.cancellationToken = r, this.onProgress = n, this.start = Date.now(), this.transferred = 0, this.delta = 0, this.expectedBytes = 0, this.index = 0, this.operationType = rr.COPY, this.nextUpdate = this.start + 1e3;
  }
  _transform(t, r, n) {
    if (this.cancellationToken.cancelled) {
      n(new Error("cancelled"), null);
      return;
    }
    if (this.operationType == rr.COPY) {
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
    this.operationType = rr.COPY;
  }
  beginRangeDownload() {
    this.operationType = rr.DOWNLOAD, this.expectedBytes += this.progressDifferentialDownloadInfo.expectedByteCounts[this.index++];
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
Si.ProgressDifferentialDownloadCallbackTransform = Ev;
Object.defineProperty(nn, "__esModule", { value: !0 });
nn.DifferentialDownloader = void 0;
const Sr = we, ia = Tt, vv = At, _v = hr, Sv = cr, Nn = Ht, tl = _i, Av = Si;
class Tv {
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
      const p = l.end - l.start;
      l.kind === Nn.OperationKind.DOWNLOAD ? a += p : o += p;
    }
    const s = this.blockAwareFileInfo.size;
    if (a + o + (this.fileMetadataBuffer == null ? 0 : this.fileMetadataBuffer.length) !== s)
      throw new Error(`Internal error, size mismatch: downloadSize: ${a}, copySize: ${o}, newSize: ${s}`);
    return n.info(`Full: ${rl(s)}, To download: ${rl(a)} (${Math.round(a / (s / 100))}%)`), this.downloadFile(i);
  }
  downloadFile(t) {
    const r = [], n = () => Promise.all(r.map((i) => (0, ia.close)(i.descriptor).catch((a) => {
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
    const n = await (0, ia.open)(this.options.oldFile, "r");
    r.push({ descriptor: n, path: this.options.oldFile });
    const i = await (0, ia.open)(this.options.newFile, "w");
    r.push({ descriptor: i, path: this.options.newFile });
    const a = (0, vv.createWriteStream)(this.options.newFile, { fd: i });
    await new Promise((o, s) => {
      const l = [];
      let p;
      if (!this.options.isUseMultipleRangeRequest && this.options.onProgress) {
        const T = [];
        let A = 0;
        for (const N of t)
          N.kind === Nn.OperationKind.DOWNLOAD && (T.push(N.end - N.start), A += N.end - N.start);
        const F = {
          expectedByteCounts: T,
          grandTotal: A
        };
        p = new Av.ProgressDifferentialDownloadCallbackTransform(F, this.options.cancellationToken, this.options.onProgress), l.push(p);
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
        g = (0, tl.executeTasksUsingMultipleRangeRequests)(this, t, h, n, s), g(0);
        return;
      }
      let v = 0, w = null;
      this.logger.info(`Differential download: ${this.options.newUrl}`);
      const S = this.createRequestOptions();
      S.redirect = "manual", g = (T) => {
        var A, F;
        if (T >= t.length) {
          this.fileMetadataBuffer != null && h.write(this.fileMetadataBuffer), h.end();
          return;
        }
        const N = t[T++];
        if (N.kind === Nn.OperationKind.COPY) {
          p && p.beginFileCopy(), (0, _v.copyData)(N, h, n, s, () => g(T));
          return;
        }
        const K = `bytes=${N.start}-${N.end - 1}`;
        S.headers.range = K, (F = (A = this.logger) === null || A === void 0 ? void 0 : A.debug) === null || F === void 0 || F.call(A, `download range: ${K}`), p && p.beginRangeDownload();
        const ne = this.httpExecutor.createRequest(S, (Y) => {
          Y.on("error", s), Y.on("aborted", () => {
            s(new Error("response has been aborted by the server"));
          }), Y.statusCode >= 400 && s((0, Sr.createHttpError)(Y)), Y.pipe(h, {
            end: !1
          }), Y.once("end", () => {
            p && p.endRangeDownload(), ++v === 100 ? (v = 0, setTimeout(() => g(T), 1e3)) : g(T);
          });
        });
        ne.on("redirect", (Y, Me, y) => {
          this.logger.info(`Redirect to ${Cv(y)}`), w = y, (0, Sr.configureRequestUrl)(new Sv.URL(w), S), ne.followRedirect();
        }), this.httpExecutor.addErrorAndTimeoutHandlers(ne, s), ne.end();
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
        (0, tl.checkIsRangesSupported)(o, i) && (o.on("error", i), o.on("aborted", () => {
          i(new Error("response has been aborted by the server"));
        }), o.on("data", r), o.on("end", () => n()));
      });
      this.httpExecutor.addErrorAndTimeoutHandlers(a, i), a.end();
    });
  }
}
nn.DifferentialDownloader = Tv;
function rl(e, t = " KB") {
  return new Intl.NumberFormat("en").format((e / 1024).toFixed(2)) + t;
}
function Cv(e) {
  const t = e.indexOf("?");
  return t < 0 ? e : e.substring(0, t);
}
Object.defineProperty(vi, "__esModule", { value: !0 });
vi.GenericDifferentialDownloader = void 0;
const $v = nn;
class bv extends $v.DifferentialDownloader {
  download(t, r) {
    return this.doDownload(t, r);
  }
}
vi.GenericDifferentialDownloader = bv;
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
const be = we, Iv = Yr, Ov = ei, Pv = Cl, Yt = Tt, Dv = Se, aa = ci, Dt = se, Rt = Au, nl = tn, Nv = mi, il = Tu, Rv = rn, oa = gi, Fv = bl, xv = Ge, Lv = vi, Xt = Ct;
class no extends Pv.EventEmitter {
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
    return (0, il.getNetSession)();
  }
  /**
   * The logger. You can pass [electron-log](https://github.com/megahertz/electron-log), [winston](https://github.com/winstonjs/winston) or another logger with the following interface: `{ info(), warn(), error() }`.
   * Set it to `null` if you would like to disable a logging feature.
   */
  get logger() {
    return this._logger;
  }
  set logger(t) {
    this._logger = t ?? new Nu();
  }
  // noinspection JSUnusedGlobalSymbols
  /**
   * test only
   * @private
   */
  set updateConfigPath(t) {
    this.clientPromise = null, this._appUpdateConfigPath = t, this.configOnDisk = new aa.Lazy(() => this.loadUpdateConfig());
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
    super(), this.autoDownload = !0, this.autoInstallOnAppQuit = !0, this.autoRunAppAfterInstall = !0, this.allowPrerelease = !1, this.fullChangelog = !1, this.allowDowngrade = !1, this.disableWebInstaller = !1, this.disableDifferentialDownload = !1, this.forceDevUpdateConfig = !1, this._channel = null, this.downloadedUpdateHelper = null, this.requestHeaders = null, this._logger = console, this.signals = new Xt.UpdaterSignal(this), this._appUpdateConfigPath = null, this._isUpdateSupported = (a) => this.checkIfUpdateSupported(a), this.clientPromise = null, this.stagingUserIdPromise = new aa.Lazy(() => this.getOrCreateStagingUserId()), this.configOnDisk = new aa.Lazy(() => this.loadUpdateConfig()), this.checkForUpdatesPromise = null, this.downloadPromise = null, this.updateInfoAndProvider = null, this._testOnlyOptions = null, this.on("error", (a) => {
      this._logger.error(`Error: ${a.stack || a.message}`);
    }), r == null ? (this.app = new Nv.ElectronAppAdapter(), this.httpExecutor = new il.ElectronHttpExecutor((a, o) => this.emit("login", a, o))) : (this.app = r, this.httpExecutor = null);
    const n = this.app.version, i = (0, Rt.parse)(n);
    if (i == null)
      throw (0, be.newError)(`App version is not a valid semver version: "${n}"`, "ERR_UPDATER_INVALID_VERSION");
    this.currentVersion = i, this.allowPrerelease = Uv(i), t != null && (this.setFeedURL(t), typeof t != "string" && t.requestHeaders && (this.requestHeaders = t.requestHeaders));
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
    typeof t == "string" ? n = new Rv.GenericProvider({ provider: "generic", url: t }, this, {
      ...r,
      isUseMultipleRangeRequest: (0, oa.isUrlProbablySupportMultiRangeRequests)(t)
    }) : n = (0, oa.createClient)(t, this, r), this.clientPromise = Promise.resolve(n);
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
      const n = no.formatDownloadNotification(r.updateInfo.version, this.app.name, t);
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
    const r = t == null ? void 0 : t.minimumSystemVersion, n = (0, Ov.release)();
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
    await this.app.whenReady(), this.clientPromise == null && (this.clientPromise = this.configOnDisk.value.then((n) => (0, oa.createClient)(n, this, this.createProviderRuntimeOptions())));
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
    this.emit(Xt.UPDATE_DOWNLOADED, t);
  }
  async loadUpdateConfig() {
    return this._appUpdateConfigPath == null && (this._appUpdateConfigPath = this.app.appUpdateConfigPath), (0, Dv.load)(await (0, Yt.readFile)(this._appUpdateConfigPath, "utf-8"));
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
    const t = Dt.join(this.app.userDataPath, ".updaterId");
    try {
      const n = await (0, Yt.readFile)(t, "utf-8");
      if (be.UUID.check(n))
        return n;
      this._logger.warn(`Staging user id file exists, but content was invalid: ${n}`);
    } catch (n) {
      n.code !== "ENOENT" && this._logger.warn(`Couldn't read staging user ID, creating a blank one: ${n}`);
    }
    const r = be.UUID.v5((0, Iv.randomBytes)(4096), be.UUID.OID);
    this._logger.info(`Generated new staging user ID: ${r}`);
    try {
      await (0, Yt.outputFile)(t, r);
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
      const i = Dt.join(this.app.baseCachePath, r || this.app.name);
      n.debug != null && n.debug(`updater cache dir: ${i}`), t = new nl.DownloadedUpdateHelper(i), this.downloadedUpdateHelper = t;
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
    this.listenerCount(Xt.DOWNLOAD_PROGRESS) > 0 && (n.onProgress = (A) => this.emit(Xt.DOWNLOAD_PROGRESS, A));
    const i = t.downloadUpdateOptions.updateInfoAndProvider.info, a = i.version, o = r.packageInfo;
    function s() {
      const A = decodeURIComponent(t.fileInfo.url.pathname);
      return A.endsWith(`.${t.fileExtension}`) ? Dt.basename(A) : t.fileInfo.info.url;
    }
    const l = await this.getOrCreateDownloadHelper(), p = l.cacheDirForPendingUpdate;
    await (0, Yt.mkdir)(p, { recursive: !0 });
    const c = s();
    let f = Dt.join(p, c);
    const h = o == null ? null : Dt.join(p, `package-${a}${Dt.extname(o.path) || ".7z"}`), g = async (A) => (await l.setDownloadedFile(f, h, i, r, c, A), await t.done({
      ...i,
      downloadedFile: f
    }), h == null ? [f] : [f, h]), v = this._logger, w = await l.validateDownloadedPath(f, i, r, v);
    if (w != null)
      return f = w, await g(!1);
    const S = async () => (await l.clear().catch(() => {
    }), await (0, Yt.unlink)(f).catch(() => {
    })), T = await (0, nl.createTempUpdateFile)(`temp-${c}`, p, v);
    try {
      await t.task(T, n, h, S), await (0, be.retry)(() => (0, Yt.rename)(T, f), 60, 500, 0, 0, (A) => A instanceof Error && /^EBUSY:/.test(A.message));
    } catch (A) {
      throw await S(), A instanceof be.CancellationError && (v.info("cancelled"), this.emit("update-cancelled", i)), A;
    }
    return v.info(`New version ${a} has been downloaded to ${f}`), await g(!0);
  }
  async differentialDownloadInstaller(t, r, n, i, a) {
    try {
      if (this._testOnlyOptions != null && !this._testOnlyOptions.isUseDifferentialDownload)
        return !0;
      const o = (0, xv.blockmapFiles)(t.url, this.app.version, r.updateInfoAndProvider.info.version);
      this._logger.info(`Download block maps (old: "${o[0]}", new: ${o[1]})`);
      const s = async (c) => {
        const f = await this.httpExecutor.downloadToBuffer(c, {
          headers: r.requestHeaders,
          cancellationToken: r.cancellationToken
        });
        if (f == null || f.length === 0)
          throw new Error(`Blockmap "${c.href}" is empty`);
        try {
          return JSON.parse((0, Fv.gunzipSync)(f).toString());
        } catch (h) {
          throw new Error(`Cannot parse blockmap "${c.href}", error: ${h}`);
        }
      }, l = {
        newUrl: t.url,
        oldFile: Dt.join(this.downloadedUpdateHelper.cacheDir, a),
        logger: this._logger,
        newFile: n,
        isUseMultipleRangeRequest: i.isUseMultipleRangeRequest,
        requestHeaders: r.requestHeaders,
        cancellationToken: r.cancellationToken
      };
      this.listenerCount(Xt.DOWNLOAD_PROGRESS) > 0 && (l.onProgress = (c) => this.emit(Xt.DOWNLOAD_PROGRESS, c));
      const p = await Promise.all(o.map((c) => s(c)));
      return await new Lv.GenericDifferentialDownloader(t.info, this.httpExecutor, l).download(p[0], p[1]), !1;
    } catch (o) {
      if (this._logger.error(`Cannot download differentially, fallback to full download: ${o.stack || o}`), this._testOnlyOptions != null)
        throw o;
      return !0;
    }
  }
}
wt.AppUpdater = no;
function Uv(e) {
  const t = (0, Rt.prerelease)(e);
  return t != null && t.length > 0;
}
class Nu {
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
wt.NoOpLogger = Nu;
Object.defineProperty(st, "__esModule", { value: !0 });
st.BaseUpdater = void 0;
const al = Zn, kv = wt;
class Mv extends kv.AppUpdater {
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
    const i = (0, al.spawnSync)(t, r, {
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
        const s = { stdio: i, env: n, detached: !0 }, l = (0, al.spawn)(t, r, s);
        l.on("error", (p) => {
          o(p);
        }), l.unref(), l.pid !== void 0 && a(!0);
      } catch (s) {
        o(s);
      }
    });
  }
}
st.BaseUpdater = Mv;
var Mr = {}, an = {};
Object.defineProperty(an, "__esModule", { value: !0 });
an.FileWithEmbeddedBlockMapDifferentialDownloader = void 0;
const Jt = Tt, Bv = nn, jv = bl;
class Hv extends Bv.DifferentialDownloader {
  async download() {
    const t = this.blockAwareFileInfo, r = t.size, n = r - (t.blockMapSize + 4);
    this.fileMetadataBuffer = await this.readRemoteBytes(n, r - 1);
    const i = Ru(this.fileMetadataBuffer.slice(0, this.fileMetadataBuffer.length - 4));
    await this.doDownload(await qv(this.options.oldFile), i);
  }
}
an.FileWithEmbeddedBlockMapDifferentialDownloader = Hv;
function Ru(e) {
  return JSON.parse((0, jv.inflateRawSync)(e).toString());
}
async function qv(e) {
  const t = await (0, Jt.open)(e, "r");
  try {
    const r = (await (0, Jt.fstat)(t)).size, n = Buffer.allocUnsafe(4);
    await (0, Jt.read)(t, n, 0, n.length, r - n.length);
    const i = Buffer.allocUnsafe(n.readUInt32BE(0));
    return await (0, Jt.read)(t, i, 0, i.length, r - n.length - i.length), await (0, Jt.close)(t), Ru(i);
  } catch (r) {
    throw await (0, Jt.close)(t), r;
  }
}
Object.defineProperty(Mr, "__esModule", { value: !0 });
Mr.AppImageUpdater = void 0;
const ol = we, sl = Zn, Gv = Tt, Wv = At, Ar = se, zv = st, Vv = an, Yv = he, ll = Ct;
class Xv extends zv.BaseUpdater {
  constructor(t, r) {
    super(t, r);
  }
  isUpdaterActive() {
    return process.env.APPIMAGE == null ? (process.env.SNAP == null ? this._logger.warn("APPIMAGE env is not defined, current application is not an AppImage") : this._logger.info("SNAP env is defined, updater is disabled"), !1) : super.isUpdaterActive();
  }
  /*** @private */
  doDownloadUpdate(t) {
    const r = t.updateInfoAndProvider.provider, n = (0, Yv.findFile)(r.resolveFiles(t.updateInfoAndProvider.info), "AppImage", ["rpm", "deb", "pacman"]);
    return this.executeDownload({
      fileExtension: "AppImage",
      fileInfo: n,
      downloadUpdateOptions: t,
      task: async (i, a) => {
        const o = process.env.APPIMAGE;
        if (o == null)
          throw (0, ol.newError)("APPIMAGE env is not defined", "ERR_UPDATER_OLD_FILE_NOT_FOUND");
        (t.disableDifferentialDownload || await this.downloadDifferential(n, o, i, r, t)) && await this.httpExecutor.download(n.url, i, a), await (0, Gv.chmod)(i, 493);
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
      return this.listenerCount(ll.DOWNLOAD_PROGRESS) > 0 && (o.onProgress = (s) => this.emit(ll.DOWNLOAD_PROGRESS, s)), await new Vv.FileWithEmbeddedBlockMapDifferentialDownloader(t.info, this.httpExecutor, o).download(), !1;
    } catch (o) {
      return this._logger.error(`Cannot download differentially, fallback to full download: ${o.stack || o}`), process.platform === "linux";
    }
  }
  doInstall(t) {
    const r = process.env.APPIMAGE;
    if (r == null)
      throw (0, ol.newError)("APPIMAGE env is not defined", "ERR_UPDATER_OLD_FILE_NOT_FOUND");
    (0, Wv.unlinkSync)(r);
    let n;
    const i = Ar.basename(r), a = this.installerPath;
    if (a == null)
      return this.dispatchError(new Error("No valid update available, can't quit and install")), !1;
    Ar.basename(a) === i || !/\d+\.\d+\.\d+/.test(i) ? n = r : n = Ar.join(Ar.dirname(r), Ar.basename(a)), (0, sl.execFileSync)("mv", ["-f", a, n]), n !== r && this.emit("appimage-filename-updated", n);
    const o = {
      ...process.env,
      APPIMAGE_SILENT_INSTALL: "true"
    };
    return t.isForceRunAfter ? this.spawnLog(n, [], o) : (o.APPIMAGE_EXIT_AFTER_INSTALL = "true", (0, sl.execFileSync)(n, [], { env: o })), !0;
  }
}
Mr.AppImageUpdater = Xv;
var Br = {};
Object.defineProperty(Br, "__esModule", { value: !0 });
Br.DebUpdater = void 0;
const Jv = st, Kv = he, cl = Ct;
class Qv extends Jv.BaseUpdater {
  constructor(t, r) {
    super(t, r);
  }
  /*** @private */
  doDownloadUpdate(t) {
    const r = t.updateInfoAndProvider.provider, n = (0, Kv.findFile)(r.resolveFiles(t.updateInfoAndProvider.info), "deb", ["AppImage", "rpm", "pacman"]);
    return this.executeDownload({
      fileExtension: "deb",
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
    const r = this.wrapSudo(), n = /pkexec/i.test(r) ? "" : '"', i = this.installerPath;
    if (i == null)
      return this.dispatchError(new Error("No valid update available, can't quit and install")), !1;
    const a = ["dpkg", "-i", i, "||", "apt-get", "install", "-f", "-y"];
    return this.spawnSyncLog(r, [`${n}/bin/bash`, "-c", `'${a.join(" ")}'${n}`]), t.isForceRunAfter && this.app.relaunch(), !0;
  }
}
Br.DebUpdater = Qv;
var jr = {};
Object.defineProperty(jr, "__esModule", { value: !0 });
jr.PacmanUpdater = void 0;
const Zv = st, ul = Ct, e_ = he;
class t_ extends Zv.BaseUpdater {
  constructor(t, r) {
    super(t, r);
  }
  /*** @private */
  doDownloadUpdate(t) {
    const r = t.updateInfoAndProvider.provider, n = (0, e_.findFile)(r.resolveFiles(t.updateInfoAndProvider.info), "pacman", ["AppImage", "deb", "rpm"]);
    return this.executeDownload({
      fileExtension: "pacman",
      fileInfo: n,
      downloadUpdateOptions: t,
      task: async (i, a) => {
        this.listenerCount(ul.DOWNLOAD_PROGRESS) > 0 && (a.onProgress = (o) => this.emit(ul.DOWNLOAD_PROGRESS, o)), await this.httpExecutor.download(n.url, i, a);
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
jr.PacmanUpdater = t_;
var Hr = {};
Object.defineProperty(Hr, "__esModule", { value: !0 });
Hr.RpmUpdater = void 0;
const r_ = st, fl = Ct, n_ = he;
class i_ extends r_.BaseUpdater {
  constructor(t, r) {
    super(t, r);
  }
  /*** @private */
  doDownloadUpdate(t) {
    const r = t.updateInfoAndProvider.provider, n = (0, n_.findFile)(r.resolveFiles(t.updateInfoAndProvider.info), "rpm", ["AppImage", "deb", "pacman"]);
    return this.executeDownload({
      fileExtension: "rpm",
      fileInfo: n,
      downloadUpdateOptions: t,
      task: async (i, a) => {
        this.listenerCount(fl.DOWNLOAD_PROGRESS) > 0 && (a.onProgress = (o) => this.emit(fl.DOWNLOAD_PROGRESS, o)), await this.httpExecutor.download(n.url, i, a);
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
Hr.RpmUpdater = i_;
var qr = {};
Object.defineProperty(qr, "__esModule", { value: !0 });
qr.MacUpdater = void 0;
const dl = we, sa = Tt, a_ = At, hl = se, o_ = Kf, s_ = wt, l_ = he, pl = Zn, ml = Yr;
class c_ extends s_.AppUpdater {
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
      this.debug("Checking for macOS Rosetta environment"), a = (0, pl.execFileSync)("sysctl", [i], { encoding: "utf8" }).includes(`${i}: 1`), n.info(`Checked for macOS Rosetta environment (isRosetta=${a})`);
    } catch (f) {
      n.warn(`sysctl shell command to check for macOS Rosetta environment failed: ${f}`);
    }
    let o = !1;
    try {
      this.debug("Checking for arm64 in uname");
      const h = (0, pl.execFileSync)("uname", ["-a"], { encoding: "utf8" }).includes("ARM");
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
    const l = (0, l_.findFile)(r, "zip", ["pkg", "dmg"]);
    if (l == null)
      throw (0, dl.newError)(`ZIP file not provided: ${(0, dl.safeStringifyJson)(r)}`, "ERR_UPDATER_ZIP_FILE_NOT_FOUND");
    const p = t.updateInfoAndProvider.provider, c = "update.zip";
    return this.executeDownload({
      fileExtension: "zip",
      fileInfo: l,
      downloadUpdateOptions: t,
      task: async (f, h) => {
        const g = hl.join(this.downloadedUpdateHelper.cacheDir, c), v = () => (0, sa.pathExistsSync)(g) ? !t.disableDifferentialDownload : (n.info("Unable to locate previous update.zip for differential download (is this first install?), falling back to full download"), !1);
        let w = !0;
        v() && (w = await this.differentialDownloadInstaller(l, t, f, p, c)), w && await this.httpExecutor.download(l.url, f, h);
      },
      done: async (f) => {
        if (!t.disableDifferentialDownload)
          try {
            const h = hl.join(this.downloadedUpdateHelper.cacheDir, c);
            await (0, sa.copyFile)(f.downloadedFile, h);
          } catch (h) {
            this._logger.warn(`Unable to copy file for caching for future differential downloads: ${h.message}`);
          }
        return this.updateDownloaded(l, f);
      }
    });
  }
  async updateDownloaded(t, r) {
    var n;
    const i = r.downloadedFile, a = (n = t.info.size) !== null && n !== void 0 ? n : (await (0, sa.stat)(i)).size, o = this._logger, s = `fileToProxy=${t.url.href}`;
    this.closeServerIfExists(), this.debug(`Creating proxy server for native Squirrel.Mac (${s})`), this.server = (0, o_.createServer)(), this.debug(`Proxy server for native Squirrel.Mac is created (${s})`), this.server.on("close", () => {
      o.info(`Proxy server for native Squirrel.Mac is closed (${s})`);
    });
    const l = (p) => {
      const c = p.address();
      return typeof c == "string" ? c : `http://127.0.0.1:${c == null ? void 0 : c.port}`;
    };
    return await new Promise((p, c) => {
      const f = (0, ml.randomBytes)(64).toString("base64").replace(/\//g, "_").replace(/\+/g, "-"), h = Buffer.from(`autoupdater:${f}`, "ascii"), g = `/${(0, ml.randomBytes)(64).toString("hex")}.zip`;
      this.server.on("request", (v, w) => {
        const S = v.url;
        if (o.info(`${S} requested`), S === "/") {
          if (!v.headers.authorization || v.headers.authorization.indexOf("Basic ") === -1) {
            w.statusCode = 401, w.statusMessage = "Invalid Authentication Credentials", w.end(), o.warn("No authenthication info");
            return;
          }
          const F = v.headers.authorization.split(" ")[1], N = Buffer.from(F, "base64").toString("ascii"), [K, ne] = N.split(":");
          if (K !== "autoupdater" || ne !== f) {
            w.statusCode = 401, w.statusMessage = "Invalid Authentication Credentials", w.end(), o.warn("Invalid authenthication credentials");
            return;
          }
          const Y = Buffer.from(`{ "url": "${l(this.server)}${g}" }`);
          w.writeHead(200, { "Content-Type": "application/json", "Content-Length": Y.length }), w.end(Y);
          return;
        }
        if (!S.startsWith(g)) {
          o.warn(`${S} requested, but not supported`), w.writeHead(404), w.end();
          return;
        }
        o.info(`${g} requested by Squirrel.Mac, pipe ${i}`);
        let T = !1;
        w.on("finish", () => {
          T || (this.nativeUpdater.removeListener("error", c), p([]));
        });
        const A = (0, a_.createReadStream)(i);
        A.on("error", (F) => {
          try {
            w.end();
          } catch (N) {
            o.warn(`cannot end response: ${N}`);
          }
          T = !0, this.nativeUpdater.removeListener("error", c), c(new Error(`Cannot pipe "${i}": ${F}`));
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
        }), this.dispatchUpdateDownloaded(r), this.autoInstallOnAppQuit ? (this.nativeUpdater.once("error", c), this.nativeUpdater.checkForUpdates()) : p([]);
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
qr.MacUpdater = c_;
var Gr = {}, io = {};
Object.defineProperty(io, "__esModule", { value: !0 });
io.verifySignature = f_;
const gl = we, Fu = Zn, u_ = ei, yl = se;
function f_(e, t, r) {
  return new Promise((n, i) => {
    const a = t.replace(/'/g, "''");
    r.info(`Verifying signature ${a}`), (0, Fu.execFile)('set "PSModulePath=" & chcp 65001 >NUL & powershell.exe', ["-NoProfile", "-NonInteractive", "-InputFormat", "None", "-Command", `"Get-AuthenticodeSignature -LiteralPath '${a}' | ConvertTo-Json -Compress"`], {
      shell: !0,
      timeout: 20 * 1e3
    }, (o, s, l) => {
      var p;
      try {
        if (o != null || l) {
          la(r, o, l, i), n(null);
          return;
        }
        const c = d_(s);
        if (c.Status === 0) {
          try {
            const v = yl.normalize(c.Path), w = yl.normalize(t);
            if (r.info(`LiteralPath: ${v}. Update Path: ${w}`), v !== w) {
              la(r, new Error(`LiteralPath of ${v} is different than ${w}`), l, i), n(null);
              return;
            }
          } catch (v) {
            r.warn(`Unable to verify LiteralPath of update asset due to missing data.Path. Skipping this step of validation. Message: ${(p = v.message) !== null && p !== void 0 ? p : v.stack}`);
          }
          const h = (0, gl.parseDn)(c.SignerCertificate.Subject);
          let g = !1;
          for (const v of e) {
            const w = (0, gl.parseDn)(v);
            if (w.size ? g = Array.from(w.keys()).every((T) => w.get(T) === h.get(T)) : v === h.get("CN") && (r.warn(`Signature validated using only CN ${v}. Please add your full Distinguished Name (DN) to publisherNames configuration`), g = !0), g) {
              n(null);
              return;
            }
          }
        }
        const f = `publisherNames: ${e.join(" | ")}, raw info: ` + JSON.stringify(c, (h, g) => h === "RawData" ? void 0 : g, 2);
        r.warn(`Sign verification failed, installer signed with incorrect certificate: ${f}`), n(f);
      } catch (c) {
        la(r, c, null, i), n(null);
        return;
      }
    });
  });
}
function d_(e) {
  const t = JSON.parse(e);
  delete t.PrivateKey, delete t.IsOSBinary, delete t.SignatureType;
  const r = t.SignerCertificate;
  return r != null && (delete r.Archived, delete r.Extensions, delete r.Handle, delete r.HasPrivateKey, delete r.SubjectName), t;
}
function la(e, t, r, n) {
  if (h_()) {
    e.warn(`Cannot execute Get-AuthenticodeSignature: ${t || r}. Ignoring signature validation due to unsupported powershell version. Please upgrade to powershell 3 or higher.`);
    return;
  }
  try {
    (0, Fu.execFileSync)("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", "ConvertTo-Json test"], { timeout: 10 * 1e3 });
  } catch (i) {
    e.warn(`Cannot execute ConvertTo-Json: ${i.message}. Ignoring signature validation due to unsupported powershell version. Please upgrade to powershell 3 or higher.`);
    return;
  }
  t != null && n(t), r && n(new Error(`Cannot execute Get-AuthenticodeSignature, stderr: ${r}. Failing signature validation due to unknown stderr.`));
}
function h_() {
  const e = u_.release();
  return e.startsWith("6.") && !e.startsWith("6.3");
}
Object.defineProperty(Gr, "__esModule", { value: !0 });
Gr.NsisUpdater = void 0;
const Rn = we, wl = se, p_ = st, m_ = an, El = Ct, g_ = he, y_ = Tt, w_ = io, vl = cr;
class E_ extends p_.BaseUpdater {
  constructor(t, r) {
    super(t, r), this._verifyUpdateCodeSignature = (n, i) => (0, w_.verifySignature)(n, i, this._logger);
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
    const r = t.updateInfoAndProvider.provider, n = (0, g_.findFile)(r.resolveFiles(t.updateInfoAndProvider.info), "exe");
    return this.executeDownload({
      fileExtension: "exe",
      downloadUpdateOptions: t,
      fileInfo: n,
      task: async (i, a, o, s) => {
        const l = n.packageInfo, p = l != null && o != null;
        if (p && t.disableWebInstaller)
          throw (0, Rn.newError)(`Unable to download new version ${t.updateInfoAndProvider.info.version}. Web Installers are disabled`, "ERR_UPDATER_WEB_INSTALLER_DISABLED");
        !p && !t.disableWebInstaller && this._logger.warn("disableWebInstaller is set to false, you should set it to true if you do not plan on using a web installer. This will default to true in a future version."), (p || t.disableDifferentialDownload || await this.differentialDownloadInstaller(n, t, i, r, Rn.CURRENT_APP_INSTALLER_FILE_NAME)) && await this.httpExecutor.download(n.url, i, a);
        const c = await this.verifySignature(i);
        if (c != null)
          throw await s(), (0, Rn.newError)(`New version ${t.updateInfoAndProvider.info.version} is not signed by the application owner: ${c}`, "ERR_UPDATER_INVALID_SIGNATURE");
        if (p && await this.differentialDownloadWebPackage(t, l, o, r))
          try {
            await this.httpExecutor.download(new vl.URL(l.path), o, {
              headers: t.requestHeaders,
              cancellationToken: t.cancellationToken,
              sha512: l.sha512
            });
          } catch (f) {
            try {
              await (0, y_.unlink)(o);
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
      this.spawnLog(wl.join(process.resourcesPath, "elevate.exe"), [r].concat(n)).catch((o) => this.dispatchError(o));
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
        newUrl: new vl.URL(r.path),
        oldFile: wl.join(this.downloadedUpdateHelper.cacheDir, Rn.CURRENT_APP_PACKAGE_FILE_NAME),
        logger: this._logger,
        newFile: n,
        requestHeaders: this.requestHeaders,
        isUseMultipleRangeRequest: i.isUseMultipleRangeRequest,
        cancellationToken: t.cancellationToken
      };
      this.listenerCount(El.DOWNLOAD_PROGRESS) > 0 && (a.onProgress = (o) => this.emit(El.DOWNLOAD_PROGRESS, o)), await new m_.FileWithEmbeddedBlockMapDifferentialDownloader(r, this.httpExecutor, a).download();
    } catch (a) {
      return this._logger.error(`Cannot download differentially, fallback to full download: ${a.stack || a}`), process.platform === "win32";
    }
    return !1;
  }
}
Gr.NsisUpdater = E_;
(function(e) {
  var t = Ie && Ie.__createBinding || (Object.create ? function(S, T, A, F) {
    F === void 0 && (F = A);
    var N = Object.getOwnPropertyDescriptor(T, A);
    (!N || ("get" in N ? !T.__esModule : N.writable || N.configurable)) && (N = { enumerable: !0, get: function() {
      return T[A];
    } }), Object.defineProperty(S, F, N);
  } : function(S, T, A, F) {
    F === void 0 && (F = A), S[F] = T[A];
  }), r = Ie && Ie.__exportStar || function(S, T) {
    for (var A in S) A !== "default" && !Object.prototype.hasOwnProperty.call(T, A) && t(T, S, A);
  };
  Object.defineProperty(e, "__esModule", { value: !0 }), e.NsisUpdater = e.MacUpdater = e.RpmUpdater = e.PacmanUpdater = e.DebUpdater = e.AppImageUpdater = e.Provider = e.NoOpLogger = e.AppUpdater = e.BaseUpdater = void 0;
  const n = Tt, i = se;
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
  var p = Br;
  Object.defineProperty(e, "DebUpdater", { enumerable: !0, get: function() {
    return p.DebUpdater;
  } });
  var c = jr;
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
  let v;
  function w() {
    if (process.platform === "win32")
      v = new Gr.NsisUpdater();
    else if (process.platform === "darwin")
      v = new qr.MacUpdater();
    else {
      v = new Mr.AppImageUpdater();
      try {
        const S = i.join(process.resourcesPath, "package-type");
        if (!(0, n.existsSync)(S))
          return v;
        console.info("Checking for beta autoupdate feature for deb/rpm distributions");
        const T = (0, n.readFileSync)(S).toString().trim();
        switch (console.info("Found package-type:", T), T) {
          case "deb":
            v = new Br.DebUpdater();
            break;
          case "rpm":
            v = new Hr.RpmUpdater();
            break;
          case "pacman":
            v = new jr.PacmanUpdater();
            break;
          default:
            break;
        }
      } catch (S) {
        console.warn("Unable to detect 'package-type' for autoUpdater (beta rpm/deb support). If you'd like to expand support, please consider contributing to electron-builder", S.message);
      }
    }
    return v;
  }
  Object.defineProperty(e, "autoUpdater", {
    enumerable: !0,
    get: () => v || w()
  });
})(xe);
const v_ = "updater:status";
let Kn = { state: ke.isPackaged ? "idle" : "disabled" }, _l = !1, ca = !1;
const Sl = (e) => Array.isArray(e) ? e.map((t) => typeof t == "string" ? t : typeof t == "object" && t !== null ? t.note ?? t.version ?? "" : "").filter(Boolean).join(`
`) : e && typeof e == "object" ? e.note ?? null : e ?? null, __ = (e) => (t) => {
  Kn = t;
  const r = e();
  r && !r.isDestroyed() && r.webContents.send(v_, t);
}, S_ = (e) => (t) => {
  e({
    state: "downloading",
    percent: Math.round(t.percent * 10) / 10,
    transferredBytes: t.transferred,
    totalBytes: t.total,
    version: Kn.version
  });
};
function A_(e) {
  if (_l) return;
  _l = !0;
  const t = __(e);
  if (j.handle("updater:last-status", async () => Kn), !ke.isPackaged) {
    j.handle("updater:check-now", async () => ({ skipped: !0, reason: "dev" })), j.handle("updater:install-now", async () => ({ skipped: !0, reason: "dev" })), t({ state: "disabled" });
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
    if (ca)
      return { skipped: !0 };
    ca = !0;
    try {
      return await xe.autoUpdater.checkForUpdates(), { ok: !0 };
    } catch (s) {
      return t({
        state: "error",
        errorMessage: s instanceof Error ? s.message : typeof s == "string" ? s : "检查更新失败"
      }), { ok: !1 };
    } finally {
      ca = !1;
    }
  };
  xe.autoUpdater.on("checking-for-update", () => {
    t({ state: "checking", version: Kn.version });
  }), xe.autoUpdater.on("update-available", (s) => {
    t({
      state: "available",
      version: s == null ? void 0 : s.version,
      releaseNotes: Sl(s == null ? void 0 : s.releaseNotes)
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
  }), xe.autoUpdater.on("download-progress", S_(t)), xe.autoUpdater.on("update-downloaded", (s) => {
    t({
      state: "downloaded",
      version: s == null ? void 0 : s.version,
      releaseNotes: Sl(s == null ? void 0 : s.releaseNotes)
    });
  }), j.handle("updater:check-now", async () => n()), j.handle("updater:install-now", async () => (setImmediate(() => {
    xe.autoUpdater.quitAndInstall(!0, !0);
  }), { ok: !0 }));
  const i = (s, l) => {
    const p = s ? Number(s) : NaN;
    return Number.isFinite(p) && p > 0 ? p : l;
  }, a = i(process.env.INFINITY_UPDATER_INITIAL_DELAY_MS, 15e3), o = i(process.env.INFINITY_UPDATER_INTERVAL_MS, 6 * 60 * 60 * 1e3);
  setTimeout(() => {
    n(), setInterval(() => {
      n();
    }, o);
  }, a);
}
function xu() {
  return B.join(ke.getPath("userData"), "ai-config.json");
}
async function Ai() {
  try {
    const e = xu(), t = await Q.readFile(e, "utf-8");
    return JSON.parse(t);
  } catch (e) {
    return console.warn("[AI] Config file not found or invalid:", e), null;
  }
}
async function T_(e) {
  try {
    const t = xu();
    await Q.writeFile(t, JSON.stringify(e, null, 2), "utf-8"), console.log("[AI] Config saved:", { provider: e.provider, model: e.model });
  } catch (t) {
    throw console.error("[AI] Failed to save config:", t), new Error("Failed to save AI config");
  }
}
class C_ {
  constructor(t) {
    Gt(this, "config");
    this.config = t;
  }
  /**
   * 测试连接
   */
  async testConnection() {
    try {
      const t = new URL("/v1/models", this.config.baseURL), r = await fetch(t.toString(), {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`
        },
        signal: AbortSignal.timeout(this.config.timeoutMs || 1e4)
      });
      return r.ok ? {
        ok: !0,
        message: `连接成功！当前模型：${this.config.model}`,
        modelInfo: {
          model: this.config.model,
          provider: this.config.provider
        }
      } : r.status === 401 ? {
        ok: !1,
        message: `连接失败：API Key 无效（${r.status} Unauthorized）`
      } : {
        ok: !1,
        message: `连接失败：${r.status} ${r.statusText}`
      };
    } catch (t) {
      return {
        ok: !1,
        message: `连接失败：${t instanceof Error ? t.message : String(t)}`
      };
    }
  }
  /**
   * 发送聊天请求（非流式）
   */
  async chat(t) {
    var n, i, a, o, s;
    const r = [
      ...this.config.systemPrompt ? [{ role: "system", content: this.config.systemPrompt }] : [],
      ...t.messages,
      { role: "user", content: t.message }
    ];
    try {
      const l = new URL("/v1/chat/completions", this.config.baseURL), p = await fetch(l.toString(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey}`
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: r,
          temperature: this.config.temperature ?? 0.7,
          max_tokens: this.config.max_tokens,
          stream: !1
        }),
        signal: AbortSignal.timeout(this.config.timeoutMs || 6e4)
      });
      if (!p.ok)
        throw new Error(`HTTP ${p.status}: ${p.statusText}`);
      const c = await p.json(), f = ((a = (i = (n = c == null ? void 0 : c.choices) == null ? void 0 : n[0]) == null ? void 0 : i.message) == null ? void 0 : a.content) || "";
      if (!f)
        throw new Error("No content in response");
      return {
        content: f,
        finishReason: (s = (o = c == null ? void 0 : c.choices) == null ? void 0 : o[0]) == null ? void 0 : s.finish_reason
      };
    } catch (l) {
      const p = l instanceof Error ? l.message : String(l);
      throw new Error(`Chat failed: ${p}`);
    }
  }
  /**
   * 流式聊天请求
   * 返回异步迭代器，逐段产生内容
   */
  async *chatStream(t) {
    var n, i, a, o;
    const r = [
      ...this.config.systemPrompt ? [{ role: "system", content: this.config.systemPrompt }] : [],
      ...t.messages,
      { role: "user", content: t.message }
    ];
    try {
      const s = new URL("/v1/chat/completions", this.config.baseURL), l = await fetch(s.toString(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey}`
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: r,
          temperature: this.config.temperature ?? 0.7,
          max_tokens: this.config.max_tokens,
          stream: !0
        }),
        signal: AbortSignal.timeout(this.config.timeoutMs || 6e4)
      });
      if (!l.ok)
        throw new Error(`HTTP ${l.status}: ${l.statusText}`);
      if (!l.body)
        throw new Error("No response body");
      const p = l.body.getReader(), c = new TextDecoder();
      let f = "";
      try {
        for (; ; ) {
          const { done: h, value: g } = await p.read();
          if (h) break;
          f += c.decode(g, { stream: !0 });
          const v = f.split(`
`);
          f = v.pop() || "";
          for (const w of v) {
            const S = w.trim();
            if (!(!S || S === ":") && S.startsWith("data: ")) {
              const T = S.slice(6);
              if (T === "[DONE]") continue;
              try {
                const A = JSON.parse(T), N = ((A == null ? void 0 : A.choices) || [])[0], K = (N == null ? void 0 : N.delta) || {}, ne = (K == null ? void 0 : K.content) || "", Y = K == null ? void 0 : K.reasoning_content;
                (ne || Y) && (yield {
                  delta: ne || "",
                  reasoningDelta: Y || void 0,
                  finishReason: N == null ? void 0 : N.finish_reason
                });
              } catch {
                console.warn("[AI] Failed to parse SSE:", S);
              }
            }
          }
        }
        if (f.trim() && f.trim() !== ":" && f.trim().startsWith("data: ")) {
          const h = f.trim().slice(6);
          if (h !== "[DONE]")
            try {
              const g = JSON.parse(h), v = ((i = (n = g == null ? void 0 : g.choices) == null ? void 0 : n[0]) == null ? void 0 : i.delta) || {}, w = (v == null ? void 0 : v.content) || "", S = v == null ? void 0 : v.reasoning_content;
              (w || S) && (yield {
                delta: w || "",
                reasoningDelta: S || void 0,
                finishReason: (o = (a = g == null ? void 0 : g.choices) == null ? void 0 : a[0]) == null ? void 0 : o.finish_reason
              });
            } catch {
              console.warn("[AI] Failed to parse final SSE:", f);
            }
        }
      } finally {
        p.releaseLock();
      }
    } catch (s) {
      const l = s instanceof Error ? s.message : String(s);
      throw new Error(`Stream failed: ${l}`);
    }
  }
}
function ao(e) {
  return new C_(e);
}
const on = B.dirname(Vf(import.meta.url));
process.env.APP_ROOT = B.join(on, "..");
const ot = process.env.VITE_DEV_SERVER_URL, J_ = B.join(process.env.APP_ROOT, "dist-electron"), sn = B.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = ot ? B.join(process.env.APP_ROOT, "public") : sn;
let L, Lu = !1;
const qe = /* @__PURE__ */ new Map(), Qn = /* @__PURE__ */ new Map(), $a = /* @__PURE__ */ new Map(), Al = { width: 130, height: 48 };
let Wr = {
  width: 400,
  height: 400
};
function Uu() {
  return B.join(ke.getPath("userData"), "window-state.json");
}
function $_() {
  try {
    const e = Uu();
    if (kn.existsSync(e)) {
      const t = kn.readFileSync(e, "utf-8");
      return JSON.parse(t);
    }
  } catch (e) {
    console.error("[Window] Failed to load window state:", e);
  }
  return null;
}
function ku() {
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
      const t = Uu();
      kn.writeFileSync(t, JSON.stringify(e), "utf-8");
    } catch (e) {
      console.error("[Window] Failed to save window state:", e);
    }
}
function Mu() {
  const e = $_(), t = {
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
    if (process.platform === "darwin" && !Lu) {
      r.preventDefault(), L == null || L.hide();
      return;
    }
    ku(), L = null;
  }), ot ? L.loadURL(ot) : L.loadFile(B.join(sn, "index.html"));
}
ke.on("window-all-closed", () => {
  process.platform !== "darwin" && (ke.quit(), L = null);
});
ke.on("activate", () => {
  L ? L.show() : zr.getAllWindows().length === 0 && Mu();
});
j.on("window-minimize", () => {
  L && L.minimize();
});
j.on("window-maximize", () => {
  L && (L.isMaximized() ? L.unmaximize() : L.maximize());
});
j.on("window-close", () => {
  L && (process.platform === "darwin" ? L.hide() : L.close());
});
j.handle("window-is-maximized", () => (L == null ? void 0 : L.isMaximized()) ?? !1);
j.on("window-double-click-titlebar", () => {
  L && (L.isMaximized() ? L.unmaximize() : L.maximize());
});
const b_ = ke.requestSingleInstanceLock();
b_ ? ke.on("second-instance", () => {
  L && (L.isMinimized() && L.restore(), L.show(), L.focus());
}) : ke.quit();
ke.on("before-quit", () => {
  Lu = !0, ku();
});
ke.whenReady().then(async () => {
  await ue.initialize(), Mu(), A_(() => L ?? null);
});
j.handle("app:getVersion", () => ke.getVersion());
j.handle("storage:getDefaultPath", () => ue.getDefaultPath());
j.handle("storage:getCurrentPath", () => ue.getCurrentPath());
j.handle("storage:isFirstLaunch", async () => await ue.isFirstLaunch());
j.handle("storage:markInitialized", async () => {
  await ue.markInitialized();
});
j.handle(
  "storage:setStoragePath",
  async (e, t, r) => {
    await ue.setStoragePath(t, r);
  }
);
j.handle("storage:healthCheck", async () => await ue.healthCheck());
j.handle("storage:openInFinder", async () => {
  await ue.openInFinder();
});
j.handle("storage:getStats", async () => await ue.getStats());
j.handle("storage:createBackup", async () => await ue.createBackup());
j.handle("storage:exportData", async (e, t) => {
  await ue.exportData(t);
});
j.handle("storage:resetAllData", async () => {
  await ue.resetAllData();
});
j.handle("storage:listFolders", async () => await ue.listFolders());
j.handle("storage:createFolder", async (e, t) => await ue.createFolder(t));
j.handle("storage:renameFolder", async (e, t, r) => await ue.renameFolder(t, r));
j.handle("storage:deleteFolder", async (e, t) => {
  await ue.deleteFolder(t);
});
j.handle("storage:listNotes", async (e, t) => await ue.listNotes(t));
j.handle("storage:createNote", async (e, t, r) => await ue.createNote(t, r));
j.handle("storage:getNote", async (e, t) => await ue.getNote(t));
j.handle("storage:updateNote", async (e, t, r) => await ue.updateNote(t, r));
j.handle("storage:deleteNote", async (e, t) => {
  await ue.deleteNote(t);
});
j.handle("dialog:showOpenDialog", async (e, t) => await zf.showOpenDialog(t));
j.handle("floating:createWindow", async (e, t) => {
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
j.handle("floating:minimizeWindow", async (e, t) => {
  const r = qe.get(t);
  if (!r || r.isDestroyed())
    return { success: !1, message: "窗口不存在" };
  const n = r.getBounds();
  $a.set(t, n);
  const i = new zr({
    width: Al.width,
    height: Al.height,
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
j.handle("floating:restoreWindow", async (e, t) => {
  const r = Qn.get(t);
  if (!r || r.isDestroyed())
    return { success: !1, message: "药丸窗口不存在" };
  const n = $a.get(t);
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
  }), qe.set(t, i), $a.delete(t), { success: !0 };
});
j.handle("floating:closeWindow", async (e, t) => {
  const r = qe.get(t);
  return r && !r.isDestroyed() ? (r.close(), qe.delete(t), { success: !0 }) : { success: !1, message: "窗口不存在" };
});
j.handle("floating:listWindows", async () => Array.from(qe.keys()).filter((t) => {
  const r = qe.get(t);
  return r && !r.isDestroyed();
}));
j.on("note:changed", (e, t) => {
  const r = Qn.get(t);
  r && !r.isDestroyed() && r.webContents.send("note:updated", t);
  const n = qe.get(t);
  n && !n.isDestroyed() && n.webContents.send("note:updated", t), L && !L.isDestroyed() && L.webContents.send("note:updated", t);
});
j.on("floating-note:changed", (e, t) => {
  L && !L.isDestroyed() && L.webContents.send("floating-note:updated", t);
});
j.handle("config:getDefaultFloatingWindowSize", async () => Wr);
j.handle(
  "config:setDefaultFloatingWindowSize",
  async (e, t) => (t.width && t.height && (Wr = {
    width: t.width,
    height: t.height
  }), Wr)
);
j.handle("ai:getConfig", async () => await Ai());
j.handle("ai:setConfig", async (e, t) => {
  await T_(t);
});
j.handle("ai:testConnection", async () => {
  try {
    const e = await Ai();
    return e ? await ao(e).testConnection() : { ok: !1, message: "未找到 AI 配置，请先设置" };
  } catch (e) {
    return { ok: !1, message: `连接测试失败：${e instanceof Error ? e.message : String(e)}` };
  }
});
j.handle("ai:chat", async (e, t) => {
  try {
    const r = await Ai();
    if (!r)
      throw new Error("未找到 AI 配置，请先在设置中配置 AI");
    return { success: !0, content: (await ao(r).chat(t)).content };
  } catch (r) {
    return { success: !1, error: r instanceof Error ? r.message : String(r) };
  }
});
j.handle("ai:chatStream", async (e, t) => {
  try {
    const r = await Ai();
    if (!r)
      throw new Error("未找到 AI 配置，请先在设置中配置 AI");
    const n = ao(r);
    return (async () => {
      try {
        for await (const i of n.chatStream(t))
          e.sender.send("ai:stream:chunk", i);
        e.sender.send("ai:stream:done", { success: !0 });
      } catch (i) {
        const a = i instanceof Error ? i.message : String(i);
        e.sender.send("ai:stream:error", { error: a });
      }
    })(), { success: !0 };
  } catch (r) {
    return { success: !1, error: r instanceof Error ? r.message : String(r) };
  }
});
export {
  J_ as MAIN_DIST,
  sn as RENDERER_DIST,
  ot as VITE_DEV_SERVER_URL
};
