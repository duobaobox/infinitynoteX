import { ipcRenderer, contextBridge } from 'electron';
import type {
  OpenDialogOptions,
  SetStoragePathOptions,
  CreateNotePayload,
  UpdateNotePayload,
  UpdateStatusPayload,
} from '../src/services/types';
import type { AIConfig, ChatPayload } from '../src/services/aiConfig';

type AIConversationMessage = {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
};

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('ipcRenderer', {
  on(...args: Parameters<typeof ipcRenderer.on>) {
    const [channel, listener] = args;
    return ipcRenderer.on(channel, (event, ...args) => listener(event, ...args));
  },
  off(...args: Parameters<typeof ipcRenderer.off>) {
    const [channel, ...omit] = args;
    return ipcRenderer.off(channel, ...omit);
  },
  send(...args: Parameters<typeof ipcRenderer.send>) {
    const [channel, ...omit] = args;
    return ipcRenderer.send(channel, ...omit);
  },
  invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
    const [channel, ...omit] = args;
    return ipcRenderer.invoke(channel, ...omit);
  },

  // You can expose other APTs you need here.
  // ...
});

// --------- Expose window control API ---------
contextBridge.exposeInMainWorld('electronAPI', {
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  unmaximize: () => ipcRenderer.send('window-unmaximize'),
  close: () => ipcRenderer.send('window-close'),
  isMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  reload: () => ipcRenderer.invoke('window-reload'),
  onWindowStateChanged: (callback: (isMaximized: boolean) => void) => {
    ipcRenderer.on('window-state-changed', (_event, isMaximized: boolean) => {
      callback(isMaximized);
    });
  },
  showOpenDialog: (options: OpenDialogOptions) =>
    ipcRenderer.invoke('dialog:showOpenDialog', options),
});

