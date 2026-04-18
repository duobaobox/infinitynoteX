/**
 * 数据持久化相关类型定义
 */

import type { NoteCardColor } from '../hooks/useNoteCardTheme';

/**
 * 便签颜色（预设 6 种）
 * 统一从 useNoteCardTheme 导出，避免重复定义
 */
export type NoteColor = NoteCardColor;

// ============ 数据模型 ============

/**
 * 便签引用
 */
export interface NoteReference {
  id: string;
  title: string;
  byteLength: number;
  content: string; // 便签纯文本内容，用于发送给 AI
}

/**
 * AI 对话消息
 */
export interface AIMessage {
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
  references?: NoteReference[];
  toolApprovals?: AIToolApproval[];
  runTrace?: AIRunTrace;
}

export type AIConversationSource = 'note' | 'workbench' | 'canvas' | 'global';
export type AIConversationBindingSource = 'note' | 'global';

export type AIToolApprovalStatus = 'pending' | 'processing' | 'executed' | 'denied' | 'failed';

export type AIRunStatus = 'running' | 'waiting_approval' | 'completed' | 'failed' | 'cancelled';

export type AIStepStatus = 'pending' | 'running' | 'waiting' | 'completed' | 'failed' | 'skipped';

export type AIStepKind = 'planning' | 'retrieval' | 'generation' | 'tool' | 'approval';

export type AIArtifactType =
  | 'retrieval-query'
  | 'retrieval-result'
  | 'tool-input'
  | 'tool-result'
  | 'context'
  | 'answer';

export interface AIArtifact {
  id: string;
  type: AIArtifactType;
  title: string;
  summary?: string;
  data?: unknown;
  createdAt: number;
}

export interface AIStepTrace {
  stepId: string;
  kind: AIStepKind;
  title: string;
  status: AIStepStatus;
  detail?: string;
  toolName?: string;
  approvalId?: string;
  startedAt: number;
  endedAt?: number;
  artifacts?: AIArtifact[];
}

export interface AIRunTrace {
  runId: string;
  requestId: string;
  status: AIRunStatus;
  input: string;
  startedAt: number;
  endedAt?: number;
  error?: string;
  steps: AIStepTrace[];
  artifacts: AIArtifact[];
}

export interface AIToolApproval {
  approvalId: string;
  toolCallId: string;
  toolName: string;
  title: string;
  description: string;
  status: AIToolApprovalStatus;
  preview?: string;
  targetId?: string;
  targetLabel?: string;
  resultSummary?: string;
  error?: string;
}

export interface AIConversationBinding {
  source: AIConversationBindingSource;
  entityId: string;
}

/**
 * AI 对话
 */
export interface AIConversation {
  id: string;
  title: string;
  excerpt: string;
  messages: AIMessage[];
  createdAt: number;
  updatedAt: number;
  source?: AIConversationSource;
  sourceEntityId?: string;
}

export interface AIConversationPreview {
  id: string;
  title: string;
  excerpt: string;
  createdAt: number;
  updatedAt: number;
  source?: AIConversationSource;
  sourceEntityId?: string;
}

/**
 * 文件夹
 */
export interface Folder {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  order: number;
  system: boolean; // 系统默认文件夹为 true，不可删除
}

/**
 * 便签完整内容
 */
export interface Note {
  id: string;
  folderId: string;
  title: string;
  content: TipTapJSONContent; // TipTap JSON 格式
  tags: string[];
  pinned: boolean;
  /** 便签颜色（6个预设） */
  color?: NoteColor;
  createdAt: number;
  updatedAt: number;
  /** 画布 X 坐标 */
  canvasX?: number | null;
  /** 画布 Y 坐标 */
  canvasY?: number | null;
  /** 画布宽度 */
  canvasWidth?: number | null;
  /** 画布高度 */
  canvasHeight?: number | null;
}

/**
 * 便签索引（用于列表展示，轻量级）
 */
