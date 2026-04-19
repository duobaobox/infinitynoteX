/**
 * Storage IPC Handlers
 * 存储相关 IPC 处理器 - 从 main.ts 抽离
 *
 * 注意：此模块不需要 __dirname，因为不涉及文件路径操作
 */

import { ipcMain, dialog } from 'electron';
import type { OpenDialogOptions } from 'electron';
import type {
  SetStoragePathOptions,
  CreateNotePayload,
  UpdateNotePayload,
  AIMessage,
} from '../../src/services/types';
import { IPC_CHANNELS, getIpcProxyChannel } from '../../src/shared/types/ipc';
import type { IpcProxyMethod } from '../../src/shared/types/ipc';
import { storageManager } from '../storage';
import { emitCreated, emitDeleted, emitUpdated } from '../storage/storageEvents';

const storageChannel = (method: IpcProxyMethod<'storage'>) => getIpcProxyChannel('storage', method);
const browserCardsChannel = (method: IpcProxyMethod<'browserCards'>) =>
  getIpcProxyChannel('browserCards', method);
const attachmentsChannel = (method: IpcProxyMethod<'attachments'>) =>
  getIpcProxyChannel('attachments', method);

/**
 * 注册存储相关 IPC 处理器
 */
export function registerStorageHandlers(): void {
  // ============ 路径管理 ============

  ipcMain.handle(storageChannel('getDefaultPath'), () => {
    return storageManager.getDefaultPath();
  });

  ipcMain.handle(storageChannel('getCurrentPath'), () => {
    return storageManager.getCurrentPath();
  });

  ipcMain.handle(storageChannel('isFirstLaunch'), async () => {
    return await storageManager.isFirstLaunch();
  });

  ipcMain.handle(storageChannel('markInitialized'), async () => {
    await storageManager.markInitialized();
  });

  ipcMain.handle(
    storageChannel('setStoragePath'),
    async (_, nextPath: string, options?: SetStoragePathOptions) => {
      await storageManager.setStoragePath(nextPath, options);
    },
  );

  ipcMain.handle(storageChannel('healthCheck'), async () => {
    return await storageManager.healthCheck();
  });

  ipcMain.handle(storageChannel('openInFinder'), async () => {
    await storageManager.openInFinder();
  });

  ipcMain.handle(storageChannel('getStats'), async () => {
    return await storageManager.getStats();
  });

  ipcMain.handle(storageChannel('createBackup'), async () => {
    return await storageManager.createBackup();
  });

  ipcMain.handle(storageChannel('restoreBackup'), async (_, backupFilePath: string) => {
    await storageManager.restoreBackup(backupFilePath);
  });

  ipcMain.handle(storageChannel('exportData'), async (_, targetPath: string) => {
    await storageManager.exportData(targetPath);
  });

  ipcMain.handle(storageChannel('resetAllData'), async () => {
    await storageManager.resetAllData();
  });

  // ============ 文件夹操作 ============

  ipcMain.handle(storageChannel('listFolders'), async () => {
    return await storageManager.folders.getAll();
  });

  ipcMain.handle(storageChannel('createFolder'), async (_, name: string) => {
    return await storageManager.folders.createFolder(name);
  });

  ipcMain.handle(storageChannel('renameFolder'), async (_, id: string, name: string) => {
    return await storageManager.folders.rename(id, name);
  });

  ipcMain.handle(storageChannel('deleteFolder'), async (_, id: string) => {
    // 只能通过 StorageManager 访问各模块，因此在这里组装业务逻辑
    // 1. 移动该文件夹下的便签到默认文件夹 (如果有)
    await storageManager.folders.deleteFolder(id, async (folderId) => {
      const notes = await storageManager.notes.list(folderId);
      for (const note of notes) {
        await storageManager.notes.moveToFolder(note.id, 'default');
      }
    });
    // 2. 发送删除事件
    emitDeleted('folder', id);
  });

  // ============ 便签操作 ============

  ipcMain.handle(storageChannel('listNotes'), async (_, folderId?: string) => {
    return await storageManager.notes.list(folderId);
  });

  ipcMain.handle(
    storageChannel('createNote'),
    async (_, folderId: string, payload?: CreateNotePayload) => {
      const note = await storageManager.notes.createNote(folderId, payload);
      emitCreated('note', note.id);
      return note;
    },
  );

  ipcMain.handle(storageChannel('getNote'), async (_, id: string) => {
    return await storageManager.notes.get(id);
  });

  ipcMain.handle(storageChannel('updateNote'), async (_, id: string, patch: UpdateNotePayload) => {
    return await storageManager.notes.update(id, patch);
  });

  ipcMain.handle(storageChannel('deleteNote'), async (_, id: string) => {
    await storageManager.noteLifecycle.deleteNote(id);
    // 发送删除事件
    emitDeleted('note', id);
  });

  // ============ AI 对话操作 ============

  ipcMain.handle(storageChannel('listAIConversationPreviews'), async () => {
    return await storageManager.ai.listPreviews();
  });

  ipcMain.handle(storageChannel('getAIConversation'), async (_, id: string) => {
    return await storageManager.ai.getConversation(id);
  });

  ipcMain.handle(
    storageChannel('resolveAIConversationBinding'),
    async (
      _,
      binding: { source: 'note' | 'global'; entityId: string },
      options?: { autoCreate?: boolean; title?: string },
    ) => {
      return await storageManager.ai.resolveBinding(binding.source, binding.entityId, options);
    },
  );

  ipcMain.handle(storageChannel('getAIConversations'), async () => {
    return await storageManager.ai.getAll();
  });

  ipcMain.handle(storageChannel('createAIConversation'), async (_, title?: string) => {
    const conversation = await storageManager.ai.createConversation(title);
    emitCreated('aiConversation', conversation.id);
    return conversation;
  });

  ipcMain.handle(storageChannel('deleteAIConversation'), async (_, id: string) => {
    await storageManager.ai.delete(id);
    emitDeleted('aiConversation', id);
  });

  ipcMain.handle(
    storageChannel('saveAIConversationMessages'),
    async (
      _,
      id: string,
      messages: AIMessage[],
      options?: {
        source?: 'note' | 'workbench' | 'canvas' | 'global';
        sourceEntityId?: string;
      },
    ) => {
      const conversation = await storageManager.ai.saveMessages(id, messages, options);
      emitUpdated('aiConversation', id);
      return conversation;
    },
  );

  ipcMain.handle(
    storageChannel('updateAIConversationTitle'),
    async (_, id: string, title: string) => {
      const conversation = await storageManager.ai.updateTitle(id, title);
      emitUpdated('aiConversation', id);
      return conversation;
    },
  );

  // ============ 回收站操作 ============

  ipcMain.handle(storageChannel('listTrash'), async () => {
    return await storageManager.trash.list();
  });

  ipcMain.handle(storageChannel('getTrashItem'), async (_, id: string) => {
    return await storageManager.trash.get(id);
  });

  ipcMain.handle(
    storageChannel('restoreNote'),
    async (_, trashItemId: string, targetFolderId?: string) => {
      return await storageManager.noteLifecycle.restoreNote(trashItemId, targetFolderId);
    },
  );

  ipcMain.handle(storageChannel('deleteTrashItemPermanently'), async (_, id: string) => {
    await storageManager.noteLifecycle.permanentlyDeleteTrashItem(id);
  });

  ipcMain.handle(storageChannel('emptyTrash'), async () => {
    const result = await storageManager.noteLifecycle.emptyTrash();
    return result.deletedCount;
  });

  // ============ Todo 清单 ============

  ipcMain.handle(storageChannel('listTodoLists'), async () => {
    return await storageManager.todoLists.getAll();
  });

  ipcMain.handle(storageChannel('createTodoList'), async (_, name: string, color?: string) => {
    const nextOrder = await storageManager.todoLists.getNextOrder();
    return await storageManager.todoLists.create({ name, color, order: nextOrder });
  });

  ipcMain.handle(
    storageChannel('updateTodoList'),
    async (_, id: string, patch: { name?: string; color?: string; order?: number }) => {
      return await storageManager.todoLists.update(id, patch);
    },
  );

  ipcMain.handle(storageChannel('deleteTodoList'), async (_, id: string) => {
    // 删除相关的手动任务
    await storageManager.manualTasks.deleteByListId(id);
    return await storageManager.todoLists.delete(id);
  });

  // ============ 手动任务 ============

  ipcMain.handle(storageChannel('listManualTasks'), async (_, listId?: string) => {
    if (listId) {
      return await storageManager.manualTasks.listByListId(listId);
    }
    return await storageManager.manualTasks.list();
  });

  ipcMain.handle(
    storageChannel('createManualTask'),
    async (_, listId: string, text: string, dueDate?: number) => {
      const nextOrder = await storageManager.manualTasks.getNextOrder(listId);
      return await storageManager.manualTasks.create({ listId, text, order: nextOrder, dueDate });
    },
  );

  ipcMain.handle(
    storageChannel('updateManualTask'),
    async (
      _,
      id: string,
      _listId: string,
      patch: { text?: string; checked?: boolean; order?: number; dueDate?: number },
    ) => {
      return await storageManager.manualTasks.update(id, patch);
    },
  );

  ipcMain.handle(storageChannel('deleteManualTask'), async (_, id: string) => {
    return await storageManager.manualTasks.delete(id);
  });

  ipcMain.handle(storageChannel('toggleManualTask'), async (_, id: string) => {
    const task = await storageManager.manualTasks.get(id);
    if (!task) throw new Error('Task not found');
    return await storageManager.manualTasks.update(id, { checked: !task.checked });
  });

  // ============ 网页看板卡片 ============

  ipcMain.handle(browserCardsChannel('list'), async () => {
    return await storageManager.browserCards.list();
  });

  ipcMain.handle(
    browserCardsChannel('create'),
    async (_, card: { name: string; url: string; icon?: string }) => {
      return await storageManager.browserCards.create(card);
    },
  );

  ipcMain.handle(
    browserCardsChannel('update'),
    async (_, id: string, patch: { name?: string; url?: string; icon?: string }) => {
      return await storageManager.browserCards.update(id, patch);
    },
  );

  ipcMain.handle(browserCardsChannel('delete'), async (_, id: string) => {
    await storageManager.browserCards.delete(id);
  });

  ipcMain.handle(browserCardsChannel('reorder'), async (_, orderedIds: string[]) => {
    await storageManager.browserCards.reorder(orderedIds);
  });

  // ============ 附件 ============

  ipcMain.handle(attachmentsChannel('save'), async (_, dataUrl: string) => {
    try {
      // 从 dataUrl 中提取文件类型和 base64 数据
      const match = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
      if (!match) {
        throw new Error('Invalid data URL format');
      }
      const ext = match[1];
      const base64Data = match[2];
      const id = await storageManager.attachments.save(base64Data, ext);
      const path = await storageManager.attachments.getPath(id);
      return { success: true, id, path };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, error: msg };
    }
  });

  ipcMain.handle(attachmentsChannel('getPath'), async (_, id: string) => {
    return await storageManager.attachments.getPath(id);
  });

  ipcMain.handle(attachmentsChannel('delete'), async (_, id: string) => {
    try {
      await storageManager.attachments.delete(id);
      return { success: true };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, error: msg };
    }
  });

  ipcMain.handle(attachmentsChannel('list'), async () => {
    return await storageManager.attachments.list();
  });

  ipcMain.handle(attachmentsChannel('cleanup'), async () => {
    return await storageManager.cleanupOrphanedAttachments();
  });

  // ============ 系统对话框 ============

  ipcMain.handle(IPC_CHANNELS.dialogShowOpen, async (_, options: OpenDialogOptions) => {
    const result = await dialog.showOpenDialog(options);
    return result;
  });
}