// --------- Expose storage API ---------
contextBridge.exposeInMainWorld('storage', {
  // 路径管理
  getDefaultPath: () => ipcRenderer.invoke('storage:getDefaultPath'),
  getCurrentPath: () => ipcRenderer.invoke('storage:getCurrentPath'),
  isFirstLaunch: () => ipcRenderer.invoke('storage:isFirstLaunch'),
  markInitialized: () => ipcRenderer.invoke('storage:markInitialized'),
  setStoragePath: (nextPath: string, options?: SetStoragePathOptions) =>
    ipcRenderer.invoke('storage:setStoragePath', nextPath, options),
  healthCheck: () => ipcRenderer.invoke('storage:healthCheck'),
  openInFinder: () => ipcRenderer.invoke('storage:openInFinder'),
  getStats: () => ipcRenderer.invoke('storage:getStats'),
  createBackup: () => ipcRenderer.invoke('storage:createBackup'),
  restoreBackup: (backupFilePath: string) =>
    ipcRenderer.invoke('storage:restoreBackup', backupFilePath),
  exportData: (targetPath: string) => ipcRenderer.invoke('storage:exportData', targetPath),
  resetAllData: () => ipcRenderer.invoke('storage:resetAllData'),

  // 文件夹操作
  listFolders: () => ipcRenderer.invoke('storage:listFolders'),
  createFolder: (name: string) => ipcRenderer.invoke('storage:createFolder', name),
  renameFolder: (id: string, name: string) => ipcRenderer.invoke('storage:renameFolder', id, name),
  deleteFolder: (id: string) => ipcRenderer.invoke('storage:deleteFolder', id),

  // 便签操作
  listNotes: (folderId?: string) => ipcRenderer.invoke('storage:listNotes', folderId),
  createNote: (folderId: string, payload?: CreateNotePayload) =>
    ipcRenderer.invoke('storage:createNote', folderId, payload),
  getNote: (id: string) => ipcRenderer.invoke('storage:getNote', id),
  updateNote: (id: string, patch: UpdateNotePayload) =>
    ipcRenderer.invoke('storage:updateNote', id, patch),
  deleteNote: (id: string) => ipcRenderer.invoke('storage:deleteNote', id),

  // AI 对话操作
  getAIConversations: () => ipcRenderer.invoke('storage:getAIConversations'),
  createAIConversation: (title?: string) =>
    ipcRenderer.invoke('storage:createAIConversation', title),
  deleteAIConversation: (id: string) => ipcRenderer.invoke('storage:deleteAIConversation', id),
  saveAIConversationMessages: (id: string, messages: AIConversationMessage[]) =>
    ipcRenderer.invoke('storage:saveAIConversationMessages', id, messages),
  updateAIConversationTitle: (id: string, title: string) =>
    ipcRenderer.invoke('storage:updateAIConversationTitle', id, title),

  // 回收站操作
  listTrash: () => ipcRenderer.invoke('storage:listTrash'),
  getTrashItem: (id: string) => ipcRenderer.invoke('storage:getTrashItem', id),
  restoreNote: (trashItemId: string, targetFolderId?: string) =>
    ipcRenderer.invoke('storage:restoreNote', trashItemId, targetFolderId),
  deleteTrashItemPermanently: (id: string) =>
    ipcRenderer.invoke('storage:deleteTrashItemPermanently', id),
  emptyTrash: () => ipcRenderer.invoke('storage:emptyTrash'),

  // Todo 清单操作
  listTodoLists: () => ipcRenderer.invoke('storage:listTodoLists'),
  createTodoList: (name: string, color?: string) =>
    ipcRenderer.invoke('storage:createTodoList', name, color),
  updateTodoList: (id: string, patch: { name?: string; color?: string; order?: number }) =>
    ipcRenderer.invoke('storage:updateTodoList', id, patch),
  deleteTodoList: (id: string) => ipcRenderer.invoke('storage:deleteTodoList', id),

  // 手动任务操作
  listManualTasks: (listId?: string) => ipcRenderer.invoke('storage:listManualTasks', listId),
  createManualTask: (listId: string, text: string, dueDate?: number) =>
    ipcRenderer.invoke('storage:createManualTask', listId, text, dueDate),
  updateManualTask: (
    id: string,
    listId: string,
    patch: { text?: string; checked?: boolean; order?: number; dueDate?: number },
  ) => ipcRenderer.invoke('storage:updateManualTask', id, listId, patch),
  deleteManualTask: (id: string, listId: string) =>
    ipcRenderer.invoke('storage:deleteManualTask', id, listId),
  toggleManualTask: (id: string, listId: string) =>
    ipcRenderer.invoke('storage:toggleManualTask', id, listId),
});

// --------- Expose storage events API ---------
contextBridge.exposeInMainWorld('storageEvents', {
  /**
   * 监听存储事件（创建、更新、删除）
   * @returns 取消监听的函数
   */
  onEvent: (
    callback: (event: {
      type: 'created' | 'updated' | 'deleted';
      entity: 'note' | 'aiConversation' | 'folder' | 'trash';
      id: string;
      data?: unknown;
    }) => void,
  ) => {
    const listener = (
      _: Electron.IpcRendererEvent,
      event: {
        type: 'created' | 'updated' | 'deleted';
        entity: 'note' | 'aiConversation' | 'folder' | 'trash';
        id: string;
        data?: unknown;
      },
    ) => callback(event);
    ipcRenderer.on('storage:event', listener);
    return () => {
      ipcRenderer.removeListener('storage:event', listener);
    };
  },
});

// --------- Expose floating window API ---------
contextBridge.exposeInMainWorld('floatingWindow', {
  createWindow: (noteId: string) => ipcRenderer.invoke('floating:createWindow', noteId),
  closeWindow: (noteId: string) => ipcRenderer.invoke('floating:closeWindow', noteId),
  listWindows: () => ipcRenderer.invoke('floating:listWindows'),
  minimizeWindow: (noteId: string) => ipcRenderer.invoke('floating:minimizeWindow', noteId),
  restoreWindow: (noteId: string) => ipcRenderer.invoke('floating:restoreWindow', noteId),
});

