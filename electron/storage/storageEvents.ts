/**
 * 存储事件发射器
 * 用于在数据变更时通知所有渲染进程
 */

import { BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../../src/shared/types/ipc';

/**
 * 存储事件类型
 */
export type StorageEventType = 'created' | 'updated' | 'deleted';

/**
 * 存储实体类型
 */
export type StorageEntityType = 'note' | 'aiConversation' | 'folder' | 'trash';

/**
 * 存储事件
 */
export interface StorageEvent {
  /** 事件类型 */
  type: StorageEventType;
  /** 实体类型 */
  entity: StorageEntityType;
  /** 实体 ID */
  id: string;
  /** 附加数据（可选） */
  data?: unknown;
}

/**
 * 发送存储事件到所有渲染进程
 */
export function emitStorageEvent(event: StorageEvent): void {
  console.log(`[StorageEvents] ${event.type} ${event.entity}: ${event.id}`);

  BrowserWindow.getAllWindows().forEach((win) => {
    if (!win.isDestroyed()) {
      win.webContents.send(IPC_CHANNELS.storageEvent, event);
    }
  });
}

/**
 * 便捷方法：发送创建事件
 */
export function emitCreated(entity: StorageEntityType, id: string, data?: unknown): void {
  emitStorageEvent({ type: 'created', entity, id, data });
}

/**
 * 便捷方法：发送更新事件
 */
export function emitUpdated(entity: StorageEntityType, id: string, data?: unknown): void {
  emitStorageEvent({ type: 'updated', entity, id, data });
}

/**
 * 便捷方法：发送删除事件
 */
export function emitDeleted(entity: StorageEntityType, id: string): void {
  emitStorageEvent({ type: 'deleted', entity, id });
}
