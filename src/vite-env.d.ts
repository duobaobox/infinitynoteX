/// <reference types="vite/client" />

import type {
  Folder,
  Note,
  NoteIndex,
  TrashIndex,
  TrashItem,
  HealthCheckResult,
  StorageStats,
  CreateNotePayload,
  SetStoragePathOptions,
  UpdateStatusPayload,
  OpenDialogOptions,
} from './services/types';

// ============ 统一配置类型定义 ============

interface WindowConfig {
  width: number;
  height: number;
  x?: number;
  y?: number;
  isMaximized: boolean;
}

interface ThemeConfig {
  colorPrimary: string;
  mode: 'light' | 'dark' | 'auto';
  bgLight: string;
  bgDark: string;
}

interface AIProviderConfig {
  provider: string;
  baseURL: string;
  apiKey: string;
  model: string;
  temperature?: number;
  max_tokens?: number;
  timeoutMs?: number;
  systemPrompt?: string;
}

interface AIAppConfig {
  activeProviderId: string;
  providers: Record<string, AIProviderConfig>;
  /** 前端使用的完整 provider 配置缓存 */
  providerConfigs?: Record<string, any>;
}

interface WebDAVProviderConfig {
  url: string;
  username: string;
  password: string;
  remotePath: string;
  conflictStrategy: 'newest' | 'local' | 'remote';
}

interface SyncAppConfig {
  enabled: boolean;
  activeProvider: string;
  providers: {
    webdav?: WebDAVProviderConfig;
    [key: string]: any;
  };
}

interface StorageAppConfig {
  dataPath: string | null;
}

interface AppConfig {
  schemaVersion: number;
  storage: StorageAppConfig;
  window: WindowConfig;
  theme: ThemeConfig;
  ai: AIAppConfig;
  sync: SyncAppConfig;
  features: Record<string, unknown>;
  plugins: Record<string, unknown>;
}

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

