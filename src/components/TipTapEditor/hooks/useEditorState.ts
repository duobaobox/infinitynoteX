/**
 * 编辑器状态管理 Hook
 *
 * 基于官方 TipTap useEditorState 的规范实现
 * @see https://tiptap.dev/docs/guides/performance
 *
 * 优化策略：
 * - 使用官方 useEditorState 的 selector 模式
 * - 只在订阅的状态变化时重渲染
 */

import type { Editor } from '@tiptap/core';
import { useEditorState as useEditorStateOriginal } from '@tiptap/react';

// 直接从 @tiptap/react 重新导出官方 useEditorState
export { useEditorState } from '@tiptap/react';

/**
 * 简化版本：仅用于触发组件重渲染
 * 当需要在编辑器状态变化时重渲染组件，但不需要选择特定状态时使用
 */
export const useForceUpdateOnEditor = (editor: Editor | null) => {
  return useEditorStateOriginal({
    editor,
    // 返回一个始终递增的计数器，确保每次 transaction 都触发重渲染
    selector: () => Date.now(),
    // 始终认为状态已变化，触发重渲染
    equalityFn: () => false,
  });
};
