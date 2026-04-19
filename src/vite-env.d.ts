/// <reference types="vite/client" />

import type {
  Folder,
  Note,
  AIConversation,
  AIConversationBinding,
  AIConversationPreview,
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
      deleteNote(id: string): Promise<void>;

      // 回收站操作
      listTrash(): Promise<TrashIndex[]>;
      getTrashItem(id: string): Promise<TrashItem>;
      restoreNote(trashItemId: string, targetFolderId?: string): Promise<Note>;
      deleteTrashItemPermanently(id: string): Promise<void>;
      emptyTrash(): Promise<number>;

      // AI 对话操作
      listAIConversationPreviews(): Promise<AIConversationPreview[]>;
      getAIConversation(id: string): Promise<AIConversation>;
      resolveAIConversationBinding(
        binding: AIConversationBinding,
        options?: { autoCreate?: boolean; title?: string },
      ): Promise<AIConversation | null>;
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
          sourceEntityId?: string;
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
        source?: 'note' | 'workbench' | 'canvas' | 'global';
        sourceEntityId?: string;
      }>;
      deleteAIConversation(id: string): Promise<void>;
      saveAIConversationMessages(
        id: string,
        messages: Array<{
          role: 'user' | 'assistant';
          content: string;
          timestamp: number;
          reasoning?: string;
          ragSources?: Array<{
            key: number;
            title: string;
            description?: string;
            noteId?: string;
          }>;
          references?: Array<{
            id: string;
            title: string;
            byteLength: number;
            content: string;
          }>;
          toolApprovals?: import('./services/types').AIToolApproval[];
          runTrace?: import('./services/types').AIRunTrace;
        }>,
        options?: {
          source?: 'note' | 'workbench' | 'canvas' | 'global';
          sourceEntityId?: string;
        },
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
          ragSources?: Array<{
            key: number;
            title: string;
            description?: string;
            noteId?: string;
          }>;
          references?: Array<{
            id: string;
            title: string;
            byteLength: number;
            content: string;
          }>;
          toolApprovals?: import('./services/types').AIToolApproval[];
          runTrace?: import('./services/types').AIRunTrace;
        }>;
        createdAt: number;
        updatedAt: number;
        source?: 'note' | 'workbench' | 'canvas' | 'global';
        sourceEntityId?: string;
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
          toolApprovals?: import('./services/types').AIToolApproval[];
          runTrace?: import('./services/types').AIRunTrace;
        }>;
        createdAt: number;
        updatedAt: number;
      }>;
    };
    ai: {
      getConfig(): Promise<import('./services/aiConfig').AIConfig | null>;
      setConfig(config: import('./services/aiConfig').AIConfig): Promise<void>;
      testConnection(): Promise<{ ok: boolean; message: string }>;
      chat(payload: import('./services/aiConfig').ChatPayload): Promise<{
        success: boolean;
        content?: string;
        error?: string;
      }>;
      chatStream(payload: import('./services/aiConfig').ChatPayload): Promise<{
        success: boolean;
        requestId?: string;
        error?: string;
      }>;
      respondToolApproval(payload: {
        approvalId: string;
        approved: boolean;
        reason?: string;
      }): Promise<{
        success: boolean;
        content?: string;
        approval?: import('./services/types').AIToolApproval;
        followUpApprovals?: import('./services/types').AIToolApproval[];
        error?: string;
      }>;
      abortStream(requestId: string): Promise<{ success: boolean; error?: string }>;
      onStreamChunk(
        callback: (data: {
          requestId: string;
          chunk: {
            delta: string;
            reasoningDelta?: string;
            finishReason?: string;
          };
        }) => void,
      ): () => void;
      onStreamDone(callback: (data: { requestId: string; success: boolean }) => void): () => void;
      onStreamError(callback: (data: { requestId: string; error: string }) => void): () => void;
      onToolApprovalRequest(
        callback: (data: {
          requestId: string;
          approval: import('./services/types').AIToolApproval;
        }) => void,
      ): () => void;
      onToolProgress(
        callback: (data: {
          requestId: string;
          progress: {
            phase: 'start' | 'delta';
            toolCallId: string;
            toolName?: string;
            title?: string;
            inputTextDelta?: string;
          };
        }) => void,
      ): () => void;
      onRunUpdate(
        callback: (data: { requestId: string; run: import('./services/types').AIRunTrace }) => void,
      ): () => void;
      onApprovalStateChanged(
        callback: (data: {
          requestId: string;
          toolCallId: string;
          approvalId: string;
          state: 'PENDING_APPROVAL' | 'EXECUTING' | 'SUCCESS' | 'ERROR' | 'REJECTED';
          result?: unknown;
          error?: string;
          timestamp: number;
        }) => void,
      ): () => void;
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
      getDefaultFloatingWindowSize(): Promise<{ width: number; height: number }>;
      setDefaultFloatingWindowSize(size: { width: number; height: number }): Promise<void>;
    };
  }
}

export {};
