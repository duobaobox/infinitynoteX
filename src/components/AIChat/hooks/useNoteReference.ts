/**
 * useNoteReference - 便签引用管理 Hook
 *
 * 功能：
 * 1. 获取最近编辑的便签列表
 * 2. 提供获取单个便签内容的方法（用于发送前获取）
 */

import { useState, useEffect, useCallback } from 'react';
import { noteService } from '../../../services';

export interface ReferencedNote {
  id: string;
  title: string;
  excerpt: string;
}

export interface UseNoteReferenceResult {
  // 可选的便签列表
  availableNotes: ReferencedNote[];
  // 是否正在加载
  loading: boolean;
  // 获取多个便签内容文本（根据 ID 列表）
  getNoteContents: (noteIds: string[]) => Promise<string>;
}

/**
 * 便签引用 Hook
 */
export const useNoteReference = (folderId: string = 'default'): UseNoteReferenceResult => {
  const [availableNotes, setAvailableNotes] = useState<ReferencedNote[]>([]);
  const [loading, setLoading] = useState(false);

  // 加载最近的便签列表（最多10条）
  useEffect(() => {
    const loadNotes = async () => {
      setLoading(true);
      try {
        const notes = await noteService.listNotes(folderId);
        // 按更新时间倒序，取前10条
        const recentNotes = notes
          .sort((a, b) => b.updatedAt - a.updatedAt)
          .slice(0, 10)
          .map((note) => ({
            id: note.id,
            title: note.title || '无标题',
            excerpt: note.excerpt || '',
          }));
        setAvailableNotes(recentNotes);
      } catch (error) {
        console.error('Failed to load notes for reference:', error);
        setAvailableNotes([]);
      } finally {
        setLoading(false);
      }
    };

    loadNotes();
  }, [folderId]);

  // 获取多个便签内容作为上下文
  const getNoteContents = useCallback(
    async (noteIds: string[]): Promise<string> => {
      if (noteIds.length === 0) {
        return '';
      }

      try {
        const contents = await Promise.all(
          noteIds.map(async (noteId) => {
            const note = availableNotes.find((n) => n.id === noteId);
            const fullNote = await noteService.getNote(noteId);
            const title = note?.title || '便签';
            // 将 TipTap JSON 转换为纯文本
            const text = extractTextFromTipTap(fullNote.content);
            return `## ${title}\n\n${text}`;
          }),
        );

        return `\n\n--- 参考便签 ---\n\n${contents.join('\n\n---\n\n')}\n\n--- 参考便签结束 ---\n\n`;
      } catch (error) {
        console.error('Failed to get notes context:', error);
        return '';
      }
    },
    [availableNotes],
  );

  return {
    availableNotes,
    loading,
    getNoteContents,
  };
};

/**
 * 从 TipTap JSON 提取纯文本
 */
function extractTextFromTipTap(content: any): string {
  if (!content) return '';

  if (typeof content === 'string') return content;

  if (Array.isArray(content)) {
    return content.map(extractTextFromTipTap).join('');
  }

  if (typeof content === 'object') {
    // 处理 TipTap 节点
    if (content.type === 'text') {
      return content.text || '';
    }

    if (content.content && Array.isArray(content.content)) {
      const texts = content.content.map(extractTextFromTipTap).join('');

      // 为段落、标题等添加换行
      if (['paragraph', 'heading', 'codeBlock'].includes(content.type)) {
        return texts + '\n';
      }

      return texts;
    }
  }

  return '';
}
