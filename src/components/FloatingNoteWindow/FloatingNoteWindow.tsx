/**
 * FloatingNoteWindow.tsx
 * 悬浮便签窗口组件 - 复用 TipTapEditor
 *
 * 微软便签风格：头部颜色根据便签卡片颜色动态变动
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { message } from 'antd';
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
  const [isFocused, setIsFocused] = useState(false);
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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

  // 监听便签数据变化（主窗口编辑时同步更新）
  useEffect(() => {
    if (!noteId) return;

    const handleNoteUpdate = async (_event: unknown, updatedNoteId: string) => {
      if (updatedNoteId === noteId) {
        try {
          const note = await window.storage.getNote(noteId);
          setNoteTitle(note.title);
          setNoteColor(note.color || 'ffffff');
          // 只有当编辑器已初始化时才更新内容
          if (editorContent) {
            setEditorContent(note.content);
          }
          // 不重新加载编辑器内容，避免光标跳动
        } catch (error) {
          console.error('Failed to reload note:', error);
        }
      }
    };

    // 监听主进程的数据更新通知
    window.ipcRenderer?.on('note:updated', handleNoteUpdate);

    return () => {
      window.ipcRenderer?.off('note:updated', handleNoteUpdate);
    };
  }, [noteId, editorContent]);

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
          // 通知主窗口该便签已更新
          window.ipcRenderer?.send('floating-note:changed', noteId);
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
    window.floatingWindow?.closeWindow(noteId);
  };

  // 容器获得焦点（编辑器或其内部元素获得焦点）
  const handleContainerFocus = () => {
    setIsFocused(true);
  };

  // 容器失焦（焦点移出编辑器）
  const handleContainerBlur = (e: React.FocusEvent) => {
    // 检查焦点是否移到容器外部
    if (!containerRef.current?.contains(e.relatedTarget as Node)) {
      setIsFocused(false);
    }
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
    <div
      className="floating-note-container"
      ref={containerRef}
      onFocus={handleContainerFocus}
      onBlur={handleContainerBlur}
      tabIndex={-1}
    >
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
        {/* 仅在聚焦状态下显示控制按钮 */}
        {isFocused && (
          <div className="floating-note-controls">
            <button
              className="floating-note-control-btn"
              onClick={() => {
                // TODO: 实现更多功能
              }}
              title="更多选项"
              style={{ color: titlebarTextColor }}
            >
              <i className="ri-more-2-line" />
            </button>
            <button
              className="floating-note-control-btn floating-note-close-btn"
              onClick={handleClose}
              title="关闭"
              style={{ color: titlebarTextColor }}
            >
              <i className="ri-close-line" />
            </button>
          </div>
        )}
      </div>

      {/* 编辑器内容 */}
      <div className={`floating-note-editor ${isFocused ? 'focused' : ''}`}>
        <TipTapEditor
          initialContent={editorContent || { type: 'doc', content: [] }}
          onContentChange={handleContentChange}
          placeholder="开始输入..."
          editable={true}
          showMenuBar={isFocused}
          showTitleInput={false}
        />
      </div>
    </div>
  );
};

export default FloatingNoteWindow;
