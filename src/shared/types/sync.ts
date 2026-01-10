/**
 * Sync Types
 * Shared between Frontend and Electron
 */

export type SyncStage =
  | 'idle'
  | 'connecting'
  | 'scanning'
  | 'comparing'
  | 'uploading'
  | 'downloading'
  | 'finalizing'
  | 'done'
  | 'error';

export interface SyncProgress {
  stage: SyncStage;
  percent: number;
  currentFile?: string;
  processed: number;
  total: number;
  message: string;
}

export type SyncPreview = {
  toUpload: string[];
  toDownload: string[];
  toDeleteRemote: string[];
  toDeleteLocal: string[];
  conflicts: string[];
  unchanged: number;
};

export type SyncError = {
  path?: string;
  code: string;
  message: string;
  retryable?: boolean;
};

export type SyncResult = {
  success: boolean;
  message: string;
  startTime: number;
  endTime: number;
  uploaded: number;
  downloaded: number;
  deleted: number;
  skipped: number;
  conflictsResolved: number;
  conflictBackups?: string[];
  errors: SyncError[];
};

export type ConflictStrategy = 'local' | 'remote' | 'newest';

export interface WebDAVConfig {
  url: string;
  username: string;
  password: string;
  remotePath: string;
}

export interface SyncConfig extends WebDAVConfig {
  enabled: boolean;
  conflictStrategy: ConflictStrategy;
}
