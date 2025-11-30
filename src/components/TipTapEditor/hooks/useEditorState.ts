/**
 * 编辑器状态管理 Hook
 * 监听编辑器的选区和内容变化,触发组件重渲染
 */

import { useEffect, useState } from 'react';
import type { Editor } from '@tiptap/core';

/**
 * 使用编辑器状态
 * 监听编辑器的 selectionUpdate, transaction, update 事件
 * 返回一个递增的数字,用于触发组件重渲染
 */
export const useEditorState = (editor: Editor | null) => {
  const [state, setState] = useState(0);

  useEffect(() => {
    if (!editor) return;

    const update = () => setState((x) => x + 1);

    // 监听编辑器事件
    editor.on('selectionUpdate', update);
    editor.on('transaction', update);
    editor.on('update', update);

    return () => {
      editor.off('selectionUpdate', update);
      editor.off('transaction', update);
      editor.off('update', update);
    };
  }, [editor]);

  return state;
};