export interface NoteIndex {
  id: string;
  folderId: string;
  title: string;
  excerpt: string;
  createdAt: number;
  updatedAt: number;
  pinned: boolean;
  tags: string[];
  /** 便签颜色（用于列表渲染） */
  color?: NoteColor;
  /** 画布 X 坐标 */
  canvasX?: number | null;
  /** 画布 Y 坐标 */
  canvasY?: number | null;
  /** 画布宽度 */
  canvasWidth?: number | null;
  /** 画布高度 */
  canvasHeight?: number | null;
}

/**
 * 回收站项目（完整内容）
 */
export interface TrashItem {
  id: string;
  originalId: string;
  originalFolderId: string;
  title: string;
  content: TipTapJSONContent;
  tags: string[];
  pinned: boolean;
  color?: NoteColor;
  createdAt: number;
  updatedAt: number;
  deletedAt: number;
  expiresAt: number;
}

/**
 * 回收站索引（用于列表展示）
 */
export interface TrashIndex {
  id: string;
  originalId: string;
  originalFolderId: string;
  title: string;
  excerpt: string;
  deletedAt: number;
  expiresAt: number;
}

/**
 * 存储元信息
 */
export interface StorageMeta {
  schemaVersion: number;
  storageId: string;
  createdAt: number;
}

/**
 * 健康检查结果
 */
export interface HealthCheckResult {
  ok: boolean;
  details?: string;
}

/**
 * 存储统计信息
 */
export interface StorageStats {
  folderCount: number;
  noteCount: number;
  dataSize: number; // 字节
  lastBackupTime?: number;
}

// ============ 错误码 ============

export enum StorageErrorCode {
  E_FOLDER_SYSTEM = 'E_FOLDER_SYSTEM', // 试图删除系统默认文件夹
  E_IO_READ = 'E_IO_READ', // 文件读取错误
  E_IO_WRITE = 'E_IO_WRITE', // 文件写入错误
  E_PATH_INVALID = 'E_PATH_INVALID', // 路径不可用或权限不足
  E_MIGRATE_FAIL = 'E_MIGRATE_FAIL', // 迁移失败
  E_NOT_FOUND = 'E_NOT_FOUND', // 资源不存在
  E_ALREADY_EXISTS = 'E_ALREADY_EXISTS', // 资源已存在
}

/**
 * 存储错误类
 */
export class StorageError extends Error {
  constructor(
    public code: StorageErrorCode,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'StorageError';
  }
}

// ============ API 参数类型 ============

export interface CreateNotePayload {
  title?: string;
  content?: TipTapJSONContent;
}

export interface UpdateNotePayload {
  title?: string;
  content?: TipTapJSONContent;
  tags?: string[];
  pinned?: boolean;
  color?: NoteColor;
  /** 画布 X 坐标 */
  canvasX?: number | null;
  /** 画布 Y 坐标 */
  canvasY?: number | null;
  /** 画布宽度 */
  canvasWidth?: number | null;
  /** 画布高度 */
  canvasHeight?: number | null;
}

export interface SetStoragePathOptions {
  migrate?: boolean;
}

// ============ 对话框选项（精简） ============
export type OpenDialogOptions = {
  title?: string;
  defaultPath?: string;
  buttonLabel?: string;
  properties?: (
    | 'openFile'
    | 'openDirectory'
    | 'multiSelections'
    | 'showHiddenFiles'
    | 'createDirectory'
    | 'promptToCreate'
    | 'noResolveAliases'
    | 'treatPackageAsDirectory'
    | 'dontAddToRecent'
  )[];
  filters?: { name: string; extensions: string[] }[];
  message?: string;
  securityScopedBookmarks?: boolean;
};

// ============ TipTap JSON 类型（最小必要结构） ============

export type JSONObject = { [key: string]: unknown };

export interface TipTapMark {
  type: string;
  attrs?: JSONObject;
}

export interface TipTapJSONContent {
  type?: string;
  attrs?: JSONObject;
  content?: TipTapJSONContent[];
  marks?: TipTapMark[];
  text?: string;
}

// ============ 悬浮窗口相关 ============

/**
 * 悬浮窗口配置
 */
export interface FloatingWindowOptions {
  noteId: string;
  width?: number;
  height?: number;
  x?: number;
  y?: number;
}

