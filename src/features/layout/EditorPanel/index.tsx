/**
 * EditorPanel/index.tsx
 * 编辑器面板容器 - 根据 workspaceView 渲染对应编辑器
 */

import React from 'react';
import { useWorkspaceStore } from '../../../store/workspaceStore';
import { NoteEditor } from '../../note/views/NoteEditor/NoteEditor';

/**
 * EditorPanel - 编辑器面板容器
 */
const EditorPanel: React.FC = () => {
  const { workspaceView } = useWorkspaceStore();

  // 便签编辑器
  if (workspaceView === 'note') {
    return <NoteEditor />;
  }

  // 其他视图可在此扩展
  return null;
};

export default EditorPanel;
