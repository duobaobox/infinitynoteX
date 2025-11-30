/**
 * NoteEditor - 便签编辑器容器
 * 管理编辑器 tabs 切换和数据流
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Segmented, message } from 'antd';
import { EditOutlined, ToolOutlined, RobotOutlined, AppstoreOutlined } from '@ant-design/icons';
import type { TipTapJSONContent } from '../../../../services/types';
import { EditTab } from './tabs/EditTab';
import { ToolsTab } from './tabs/ToolsTab';
import { AITab } from '../../../layout/EditorPanel/AITab'; // AITab 保持在 layout/
import { OtherTab } from './tabs/OtherTab';
import type { NoteColor as NoteColorType } from '../../../../services/types';
import { useWorkspaceStore } from '../../../../store/workspaceStore';

type TabKeyType = 'edit' | 'tools' | 'ai' | 'other';

/**
 * NoteEditor - 便签编辑器组件
 */
export const NoteEditor: React.FC = () => {
  // 从 Store 获取状态
  const { selectedNoteId, triggerListRefresh, resetEditorTabTrigger } = useWorkspaceStore();

  // 本地状态
  const [noteTitle, setNoteTitle] = useState<string>('');
  const [editorContent, setEditorContent] = useState<TipTapJSONContent | string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKeyType>('edit');
  const [noteColor, setNoteColor] = useState<NoteColorType>('ffffff');
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const currentNoteIdRef = useRef<string | null>(null);

  // 加载便签内容
  useEffect(() => {
    if (!selectedNoteId) {
      setNoteTitle('');
      setEditorContent(null);
      return;
    }

    loadNote(selectedNoteId);
    currentNoteIdRef.current = selectedNoteId;
  }, [selectedNoteId]);

  // 监听 tab 重置信号
  useEffect(() => {
    setActiveTab('edit');
  }, [resetEditorTabTrigger]);

  // 监听来自悬浮窗口的更新通知
  useEffect(() => {
    const handleFloatingNoteUpdate = async (_event: unknown, updatedNoteId: string) => {
      if (updatedNoteId === currentNoteIdRef.current) {
        try {
          const note = await window.storage.getNote(updatedNoteId);
          setNoteTitle(note.title);
          setEditorContent(note.content);
          setNoteColor(note.color || 'ffffff');
        } catch (error) {
          console.error('Failed to reload note from floating window:', error);
        }
      }
    };

    window.ipcRenderer?.on('floating-note:updated', handleFloatingNoteUpdate);
    return () => {
      window.ipcRenderer?.off('floating-note:updated', handleFloatingNoteUpdate);
    };
  }, []);

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

      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }

      saveTimerRef.current = setTimeout(async () => {
        try {
          await window.storage.updateNote(currentNoteIdRef.current!, {
            title,
            content,
          });
          console.log('Note auto-saved');
          window.ipcRenderer?.send('note:changed', currentNoteIdRef.current);
          triggerListRefresh();
        } catch (error) {
          console.error('Failed to save note:', error);
          message.error('自动保存失败，请检查磁盘空间');
        }
      }, 800);
    },
    [triggerListRefresh],
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
    triggerListRefresh();
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
              noteId={selectedNoteId}
              noteTitle={noteTitle}
              editorContent={editorContent}
              onTitleChange={handleTitleChange}
              onContentChange={handleContentChange}
            />
          )}
          {activeTab === 'tools' && (
            <ToolsTab
              noteId={selectedNoteId}
              noteColor={noteColor}
              onColorChange={handleColorChange}
            />
          )}
          {activeTab === 'ai' && <AITab noteId={selectedNoteId} />}
          {activeTab === 'other' && <OtherTab noteId={selectedNoteId} />}
        </div>
      </div>
    </div>
  );
};
