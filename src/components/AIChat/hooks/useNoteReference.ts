/**
 * useNoteReference - 便签引用管理 Hook
 *
 * 功能：
 * 1. 获取最近编辑的便签列表
 * 2. 管理选中的便签引用
 * 3. 提供便签内容作为 AI 上下文
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
  // 当前选中的便签
  selectedNotes: ReferencedNote[];
  // 是否正在加载
  loading: boolean;
  // 选择便签
  selectNote: (note: ReferencedNote) => void;
  // 取消选择
  unselectNote: (noteId: string) => void;
  // 清空选择
  clearSelection: () => void;
  // 获取便签内容文本（用于发送给 AI）
  getNotesContext: () => Promise<string>;
}

/**
 * 便签引用 Hook
 */
export const useNoteReference = (folderId: string = 'default'): UseNoteReferenceResult => {
  const [availableNotes, setAvailableNotes] = useState<ReferencedNote[]>([]);
  const [selectedNotes, setSelectedNotes] = useState<ReferencedNote[]>([]);
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

  // 选择便签
  const selectNote = useCallback((note: ReferencedNote) => {
    setSelectedNotes((prev) => {
      // 避免重复选择
      if (prev.some((n) => n.id === note.id)) {
        return prev;
      }
      return [...prev, note];
    });
  }, []);

  // 取消选择
  const unselectNote = useCallback((noteId: string) => {
    setSelectedNotes((prev) => prev.filter((n) => n.id !== noteId));
  }, []);

  // 清空选择
  const clearSelection = useCallback(() => {
    setSelectedNotes([]);
  }, []);

  // 获取便签内容作为上下文
  const getNotesContext = useCallback(async (): Promise<string> => {
    if (selectedNotes.length === 0) {
      return '';
    }

    try {
      const contents = await Promise.all(
        selectedNotes.map(async (note) => {
          const fullNote = await noteService.getNote(note.id);
          // 将 TipTap JSON 转换为纯文本
          const text = extractTextFromTipTap(fullNote.content);
          return `## ${note.title}\n\n${text}`;
        }),
      );

      return `\n\n--- 参考便签 ---\n\n${contents.join('\n\n---\n\n')}\n\n--- 参考便签结束 ---\n\n`;
    } catch (error) {
      console.error('Failed to get notes context:', error);
      return '';
    }
  }, [selectedNotes]);

  return {
    availableNotes,
    selectedNotes,
    loading,
    selectNote,
    unselectNote,
    clearSelection,
    getNotesContext,
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
