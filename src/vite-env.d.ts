/// <reference types="vite/client" />

import type {
  Folder,
  Note,
  NoteIndex,
  HealthCheckResult,
  StorageStats,
  CreateNotePayload,
  SetStoragePathOptions,
  UpdateStatusPayload,
  OpenDialogOptions,
} from './services/types';

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

      // AI 对话操作
      getAIConversations(): Promise<
        Array<{
          id: string;
          title: string;
          excerpt: string;
          messages: Array<{
            role: 'user' | 'assistant';
            content: string;
            timestamp: number;
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
          role: 'user' | 'assistant';
          content: string;
          timestamp: number;
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
        }>,
      ): Promise<{
        id: string;
        title: string;
        excerpt: string;
        messages: Array<{
          role: 'user' | 'assistant';
          content: string;
          timestamp: number;
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
          role: 'user' | 'assistant';
          content: string;
          timestamp: number;
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
    appInfo?: {
      getVersion(): Promise<string>;
    };
  }
}

export {};
