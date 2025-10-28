import { ipcMain, app, BrowserWindow } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
ipcMain.on("window-unmaximize", () => {
  if (win) {
    win.unmaximize();
  }
});
const __dirname = path.dirname(fileURLToPath(import.meta.url));
process.env.APP_ROOT = path.join(__dirname, "..");
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
let win;
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
    trafficLightPosition: { x: 12, y: 6 },
    // macOS 红绿黄按钮位置（不会显示因为 frame: false）
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs")
    }
  });
  win.webContents.on("did-finish-load", () => {
    win == null ? void 0 : win.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
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
  if (BrowserWindow.getAllWindows().length === 0) {
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
  if (win) {
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
app.whenReady().then(createWindow);
export {
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};