// --------- Expose floating todo window API ---------
contextBridge.exposeInMainWorld('floatingTodo', {
  createWindow: (listId: string) => ipcRenderer.invoke('floatingTodo:createWindow', listId),
  closeWindow: (listId: string) => ipcRenderer.invoke('floatingTodo:closeWindow', listId),
  listWindows: () => ipcRenderer.invoke('floatingTodo:listWindows'),
  minimizeWindow: (listId: string) => ipcRenderer.invoke('floatingTodo:minimizeWindow', listId),
  restoreWindow: (listId: string) => ipcRenderer.invoke('floatingTodo:restoreWindow', listId),
});

// --------- Expose auto-updater API ---------
contextBridge.exposeInMainWorld('autoUpdater', {
  checkForUpdates: () => ipcRenderer.invoke('updater:check-now'),
  installUpdate: () => ipcRenderer.invoke('updater:install-now'),
  getLastStatus: () => ipcRenderer.invoke('updater:last-status') as Promise<UpdateStatusPayload>,
  onStatusChange: (callback: (status: UpdateStatusPayload) => void) => {
    const listener = (_event: unknown, status: UpdateStatusPayload) => {
      callback(status);
    };
    ipcRenderer.on('updater:status', listener);
    return () => ipcRenderer.removeListener('updater:status', listener);
  },
});

// --------- Expose app info API ---------
contextBridge.exposeInMainWorld('appInfo', {
  getVersion: () => ipcRenderer.invoke('app:getVersion') as Promise<string>,
});

// --------- Expose Browser Cards API ---------
contextBridge.exposeInMainWorld('browserCards', {
  /**
   * 获取所有浏览器卡片
   */
  list: () =>
    ipcRenderer.invoke('browserCards:list') as Promise<
      Array<{
        id: string;
        name: string;
        url: string;
        icon?: string;
        isBuiltIn?: boolean;
        order: number;
        createdAt: number;
        updatedAt: number;
      }>
    >,

  /**
   * 创建浏览器卡片
   */
  create: (card: { name: string; url: string; icon?: string }) =>
    ipcRenderer.invoke('browserCards:create', card),

  /**
   * 更新浏览器卡片
   */
  update: (id: string, patch: { name?: string; url?: string; icon?: string }) =>
    ipcRenderer.invoke('browserCards:update', id, patch),

  /**
   * 删除浏览器卡片
   */
  delete: (id: string) => ipcRenderer.invoke('browserCards:delete', id),

  /**
   * 重新排序浏览器卡片
   */
  reorder: (orderedIds: string[]) => ipcRenderer.invoke('browserCards:reorder', orderedIds),
});

// --------- Expose Attachments API ---------
contextBridge.exposeInMainWorld('attachments', {
  /**
   * 保存附件（从 Base64 Data URL）
   * @param dataUrl 形如 data:image/png;base64,xxxxx 的字符串
   * @returns 附件 ID（用于构建 attachment://xxx URL）
   */
  save: (dataUrl: string) =>
    ipcRenderer.invoke('attachments:save', dataUrl) as Promise<{
      success: boolean;
      id?: string;
      error?: string;
    }>,

  /**
   * 获取附件的完整文件路径
   */
  getPath: (id: string) => ipcRenderer.invoke('attachments:getPath', id) as Promise<string | null>,

  /**
   * 删除附件
   */
  delete: (id: string) =>
    ipcRenderer.invoke('attachments:delete', id) as Promise<{
      success: boolean;
      error?: string;
    }>,

  /**
   * 列出所有附件
   */
  list: () =>
    ipcRenderer.invoke('attachments:list') as Promise<
      Array<{
        id: string;
        filename: string;
        size: number;
        createdAt: number;
      }>
    >,

  /**
   * 清理未被引用的附件（垃圾回收）
   */
  cleanup: () =>
    ipcRenderer.invoke('attachments:cleanup') as Promise<{
      deleted: number;
      freedBytes: number;
      errors: string[];
    }>,
});

