import type { FolderStorage } from './FolderStorage';
import type { NoteStorage } from './NoteStorage';
import type { AIStorage } from './AIStorage';
import type { TrashStorage } from './TrashStorage';
import type { Note } from './types';

/**
 * 便签生命周期应用服务
 *
 * 将删除、恢复、回收站清理这些跨聚合流程从 IPC handler 中抽离出来，
 * 让 handler 只保留参数边界和事件分发职责。
 */
export class NoteLifecycleService {
  constructor(
    private readonly folders: FolderStorage,
    private readonly notes: NoteStorage,
    private readonly trash: TrashStorage,
    private readonly ai: AIStorage,
  ) {}

  async deleteNote(noteId: string): Promise<void> {
    const note = await this.notes.get(noteId);
    await this.trash.moveToTrash(note);
    await this.notes.delete(noteId);
  }

  async restoreNote(trashItemId: string, targetFolderId?: string): Promise<Note> {
    const restoredNote = await this.trash.restore(trashItemId);

    const originalFolderExists = await this.folders.exists(restoredNote.folderId);
    let folderId = restoredNote.folderId;

    if (targetFolderId) {
      folderId = targetFolderId;
    } else if (!originalFolderExists) {
      folderId = 'default';
    }

    const newNote = await this.notes.createNote(folderId, {
      title: restoredNote.title,
      content: restoredNote.content,
    });

    await this.notes.update(newNote.id, {
      tags: restoredNote.tags,
      pinned: restoredNote.pinned,
      color: restoredNote.color,
    });

    await this.ai.rebindSourceEntity('note', restoredNote.id, newNote.id);

    return newNote;
  }

  async permanentlyDeleteTrashItem(
    trashItemId: string,
  ): Promise<{ trashItemId: string; originalNoteId: string }> {
    const trashItem = await this.trash.get(trashItemId);
    await this.trash.permanentDelete(trashItemId);
    await this.ai.deleteBySourceEntity('note', trashItem.originalId);

    return {
      trashItemId,
      originalNoteId: trashItem.originalId,
    };
  }

  async emptyTrash(): Promise<{ deletedCount: number; deletedOriginalNoteIds: string[] }> {
    const trashItems = await this.trash.list();
    const deletedCount = await this.trash.emptyTrash();
    const deletedOriginalNoteIds = trashItems.map((item) => item.originalId);

    for (const noteId of deletedOriginalNoteIds) {
      await this.ai.deleteBySourceEntity('note', noteId);
    }

    return {
      deletedCount,
      deletedOriginalNoteIds,
    };
  }
}
