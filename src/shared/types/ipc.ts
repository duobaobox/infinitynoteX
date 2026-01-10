/**
 * IPC 通道定义
 * Single Source of Truth for IPC Channels
 */

export enum IpcChannels {
  // ============ Window Controls ============
  WINDOW_MINIMIZE = 'window-minimize',
  WINDOW_MAXIMIZE = 'window-maximize',
  WINDOW_UNMAXIMIZE = 'window-unmaximize',
  WINDOW_CLOSE = 'window-close',
  WINDOW_IS_MAXIMIZED = 'window-is-maximized',
  WINDOW_RELOAD = 'window-reload',
  WINDOW_STATE_CHANGED = 'window-state-changed',

  // ============ App ============
  APP_GET_CONFIG = 'app:getConfig',
  APP_SET_CONFIG = 'app:setConfig',
  APP_GET_VERSION = 'app:getVersion',

  // ============ Storage: Notes ============
  NOTE_LIST = 'storage:listNotes',
  NOTE_GET = 'storage:getNote',
  NOTE_CREATE = 'storage:createNote',
  NOTE_UPDATE = 'storage:updateNote',
  NOTE_DELETE = 'storage:deleteNote',

  // ============ AI ============
  AI_CHAT = 'ai:chat',
  AI_CHAT_STREAM = 'ai:chatStream',
  AI_ABORT_STREAM = 'ai:abortStream',

  // ============ Events ============
  NOTE_UPDATED_EVENT = 'note:updated',
  AI_CONFIG_CHANGED_EVENT = 'ai:config-changed',
}

export interface IpcRequest<T> {
  payload: T;
}

export interface IpcResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