// --------- Expose AI API ---------
contextBridge.exposeInMainWorld('ai', {
  getConfig: () => ipcRenderer.invoke('ai:getConfig') as Promise<AIConfig | null>,
  setConfig: (config: AIConfig) => ipcRenderer.invoke('ai:setConfig', config) as Promise<void>,
  testConnection: () =>
    ipcRenderer.invoke('ai:testConnection') as Promise<{ ok: boolean; message: string }>,
  chat: (payload: ChatPayload) =>
    ipcRenderer.invoke('ai:chat', payload) as Promise<{
      success: boolean;
      content?: string;
      error?: string;
    }>,
  chatStream: (payload: ChatPayload) =>
    ipcRenderer.invoke('ai:chatStream', payload) as Promise<{ success: boolean; error?: string }>,
  abortStream: () =>
    ipcRenderer.invoke('ai:abortStream') as Promise<{ success: boolean; error?: string }>,
  onStreamChunk: (
    callback: (data: { delta: string; reasoningDelta?: string; finishReason?: string }) => void,
  ) => {
    const listener = (
      _event: unknown,
      data: { delta: string; reasoningDelta?: string; finishReason?: string },
    ) => callback(data);
    ipcRenderer.on('ai:stream:chunk', listener);
    return () => ipcRenderer.removeListener('ai:stream:chunk', listener);
  },
  onStreamDone: (callback: (data: { success: boolean }) => void) => {
    const listener = (_event: unknown, data: { success: boolean }) => callback(data);
    ipcRenderer.on('ai:stream:done', listener);
    return () => ipcRenderer.removeListener('ai:stream:done', listener);
  },
  onStreamError: (callback: (data: { error: string }) => void) => {
    const listener = (_event: unknown, data: { error: string }) => callback(data);
    ipcRenderer.on('ai:stream:error', listener);
    return () => ipcRenderer.removeListener('ai:stream:error', listener);
  },
});

// --------- Expose Sync API ---------
contextBridge.exposeInMainWorld('sync', {
  testConnection: (providerId: string, config: unknown) =>
    ipcRenderer.invoke('sync:testConnection', providerId, config) as Promise<{
      ok: boolean;
      message: string;
    }>,
  execute: (providerId: string, config: unknown) =>
    ipcRenderer.invoke('sync:execute', providerId, config) as Promise<unknown>,
  preview: (providerId: string, config: unknown) =>
    ipcRenderer.invoke('sync:preview', providerId, config) as Promise<{
      toUpload: string[];
      toDownload: string[];
      toDeleteRemote: string[];
      toDeleteLocal: string[];
      conflicts: string[];
      unchanged: number;
    }>,
  getConfig: (providerId: string) => ipcRenderer.invoke('sync:getConfig', providerId),
  setConfig: (providerId: string, config: unknown) =>
    ipcRenderer.invoke('sync:setConfig', providerId, config),
  openLogDir: () => ipcRenderer.invoke('sync:openLogDir'),
  getLastResult: () => ipcRenderer.invoke('sync:getLastResult'),
  // 进度回调
  onProgress: (callback: (progress: unknown) => void) => {
    const listener = (_event: unknown, progress: unknown) => callback(progress);
    ipcRenderer.on('sync:progress', listener);
    return () => ipcRenderer.removeListener('sync:progress', listener);
  },
  // 同步完成回调
  onCompleted: (callback: (result: unknown) => void) => {
    const listener = (_event: unknown, result: unknown) => callback(result);
    ipcRenderer.on('sync:completed', listener);
    return () => ipcRenderer.removeListener('sync:completed', listener);
  },
  // 数据变化通知（同步后需要刷新）
  onDataChanged: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('sync:dataChanged', listener);
    return () => ipcRenderer.removeListener('sync:dataChanged', listener);
  },
});

