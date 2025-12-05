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
  // 获取 store 状态和 actions
  const selectedNoteId = useWorkspaceStore((state) => state.selectedNoteId);
  const selectedFolderId = useWorkspaceStore((state) => state.selectedFolderId);
  const selectedToolItemId = useWorkspaceStore((state) => state.selectedToolItemId);

  const setSelectedNote = useWorkspaceStore((state) => state.setSelectedNote);
  const setSelectedFolder = useWorkspaceStore((state) => state.setSelectedFolder);
  const setSelectedToolItem = useWorkspaceStore((state) => state.setSelectedToolItem);
  const loadNotes = useWorkspaceStore((state) => state.loadNotes);
  const loadFolders = useWorkspaceStore((state) => state.loadFolders);
  const loadAIConversations = useWorkspaceStore((state) => state.loadAIConversations);
  const triggerListRefresh = useWorkspaceStore((state) => state.triggerListRefresh);
  const triggerAIConversationsRefresh = useWorkspaceStore(
    (state) => state.triggerAIConversationsRefresh,
  );

  useEffect(() => {
    // 检查 API 是否可用
    if (!window.storageEvents?.onEvent) {
      console.warn('[useStorageEvents] storageEvents API not available');
      return;
    }

    const handleEvent = (event: StorageEvent) => {
      console.log(`[useStorageEvents] Received: ${event.type} ${event.entity}:${event.id}`);

      switch (event.type) {
        case 'deleted':
          handleDelete(event);
          break;
        case 'created':
          handleCreate(event);
          break;
        case 'updated':
          handleUpdate(event);
          break;
      }
    };

    const handleDelete = (event: StorageEvent) => {
      switch (event.entity) {
        case 'note':
          // 如果删除的是当前选中的便签，清空选中状态
          if (selectedNoteId === event.id) {
            console.log('[useStorageEvents] Clearing selected note (deleted externally)');
            setSelectedNote(null);
          }
          // 触发列表刷新
          triggerListRefresh();
          break;

        case 'aiConversation':
          // 如果删除的是当前选中的对话，清空选中状态
          if (selectedToolItemId === event.id) {
            console.log('[useStorageEvents] Clearing selected conversation (deleted externally)');
            setSelectedToolItem(null);
          }
          // 刷新对话列表
          triggerAIConversationsRefresh();
          break;

        case 'folder':
          // 如果删除的是当前选中的文件夹，清空选中状态
          if (selectedFolderId === event.id) {
            console.log('[useStorageEvents] Clearing selected folder (deleted externally)');
            setSelectedFolder(null);
          }
          // 刷新文件夹列表
          loadFolders();
          break;
      }
    };

    const handleCreate = (event: StorageEvent) => {
      switch (event.entity) {
        case 'note':
          // 刷新便签列表
          if (selectedFolderId) {
            loadNotes(selectedFolderId);
          }
          break;

        case 'aiConversation':
          // 刷新对话列表
          loadAIConversations();
          break;

        case 'folder':
          // 刷新文件夹列表
          loadFolders();
          break;
      }
    };

    const handleUpdate = (event: StorageEvent) => {
      // 更新事件通常不需要额外处理
      // 各组件会通过自己的状态管理来更新
      switch (event.entity) {
        case 'note':
          triggerListRefresh();
          break;
        case 'aiConversation':
          triggerAIConversationsRefresh();
          break;
      }
    };

    // 订阅事件
    const unsubscribe = window.storageEvents.onEvent(handleEvent);

    return () => {
      unsubscribe();
    };
  }, [
    selectedNoteId,
    selectedFolderId,
    selectedToolItemId,
    setSelectedNote,
    setSelectedFolder,
    setSelectedToolItem,
    loadNotes,
    loadFolders,
    loadAIConversations,
    triggerListRefresh,
    triggerAIConversationsRefresh,
  ]);
}
