/**
 * 菜单状态计算 Hook
 * 计算标题、列表、对齐菜单的当前状态和图标
 *
 * 使用官方 useEditorState 的 selector 模式，确保状态响应编辑器变化
 * @see https://tiptap.dev/docs/guides/performance
 */

import type { Editor } from '@tiptap/core';
import { useEditorState } from '@tiptap/react';

export interface MenuTriggerState {
  icon: string;
  title: string;
  active: boolean;
}

// 默认状态
const defaultHeadingState: MenuTriggerState = { icon: 'ri-heading', title: '标题', active: false };
const defaultListState: MenuTriggerState = { icon: 'ri-list-check', title: '列表', active: false };
const defaultAlignState: MenuTriggerState = {
  icon: 'ri-align-justify',
  title: '对齐',
  active: false,
};
const defaultTableState: MenuTriggerState = { icon: 'ri-table-2', title: '表格', active: false };

/**
 * 计算标题菜单状态
 * 使用 useEditorState 确保在编辑器状态变化时正确更新
 */
export const useHeadingState = (editor: Editor | null): MenuTriggerState => {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }): MenuTriggerState => {
      if (!e) return defaultHeadingState;

      if (e.isActive('heading', { level: 1 }))
        return { icon: 'ri-h-1', title: '标题 1', active: true };
      if (e.isActive('heading', { level: 2 }))
        return { icon: 'ri-h-2', title: '标题 2', active: true };
      if (e.isActive('heading', { level: 3 }))
        return { icon: 'ri-h-3', title: '标题 3', active: true };

      return defaultHeadingState;
    },
  });
  return state ?? defaultHeadingState;
};

/**
 * 计算列表菜单状态
 * 使用 useEditorState 确保在编辑器状态变化时正确更新
 */
export const useListState = (editor: Editor | null): MenuTriggerState => {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }): MenuTriggerState => {
      if (!e) return defaultListState;

      if (e.isActive('bulletList'))
        return { icon: 'ri-list-unordered', title: '无序列表', active: true };

      if (e.isActive('orderedList'))
        return { icon: 'ri-list-ordered', title: '有序列表', active: true };

      if (e.isActive('taskList'))
        return { icon: 'ri-checkbox-line', title: '任务列表', active: true };

      return defaultListState;
    },
  });
  return state ?? defaultListState;
};

/**
 * 计算对齐菜单状态
 * 使用 useEditorState 确保在编辑器状态变化时正确更新
 */
export const useAlignState = (editor: Editor | null): MenuTriggerState => {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }): MenuTriggerState => {
      if (!e) return defaultAlignState;

      if (e.isActive({ textAlign: 'left' }))
        return { icon: 'ri-align-left', title: '左对齐', active: true };

      if (e.isActive({ textAlign: 'center' }))
        return { icon: 'ri-align-center', title: '居中对齐', active: true };

      if (e.isActive({ textAlign: 'right' }))
        return { icon: 'ri-align-right', title: '右对齐', active: true };

      if (e.isActive({ textAlign: 'justify' }))
        return { icon: 'ri-align-justify', title: '两端对齐', active: true };

      return defaultAlignState;
    },
  });
  return state ?? defaultAlignState;
};

/**
 * 计算表格菜单状态
 * 使用 useEditorState 确保在编辑器状态变化时正确更新
 */
export const useTableState = (editor: Editor | null): MenuTriggerState => {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }): MenuTriggerState => {
      const isInTable = e?.isActive('table') ?? false;
      return { icon: 'ri-table-2', title: '表格', active: isInTable };
    },
  });
  return state ?? defaultTableState;
};

/**
 * 计算所有菜单状态
 */
export const useMenuState = (editor: Editor | null) => {
  const headingState = useHeadingState(editor);
  const listState = useListState(editor);
  const alignState = useAlignState(editor);
  const tableState = useTableState(editor);

  return {
    headingState,
    listState,
    alignState,
    tableState,
  };
};
