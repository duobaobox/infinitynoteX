/**
 * IPC 契约定义（共享）
 * 作为 preload / 渲染层类型声明的单一来源，避免方法名漂移
 */

// ============ Proxy 方法清单 ============

export const IPC_PROXY_METHODS = {
  storage: [
    'getDefaultPath',
    'getCurrentPath',
    'isFirstLaunch',
    'markInitialized',
    'setStoragePath',
    'healthCheck',
    'openInFinder',
    'getStats',
    'createBackup',
    'restoreBackup',
    'exportData',
    'resetAllData',
    'listFolders',
    'createFolder',
    'renameFolder',
    'deleteFolder',
    'listNotes',
    'createNote',
    'getNote',
    'updateNote',
    'deleteNote',
    'getAIConversations',
    'listAIConversationPreviews',
    'getAIConversation',
    'resolveAIConversationBinding',
    'createAIConversation',
    'deleteAIConversation',
    'saveAIConversationMessages',
    'updateAIConversationTitle',
    'listTrash',
    'getTrashItem',
    'restoreNote',
    'deleteTrashItemPermanently',
    'emptyTrash',
    'listTodoLists',
    'createTodoList',
    'updateTodoList',
    'deleteTodoList',
    'listManualTasks',
    'createManualTask',
    'updateManualTask',
    'deleteManualTask',
    'toggleManualTask',
  ],
  browserCards: ['list', 'create', 'update', 'delete', 'reorder'],
  attachments: ['save', 'getPath', 'delete', 'list', 'cleanup'],
  sync: [
    'testConnection',
    'execute',
    'getLastResult',
    'preview',
    'getConfig',
    'setConfig',
    'openLogDir',
  ],
  ai: [
    'getConfig',
    'setConfig',
    'testConnection',
    'chat',
    'chatStream',
    'abortStream',
    'respondToolApproval',
  ],
  knowledge: [
    'getConfig',
    'setConfig',
    'testEmbedding',
    'rebuildIndex',
    'getStats',
    'search',
    'getChunks',
    'getNoteIndexList',
    'testSearch',
    'incrementalUpdate',
    'reindexNote',
    'deleteNoteIndex',
    'runDiagnostics',
    'repairIndex',
    'getIndexingConfig',
    'setIndexingConfig',
    'resetIndexingConfig',
    'getDefaultIndexingConfig',
  ],
  config: [
    'getShortcutKeys',
    'setShortcutKeys',
    'getDefaultFloatingWindowSize',
    'setDefaultFloatingWindowSize',
  ],
  log: ['openDir', 'getPath', 'readRecent', 'readByLevel', 'search', 'cleanOld', 'getStats'],
  floating: ['createWindow', 'minimizeWindow', 'restoreWindow', 'closeWindow', 'listWindows'],
  floatingTodo: ['createWindow', 'closeWindow', 'minimizeWindow', 'restoreWindow', 'listWindows'],
  app: ['getConfig', 'setConfig', 'getConfigPath'],
} as const;

export type IpcProxyNamespace = keyof typeof IPC_PROXY_METHODS;
export type IpcProxyMethod<T extends IpcProxyNamespace> = (typeof IPC_PROXY_METHODS)[T][number];

/**
 * 构造 Proxy 通道名，保持主/渲染进程使用一致
 */
export function getIpcProxyChannel<T extends IpcProxyNamespace>(
  namespace: T,
  method: IpcProxyMethod<T>,
): `${T}:${IpcProxyMethod<T>}` {
  return `${namespace}:${method}` as `${T}:${IpcProxyMethod<T>}`;
}

// ============ 非 Proxy 通道 ============

export const IPC_CHANNELS = {
  mainProcessMessage: 'main-process-message',
  windowMinimize: 'window-minimize',
  windowMaximize: 'window-maximize',
  windowUnmaximize: 'window-unmaximize',
  windowClose: 'window-close',
  windowDoubleClickTitlebar: 'window-double-click-titlebar',
  windowIsMaximized: 'window-is-maximized',
  windowReload: 'window-reload',
  windowStateChanged: 'window-state-changed',
  dialogShowOpen: 'dialog:showOpenDialog',
  aiChatWindowShow: 'ai-chat-window:show',
  aiChatWindowHide: 'ai-chat-window:hide',
  aiChatWindowToggle: 'ai-chat-window:toggle',
  storageEvent: 'storage:event',
  aiStreamChunk: 'ai:stream:chunk',
  aiStreamDone: 'ai:stream:done',
  aiStreamError: 'ai:stream:error',
  aiToolApprovalRequested: 'ai:tool-approval-requested',
  aiToolProgress: 'ai:tool-progress',
  aiRunUpdate: 'ai:run-update',
  aiApprovalStateChanged: 'ai:approval-state-changed',
  updaterCheckNow: 'updater:check-now',
  updaterInstallNow: 'updater:install-now',
  updaterLastStatus: 'updater:last-status',
  updaterStatus: 'updater:status',
  appGetVersion: 'app:getVersion',
  appConfigChanged: 'app:configChanged',
  syncProgress: 'sync:progress',
  syncCompleted: 'sync:completed',
  syncDataChanged: 'sync:dataChanged',
  logRenderer: 'log:renderer',
  noteChanged: 'note:changed',
  todoChanged: 'todo:changed',
  noteUpdated: 'note:updated',
  todoUpdated: 'todo:updated',
  floatingNoteChanged: 'floating-note:changed',
  floatingNoteUpdated: 'floating-note:updated',
  navigateNote: 'navigate:note',
} as const;

// ============ Renderer 事件载荷 ============

export interface NavigateNotePayload {
  folderId: string;
  noteId: string;
  taskPath?: number[];
}

export interface NoteSyncPayload {
  noteId: string;
  sourceId: string;
  revision: number;
  taskChanged: boolean;
}

export type RendererIpcEventPayloadMap = {
  [IPC_CHANNELS.mainProcessMessage]: [message: string];
  [IPC_CHANNELS.noteChanged]: [payload: NoteSyncPayload];
  [IPC_CHANNELS.todoChanged]: [listId: string];
  [IPC_CHANNELS.noteUpdated]: [payload: NoteSyncPayload];
  [IPC_CHANNELS.todoUpdated]: [listId: string];
  [IPC_CHANNELS.floatingNoteChanged]: [noteId: string];
  [IPC_CHANNELS.floatingNoteUpdated]: [noteId: string];
  [IPC_CHANNELS.navigateNote]: [payload: NavigateNotePayload];
};

export type RendererIpcEventChannel = keyof RendererIpcEventPayloadMap;
