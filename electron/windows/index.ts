/**
 * Windows Module - Barrel Export
 * 窗口管理模块入口
 */

export {
  createMainWindow,
  getMainWindow,
  saveWindowState,
  setQuitting,
  registerMainWindowHandlers,
  VITE_DEV_SERVER_URL,
  MAIN_DIST,
  RENDERER_DIST,
} from './mainWindow';

export {
  createAIChatWindow,
  toggleAIChatWindow,
  getAIChatWindow,
  registerAIChatWindowHandlers,
} from './aiChatWindow';

export {
  registerFloatingWindowHandlers,
  getDefaultFloatingWindowSize,
  setDefaultFloatingWindowSize,
  getFloatingNoteWindows,
  getFloatingTodoWindows,
} from './floatingWindow';
