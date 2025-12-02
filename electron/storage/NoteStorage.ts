/**
 * 便签存储模块
 * 负责便签的 CRUD 操作
 */

import fs from 'node:fs/promises';
import type { StorageContext } from './StorageContext';
import type { FolderStorage } from './FolderStorage';
import type { Note, NoteIndex, CreateNotePayload } from './types';
import type { TipTapJSONContent } from '../../src/services/types';
import { StorageError, StorageErrorCode } from './errors';
import { generateId, readJsonFile, writeJsonFile, writeJsonFileAtomic, fileExists } from './utils';

export class NoteStorage {
  private indexCache: NoteIndex[] | null = null;
  private context: StorageContext;
  private folderStorage: FolderStorage;

  constructor(context: StorageContext, folderStorage: FolderStorage) {
    this.context = context;
    this.folderStorage = folderStorage;
  }

  /**
   * 列出便签索引
   */
  async list(folderId?: string): Promise<NoteIndex[]> {
    if (!this.indexCache) {
      await this.loadCache();
    }

    const allNotes = this.indexCache || [];

    if (folderId) {
      return allNotes.filter((n) => n.folderId === folderId);
    }

    return allNotes;
  }

  /**
   * 创建便签
   */
  async create(folderId: string, payload?: CreateNotePayload): Promise<Note> {
    // 验证文件夹存在
    const folderExists = await this.folderStorage.exists(folderId);
    if (!folderExists) {
      throw new StorageError(StorageErrorCode.E_NOT_FOUND, `Folder not found: ${folderId}`);
    }

    const now = Date.now();
    const newNote: Note = {
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

    // 保存完整便签
    await this.save(newNote);

    return newNote;
  }

  /**
   * 获取便签完整内容
   */
  async get(id: string): Promise<Note> {
    const notePath = this.context.getNotePath(id);
    const exists = await fileExists(notePath);

    if (!exists) {
      throw new StorageError(StorageErrorCode.E_NOT_FOUND, `Note not found: ${id}`);
    }

    return await readJsonFile<Note>(notePath);
  }

  /**
   * 更新便签
   */
  async update(id: string, patch: Partial<Note>): Promise<Note> {
    const note = await this.get(id);

    // 更新字段
    Object.assign(note, patch);
    note.updatedAt = Date.now();

    // 保存
    await this.save(note);

    return note;
  }

  /**
   * 删除便签
   */
  async delete(id: string): Promise<void> {
    const notePath = this.context.getNotePath(id);
    const exists = await fileExists(notePath);

    if (!exists) {
      throw new StorageError(StorageErrorCode.E_NOT_FOUND, `Note not found: ${id}`);
    }

    // 删除文件
    await fs.unlink(notePath);

    // 从索引中移除
    const index = this.indexCache || [];
    const noteIndex = index.findIndex((n) => n.id === id);
    if (noteIndex >= 0) {
      index.splice(noteIndex, 1);
      await this.saveIndex(index);
    }
  }

  /**
   * 将便签移动到指定文件夹
   */
  async moveToFolder(noteId: string, targetFolderId: string): Promise<Note> {
    const note = await this.get(noteId);
    note.folderId = targetFolderId;
    note.updatedAt = Date.now();
    await this.save(note);
    return note;
  }

  /**
   * 批量将便签移动到指定文件夹
   */
  async batchMoveToFolder(noteIds: string[], targetFolderId: string): Promise<void> {
    for (const noteId of noteIds) {
      await this.moveToFolder(noteId, targetFolderId);
    }
  }

  /**
   * 加载缓存
   */
  async loadCache(): Promise<void> {
    this.indexCache = await readJsonFile<NoteIndex[]>(this.context.notesIndexPath, []);
  }

  /**
   * 清空缓存
   */
  clearCache(): void {
    this.indexCache = null;
  }

  /**
   * 获取缓存数量（用于统计）
   */
  getCacheCount(): number {
    return this.indexCache?.length || 0;
  }

  /**
   * 创建空索引文件
   */
  async createEmptyIndex(): Promise<void> {
    await writeJsonFile(this.context.notesIndexPath, []);
  }

  /**
   * 保存便签
   * 先写正文，再更新索引
   */
  private async save(note: Note): Promise<void> {
    // 1. 保存完整便签（原子写入）
    const notePath = this.context.getNotePath(note.id);
    await writeJsonFileAtomic(notePath, note, this.context.tempDir);

    // 2. 更新索引
    const index = this.indexCache || [];
    const existingIndex = index.findIndex((n) => n.id === note.id);

    const noteIndex: NoteIndex = {
      id: note.id,
      folderId: note.folderId,
      title: note.title,
      excerpt: this.generateExcerpt(note.content),
      updatedAt: note.updatedAt,
      pinned: note.pinned,
      tags: note.tags,
      color: note.color ?? 'ffffff',
    };

    if (existingIndex >= 0) {
      index[existingIndex] = noteIndex;
    } else {
      index.push(noteIndex);
    }

    await this.saveIndex(index);
  }

  /**
   * 保存便签索引
   */
  private async saveIndex(index: NoteIndex[]): Promise<void> {
    await writeJsonFile(this.context.notesIndexPath, index);
    this.indexCache = index;
  }

  /**
   * 生成摘要
   */
  private generateExcerpt(content: unknown): string {
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
