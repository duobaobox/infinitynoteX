/**
 * PillWindow.tsx
 * 药丸最小化窗口组件 - 轻量级显示便签标题
 */

import React, { useState, useEffect } from 'react';
import { useNoteCardTheme } from '../../features/workspace/NoteCard/useNoteCardTheme';
import CardBackground from '../CardBackground/CardBackground';
import type { NoteColor } from '../../services/types';
import './PillWindow.css';

interface PillWindowProps {
  noteId: string;
}

const PillWindow: React.FC<PillWindowProps> = ({ noteId }) => {
  const [noteTitle, setNoteTitle] = useState<string>('');
  const [noteColor, setNoteColor] = useState<NoteColor>('ffffff');
  const [isLoading, setIsLoading] = useState(true);

  // 使用便签卡片主题 hook 获取颜色
  const { bgColor: pillBgColor, isDark } = useNoteCardTheme(noteColor, '#ffffff', false);

  // 加载便签基本信息（仅标题和颜色）
  useEffect(() => {
    if (!noteId) {
      setIsLoading(false);
      return;
    }

    const loadNoteInfo = async () => {
      try {
        const note = await window.storage.getNote(noteId);
        if (!note) {
          setIsLoading(false);
          return;
        }
        setNoteTitle(note.title);
        setNoteColor(note.color || 'ffffff');
        setIsLoading(false);
      } catch (error) {
        console.error('Failed to load note info:', error);
        setIsLoading(false);
      }
    };

    loadNoteInfo();
  }, [noteId]);

  // 监听便签标题和颜色变化
  useEffect(() => {
    if (!noteId) return;

    const handleNoteUpdate = async (_event: unknown, updatedNoteId: string) => {
      if (updatedNoteId === noteId) {
        try {
          const note = await window.storage.getNote(noteId);
          setNoteTitle(note.title);
          setNoteColor(note.color || 'ffffff');
        } catch (error) {
          console.error('Failed to reload note info:', error);
        }
      }
    };

    window.ipcRenderer?.on('note:updated', handleNoteUpdate);

    return () => {
      window.ipcRenderer?.off('note:updated', handleNoteUpdate);
    };
  }, [noteId]);

  // 恢复到正常窗口
  const handleRestore = async () => {
    await window.floatingWindow?.restoreWindow(noteId);
  };

  if (isLoading) {
    return (
      <div
        className="pill-window"
        style={{
          backgroundColor: pillBgColor,
          color: isDark ? '#ffffff' : '#2d2d2d',
        }}
      >
        <CardBackground className="pill-window-pattern" />
        <span className="pill-title">加载中...</span>
      </div>
    );
  }

  return (
    <div
      className="pill-window"
      style={{
        backgroundColor: pillBgColor,
        color: isDark ? '#ffffff' : '#2d2d2d',
      }}
    >
      <CardBackground className="pill-window-pattern" />
      <span className="pill-title" title={noteTitle || '无标题'}>
        {noteTitle || '无标题'}
      </span>
      <div className="pill-buttons">
        <button
          className="pill-btn"
          title="恢复"
          onClick={handleRestore}
          style={{ color: isDark ? '#ffffff' : '#2d2d2d' }}
        >
          <i className="ri-fullscreen-line" />
        </button>
      </div>
    </div>
  );
};

export default PillWindow;
