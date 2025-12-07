/**
 * Services - 统一服务层导出
 *
 * 服务层架构说明：
 * - 所有与 Electron IPC (window.storage, window.ai) 的交互都通过 Service 进行
 * - Service 提供统一的接口，便于测试 mock 和后续扩展
 * - 组件和 Store 应该通过 Service 访问数据，而不是直接调用 window.storage
 *
 * 使用示例：
 * ```ts
 * import { noteService, folderService } from '@/services';
 *
 * // 获取便签
 * const note = await noteService.getNote(id);
 *
 * // 创建文件夹
 * await folderService.createFolder('新文件夹');
 * ```
 */

// 数据服务
export { noteService } from './noteService';
export type { NoteService } from './noteService';

export { folderService } from './folderService';
export type { FolderService } from './folderService';

export { aiConversationService } from './aiConversationService';
export type { AIConversationService, AIMessage } from './aiConversationService';

export { browserCardService } from './browserCardService';
export type { BrowserCardService, BrowserCard } from './browserCardService';

// 存储管理服务
export { storageService } from './storageService';
export type { StorageService } from './storageService';

// 类型定义
export * from './types';

// AI 配置相关（已有）
export * from './aiConfig';
export * from './aiProviders';
