/**
 * PillWindow.tsx
 * 便签药丸窗口组件 - 使用 BasePillWindow 基础组件
 */

import React, { useState, useEffect } from 'react';
import { BasePillWindow } from '../BasePillWindow';
import { useNoteCardTheme } from '../../hooks/useNoteCardTheme';
import type { NoteColor } from '../../services/types';
import './PillWindow.css';

// 便签装饰图标
const NoteIcon: React.FC = () => (
  <div className="pill-note-icon">
    <div className="pill-note-icon__card">
      <div className="pill-note-icon__shine" />
      <div className="pill-note-icon__lines" />
    </div>
  </div>
);

interface PillWindowProps {
  noteId: string;
}

const PillWindow: React.FC<PillWindowProps> = ({ noteId }) => {
  const [noteTitle, setNoteTitle] = useState<string>('');
  const [noteColor, setNoteColor] = useState<NoteColor>('ffffff');
  const [isLoading, setIsLoading] = useState(true);

  const { bgColor: pillBgColor, isDark } = useNoteCardTheme(noteColor, '#ffffff', false);

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

  const handleRestore = async () => {
    await window.floatingWindow?.restoreWindow(noteId);
  };

  if (isLoading) {
    return (
      <BasePillWindow
        title="加载中..."
        bgColor={pillBgColor}
        textColor={isDark ? '#ffffff' : '#2d2d2d'}
        icon={<NoteIcon />}
        onRestore={handleRestore}
        className="note-pill-window"
      />
    );
  }

  return (
    <BasePillWindow
      title={noteTitle || '无标题'}
      bgColor={pillBgColor}
      textColor={isDark ? '#ffffff' : '#2d2d2d'}
      icon={<NoteIcon />}
      onRestore={handleRestore}
      className="note-pill-window"
    />
  );
};

export default PillWindow;