// --------- Expose Unified App Config API ---------
contextBridge.exposeInMainWorld('app', {
  getConfig: () => ipcRenderer.invoke('app:getConfig'),
  setConfig: (partial: unknown) => ipcRenderer.invoke('app:setConfig', partial),
  getConfigPath: () => ipcRenderer.invoke('app:getConfigPath') as Promise<string>,
  onConfigChanged: (callback: (config: unknown) => void) => {
    const listener = (_event: unknown, config: unknown) => callback(config);
    ipcRenderer.on('app:configChanged', listener);
    return () => ipcRenderer.removeListener('app:configChanged', listener);
  },
});

// --------- Expose Log API ---------
contextBridge.exposeInMainWorld('log', {
  openDir: () => ipcRenderer.invoke('log:openDir'),
  getPath: () => ipcRenderer.invoke('log:getPath') as Promise<string>,
  readRecent: (lines?: number) => ipcRenderer.invoke('log:readRecent', lines) as Promise<string>,
  readByLevel: (level: 'error' | 'warn' | 'info' | 'debug' | 'all', lines?: number) =>
    ipcRenderer.invoke('log:readByLevel', level, lines) as Promise<string>,
  search: (keyword: string, lines?: number) =>
    ipcRenderer.invoke('log:search', keyword, lines) as Promise<string>,
  cleanOld: () => ipcRenderer.invoke('log:cleanOld') as Promise<number>,
  getStats: () =>
    ipcRenderer.invoke('log:getStats') as Promise<{
      totalSize: number;
      fileCount: number;
      oldestFile?: string;
      newestFile?: string;
    }>,
  // 渲染进程日志上报
  error: (...args: unknown[]) => ipcRenderer.send('log:renderer', 'error', ...args),
  warn: (...args: unknown[]) => ipcRenderer.send('log:renderer', 'warn', ...args),
  info: (...args: unknown[]) => ipcRenderer.send('log:renderer', 'info', ...args),
  debug: (...args: unknown[]) => ipcRenderer.send('log:renderer', 'debug', ...args),
});

