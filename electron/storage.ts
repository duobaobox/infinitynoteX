/**
 * 存储管理模块
 * 此文件保持向后兼容，从新的模块化存储目录重新导出
 *
 * 新的模块化结构位于 ./storage/ 目录：
 * - types.ts      - 类型定义
 * - errors.ts     - 错误定义
 * - utils.ts      - 通用工具函数
 * - StorageContext.ts - 存储上下文
 * - FolderStorage.ts  - 文件夹存储
 * - NoteStorage.ts    - 便签存储
 * - AIStorage.ts      - AI 对话存储
 * - StorageManager.ts - 主管理器
 * - index.ts          - 主入口
 */

// 重新导出所有内容，保持向后兼容
export {
  // 类型
  type Folder,
  type Note,
  type NoteIndex,
  type CreateNotePayload,
  type AIMessage,
  type AIConversation,
  type AIConversationIndex,
  type StorageMeta,
  type HealthCheckResult,
  type StorageStats,
  type SetStoragePathOptions,
  type Todo,
  type TodoIndex,
} from './storage/types';

export { StorageError, StorageErrorCode } from './storage/errors';
export { StorageContext } from './storage/StorageContext';
export { FolderStorage } from './storage/FolderStorage';
export { NoteStorage } from './storage/NoteStorage';
export { AIStorage } from './storage/AIStorage';
export { StorageManager, storageManager } from './storage/StorageManager';
