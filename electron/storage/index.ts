/**
 * 存储模块主入口
 * 导出所有存储相关的类型、类和单例
 */

// 导出类型
export type {
  Folder,
  Note,
  NoteIndex,
  CreateNotePayload,
  AIMessage,
  AIConversation,
  AIConversationIndex,
  StorageMeta,
  HealthCheckResult,
  StorageStats,
  SetStoragePathOptions,
  Todo,
  TodoIndex,
} from './types';

// 导出错误类型
export { StorageError, StorageErrorCode } from './errors';

// 导出存储上下文
export { StorageContext } from './StorageContext';

// 导出子模块
export { FolderStorage } from './FolderStorage';
export { NoteStorage } from './NoteStorage';
export { AIStorage } from './AIStorage';
export { NoteLifecycleService } from './NoteLifecycleService';

// 导出主管理器和单例
export { StorageManager, storageManager } from './StorageManager';
