/**
 * EditTab.tsx
 * 编辑页面 - 富文本编辑器
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
}

export const EditTab: React.FC<EditTabProps> = ({
  noteId,
  noteTitle,
  editorContent,
  onTitleChange,
  onContentChange,
}) => {
  if (!editorContent) {
    return <div style={{ padding: '16px' }}>编辑器加载中...</div>;
  }

  return (
    <Suspense
      fallback={
        <div style={{ padding: '16px', textAlign: 'center' }}>
          <Spin />
        </div>
      }
    >
      <TipTapEditor
        key={noteId} // 添加 key 确保切换便签时重新创建编辑器
        initialContent={editorContent}
        onContentChange={onContentChange}
        title={noteTitle}
        onTitleChange={onTitleChange}
      />
    </Suspense>
  );
};

export default EditTab;
