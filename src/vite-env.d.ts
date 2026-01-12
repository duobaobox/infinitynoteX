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

import type { AppConfig, DeepPartial } from './shared/types/config';
import type { SyncResult, SyncConfig, SyncProgress, SyncPreview } from './shared/types/sync';

// 确保 AppConfig 在这里可用
// 注意：其他引用了这些本地接口的地方可能需要修改，但 vite-env.d.ts 主要是给 window 扩展用的

declare global {
  interface Window {
    electronAPI?: {
      minimize(): void;
      maximize(): void;
      unmaximize(): void;
      close(): void;
      isMaximized(): Promise<boolean>;
      reload(): Promise<void>;
      onWindowStateChanged(callback: (isMaximized: boolean) => void): void;
      showOpenDialog(
        options: OpenDialogOptions,
      ): Promise<{ canceled: boolean; filePaths: string[] }>;

      // AI 对话悬浮窗口
      showAIChatWindow(): Promise<void>;
      hideAIChatWindow(): Promise<void>;
      toggleAIChatWindow(): Promise<void>;
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
      restoreBackup(backupFilePath: string): Promise<void>;
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
      // 同步更新便签（用于 beforeunload 场景）
      updateNoteSync(id: string, patch: Partial<Note>): boolean;
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
            references?: Array<{
              id: string;
              title: string;
              byteLength: number;
              content: string;
            }>;
          }>;
          createdAt: number;
          updatedAt: number;
          source?: 'note' | 'workbench' | 'canvas' | 'global';
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
          references?: Array<{
            id: string;
            title: string;
            byteLength: number;
            content: string;
          }>;
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
          references?: Array<{
            id: string;
            title: string;
            byteLength: number;
            content: string;
          }>;
        }>,
        options?: { source?: 'note' | 'workbench' | 'canvas' | 'global' },
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
          references?: Array<{
            id: string;
            title: string;
            byteLength: number;
            content: string;
          }>;
        }>;
        createdAt: number;
        updatedAt: number;
        source?: 'note' | 'workbench' | 'canvas' | 'global';
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
    browserCards: {
      list(): Promise<
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
      >;
      create(card: { name: string; url: string; icon?: string }): Promise<{
        id: string;
        name: string;
        url: string;
        icon?: string;
        isBuiltIn?: boolean;
        order: number;
        createdAt: number;
        updatedAt: number;
      }>;
      update(
        id: string,
        patch: { name?: string; url?: string; icon?: string },
      ): Promise<{
        id: string;
        name: string;
        url: string;
        icon?: string;
        isBuiltIn?: boolean;
        order: number;
        createdAt: number;
        updatedAt: number;
      }>;
      delete(id: string): Promise<void>;
      reorder(orderedIds: string[]): Promise<void>;
    };
    sync: {
      testConnection(
        providerId: string,
        config: SyncConfig,
      ): Promise<{ ok: boolean; message: string }>;
      execute(providerId: string, config: SyncConfig): Promise<SyncResult>;
      preview(providerId: string, config: SyncConfig): Promise<SyncPreview>;
      getConfig(providerId: string): Promise<SyncConfig | null>;
      setConfig(providerId: string, config: SyncConfig): Promise<void>;
      openLogDir(): Promise<void>;
      getLastResult(): Promise<SyncResult | null>;
      onProgress(callback: (progress: SyncProgress) => void): () => void;
      onCompleted(callback: (result: SyncResult) => void): () => void;
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
    // 配置 API
    config?: {
      getShortcutKeys(): Promise<{ aiChatWindow: string }>;
      setShortcutKeys(keys: { aiChatWindow: string }): Promise<{ aiChatWindow: string }>;
    };
  }
}

export {};
