import { ipcMain as n, app as o, BrowserWindow as t } from "electron";
import { fileURLToPath as d } from "node:url";
import e from "node:path";
n.on("window-unmaximize", () => {
  i && i.unmaximize();
});
const a = e.dirname(d(import.meta.url));
process.env.APP_ROOT = e.join(a, "..");
const s = process.env.VITE_DEV_SERVER_URL, w = e.join(process.env.APP_ROOT, "dist-electron"), m = e.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = s ? e.join(process.env.APP_ROOT, "public") : m;
let i;
function r() {
  i = new t({
    width: 700,
    // 默认宽度
    height: 560,
    // 默认高度
    minWidth: 700,
    // 最小宽度
    minHeight: 560,
    // 最小高度
    icon: e.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    frame: !1,
    // 隐藏默认标题栏
    titleBarStyle: "hidden",
    // 隐藏标题栏但保留拖拽区域
    trafficLightPosition: { x: 12, y: 6 },
    // macOS 红绿黄按钮位置（不会显示因为 frame: false）
    webPreferences: {
      preload: e.join(a, "preload.mjs")
    }
  }), i.webContents.on("did-finish-load", () => {
    i == null || i.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  }), s ? i.loadURL(s) : i.loadFile(e.join(m, "index.html"));
}
o.on("window-all-closed", () => {
  process.platform !== "darwin" && (o.quit(), i = null);
});
o.on("activate", () => {
  t.getAllWindows().length === 0 && r();
});
n.on("window-minimize", () => {
  i && i.minimize();
});
n.on("window-maximize", () => {
  i && (i.isMaximized() ? i.unmaximize() : i.maximize());
});
n.on("window-close", () => {
  i && i.close();
});
n.handle("window-is-maximized", () => (i == null ? void 0 : i.isMaximized()) ?? !1);
n.on("window-double-click-titlebar", () => {
  i && (i.isMaximized() ? i.unmaximize() : i.maximize());
});
o.whenReady().then(r);
export {
  w as MAIN_DIST,
  m as RENDERER_DIST,
  s as VITE_DEV_SERVER_URL
};
