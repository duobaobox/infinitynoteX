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
import { FileTextOutlined } from '@ant-design/icons';
import type { TipTapJSONContent } from '../../../../../services/types';
import './EmptyState.css';

// ========== 自定义 TipTap 编辑器 ==========
const TipTapEditor = lazy(() =>
  import('../../../../editor').then((module) => ({
    default: module.TipTapEditor,
  })),
);

// 固定的编辑器 key，避免切换便签时销毁重建
const EDITOR_KEY = 'tiptap-editor-instance';

/**
 * 空状态组件 - 当没有便签选中时显示
 */
const EmptyState: React.FC = () => (
  <div className="editor-empty-state">
    <FileTextOutlined className="editor-empty-icon" />
    <p className="editor-empty-text">选择或创建一个便签开始编辑</p>
  </div>
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
  // 没有选中便签时，显示空状态
  if (!noteId) {
    return <EmptyState />;
  }

  // 便签正在加载时，显示加载提示
  if (!editorContent) {
    return (
      <div className="editor-loading-container">
        <Spin tip="编辑器加载中...">
          <div style={{ height: 100 }} />
        </Spin>
      </div>
    );
  }

  return (
    <div className="edit-tab-container" style={{ height: '100%', overflow: 'hidden' }}>
      {/* 加载过渡遮罩 */}
      {isLoading && (
        <div className="editor-loading-overlay">
          <Spin size="small" />
        </div>
      )}

      {/* TipTap 编辑器 */}
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