declare global {
  interface Window {
    electronAPI?: {
      minimize(): void;
      maximize(): void;
      unmaximize(): void;
      close(): void;
      isMaximized(): Promise<boolean>;
      onWindowStateChanged(callback: (isMaximized: boolean) => void): void;
      showOpenDialog(
        options: OpenDialogOptions,
      ): Promise<{ canceled: boolean; filePaths: string[] }>;
    };
    storage: {
      // 路径管理
      getDefaultPath(): Promise<string>;
      getCurrentPath(): Promise<string>;
      isFirstLaunch(): Promise<boolean>;
      markInitialized(): Promise<void>;
      setStoragePath(nextPath: string, options?: SetStoragePathOptions): Promise<void>;
      healthCheck(): Promise<HealthCheckResult>;
      openInFinder(): Promise<void>;
      getStats(): Promise<StorageStats>;
      createBackup(): Promise<string>;
      exportData(targetPath: string): Promise<void>;
      resetAllData(): Promise<void>;

      // 文件夹操作
      listFolders(): Promise<Folder[]>;
      createFolder(name: string): Promise<Folder>;
      renameFolder(id: string, name: string): Promise<Folder>;
      deleteFolder(id: string): Promise<void>;

      // 便签操作
      listNotes(folderId?: string): Promise<NoteIndex[]>;
      createNote(folderId: string, payload?: CreateNotePayload): Promise<Note>;
      getNote(id: string): Promise<Note>;
      updateNote(id: string, patch: Partial<Note>): Promise<Note>;
      deleteNote(id: string): Promise<void>;

      // 回收站操作
      listTrash(): Promise<TrashIndex[]>;
      getTrashItem(id: string): Promise<TrashItem>;
      restoreNote(trashItemId: string, targetFolderId?: string): Promise<Note>;
      deleteTrashItemPermanently(id: string): Promise<void>;
      emptyTrash(): Promise<number>;

      // AI 对话操作
      getAIConversations(): Promise<
        Array<{
          id: string;
          title: string;
          excerpt: string;
          messages: Array<{
            id?: string;
            role: 'user' | 'assistant';
            content: string;
            timestamp: number;
            reasoning?: string;
          }>;
          createdAt: number;
          updatedAt: number;
        }>
      >;
      createAIConversation(title?: string): Promise<{
        id: string;
        title: string;
        excerpt: string;
        messages: Array<{
          id?: string;
          role: 'user' | 'assistant';
          content: string;
          timestamp: number;
          reasoning?: string;
        }>;
        createdAt: number;
        updatedAt: number;
      }>;
      deleteAIConversation(id: string): Promise<void>;
      saveAIConversationMessages(
        id: string,
        messages: Array<{
          role: 'user' | 'assistant';
          content: string;
          timestamp: number;
          reasoning?: string;
        }>,
      ): Promise<{
        id: string;
        title: string;
        excerpt: string;
        messages: Array<{
          id?: string;
          role: 'user' | 'assistant';
          content: string;
          timestamp: number;
          reasoning?: string;
        }>;
        createdAt: number;
        updatedAt: number;
      }>;
      updateAIConversationTitle(
        id: string,
        title: string,
      ): Promise<{
        id: string;
        title: string;
        excerpt: string;
        messages: Array<{
          id?: string;
          role: 'user' | 'assistant';
          content: string;
          timestamp: number;
          reasoning?: string;
        }>;
        createdAt: number;
        updatedAt: number;
      }>;
    };
    floatingWindow: {
      // 悬浮窗口操作
      createWindow(noteId: string): Promise<{ success: boolean; message?: string }>;
      closeWindow(noteId: string): Promise<{ success: boolean; message?: string }>;
      listWindows(): Promise<string[]>;
      minimizeWindow(noteId: string): Promise<{ success: boolean; message?: string }>;
      restoreWindow(noteId: string): Promise<{ success: boolean; message?: string }>;
    };
    autoUpdater?: {
      checkForUpdates(): Promise<unknown>;
      installUpdate(): Promise<unknown>;
      getLastStatus(): Promise<UpdateStatusPayload>;
      onStatusChange(callback: (status: UpdateStatusPayload) => void): () => void;
    };
    storageEvents?: {
      /**
       * 监听存储事件
       * @returns 取消监听的函数
       */
      onEvent(
        callback: (event: {
          type: 'created' | 'updated' | 'deleted';
          entity: 'note' | 'aiConversation' | 'folder' | 'trash';
          id: string;
          data?: unknown;
        }) => void,
      ): () => void;
    };
    appInfo?: {
      getVersion(): Promise<string>;
    };
    sync: {
      testConnection(providerId: string, config: any): Promise<{ ok: boolean; message: string }>;
      execute(providerId: string, config: any): Promise<any>;
      preview(
        providerId: string,
        config: any,
      ): Promise<{
        toUpload: string[];
        toDownload: string[];
        toDeleteRemote: string[];
        toDeleteLocal: string[];
        conflicts: string[];
        unchanged: number;
      }>;
      getConfig(providerId: string): Promise<any>;
      setConfig(providerId: string, config: any): Promise<void>;
      onProgress(
        callback: (progress: {
          stage: string;
          percent: number;
          currentFile?: string;
          processed: number;
          total: number;
          message: string;
        }) => void,
      ): () => void;
      onCompleted(callback: (result: any) => void): () => void;
      onDataChanged(callback: () => void): () => void;
    };
    // 统一配置 API
    app: {
      getConfig(): Promise<AppConfig>;
      setConfig(partial: DeepPartial<AppConfig>): Promise<AppConfig>;
      getConfigPath(): Promise<string>;
      onConfigChanged(callback: (config: AppConfig) => void): () => void;
    };
    // 日志 API
    log?: {
      openDir(): Promise<void>;
      getPath(): Promise<string>;
      readRecent(lines?: number): Promise<string>;
      readByLevel(
        level: 'error' | 'warn' | 'info' | 'debug' | 'all',
        lines?: number,
      ): Promise<string>;
      search(keyword: string, lines?: number): Promise<string>;
      cleanOld(): Promise<number>;
      getStats(): Promise<{
        totalSize: number;
        fileCount: number;
        oldestFile?: string;
        newestFile?: string;
      }>;
      // 渲染进程日志上报
      error(...args: unknown[]): void;
      warn(...args: unknown[]): void;
      info(...args: unknown[]): void;
      debug(...args: unknown[]): void;
    };
  }
}

export {};
