import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Segmented, message } from 'antd';
import { EditOutlined, ToolOutlined, RobotOutlined, AppstoreOutlined } from '@ant-design/icons';
import { TipTapEditor } from './TipTapEditor';
import type { TipTapJSONContent } from '../services/types';

interface EditorPanelProps {
  noteId: string | null;
  onClose?: () => void;
  onSave?: () => void; // 保存完成时的回调
}

const EditorPanel: React.FC<EditorPanelProps> = ({ noteId, onSave }) => {
  const [noteTitle, setNoteTitle] = useState<string>('');
  const [editorContent, setEditorContent] = useState<TipTapJSONContent | string | null>(null);
  const [activeTab, setActiveTab] = useState<string | number>('edit');
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
      value: 'edit',
    },
    {
      label: (
        <span>
          <ToolOutlined style={{ marginRight: 4 }} />
        </span>
      ),
      value: 'tools',
    },
    {
      label: (
        <span>
          <RobotOutlined style={{ marginRight: 4 }} />
        </span>
      ),
      value: 'ai',
    },
    {
      label: (
        <span>
          <AppstoreOutlined style={{ marginRight: 4 }} />
        </span>
      ),
      value: 'other',
    },
  ];

  return (
    <div className="layout-panel editor-container">
      <div className="flex-vertical-equal">
        {/* 标签栏 */}
        <div style={{ display: 'inline-block' }}>
          <Segmented options={segmentOptions} value={activeTab} onChange={setActiveTab} />
        </div>
        <div className="editor-inner-tab-container">
          {activeTab === 'edit' && editorContent && (
            <TipTapEditor
              key={noteId} // 添加 key 确保切换便签时重新创建编辑器
              initialContent={editorContent}
              onContentChange={handleContentChange}
              title={noteTitle}
              onTitleChange={handleTitleChange}
            />
          )}
          {activeTab === 'tools' && <div style={{ padding: '16px' }}>工具面板</div>}
          {activeTab === 'ai' && <div style={{ padding: '16px' }}>AI 工作台</div>}
          {activeTab === 'other' && <div style={{ padding: '16px' }}>其他面板</div>}
        </div>
      </div>
    </div>
  );
};

export default EditorPanel;
