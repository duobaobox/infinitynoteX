/**
 * NoteNode - 画布上的便签节点组件
 * 用于在无限画布中显示可编辑的便签卡片
 *
 * 结构：
 * - Header 区域（拖拽手柄）
 * - TipTap 编辑器区域（可编辑内容）
 */

import React, { memo, useCallback, useState, useEffect, useRef, lazy, Suspense } from 'react';
import { Handle, Position, NodeResizer } from '@xyflow/react';
import { HolderOutlined } from '@ant-design/icons';
import { Spin } from 'antd';
import type { TipTapJSONContent } from '../../../../../services/types';
import { NOTE_COLOR_CSS_VAR_MAP } from '../../../../../constants/noteColors';
import { IPC_CHANNELS } from '../../../../../shared/types/ipc';
import { createNoteSyncPayload, sendRendererIpc } from '../../../../../shared/utils/ipcEvents';
import { useWorkspaceStore } from '../../../../../store/workspaceStore';
import './NoteNode.css';

const TipTapEditor = lazy(() =>
  import('../../../../editor').then((module) => ({
    default: module.TipTapEditor,
  })),
);

export interface NoteNodeData {
  noteId: string;
  title: string;
  excerpt: string;
  color?: string;
  isSelected?: boolean;
  [key: string]: unknown;
}

interface NoteNodeProps {
  data: NoteNodeData;
  selected?: boolean;
}

const NoteNode: React.FC<NoteNodeProps> = ({ data, selected }) => {
  const bgColor = data.color
    ? NOTE_COLOR_CSS_VAR_MAP[data.color as keyof typeof NOTE_COLOR_CSS_VAR_MAP] || '#ffffff'
    : '#ffffff';
  const isSelected = selected || data.isSelected;

  // 从 store 获取 actions
  const setSelectedNote = useWorkspaceStore((state) => state.setSelectedNote);
  const resetEditorTab = useWorkspaceStore((state) => state.resetEditorTab);
  const triggerListRefresh = useWorkspaceStore((state) => state.triggerListRefresh);

  // 便签完整内容状态
  const [content, setContent] = useState<TipTapJSONContent | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);

  // 加载便签完整内容
  useEffect(() => {
    if (!data.noteId || isLoaded) return;

    const loadContent = async () => {
      setIsLoading(true);
      try {
        const note = await window.storage.getNote(data.noteId);
        setContent(note.content);
        setIsLoaded(true);
      } catch (error) {
        console.error('Failed to load note content:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadContent();
  }, [data.noteId, isLoaded]);

  // 防抖保存函数（500ms 内无输入后才保存）
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debouncedSave = useCallback(
    (noteId: string, patch: { content?: TipTapJSONContent; title?: string }) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(async () => {
        await window.storage.updateNote(noteId, patch);
        // 发送 IPC 通知，让 NoteEditor 同步更新
        sendRendererIpc(IPC_CHANNELS.noteChanged, createNoteSyncPayload(noteId));
        // 刷新左侧便签列表
        triggerListRefresh();
      }, 500);
    },
    [triggerListRefresh],
  );

  // 组件卸载时清理 timeout
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // 内容更新回调
  const handleContentChange = useCallback(
    (newContent: TipTapJSONContent) => {
      setContent(newContent);
      // 防抖保存到数据库
      debouncedSave(data.noteId, { content: newContent });
    },
    [data.noteId, debouncedSave],
  );

  // 标题更新回调
  const handleTitleChange = useCallback(
    (newTitle: string) => {
      debouncedSave(data.noteId, { title: newTitle });
    },
    [data.noteId, debouncedSave],
  );

  // 点击编辑器区域时聚焦到 TipTap 编辑器
  const handleEditorClick = useCallback(() => {
    // 延迟确保编辑器已渲染
    setTimeout(() => {
      const prosemirror = editorRef.current?.querySelector('.ProseMirror') as HTMLElement;
      if (prosemirror) {
        prosemirror.focus();
      }
    }, 0);
  }, []);

  // 双击头部跳转到编辑 Tab
  const handleHeaderDoubleClick = useCallback(() => {
    // 1. 选中当前便签
    setSelectedNote(data.noteId);
    // 2. 切换到编辑 Tab
    resetEditorTab();
  }, [data.noteId, setSelectedNote, resetEditorTab]);

  return (
    <div
      className={`note-node ${isSelected ? 'note-node--selected' : ''}`}
      style={{ backgroundColor: bgColor }}
    >
      {/* 节点尺寸调整器 - 功能保留但视觉隐藏 */}
      <NodeResizer color="transparent" isVisible={isSelected} minWidth={300} minHeight={200} />

      {/* 连接点（V2 可用于连线） */}
      <Handle type="target" position={Position.Top} className="note-node__handle" />

      {/* Header 区域 - 拖拽手柄，双击跳转编辑 */}
      <div className="note-node__header drag-handle" onDoubleClick={handleHeaderDoubleClick}>
        <HolderOutlined className="note-node__drag-icon" />
        <span className="note-node__title">{data.title || '无标题'}</span>
      </div>

      {/* 编辑器区域 */}
      <div ref={editorRef} className="note-node__editor nowheel nodrag" onClick={handleEditorClick}>
        {isLoading ? (
          <div className="note-node__loading">
            <Spin size="small" />
          </div>
        ) : content ? (
          <Suspense fallback={<Spin size="small" />}>
            <TipTapEditor
              initialContent={content}
              onContentChange={handleContentChange}
              onTitleChange={handleTitleChange}
              showMenuBar={false}
              showTitleInput={false}
              contentId={data.noteId}
              editable={true}
            />
          </Suspense>
        ) : (
          <div className="note-node__excerpt">{data.excerpt || '点击编辑...'}</div>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="note-node__handle" />
    </div>
  );
};

export default memo(NoteNode);