// --------- Expose Knowledge Base API ---------
contextBridge.exposeInMainWorld('knowledge', {
  // 配置管理
  getConfig: () =>
    ipcRenderer.invoke('knowledge:getConfig') as Promise<{
      enabled: boolean;
      embedding?: {
        providerId?: string;
        provider: string;
        baseURL: string;
        apiKey?: string;
        model: string;
        dimensions?: number;
      };
    } | null>,
  setConfig: (config: {
    enabled: boolean;
    embedding?: {
      providerId?: string;
      provider: string;
      baseURL: string;
      apiKey?: string;
      model: string;
      dimensions?: number;
    };
  }) => ipcRenderer.invoke('knowledge:setConfig', config) as Promise<void>,

  // Embedding 测试
  testEmbedding: (config: {
    baseURL: string;
    apiKey: string;
    model: string;
    dimensions?: number;
  }) =>
    ipcRenderer.invoke('knowledge:testEmbedding', config) as Promise<{
      ok: boolean;
      message: string;
    }>,

  // 索引管理
  rebuildIndex: () =>
    ipcRenderer.invoke('knowledge:rebuildIndex') as Promise<{
      success: boolean;
      indexedNotes: number;
      totalVectors: number;
      error?: string;
    }>,

  getStats: () =>
    ipcRenderer.invoke('knowledge:getStats') as Promise<{
      enabled: boolean;
      indexedNotes: number;
      totalVectors: number;
      lastIndexedAt?: number;
    }>,

  // 语义搜索
  search: (query: string, topK?: number) =>
    ipcRenderer.invoke('knowledge:search', query, topK) as Promise<
      Array<{
        noteId: string;
        noteTitle: string;
        excerpt: string;
        score: number;
      }>
    >,

  // 获取数据块列表
  getChunks: (options?: { noteId?: string; offset?: number; limit?: number }) =>
    ipcRenderer.invoke('knowledge:getChunks', options ?? {}) as Promise<{
      chunks: Array<{
        id: string;
        noteId: string;
        noteTitle: string;
        chunkIndex: number;
        content: string;
        dimension: number;
        createdAt: number;
      }>;
      total: number;
    }>,

  // 获取笔记索引列表
  getNoteIndexList: () =>
    ipcRenderer.invoke('knowledge:getNoteIndexList') as Promise<
      Array<{
        noteId: string;
        noteTitle: string;
        chunkCount: number;
        status: 'indexed' | 'pending' | 'failed';
        lastIndexedAt?: number;
      }>
    >,

  // 语义搜索测试
  testSearch: (query: string, options?: { topK?: number; minScore?: number }) =>
    ipcRenderer.invoke('knowledge:testSearch', query, options) as Promise<
      Array<{
        noteId: string;
        noteTitle: string;
        excerpt: string;
        score: number;
      }>
    >,

  // 增量更新
  incrementalUpdate: () =>
    ipcRenderer.invoke('knowledge:incrementalUpdate') as Promise<{
      success: boolean;
      updated: number;
      added: number;
      removed: number;
      totalVectors: number;
      error?: string;
    }>,

  // 重新索引单个笔记
  reindexNote: (noteId: string) =>
    ipcRenderer.invoke('knowledge:reindexNote', noteId) as Promise<{
      success: boolean;
      vectorCount: number;
      error?: string;
    }>,

  // 删除笔记索引
  deleteNoteIndex: (noteId: string) =>
    ipcRenderer.invoke('knowledge:deleteNoteIndex', noteId) as Promise<{
      success: boolean;
      deleted: number;
    }>,

  // ============ 专家功能 API ============

  // 运行系统诊断
  runDiagnostics: () =>
    ipcRenderer.invoke('knowledge:runDiagnostics') as Promise<{
      database: {
        path: string;
        sizeBytes: number;
        journalMode: string;
        integrity: 'ok' | 'error';
        integrityMessage?: string;
      };
      vectorStore: {
        dimension: number;
        totalVectors: number;
        uniqueNotes: number;
        tableExists: boolean;
      };
      indexConsistency: {
        orphanedVectors: number;
        missingIndexNotes: number;
        inconsistentNotes: string[];
      };
      embeddingConfig: {
        configured: boolean;
        provider?: string;
        model?: string;
        lastTestResult?: 'success' | 'failed' | 'unknown';
      };
    }>,

  // 修复索引不一致问题
  repairIndex: () =>
    ipcRenderer.invoke('knowledge:repairIndex') as Promise<{
      success: boolean;
      orphanedCleaned: number;
      missingIndexed: number;
      error?: string;
    }>,

  // 获取索引配置
  getIndexingConfig: () =>
    ipcRenderer.invoke('knowledge:getIndexingConfig') as Promise<{
      chunkSize: number;
      chunkOverlap: number;
      batchSize: number;
      batchDelayMs: number;
      rateLimitRetryMs: number;
    }>,

  // 设置索引配置
  setIndexingConfig: (config: {
    chunkSize?: number;
    chunkOverlap?: number;
    batchSize?: number;
    batchDelayMs?: number;
    rateLimitRetryMs?: number;
  }) =>
    ipcRenderer.invoke('knowledge:setIndexingConfig', config) as Promise<{
      success: boolean;
    }>,

  // 重置索引配置为默认值
  resetIndexingConfig: () =>
    ipcRenderer.invoke('knowledge:resetIndexingConfig') as Promise<{
      success: boolean;
    }>,

  // 获取默认索引配置
  getDefaultIndexingConfig: () =>
    ipcRenderer.invoke('knowledge:getDefaultIndexingConfig') as Promise<{
      chunkSize: number;
      chunkOverlap: number;
      batchSize: number;
      batchDelayMs: number;
      rateLimitRetryMs: number;
    }>,
});
