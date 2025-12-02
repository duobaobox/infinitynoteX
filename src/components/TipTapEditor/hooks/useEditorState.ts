/**
 * 编辑器状态管理 Hook
 * 监听编辑器的选区和内容变化，触发组件重渲染
 *
 * 优化策略：使用简单的计数器触发重渲染，避免复杂的状态比较
 */

import { useEffect, useState } from 'react';
import type { Editor } from '@tiptap/core';

/**
 * 使用编辑器状态更新
 * 监听编辑器的 selectionUpdate 和 transaction 事件
 * 返回一个递增的数字，用于触发组件重渲染
 *
 * 这是一个简单但有效的方式，让依赖编辑器状态的组件能够响应变化
 */
export const useEditorState = (editor: Editor | null) => {
  const [updateCount, setUpdateCount] = useState(0);

  useEffect(() => {
    if (!editor) return;

    const update = () => setUpdateCount((x) => x + 1);

    // 监听编辑器事件
    editor.on('selectionUpdate', update);
    editor.on('transaction', update);

    return () => {
      editor.off('selectionUpdate', update);
      editor.off('transaction', update);
    };
  }, [editor]);

  return updateCount;
};

/**
 * 简化版本：包含 update 事件的完整监听
 * 用于需要响应内容变化的场景
 */
export const useEditorUpdate = (editor: Editor | null) => {
  const [updateCount, setUpdateCount] = useState(0);

  useEffect(() => {
    if (!editor) return;

    const update = () => setUpdateCount((x) => x + 1);

    editor.on('selectionUpdate', update);
    editor.on('transaction', update);
    editor.on('update', update);

    return () => {
      editor.off('selectionUpdate', update);
      editor.off('transaction', update);
      editor.off('update', update);
    };
  }, [editor]);

  return updateCount;
};
