/**
 * FloatingNoteWindow.tsx
 * 悬浮便签窗口组件 - 复用 TipTapEditor
 *
 * 微软便签风格：头部颜色根据便签卡片颜色动态变动
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { message } from 'antd';
import { CloseOutlined, MinusOutlined } from '@ant-design/icons';
import TipTapEditor from '../TipTapEditor/TipTapEditor';
import { useNoteCardTheme } from '../NoteCard/useNoteCardTheme';
import type { TipTapJSONContent, NoteColor } from '../../services/types';
import './FloatingNoteWindow.css';

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

  // 加载便签内容
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

  // 节流保存函数 (800ms)
  const debouncedSave = useCallback(
    (title: string, content: TipTapJSONContent) => {
      if (!noteId) return;

      // 清除之前的定时器
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }

      // 设置新的定时器
      saveTimerRef.current = setTimeout(async () => {
        try {
          await window.storage.updateNote(noteId, {
            title,
            content,
          });
          console.log('Floating note auto-saved');
        } catch (error) {
          console.error('Failed to save note:', error);
          message.error('自动保存失败');
        }
      }, 800);
    },
    [noteId],
  );

  // 内容变更处理
  const handleContentChange = (newContent: TipTapJSONContent) => {
    setEditorContent(newContent);
    debouncedSave(noteTitle, newContent);
  };

  // 关闭窗口
  const handleClose = () => {
    window.electronAPI?.close();
  };

  // 最小化窗口
  const handleMinimize = () => {
    window.electronAPI?.minimize();
  };

  // 组件卸载时清除定时器
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  if (isLoading) {
    return (
      <div className="floating-note-container">
        <div className="floating-note-titlebar">
          <span>加载中...</span>
        </div>
      </div>
    );
  }

  // 计算标题栏文字颜色（根据背景色亮度自适应）
  const titlebarTextColor = isDark ? '#ffffff' : '#2d2d2d';

  return (
    <div className="floating-note-container">
      {/* 自定义标题栏 - 颜色根据便签卡片颜色动态变动 */}
      <div
        className="floating-note-titlebar"
        style={{
          backgroundColor: headerBgColor,
        }}
      >
        <span className="floating-note-title" style={{ color: titlebarTextColor }}>
          {noteTitle || '无标题'}
        </span>
        <div className="floating-note-controls">
          <button
            className="floating-note-control-btn"
            onClick={handleMinimize}
            title="最小化"
            style={{ color: titlebarTextColor }}
          >
            <MinusOutlined />
          </button>
          <button
            className="floating-note-control-btn floating-note-close-btn"
            onClick={handleClose}
            title="关闭"
            style={{ color: titlebarTextColor }}
          >
            <CloseOutlined />
          </button>
        </div>
      </div>

      {/* 编辑器内容 */}
      <div className="floating-note-editor">
        <TipTapEditor
          initialContent={editorContent || { type: 'doc', content: [] }}
          onContentChange={handleContentChange}
          placeholder="开始输入..."
          editable={true}
          showMenuBar={true}
          showTitleInput={false}
        />
      </div>
    </div>
  );
};

export default FloatingNoteWindow;
