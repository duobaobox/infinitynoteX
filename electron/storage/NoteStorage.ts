/**
 * 便签存储模块
 * 继承 BaseDirectoryStorage，添加便签特有的逻辑
 */

import type { StorageContext } from './StorageContext';
import type { FolderStorage } from './FolderStorage';
import type { Note, NoteIndex, CreateNotePayload } from './types';
import type { TipTapJSONContent } from '../../src/services/types';
import { StorageError, StorageErrorCode } from './errors';
import { BaseDirectoryStorage } from './core/BaseStorage';
import { getModuleConfig } from './core/moduleRegistry';
import { generateId } from './utils';

// 获取 notes 模块配置
const notesConfig = getModuleConfig('notes')!;

export class NoteStorage extends BaseDirectoryStorage<Note, NoteIndex> {
  private folderStorage: FolderStorage;

  constructor(context: StorageContext, folderStorage: FolderStorage) {
    super(context.currentPath, context.tempDir, notesConfig);
    this.folderStorage = folderStorage;
  }

  // ============ 重写列表方法以支持按文件夹筛选 ============

  /**
   * 列出便签索引
   * @param folderId 可选，按文件夹筛选
   */
  async list(folderId?: string): Promise<NoteIndex[]> {
    const allNotes = await super.list();

    if (folderId) {
      return allNotes.filter((n) => n.folderId === folderId);
    }

    return allNotes;
  }

  // ============ 重写创建方法以支持文件夹验证 ============

  /**
   * 创建便签
   */
  async createNote(folderId: string, payload?: CreateNotePayload): Promise<Note> {
    // 验证文件夹存在
    const folderExists = await this.folderStorage.exists(folderId);
    if (!folderExists) {
      throw new StorageError(StorageErrorCode.E_NOT_FOUND, `Folder not found: ${folderId}`);
    }

    const now = Date.now();
    const note: Note = {
      id: generateId(),
      folderId,
      title: payload?.title || '无标题',
      content: payload?.content || { type: 'doc', content: [] },
      tags: [],
      pinned: false,
      color: 'ffffff',
      createdAt: now,
      updatedAt: now,
    };

    // 使用基类的写入和索引更新方法
    await this['writeFile'](note);
    await this['addToIndex'](note);

    return note;
  }

  // ============ 便签特有方法 ============

  /**
   * 将便签移动到指定文件夹
   */
  async moveToFolder(noteId: string, targetFolderId: string): Promise<Note> {
    return await this.update(noteId, { folderId: targetFolderId } as Partial<Note>);
  }

  /**
   * 批量将便签移动到指定文件夹
   */
  async batchMoveToFolder(noteIds: string[], targetFolderId: string): Promise<void> {
    for (const noteId of noteIds) {
      await this.moveToFolder(noteId, targetFolderId);
    }
  }

  // ============ 实现抽象方法 ============

  /**
   * 将 Note 转换为 NoteIndex
   */
  protected toIndex(note: Note): NoteIndex {
    return {
      id: note.id,
      folderId: note.folderId,
      title: note.title,
      excerpt: this.generateNoteExcerpt(note.content),
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
      pinned: note.pinned,
      tags: note.tags,
      color: note.color,
    };
  }

  /**
   * 创建默认数据（基类抽象方法，这里不使用，通过 createNote 覆盖）
   */
  protected createDefaultData(id: string, now: number, payload: Partial<Note>): Note {
    return {
      id,
      folderId: payload.folderId || 'default',
      title: payload.title || '无标题',
      content: payload.content || { type: 'doc', content: [] },
      tags: payload.tags || [],
      pinned: payload.pinned || false,
      color: payload.color || 'ffffff',
      createdAt: now,
      updatedAt: now,
    };
  }

  // ============ 私有方法 ============

  /**
   * 生成便签摘要
   */
  private generateNoteExcerpt(content: unknown): string {
    try {
      const isObj = (v: unknown): v is { [k: string]: unknown } =>
        typeof v === 'object' && v !== null;
      if (!isObj(content)) return '';

      const root = content as TipTapJSONContent;
      if (!Array.isArray(root.content)) return '';

      let text = '';
      const extractText = (node: TipTapJSONContent) => {
        if (node.type === 'text' && typeof node.text === 'string') {
          text += node.text;
        }
        if (node.content && Array.isArray(node.content)) {
          node.content.forEach(extractText);
        }
      };

      extractText(root);
      return text.slice(0, 100);
    } catch {
      return '';
    }
  }
}
