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
 * 待保存数据结构
 */
interface PendingSave {
  noteId: string;
  title: string;
  content: TipTapJSONContent;
}

/**
 * NoteEditor - 便签编辑器组件
 *
 * 保存机制：
 * 1. 编辑时防抖保存（1.5秒延迟）
 * 2. 切换便签时立即保存当前内容
 * 3. 页面关闭/刷新时保存
 * 4. 脏数据追踪，避免重复保存
 */
export const NoteEditor: React.FC = () => {
  // 从 Store 获取状态（优化：使用 selector）
  const selectedNoteId = useWorkspaceStore((state) => state.selectedNoteId);
  const triggerListRefresh = useWorkspaceStore((state) => state.triggerListRefresh);
  const resetEditorTabTrigger = useWorkspaceStore((state) => state.resetEditorTabTrigger);

  // 本地状态
  const [noteTitle, setNoteTitle] = useState<string>('');
  const [editorContent, setEditorContent] = useState<TipTapJSONContent | string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKeyType>('edit');
  const [noteColor, setNoteColor] = useState<NoteColorType>('ffffff');

  // 保存相关的 refs
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const currentNoteIdRef = useRef<string | null>(null);
  const pendingSaveRef = useRef<PendingSave | null>(null); // 待保存的数据
  const isSavingRef = useRef<boolean>(false); // 防止并发保存

  /**
   * 立即执行保存（核心保存函数）
   * @param data 要保存的数据，如果不传则使用 pendingSaveRef 中的数据
   * @param silent 是否静默保存（不显示错误提示）
   */
  const saveImmediately = useCallback(
    async (data?: PendingSave, silent = false): Promise<boolean> => {
      const saveData = data || pendingSaveRef.current;

      if (!saveData || !saveData.noteId) {
        return false;
      }

      // 防止并发保存
      if (isSavingRef.current) {
        return false;
      }

      isSavingRef.current = true;

      try {
        await window.storage.updateNote(saveData.noteId, {
          title: saveData.title,
          content: saveData.content,
        });

        console.log('Note saved:', saveData.noteId);

        // 清除待保存数据（仅当保存的是当前待保存数据时）
        if (pendingSaveRef.current?.noteId === saveData.noteId) {
          pendingSaveRef.current = null;
        }

        // 通知其他窗口
        window.ipcRenderer?.send('note:updated', saveData.noteId);
        triggerListRefresh();

        return true;
      } catch (error) {
        console.error('Failed to save note:', error);
        if (!silent) {
          message.error('保存失败，请检查磁盘空间');
        }
        return false;
      } finally {
        isSavingRef.current = false;
      }
    },
    [triggerListRefresh],
  );

  /**
   * 防抖保存 - 编辑过程中使用
   * 延迟 1.5 秒执行，减少 I/O 操作
   */
  const debouncedSave = useCallback(
    (noteId: string, title: string, content: TipTapJSONContent) => {
      // 更新待保存数据
      pendingSaveRef.current = { noteId, title, content };

      // 清除之前的定时器
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }

      // 设置新的防抖定时器
      saveTimerRef.current = setTimeout(() => {
        saveImmediately();
      }, 1500); // 1.5 秒防抖
    },
    [saveImmediately],
  );

  /**
   * 强制保存当前内容（切换便签前调用）
   */
  const flushPendingSave = useCallback(async () => {
    // 清除防抖定时器
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    // 如果有待保存的数据，立即保存
    if (pendingSaveRef.current) {
      await saveImmediately(pendingSaveRef.current, true);
    }
  }, [saveImmediately]);

  // 切换便签时：先保存当前便签，再加载新便签
  useEffect(() => {
    const switchNote = async () => {
      // 1. 先保存当前便签的待保存内容
      await flushPendingSave();

      // 2. 更新当前便签 ID
      currentNoteIdRef.current = selectedNoteId;

      // 3. 加载新便签
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
      // 同步保存（使用 sendSync 如果可用，否则尽力保存）
      if (pendingSaveRef.current) {
        // 清除定时器
        if (saveTimerRef.current) {
          clearTimeout(saveTimerRef.current);
        }
        // 尝试同步保存
        const data = pendingSaveRef.current;
        try {
          // 使用 navigator.sendBeacon 或同步 XMLHttpRequest 作为备选
          // 但在 Electron 中，我们可以直接调用同步保存
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
  }, []);

  // 组件卸载时保存并清理
  useEffect(() => {
    return () => {
      // 清除定时器
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
      // 尝试保存待保存的内容
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

  // 标题变更处理
  const handleTitleChange = (newTitle: string) => {
    setNoteTitle(newTitle);
    if (currentNoteIdRef.current && editorContent && typeof editorContent !== 'string') {
      debouncedSave(currentNoteIdRef.current, newTitle, editorContent);
    }
  };

  // 内容变更处理
  const handleContentChange = (newContent: TipTapJSONContent) => {
    setEditorContent(newContent);
    if (currentNoteIdRef.current) {
      debouncedSave(currentNoteIdRef.current, noteTitle, newContent);
    }
  };

  // 颜色变更处理
  const handleColorChange = async (newColor: NoteColorType) => {
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
  };

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
