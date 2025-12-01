/**
 * Note Service - 便签数据服务
 *
 * 封装便签相关的所有数据操作，提供统一的接口。
 * 便于测试 mock 和后续扩展（如添加缓存、事件通知等）。
 */

import type { Note, NoteIndex, CreateNotePayload, UpdateNotePayload, NoteColor } from './types';

class NoteService {
  /**
   * 获取文件夹下的便签列表
   */
  async listNotes(folderId: string): Promise<NoteIndex[]> {
    return window.storage.listNotes(folderId);
  }

  /**
   * 获取单个便签详情
   */
  async getNote(id: string): Promise<Note> {
    return window.storage.getNote(id);
  }

  /**
   * 创建新便签
   */
  async createNote(folderId: string, payload: CreateNotePayload = {}): Promise<Note> {
    return window.storage.createNote(folderId, payload);
  }

  /**
   * 更新便签
   */
  async updateNote(id: string, payload: UpdateNotePayload): Promise<void> {
    await window.storage.updateNote(id, payload);
  }

  /**
   * 更新便签颜色
   */
  async updateNoteColor(id: string, color: NoteColor): Promise<void> {
    await window.storage.updateNote(id, { color });
  }

  /**
   * 切换便签置顶状态
   */
  async togglePinned(id: string, pinned: boolean): Promise<void> {
    await window.storage.updateNote(id, { pinned });
  }

  /**
   * 删除便签
   */
  async deleteNote(id: string): Promise<void> {
    await window.storage.deleteNote(id);
  }
}

// 导出单例实例
export const noteService = new NoteService();

// 同时导出类型，便于测试时 mock
export type { NoteService };
