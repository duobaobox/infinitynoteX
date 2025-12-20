/**
 * EditTab.tsx
 * 编辑页面 - 富文本编辑器
 *
 * 性能优化：
 * - 使用固定 key，避免切换便签时销毁重建编辑器
 * - 编辑器实例复用，仅更新内容
 * - 添加加载过渡动画提升感知性能
 */

import React, { lazy, Suspense } from 'react';
import { Spin } from 'antd';
import type { TipTapJSONContent } from '../../../../../services/types';

// 懒加载编辑器（优化：减少初始 bundle 体积）
const TipTapEditor = lazy(() =>
  import('../../../../../components/TipTapEditor').then((module) => ({
    default: module.TipTapEditor,
  })),
);

interface EditTabProps {
  noteId: string | null;
  noteTitle: string;
  editorContent: TipTapJSONContent | string | null;
  onTitleChange: (title: string) => void;
  onContentChange: (content: TipTapJSONContent) => void;
  taskPath?: number[] | null;
  onTaskLocated?: () => void;
  /** 内容是否正在加载中 */
  isLoading?: boolean;
}

// 固定的编辑器 key，避免每次切换便签都销毁重建编辑器
const EDITOR_KEY = 'tiptap-editor-instance';

export const EditTab: React.FC<EditTabProps> = ({
  noteId,
  noteTitle,
  editorContent,
  onTitleChange,
  onContentChange,
  taskPath,
  onTaskLocated,
  isLoading = false,
}) => {
  // noteId 用于调试，实际不影响渲染
  void noteId;

  if (!editorContent) {
    return <div style={{ padding: '16px' }}>编辑器加载中...</div>;
  }

  return (
    <div className="edit-tab-container">
      {/* 加载过渡遮罩 */}
      {isLoading && (
        <div className="editor-loading-overlay">
          <Spin size="small" />
        </div>
      )}
      <Suspense
        fallback={
          <div style={{ padding: '16px', textAlign: 'center' }}>
            <Spin />
          </div>
        }
      >
        <TipTapEditor
          key={EDITOR_KEY}
          initialContent={editorContent}
          onContentChange={onContentChange}
          title={noteTitle}
          onTitleChange={onTitleChange}
          taskPath={taskPath}
          onTaskLocated={onTaskLocated}
        />
      </Suspense>
    </div>
  );
};

export default EditTab;
