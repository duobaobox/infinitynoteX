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
 * MenuBar 状态类型定义
 */
export interface MenuBarStateResult {
  // 文本格式
  isBold: boolean;
  isItalic: boolean;
  isUnderline: boolean;
  isStrike: boolean;
  isCode: boolean;
  isSubscript: boolean;
  isSuperscript: boolean;
  isHighlight: boolean;
  hasTextColor: boolean;

  // 块级元素
  isCodeBlock: boolean;
  isBlockquote: boolean;

  // 标题
  isHeading: boolean;
  headingLevel: number | null;

  // 列表
  isBulletList: boolean;
  isOrderedList: boolean;
  isTaskList: boolean;

  // 对齐
  textAlign: string;

  // 表格
  isInTable: boolean;

  // 历史
  canUndo: boolean;
  canRedo: boolean;
}

/**
 * 优化的 MenuBar 状态 Hook
 * 使用官方推荐的 selector 模式，只在工具栏需要的状态变化时重渲染
 *
 * @see https://tiptap.dev/docs/guides/performance#use-useeditorstate-to-prevent-unnecessary-re-renders
 */
export const useMenuBarState = (editor: Editor | null): MenuBarStateResult | null => {
  return useEditorStateOriginal({
    editor,
    selector: ({ editor: e }): MenuBarStateResult => {
      if (!e) {
        return {
          isBold: false,
          isItalic: false,
          isUnderline: false,
          isStrike: false,
          isCode: false,
          isSubscript: false,
          isSuperscript: false,
          isHighlight: false,
          hasTextColor: false,
          isCodeBlock: false,
          isBlockquote: false,
          isHeading: false,
          headingLevel: null,
          isBulletList: false,
          isOrderedList: false,
          isTaskList: false,
          textAlign: 'left',
          isInTable: false,
          canUndo: false,
          canRedo: false,
        };
      }

      // 获取当前标题级别
      let headingLevel: number | null = null;
      for (let i = 1; i <= 6; i++) {
        if (e.isActive('heading', { level: i })) {
          headingLevel = i;
          break;
        }
      }

      // 获取文本对齐方式
      let textAlign = 'left';
      if (e.isActive({ textAlign: 'center' })) textAlign = 'center';
      else if (e.isActive({ textAlign: 'right' })) textAlign = 'right';
      else if (e.isActive({ textAlign: 'justify' })) textAlign = 'justify';

      return {
        // 文本格式
        isBold: e.isActive('bold'),
        isItalic: e.isActive('italic'),
        isUnderline: e.isActive('underline'),
        isStrike: e.isActive('strike'),
        isCode: e.isActive('code'),
        isSubscript: e.isActive('subscript'),
        isSuperscript: e.isActive('superscript'),
        isHighlight: e.isActive('highlight'),
        hasTextColor: !!e.getAttributes('textStyle')?.color,

        // 块级元素
        isCodeBlock: e.isActive('codeBlock'),
        isBlockquote: e.isActive('blockquote'),

        // 标题
        isHeading: headingLevel !== null,
        headingLevel,

        // 列表
        isBulletList: e.isActive('bulletList'),
        isOrderedList: e.isActive('orderedList'),
        isTaskList: e.isActive('taskList'),

        // 对齐
        textAlign,

        // 表格
        isInTable: e.isActive('table'),

        // 历史
        canUndo: e.can().undo(),
        canRedo: e.can().redo(),
      };
    },
  });
};

/**
 * 简化版本：仅用于触发组件重渲染
 * 已废弃 - 请使用 useMenuBarState 替代
 *
 * @deprecated 使用 useMenuBarState 替代，以获得更好的性能
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
