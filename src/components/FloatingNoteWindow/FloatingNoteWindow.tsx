/**
 * FloatingNoteWindow.tsx
 * 悬浮便签窗口组件 - 使用 BaseFloatingWindow 基础组件
 *
 * 微软便签风格：头部颜色根据便签卡片颜色动态变动
 */

import React, { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { message, Spin } from 'antd';
import { BaseFloatingWindow } from '../BaseFloatingWindow';
import { useNoteCardTheme } from '../../hooks/useNoteCardTheme';
import type { TipTapJSONContent, NoteColor } from '../../services/types';
import './FloatingNoteWindow.css';

// 懒加载编辑器
const TipTapEditor = lazy(() =>
  import('../../features/editor').then((module) => ({ default: module.TipTapEditor })),
);

interface FloatingNoteWindowProps {
  noteId: string;
}

const FloatingNoteWindow: React.FC<FloatingNoteWindowProps> = ({ noteId }) => {
  const [noteTitle, setNoteTitle] = useState<string>('');
  const [editorContent, setEditorContent] = useState<TipTapJSONContent | null>(null);
  const [noteColor, setNoteColor] = useState<NoteColor>('ffffff');
  const [isLoading, setIsLoading] = useState(true);
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 使用便签卡片主题 hook 获取颜色
  const { bgColor: headerBgColor, isDark } = useNoteCardTheme(noteColor, '#ffffff', false);

  useEffect(() => {
    if (!noteId) return;

    const loadNote = async () => {
      try {
        const note = await window.storage.getNote(noteId);
        setNoteTitle(note.title);
        setEditorContent(note.content);
        setNoteColor(note.color || 'ffffff');
        setIsLoading(false);
      } catch (error) {
        console.error('Failed to load note:', error);
        message.error('加载便签失败');
      }
    };

    loadNote();
  }, [noteId]);

  // 监听便签数据变化
  useEffect(() => {
    if (!noteId) return;

    const handleNoteUpdate = async (_event: unknown, updatedNoteId: string) => {
      if (updatedNoteId === noteId) {
        try {
          const note = await window.storage.getNote(noteId);
          setNoteTitle(note.title);
          setNoteColor(note.color || 'ffffff');
          if (editorContent) {
            setEditorContent(note.content);
          }
        } catch (error) {
          console.error('Failed to reload note:', error);
        }
      }
    };

    window.ipcRenderer?.on('note:updated', handleNoteUpdate);
    return () => {
      window.ipcRenderer?.off('note:updated', handleNoteUpdate);
    };
  }, [noteId, editorContent]);

  // 防抖保存
  const debouncedSave = useCallback(
    (title: string, content: TipTapJSONContent) => {
      if (!noteId) return;

      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }

      saveTimerRef.current = setTimeout(async () => {
        try {
          await window.storage.updateNote(noteId, { title, content });

          window.ipcRenderer?.send('note:updated', noteId);
        } catch (error) {
          console.error('Failed to save note:', error);
          message.error('自动保存失败');
        }
      }, 2000);
    },
    [noteId],
  );

  const handleContentChange = (newContent: TipTapJSONContent) => {
    setEditorContent(newContent);
    debouncedSave(noteTitle, newContent);
  };

  const handleClose = () => {
    window.floatingWindow?.closeWindow(noteId);
  };

  const handleMinimize = async () => {
    await window.floatingWindow?.minimizeWindow(noteId);
  };

  // 清除定时器
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  if (isLoading) {
    return null;
  }

  const titlebarTextColor = isDark ? '#ffffff' : '#2d2d2d';

  return (
    <BaseFloatingWindow
      title={noteTitle || '无标题'}
      headerColor={headerBgColor}
      titleColor={titlebarTextColor}
      onClose={handleClose}
      onMinimize={handleMinimize}
      className="floating-note-window"
    >
      <div className="floating-note-editor">
        <Suspense
          fallback={
            <div style={{ padding: '16px', textAlign: 'center' }}>
              <Spin />
            </div>
          }
        >
          <TipTapEditor
            initialContent={editorContent || { type: 'doc', content: [] }}
            contentId={noteId}
            onContentChange={handleContentChange}
            placeholder="开始输入..."
            editable={true}
            showMenuBar={true}
            showTitleInput={false}
            disableSlashCommand={true}
          />
        </Suspense>
      </div>
    </BaseFloatingWindow>
  );
};

export default FloatingNoteWindow;
