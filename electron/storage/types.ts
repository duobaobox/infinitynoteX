/**
 * 存储模块类型定义
 *
 * 注意：所有数据模型类型现在从 schemas.ts 导出（使用 z.infer）
 * 这里仅保留非 Schema 相关的类型（错误码、选项等）
 */

// ============ 重新导出 Schema 推导的类型 ============

export type {
  // 文件夹
  Folder,

  // 便签
  Note,
  NoteIndex,
  CreateNotePayload,

  // AI 对话
  AIMessage,
  AIConversation,
  AIConversationIndex,

  // 存储元数据
  StorageMeta,
  HealthCheckResult,
  StorageStats,

  // Todo（预留）
  Todo,
  TodoIndex,
} from './schemas';

// ============ TipTap JSON 类型（外部依赖，手动定义） ============

export type { TipTapJSONContent, NoteColor } from '../../src/services/types';

// ============ 错误码 ============

export enum StorageErrorCode {
  E_FOLDER_SYSTEM = 'E_FOLDER_SYSTEM',
  E_IO_READ = 'E_IO_READ',
  E_IO_WRITE = 'E_IO_WRITE',
  E_PATH_INVALID = 'E_PATH_INVALID',
  E_MIGRATE_FAIL = 'E_MIGRATE_FAIL',
  E_NOT_FOUND = 'E_NOT_FOUND',
  E_ALREADY_EXISTS = 'E_ALREADY_EXISTS',
}

// ============ 选项类型 ============

export interface SetStoragePathOptions {
  migrate?: boolean;
}
