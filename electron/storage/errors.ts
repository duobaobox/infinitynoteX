/**
 * 存储模块错误定义
 */

export enum StorageErrorCode {
  E_FOLDER_SYSTEM = 'E_FOLDER_SYSTEM',
  E_IO_READ = 'E_IO_READ',
  E_IO_WRITE = 'E_IO_WRITE',
  E_PATH_INVALID = 'E_PATH_INVALID',
  E_MIGRATE_FAIL = 'E_MIGRATE_FAIL',
  E_NOT_FOUND = 'E_NOT_FOUND',
  E_ALREADY_EXISTS = 'E_ALREADY_EXISTS',
}

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
