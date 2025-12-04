/**
 * 同步模块类型定义
 * 包含同步元数据、状态、冲突等核心类型
 *
 * 同步范围：folders.json、notes.index.json、notes/*.json
 * 冲突策略：默认 newest（保留最新修改）
 * 同步方式：手动触发
 */

// ============ 同步配置 ============

export interface WebDAVConfig {
  url: string;
  username: string;
  password: string;
  remotePath: string;
}

export interface SyncConfig extends WebDAVConfig {
  enabled: boolean;
  /** 冲突解决策略，默认 newest */
  conflictStrategy: ConflictStrategy;
}

export type ConflictStrategy = 'local' | 'remote' | 'newest';

// ============ 本地同步状态 ============

/**
 * 本地同步状态（存储在 sync-state.json）
 * 记录每个文件上次同步时的状态，用于三方比较
 */
export interface LocalSyncState {
  /** 设备唯一标识 (UUID) */
  deviceId: string;
  /** 设备名称（用于冲突提示，如 "MacBook Pro"） */
  deviceName: string;
  /** 最后同步时间 */
  lastSyncAt: number;
  /** 每个文件的同步状态 */
  files: Record<string, LocalFileSyncState>;
}

export interface LocalFileSyncState {
  /** 上次同步时的内容哈希 */
  syncedHash: string;
  /** 上次同步时间 */
  syncedAt: number;
}

// ============ 远程同步清单 ============

/**
 * 远程同步清单（存储在 WebDAV .sync/manifest.json）
 * 记录远程所有文件的当前状态
 */
export interface RemoteSyncManifest {
  /** 清单格式版本 */
  version: number;
  /** 最后更新时间 */
  updatedAt: number;
  /** 最后更新的设备ID */
  updatedBy: string;
  /** 所有文件的元数据 */
  files: Record<string, RemoteFileMeta>;
}

export interface RemoteFileMeta {
  /** 文件内容哈希 (MD5) */
  hash: string;
  /** 修改时间戳 */
  modifiedAt: number;
  /** 文件大小（字节） */
  size: number;
  /** 最后更新的设备ID */
  updatedBy: string;
}

// ============ 本地文件扫描结果 ============

export interface LocalFileInfo {
  /** 相对路径 */
  path: string;
  /** 内容哈希 (MD5) */
  hash: string;
  /** 修改时间戳 */
  modifiedAt: number;
  /** 文件大小 */
  size: number;
  /** 文件内容 */
  content: string;
}

// ============ 同步差异分析 ============

export type FileAction =
  | 'upload' // 上传到远程
  | 'download' // 从远程下载
  | 'delete-remote' // 删除远程文件
  | 'delete-local' // 删除本地文件
  | 'conflict' // 冲突
  | 'skip'; // 跳过（无变化）

export interface FileDiff {
  path: string;
  action: FileAction;
  /** 本地文件信息 */
  local?: LocalFileInfo;
  /** 远程文件信息 */
  remote?: RemoteFileMeta;
  /** 冲突详情（仅 action=conflict 时有值） */
  conflict?: ConflictInfo;
}

// ============ 冲突处理 ============

export interface ConflictInfo {
  path: string;
  localModifiedAt: number;
  localHash: string;
  remoteModifiedAt: number;
  remoteHash: string;
  /** 解决方案 */
  resolution?: 'keep-local' | 'keep-remote';
}

// ============ 同步进度 ============

export type SyncStage =
  | 'idle' // 空闲
  | 'connecting' // 连接中
  | 'scanning' // 扫描本地文件
  | 'comparing' // 比较差异
  | 'uploading' // 上传中
  | 'downloading' // 下载中
  | 'finalizing' // 完成中
  | 'done' // 完成
  | 'error'; // 错误

export interface SyncProgress {
  stage: SyncStage;
  /** 进度百分比 0-100 */
  percent: number;
  /** 当前正在处理的文件 */
  currentFile?: string;
  /** 已处理文件数 */
  processed: number;
  /** 总文件数 */
  total: number;
  /** 消息 */
  message: string;
}

export type SyncProgressCallback = (progress: SyncProgress) => void;

// ============ 同步结果 ============

export interface SyncResult {
  success: boolean;
  message: string;
  startTime: number;
  endTime: number;
  /** 上传的文件数 */
  uploaded: number;
  /** 下载的文件数 */
  downloaded: number;
  /** 删除的文件数 */
  deleted: number;
  /** 跳过的文件数（无变化） */
  skipped: number;
  /** 冲突并解决的文件数 */
  conflictsResolved: number;
  /** 冲突备份文件列表（保留的被覆盖版本） */
  conflictBackups?: string[];
  /** 错误列表 */
  errors: SyncError[];
}

export interface SyncError {
  path?: string;
  code: string;
  message: string;
  /** 是否可重试 */
  retryable?: boolean;
}

// ============ 同步日志 ============

export type SyncLogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface SyncLogEntry {
  /** 时间戳 */
  timestamp: number;
  /** 日志级别 */
  level: SyncLogLevel;
  /** 操作类型 */
  action: string;
  /** 文件路径 */
  path?: string;
  /** 消息 */
  message: string;
  /** 额外数据 */
  data?: Record<string, unknown>;
}

// ============ 同步选项 ============

export interface SyncOptions {
  /** 冲突解决策略，默认 newest */
  conflictStrategy?: ConflictStrategy;
  /** 进度回调 */
  onProgress?: SyncProgressCallback;
  /** 试运行（不实际修改文件，仅返回差异） */
  dryRun?: boolean;
  /** 最大重试次数，默认 3 */
  maxRetries?: number;
  /** 是否保留冲突版本备份，默认 true */
  keepConflictBackup?: boolean;
}
