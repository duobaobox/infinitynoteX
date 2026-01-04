/**
 * NoteNode - 画布上的便签节点组件
 * 用于在无限画布中显示可编辑的便签卡片
 *
 * 结构：
 * - Header 区域（拖拽手柄）
 * - TipTap 编辑器区域（可编辑内容）
 */

import React, { memo, lazy, Suspense, useCallback, useState, useEffect, useMemo } from 'react';
import { Handle, Position, NodeResizer } from '@xyflow/react';
import { HolderOutlined } from '@ant-design/icons';
import { Spin } from 'antd';
import type { TipTapJSONContent } from '../../../../../services/types';
import './NoteNode.css';

// 懒加载 TipTap 编辑器
const TipTapEditor = lazy(() =>
  import('../../../../../components/TipTapEditor').then((module) => ({
    default: module.TipTapEditor,
  })),
);

// 颜色映射表
const colorMap: Record<string, string> = {
  bae0ff: '#bae0ff',
  d9f7be: '#d9f7be',
  ffd6e7: '#ffd6e7',
  d6e4ff: '#d6e4ff',
  ffd666: '#ffd666',
  ffffff: '#ffffff',
};

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
  const bgColor = data.color ? colorMap[data.color] || '#ffffff' : '#ffffff';
  const isSelected = selected || data.isSelected;

  // 便签完整内容状态
  const [content, setContent] = useState<TipTapJSONContent | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

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
  const debouncedSave = useMemo(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    return (noteId: string, patch: { content?: TipTapJSONContent; title?: string }) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(() => {
        window.storage.updateNote(noteId, patch);
      }, 500);
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

  return (
    <div
      className={`note-node ${isSelected ? 'note-node--selected' : ''}`}
      style={{ backgroundColor: bgColor }}
    >
      {/* 节点尺寸调整器 */}
      <NodeResizer
        color="var(--theme-color, #1677ff)"
        isVisible={isSelected}
        minWidth={300}
        minHeight={200}
      />

      {/* 连接点（V2 可用于连线） */}
      <Handle type="target" position={Position.Top} className="note-node__handle" />

      {/* Header 区域 - 拖拽手柄 */}
      <div className="note-node__header drag-handle">
        <HolderOutlined className="note-node__drag-icon" />
        <span className="note-node__title">{data.title || '无标题'}</span>
      </div>

      {/* 编辑器区域 */}
      <div className="note-node__editor">
        {isLoading ? (
          <div className="note-node__loading">
            <Spin size="small" />
          </div>
        ) : content ? (
          <Suspense
            fallback={
              <div className="note-node__loading">
                <Spin size="small" />
              </div>
            }
          >
            <TipTapEditor
              key={data.noteId}
              initialContent={content}
              onContentChange={handleContentChange}
              onTitleChange={handleTitleChange}
              showMenuBar={false}
              showTitleInput={false}
              contentId={data.noteId}
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
