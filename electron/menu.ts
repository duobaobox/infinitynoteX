/**
 * Application Menu Configuration
 * 应用菜单配置 - 最小化菜单栏
 *
 * macOS: 保留必要的系统菜单（应用名、Edit、Window）
 * Windows/Linux: 隐藏菜单栏
 */

import { app, Menu, shell } from 'electron';

/**
 * 创建 macOS 最小化菜单
 * 只包含必要的系统功能和编辑快捷键
 */
function createMacOSMenu(): Electron.MenuItemConstructorOptions[] {
  const appName = app.getName();

  return [
    // 应用名菜单 - macOS 必须
    {
      label: appName,
      submenu: [
        { role: 'about', label: `关于 ${appName}` },
        { type: 'separator' },
        { role: 'services', label: '服务' },
        { type: 'separator' },
        { role: 'hide', label: `隐藏 ${appName}` },
        { role: 'hideOthers', label: '隐藏其他' },
        { role: 'unhide', label: '显示全部' },
        { type: 'separator' },
        { role: 'quit', label: `退出 ${appName}` },
      ],
    },
    // Edit 菜单 - 必须，否则 Cmd+C/V/Z 等快捷键不工作
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
        { role: 'pasteAndMatchStyle', label: '粘贴并匹配样式' },
        { role: 'delete', label: '删除' },
        { role: 'selectAll', label: '全选' },
        { type: 'separator' },
        {
          label: '语音',
          submenu: [
            { role: 'startSpeaking', label: '开始朗读' },
            { role: 'stopSpeaking', label: '停止朗读' },
          ],
        },
      ],
    },
    // Window 菜单 - 推荐保留，用于窗口控制
    {
      label: '窗口',
      submenu: [
        { role: 'minimize', label: '最小化' },
        { role: 'zoom', label: '缩放' },
        { type: 'separator' },
        { role: 'front', label: '前置全部窗口' },
        { type: 'separator' },
        { role: 'close', label: '关闭窗口' },
      ],
    },
    // View 菜单 - 开发者工具和页面刷新（隐藏 UI 但保留快捷键）
    {
      label: '显示',
      submenu: [
        { role: 'reload', label: '刷新', visible: false },
        { role: 'forceReload', label: '强制刷新', visible: false },
        { role: 'toggleDevTools', label: '切换开发者工具', visible: false },
        { role: 'resetZoom', label: '实际大小' },
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '切换全屏' },
      ],
    },
    // Help 菜单 - 可选，提供帮助链接
    {
      label: '帮助',
      submenu: [
        {
          label: '访问官网',
          click: async () => {
            await shell.openExternal('https://github.com/user/infinitynotex');
          },
        },
      ],
    },
  ];
}

/**
 * 创建 Windows/Linux 隐藏菜单
 * 菜单栏不显示，但保留快捷键功能
 */
function createWindowsLinuxMenu(): Electron.MenuItemConstructorOptions[] {
  return [
    // Edit 菜单 - 必须，否则 Ctrl+C/V/Z 等快捷键不工作
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'delete' },
        { role: 'selectAll' },
      ],
    },
    // View 菜单 - 开发者工具和刷新快捷键
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
  ];
}

/**
 * 设置应用菜单
 * - macOS: 显示最小化菜单
 * - Windows/Linux: 隐藏菜单栏但保留快捷键
 */
export function setupApplicationMenu(): void {
  if (process.platform === 'darwin') {
    // macOS: 设置最小化菜单
    const menu = Menu.buildFromTemplate(createMacOSMenu());
    Menu.setApplicationMenu(menu);
  } else {
    // Windows/Linux: 设置隐藏菜单（保留快捷键）
    // 注意：需要在 BrowserWindow 中设置 autoHideMenuBar: true 来隐藏菜单栏
    const menu = Menu.buildFromTemplate(createWindowsLinuxMenu());
    Menu.setApplicationMenu(menu);
  }
}