// ============ 自动更新 ============

export type UpdateState =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'error'
  | 'disabled';

export interface UpdateStatusPayload {
  state: UpdateState;
  version?: string;
  releaseNotes?: string | null;
  percent?: number;
  transferredBytes?: number;
  totalBytes?: number;
  errorMessage?: string;
}

// ============ Todo 相关类型 ============

/**
 * Todo 清单
 */
export interface TodoList {
  id: string;
  name: string;
  color?: string;
  isDefault: boolean;
  createdAt: number;
  updatedAt: number;
  order: number;
}

/**
 * 手动任务
 */
export interface ManualTask {
  id: string;
  listId: string;
  text: string;
  checked: boolean;
  createdAt: number;
  updatedAt: number;
  order: number;
  dueDate?: number;
}

/**
 * 手动任务索引（用于列表展示）
 */
export interface ManualTaskIndex {
  id: string;
  listId: string;
  text: string;
  checked: boolean;
  order: number;
  updatedAt: number;
  dueDate?: number;
}

// ============ 扩展 window.storage 类型 ============

declare global {
  interface Window {
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
      updateNote(id: string, patch: UpdateNotePayload): Promise<Note>;
      deleteNote(id: string): Promise<void>;

      // AI 对话操作
      listAIConversationPreviews(): Promise<AIConversationPreview[]>;
      getAIConversation(id: string): Promise<AIConversation>;
      resolveAIConversationBinding(
        binding: AIConversationBinding,
        options?: { autoCreate?: boolean; title?: string },
      ): Promise<AIConversation | null>;
      getAIConversations(): Promise<AIConversation[]>;
      createAIConversation(title?: string): Promise<AIConversation>;
      deleteAIConversation(id: string): Promise<void>;
      saveAIConversationMessages(
        id: string,
        messages: Array<{
          role: 'user' | 'assistant';
          content: string;
          timestamp: number;
          reasoning?: string;
          references?: NoteReference[];
          ragSources?: Array<{
            key: number;
            title: string;
            description?: string;
            noteId?: string;
          }>;
          toolApprovals?: AIToolApproval[];
          runTrace?: AIRunTrace;
        }>,
        options?: {
          source?: 'note' | 'workbench' | 'canvas' | 'global';
          sourceEntityId?: string;
        },
      ): Promise<AIConversation>;
      updateAIConversationTitle(id: string, title: string): Promise<AIConversation>;

      // 回收站操作
      listTrash(): Promise<TrashIndex[]>;
      getTrashItem(id: string): Promise<TrashItem>;
      restoreNote(trashItemId: string, targetFolderId?: string): Promise<Note>;
      deleteTrashItemPermanently(id: string): Promise<void>;
      emptyTrash(): Promise<number>;

      // Todo 清单操作
      listTodoLists(): Promise<TodoList[]>;
      createTodoList(name: string, color?: string): Promise<TodoList>;
      updateTodoList(
        id: string,
        patch: { name?: string; color?: string; order?: number },
      ): Promise<TodoList>;
      deleteTodoList(id: string): Promise<void>;

      // 手动任务操作
      listManualTasks(listId?: string): Promise<ManualTaskIndex[]>;
      createManualTask(listId: string, text: string, dueDate?: number): Promise<ManualTask>;
      updateManualTask(
        id: string,
        listId: string,
        patch: { text?: string; checked?: boolean; order?: number; dueDate?: number },
      ): Promise<ManualTask>;
      deleteManualTask(id: string, listId: string): Promise<void>;
      toggleManualTask(id: string, listId: string): Promise<ManualTask>;
    };

    floatingTodo?: {
      createWindow(listId: string): Promise<{ success: boolean; message?: string }>;
      closeWindow(listId: string): Promise<{ success: boolean; message?: string }>;
      listWindows(): Promise<string[]>;
      minimizeWindow(listId: string): Promise<{ success: boolean; message?: string }>;
      restoreWindow(listId: string): Promise<{ success: boolean; message?: string }>;
    };
  }
}
