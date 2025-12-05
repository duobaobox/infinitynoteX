/**
 * NoteEditor - 便签编辑器容器
 * 管理编辑器 tabs 切换和数据流
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Segmented, message } from 'antd';
import type { TipTapJSONContent } from '../../../../services/types';
import type { NoteColor as NoteColorType } from '../../../../services/types';
import { useWorkspaceStore } from '../../../../store/workspaceStore';

// 从模块导入
import type { TabKeyType } from './types';
import { useNoteSave } from './hooks/useNoteSave';
import { EditTab, ToolsTab, AITab, OtherTab, TAB_CONFIG } from './tabs';

/**
 * NoteEditor - 便签编辑器组件
 */
export const NoteEditor: React.FC = () => {
  // 从 Store 获取状态
  const selectedNoteId = useWorkspaceStore((state) => state.selectedNoteId);
  const triggerListRefresh = useWorkspaceStore((state) => state.triggerListRefresh);
  const resetEditorTabTrigger = useWorkspaceStore((state) => state.resetEditorTabTrigger);

  // 本地状态
  const [noteTitle, setNoteTitle] = useState<string>('');
  const [editorContent, setEditorContent] = useState<TipTapJSONContent | string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKeyType>('edit');
  const [noteColor, setNoteColor] = useState<NoteColorType>('ffffff');

  // 使用保存 hook
  const { pendingSaveRef, saveTimerRef, debouncedSave, flushPendingSave } = useNoteSave();

  // 当前便签 ID 引用
  const currentNoteIdRef = useRef<string | null>(null);

  // 切换便签时：先保存当前便签，再加载新便签
  useEffect(() => {
    const switchNote = async () => {
      await flushPendingSave();
      currentNoteIdRef.current = selectedNoteId;

      if (!selectedNoteId) {
        setNoteTitle('');
        setEditorContent(null);
        return;
      }

      await loadNote(selectedNoteId);
    };

    switchNote();
  }, [selectedNoteId, flushPendingSave]);

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

    window.ipcRenderer?.on('note:updated', handleFloatingNoteUpdate);
    return () => {
      window.ipcRenderer?.off('note:updated', handleFloatingNoteUpdate);
    };
  }, []);

  // 页面关闭/刷新时保存
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (pendingSaveRef.current) {
        if (saveTimerRef.current) {
          clearTimeout(saveTimerRef.current);
        }
        const data = pendingSaveRef.current;
        try {
          window.storage.updateNote(data.noteId, {
            title: data.title,
            content: data.content,
          });
        } catch (e) {
          console.error('Failed to save on unload:', e);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [pendingSaveRef, saveTimerRef]);

  // 组件卸载时保存并清理
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
      if (pendingSaveRef.current) {
        const data = pendingSaveRef.current;
        window.storage
          .updateNote(data.noteId, {
            title: data.title,
            content: data.content,
          })
          .catch((e) => console.error('Failed to save on unmount:', e));
      }
    };
  }, [pendingSaveRef, saveTimerRef]);

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

  // 标题变更处理
  const handleTitleChange = useCallback(
    (newTitle: string) => {
      setNoteTitle(newTitle);
      if (currentNoteIdRef.current && editorContent && typeof editorContent !== 'string') {
        debouncedSave(currentNoteIdRef.current, newTitle, editorContent);
      }
    },
    [editorContent, debouncedSave],
  );

  // 内容变更处理
  const handleContentChange = useCallback(
    (newContent: TipTapJSONContent) => {
      setEditorContent(newContent);
      if (currentNoteIdRef.current) {
        debouncedSave(currentNoteIdRef.current, noteTitle, newContent);
      }
    },
    [noteTitle, debouncedSave],
  );

  // 颜色变更处理
  const handleColorChange = useCallback(
    async (newColor: NoteColorType) => {
      if (!currentNoteIdRef.current) return;

      try {
        await window.storage.updateNote(currentNoteIdRef.current, { color: newColor });
        setNoteColor(newColor);
        window.ipcRenderer?.send('note:updated', currentNoteIdRef.current);
        triggerListRefresh();
      } catch (error) {
        console.error('Failed to update color:', error);
        message.error('更新颜色失败');
      }
    },
    [triggerListRefresh],
  );

  // 使用配置生成 Segmented 选项
  const segmentOptions = useMemo(
    () =>
      TAB_CONFIG.map(({ key, icon: Icon }) => ({
        label: (
          <span>
            <Icon style={{ marginRight: 4 }} />
          </span>
        ),
        value: key,
      })),
    [],
  );

  // 渲染当前 Tab 内容
  const renderTabContent = () => {
    switch (activeTab) {
      case 'edit':
        return (
          <EditTab
            noteId={selectedNoteId}
            noteTitle={noteTitle}
            editorContent={editorContent}
            onTitleChange={handleTitleChange}
            onContentChange={handleContentChange}
          />
        );
      case 'tools':
        return (
          <ToolsTab
            noteId={selectedNoteId}
            noteColor={noteColor}
            onColorChange={handleColorChange}
          />
        );
      case 'ai':
        return <AITab noteId={selectedNoteId} />;
      case 'other':
        return <OtherTab noteId={selectedNoteId} />;
      default:
        return null;
    }
  };

  return (
    <div className="layout-panel editor-container">
      <div className="flex-vertical-equal">
        {/* 标签栏 */}
        <div style={{ display: 'inline-block' }}>
          <Segmented options={segmentOptions} value={activeTab} onChange={setActiveTab} />
        </div>

        {/* Tab 内容区 */}
        <div className="editor-inner-tab-container">{renderTabContent()}</div>
      </div>
    </div>
  );
};

export default NoteEditor;
