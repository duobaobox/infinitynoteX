/**
 * 数据持久化相关类型定义
 */

// ============ 数据模型 ============

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
}

/**
 * 便签索引（用于列表展示，轻量级）
 */
export interface NoteIndex {
  id: string;
  folderId: string;
  title: string;
  excerpt: string;
  updatedAt: number;
  pinned: boolean;
  tags: string[];
  /** 便签颜色（用于列表渲染） */
  color?: NoteColor;
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

/**
 * 便签颜色（预设 6 种）
 * 使用不带 # 的十六进制字符串，便于直接存储
 */
export type NoteColor = 'bae0ff' | 'd9f7be' | 'ffd6e7' | 'd6e4ff' | 'ffd666' | 'ffffff';

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
