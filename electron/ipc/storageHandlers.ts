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
import { storageManager } from '../storage';
import { emitCreated, emitDeleted } from '../storage/storageEvents';

/**
 * 注册存储相关 IPC 处理器
 */
export function registerStorageHandlers(): void {
  // ============ 路径管理 ============

  ipcMain.handle('storage:getDefaultPath', () => {
    return storageManager.getDefaultPath();
  });

  ipcMain.handle('storage:getCurrentPath', () => {
    return storageManager.getCurrentPath();
  });

  ipcMain.handle('storage:isFirstLaunch', async () => {
    return await storageManager.isFirstLaunch();
  });

  ipcMain.handle('storage:markInitialized', async () => {
    await storageManager.markInitialized();
  });

  ipcMain.handle(
    'storage:setStoragePath',
    async (_, nextPath: string, options?: SetStoragePathOptions) => {
      await storageManager.setStoragePath(nextPath, options);
    },
  );

  ipcMain.handle('storage:healthCheck', async () => {
    return await storageManager.healthCheck();
  });

  ipcMain.handle('storage:openInFinder', async () => {
    await storageManager.openInFinder();
  });

  ipcMain.handle('storage:getStats', async () => {
    return await storageManager.getStats();
  });

  ipcMain.handle('storage:createBackup', async () => {
    return await storageManager.createBackup();
  });

  ipcMain.handle('storage:restoreBackup', async (_, backupFilePath: string) => {
    await storageManager.restoreBackup(backupFilePath);
  });

  ipcMain.handle('storage:exportData', async (_, targetPath: string) => {
    await storageManager.exportData(targetPath);
  });

  ipcMain.handle('storage:resetAllData', async () => {
    await storageManager.resetAllData();
  });

  // ============ 文件夹操作 ============

  ipcMain.handle('storage:listFolders', async () => {
    return await storageManager.folders.getAll();
  });

  ipcMain.handle('storage:createFolder', async (_, name: string) => {
    return await storageManager.folders.createFolder(name);
  });

  ipcMain.handle('storage:renameFolder', async (_, id: string, name: string) => {
    return await storageManager.folders.rename(id, name);
  });

  ipcMain.handle('storage:deleteFolder', async (_, id: string) => {
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

  ipcMain.handle('storage:listNotes', async (_, folderId?: string) => {
    return await storageManager.notes.list(folderId);
  });

  ipcMain.handle('storage:createNote', async (_, folderId: string, payload?: CreateNotePayload) => {
    const note = await storageManager.notes.createNote(folderId, payload);
    emitCreated('note', note.id);
    return note;
  });

  ipcMain.handle('storage:getNote', async (_, id: string) => {
    return await storageManager.notes.get(id);
  });

  ipcMain.handle('storage:updateNote', async (_, id: string, patch: UpdateNotePayload) => {
    return await storageManager.notes.update(id, patch);
  });

  // 同步更新便签（用于 beforeunload 等关键场景）
  ipcMain.on('storage:updateNoteSync', (event, id: string, patch: UpdateNotePayload) => {
    storageManager.notes
      .update(id, patch)
      .then(() => {
        event.returnValue = true;
      })
      .catch((err) => {
        console.error('Failed to sync update note:', err);
        event.returnValue = false;
      });
  });

  ipcMain.handle('storage:deleteNote', async (_, id: string) => {
    const note = await storageManager.notes.get(id);
    // 移入回收站
    await storageManager.trash.moveToTrash(note);
    // 从便签列表中删除
    await storageManager.notes.delete(id);
    // 发送删除事件
    emitDeleted('note', id);
  });

  // ============ AI 对话操作 ============

  ipcMain.handle('storage:getAIConversations', async () => {
    return await storageManager.ai.getAll();
  });

  ipcMain.handle('storage:createAIConversation', async (_, title?: string) => {
    const conversation = await storageManager.ai.createConversation(title);
    emitCreated('aiConversation', conversation.id);
    return conversation;
  });

  ipcMain.handle('storage:deleteAIConversation', async (_, id: string) => {
    await storageManager.ai.delete(id);
    emitDeleted('aiConversation', id);
  });

  ipcMain.handle(
    'storage:saveAIConversationMessages',
    async (
      _,
      id: string,
      messages: AIMessage[],
      options?: { source?: 'note' | 'workbench' | 'global' },
    ) => {
      return await storageManager.ai.saveMessages(id, messages, options);
    },
  );

  ipcMain.handle('storage:updateAIConversationTitle', async (_, id: string, title: string) => {
    return await storageManager.ai.updateTitle(id, title);
  });

  // ============ 回收站操作 ============

  ipcMain.handle('storage:listTrash', async () => {
    return await storageManager.trash.list();
  });

  ipcMain.handle('storage:getTrashItem', async (_, id: string) => {
    return await storageManager.trash.get(id);
  });

  ipcMain.handle('storage:restoreNote', async (_, trashItemId: string, targetFolderId?: string) => {
    // 1. 从回收站还原（获取元数据）
    const restoredNote = await storageManager.trash.restore(trashItemId);

    // 2. 确定目标文件夹
    const originalFolderExists = await storageManager.folders.exists(restoredNote.folderId);
    let folderId = restoredNote.folderId;

    if (targetFolderId) {
      folderId = targetFolderId;
    } else if (!originalFolderExists) {
      folderId = 'default';
    }

    // 3. 创建新便签 (会生成新ID)
    const newNote = await storageManager.notes.createNote(folderId, {
      title: restoredNote.title,
      content: restoredNote.content,
    });
    // createNote 已触发 emitCreated

    // 4. 恢复其他属性 (Tags, Pinned, Color...)
    await storageManager.notes.update(newNote.id, {
      tags: restoredNote.tags,
      pinned: restoredNote.pinned,
      color: restoredNote.color,
    });

    return newNote;
  });

  ipcMain.handle('storage:deleteTrashItemPermanently', async (_, id: string) => {
    await storageManager.trash.permanentDelete(id);
  });

  ipcMain.handle('storage:emptyTrash', async () => {
    return await storageManager.trash.emptyTrash();
  });

  // ============ Todo 清单 ============

  ipcMain.handle('storage:listTodoLists', async () => {
    return await storageManager.todoLists.getAll();
  });

  ipcMain.handle('storage:createTodoList', async (_, name: string, color?: string) => {
    const nextOrder = await storageManager.todoLists.getNextOrder();
    return await storageManager.todoLists.create({ name, color, order: nextOrder });
  });

  ipcMain.handle(
    'storage:updateTodoList',
    async (_, id: string, patch: { name?: string; color?: string; order?: number }) => {
      return await storageManager.todoLists.update(id, patch);
    },
  );

  ipcMain.handle('storage:deleteTodoList', async (_, id: string) => {
    // 删除相关的手动任务
    await storageManager.manualTasks.deleteByListId(id);
    return await storageManager.todoLists.delete(id);
  });

  // ============ 手动任务 ============

  ipcMain.handle('storage:listManualTasks', async (_, listId?: string) => {
    if (listId) {
      return await storageManager.manualTasks.listByListId(listId);
    }
    return await storageManager.manualTasks.list();
  });

  ipcMain.handle(
    'storage:createManualTask',
    async (_, listId: string, text: string, dueDate?: number) => {
      const nextOrder = await storageManager.manualTasks.getNextOrder(listId);
      return await storageManager.manualTasks.create({ listId, text, order: nextOrder, dueDate });
    },
  );

  ipcMain.handle(
    'storage:updateManualTask',
    async (
      _,
      id: string,
      _listId: string,
      patch: { text?: string; checked?: boolean; order?: number; dueDate?: number },
    ) => {
      return await storageManager.manualTasks.update(id, patch);
    },
  );

  ipcMain.handle('storage:deleteManualTask', async (_, id: string) => {
    return await storageManager.manualTasks.delete(id);
  });

  ipcMain.handle('storage:toggleManualTask', async (_, id: string) => {
    const task = await storageManager.manualTasks.get(id);
    if (!task) throw new Error('Task not found');
    return await storageManager.manualTasks.update(id, { checked: !task.checked });
  });

  // ============ 浏览器卡片 ============

  ipcMain.handle('browserCards:list', async () => {
    return await storageManager.browserCards.list();
  });

  ipcMain.handle(
    'browserCards:create',
    async (_, card: { name: string; url: string; icon?: string }) => {
      return await storageManager.browserCards.create(card);
    },
  );

  ipcMain.handle(
    'browserCards:update',
    async (_, id: string, patch: { name?: string; url?: string; icon?: string }) => {
      return await storageManager.browserCards.update(id, patch);
    },
  );

  ipcMain.handle('browserCards:delete', async (_, id: string) => {
    await storageManager.browserCards.delete(id);
  });

  ipcMain.handle('browserCards:reorder', async (_, orderedIds: string[]) => {
    await storageManager.browserCards.reorder(orderedIds);
  });

  // ============ 附件 ============

  ipcMain.handle('attachments:save', async (_, data: { dataUrl: string; ext: string }) => {
    try {
      // 从 dataUrl 中提取 base64 数据
      const base64Match = data.dataUrl.match(/^data:image\/\w+;base64,(.+)$/);
      if (!base64Match) {
        throw new Error('Invalid data URL format');
      }
      const base64Data = base64Match[1];
      const id = await storageManager.attachments.save(base64Data, data.ext);
      const path = await storageManager.attachments.getPath(id);
      return { success: true, id, path };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, error: msg };
    }
  });

  ipcMain.handle('attachments:list', async () => {
    return await storageManager.attachments.list();
  });

  ipcMain.handle('attachments:cleanup', async () => {
    return await storageManager.cleanupOrphanedAttachments();
  });

  // ============ 系统对话框 ============

  ipcMain.handle('dialog:showOpenDialog', async (_, options: OpenDialogOptions) => {
    const result = await dialog.showOpenDialog(options);
    return result;
  });
}
