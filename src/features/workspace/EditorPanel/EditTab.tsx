/**
 * EditTab.tsx
 * 编辑页面 - 富文本编辑器
 */

import React from 'react';
import { TipTapEditor } from '../../../components/TipTapEditor';
import type { TipTapJSONContent } from '../../services/types';

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
    <TipTapEditor
      key={noteId} // 添加 key 确保切换便签时重新创建编辑器
      initialContent={editorContent}
      onContentChange={onContentChange}
      title={noteTitle}
      onTitleChange={onTitleChange}
    />
  );
};

export default EditTab;
