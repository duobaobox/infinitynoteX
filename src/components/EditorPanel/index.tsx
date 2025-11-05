/**
 * EditorPanel/index.tsx
 * 编辑器面板主入口 - 管理 tab 切换和数据流
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Segmented, message } from 'antd';
import { EditOutlined, ToolOutlined, RobotOutlined, AppstoreOutlined } from '@ant-design/icons';
import type { TipTapJSONContent } from '../../services/types';
import { EditTab } from './EditTab';
import { ToolsTab } from './ToolsTab';
import { AITab } from './AITab';
import { OtherTab } from './OtherTab';
import type { NoteColor as NoteColorType } from '../../services/types';

type TabKeyType = 'edit' | 'tools' | 'ai' | 'other';

interface EditorPanelProps {
  noteId: string | null;
  onClose?: () => void;
  onSave?: () => void; // 保存完成时的回调
}

const EditorPanel: React.FC<EditorPanelProps> = ({ noteId, onSave }) => {
  const [noteTitle, setNoteTitle] = useState<string>('');
  const [editorContent, setEditorContent] = useState<TipTapJSONContent | string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKeyType>('edit');
  const [noteColor, setNoteColor] = useState<NoteColorType>('ffffff');
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const currentNoteIdRef = useRef<string | null>(null);

  // 加载便签内容
  useEffect(() => {
    if (!noteId) {
      setNoteTitle('');
      setEditorContent(null);
      return;
    }

    loadNote(noteId);
    currentNoteIdRef.current = noteId;
  }, [noteId]);

  const loadNote = async (id: string) => {
    try {
      const note = await window.storage.getNote(id);
      setNoteTitle(note.title);
      setEditorContent(note.content);
      setNoteColor(note.color || 'ffffff');
    } catch (error) {
      console.error('Failed to load note:', error);
      message.error('加载便签失败');
    }
  };

  // 节流保存函数 (800ms)
  const debouncedSave = useCallback(
    (title: string, content: TipTapJSONContent) => {
      if (!currentNoteIdRef.current) return;

      // 清除之前的定时器
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }

      // 设置新的定时器
      saveTimerRef.current = setTimeout(async () => {
        try {
          await window.storage.updateNote(currentNoteIdRef.current!, {
            title,
            content,
          });
          console.log('Note auto-saved');
          // 保存成功后调用回调，通知列表更新
          onSave?.();
        } catch (error) {
          console.error('Failed to save note:', error);
          message.error('自动保存失败，请检查磁盘空间');
        }
      }, 800);
    },
    [onSave],
  );

  // 标题变更处理
  const handleTitleChange = (newTitle: string) => {
    setNoteTitle(newTitle);
    if (editorContent && typeof editorContent !== 'string') {
      debouncedSave(newTitle, editorContent);
    }
  };

  // 内容变更处理
  const handleContentChange = (newContent: TipTapJSONContent) => {
    setEditorContent(newContent);
    debouncedSave(noteTitle, newContent);
  };

  // 颜色变更处理
  const handleColorChange = (newColor: NoteColorType) => {
    setNoteColor(newColor);
    onSave?.(); // 通知列表刷新
  };

  // 组件卸载时清除定时器
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  const segmentOptions = [
    {
      label: (
        <span>
          <EditOutlined style={{ marginRight: 4 }} />
        </span>
      ),
      value: 'edit' as TabKeyType,
    },
    {
      label: (
        <span>
          <ToolOutlined style={{ marginRight: 4 }} />
        </span>
      ),
      value: 'tools' as TabKeyType,
    },
    {
      label: (
        <span>
          <RobotOutlined style={{ marginRight: 4 }} />
        </span>
      ),
      value: 'ai' as TabKeyType,
    },
    {
      label: (
        <span>
          <AppstoreOutlined style={{ marginRight: 4 }} />
        </span>
      ),
      value: 'other' as TabKeyType,
    },
  ];

  return (
    <div className="layout-panel editor-container">
      <div className="flex-vertical-equal">
        {/* 标签栏 */}
        <div style={{ display: 'inline-block' }}>
          <Segmented options={segmentOptions} value={activeTab} onChange={setActiveTab} />
        </div>

        {/* Tab 内容区 */}
        <div className="editor-inner-tab-container">
          {activeTab === 'edit' && (
            <EditTab
              noteId={noteId}
              noteTitle={noteTitle}
              editorContent={editorContent}
              onTitleChange={handleTitleChange}
              onContentChange={handleContentChange}
            />
          )}
          {activeTab === 'tools' && (
            <ToolsTab noteId={noteId} noteColor={noteColor} onColorChange={handleColorChange} />
          )}
          {activeTab === 'ai' && <AITab noteId={noteId} />}
          {activeTab === 'other' && <OtherTab noteId={noteId} />}
        </div>
      </div>
    </div>
  );
};

export default EditorPanel;
