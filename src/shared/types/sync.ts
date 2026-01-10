/**
 * Sync Types
 * Shared between Frontend and Electron
 */

export interface SyncProgress {
  stage: string;
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
