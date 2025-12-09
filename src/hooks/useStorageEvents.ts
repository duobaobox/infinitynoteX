/**
 * 存储事件监听 Hook
 * 用于响应后端数据变更，自动清理失效引用
 */

import { useEffect } from 'react';
import { useWorkspaceStore } from '../store/workspaceStore';

/**
 * 存储事件类型定义
 */
export interface StorageEvent {
  type: 'created' | 'updated' | 'deleted';
  entity: 'note' | 'aiConversation' | 'folder' | 'trash';
  id: string;
  data?: unknown;
}

/**
 * 监听存储事件并自动处理
 * 在 App 根组件中调用一次即可
 */
export function useStorageEvents(): void {
  useEffect(() => {
    // 检查 API 是否可用
    if (!window.storageEvents?.onEvent) {
      console.warn('[useStorageEvents] storageEvents API not available');
      return;
    }

    const handleEvent = (event: StorageEvent) => {
      console.log(`[useStorageEvents] Received: ${event.type} ${event.entity}:${event.id}`);

      // 直接从 store 获取最新状态和 actions，避免闭包陷阱
      const store = useWorkspaceStore.getState();

      switch (event.type) {
        case 'deleted':
          handleDelete(event, store);
          break;
        case 'created':
          handleCreate(event, store);
          break;
        case 'updated':
          handleUpdate(event, store);
          break;
      }
    };

    const handleDelete = (
      event: StorageEvent,
      store: ReturnType<typeof useWorkspaceStore.getState>,
    ) => {
      switch (event.entity) {
        case 'note':
          // 如果删除的是当前选中的便签，清空选中状态
          if (store.selectedNoteId === event.id) {
            console.log('[useStorageEvents] Clearing selected note (deleted externally)');
            store.setSelectedNote(null);
          }
          // 触发列表刷新
          store.triggerListRefresh();
          break;

        case 'aiConversation':
          // 如果删除的是当前选中的对话，清空选中状态
          if (store.selectedToolItemId === event.id) {
            console.log('[useStorageEvents] Clearing selected conversation (deleted externally)');
            store.setSelectedToolItem(null);
          }
          // 刷新对话列表
          store.triggerAIConversationsRefresh();
          break;

        case 'folder':
          // 如果删除的是当前选中的文件夹，清空选中状态
          if (store.selectedFolderId === event.id) {
            console.log('[useStorageEvents] Clearing selected folder (deleted externally)');
            store.setSelectedFolder(null);
          }
          // 刷新文件夹列表
          store.loadFolders();
          break;
      }
    };

    const handleCreate = (
      event: StorageEvent,
      store: ReturnType<typeof useWorkspaceStore.getState>,
    ) => {
      switch (event.entity) {
        case 'note':
          // 刷新便签列表
          if (store.selectedFolderId) {
            store.loadNotes(store.selectedFolderId);
          }
          break;

        case 'aiConversation':
          // 刷新对话列表
          store.loadAIConversations();
          break;

        case 'folder':
          // 刷新文件夹列表
          store.loadFolders();
          break;
      }
    };

    const handleUpdate = (
      event: StorageEvent,
      store: ReturnType<typeof useWorkspaceStore.getState>,
    ) => {
      // 更新事件通常不需要额外处理
      // 各组件会通过自己的状态管理来更新
      switch (event.entity) {
        case 'note':
          store.triggerListRefresh();
          break;
        case 'aiConversation':
          store.triggerAIConversationsRefresh();
          break;
      }
    };

    // 订阅事件
    const unsubscribe = window.storageEvents.onEvent(handleEvent);

    return () => {
      unsubscribe();
    };
  }, []); // 空依赖数组，只在组件挂载时注册一次
}
