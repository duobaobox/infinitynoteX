/**
 * 菜单状态计算 Hook
 * 计算标题、列表、对齐菜单的当前状态和图标
 */

import { useMemo } from 'react';
import type { Editor } from '@tiptap/core';

export interface MenuTriggerState {
  icon: string;
  title: string;
  active: boolean;
}

/**
 * 计算标题菜单状态
 */
export const useHeadingState = (editor: Editor | null): MenuTriggerState => {
  return useMemo(() => {
    if (!editor) return { icon: 'ri-heading', title: '标题', active: false };

    const states = [1, 2, 3].map((lv) => editor.isActive('heading', { level: lv }));

    if (states[0]) return { icon: 'ri-h-1', title: '标题 1', active: true };
    if (states[1]) return { icon: 'ri-h-2', title: '标题 2', active: true };
    if (states[2]) return { icon: 'ri-h-3', title: '标题 3', active: true };

    return { icon: 'ri-heading', title: '标题', active: false };
  }, [editor]);
};

/**
 * 计算列表菜单状态
 */
export const useListState = (editor: Editor | null): MenuTriggerState => {
  return useMemo(() => {
    if (!editor) return { icon: 'ri-list-check', title: '列表', active: false };

    if (editor.isActive('bulletList'))
      return { icon: 'ri-list-unordered', title: '无序列表', active: true };

    if (editor.isActive('orderedList'))
      return { icon: 'ri-list-ordered', title: '有序列表', active: true };

    if (editor.isActive('taskList'))
      return { icon: 'ri-checkbox-line', title: '任务列表', active: true };

    return { icon: 'ri-list-check', title: '列表', active: false };
  }, [editor]);
};

/**
 * 计算对齐菜单状态
 */
export const useAlignState = (editor: Editor | null): MenuTriggerState => {
  return useMemo(() => {
    if (!editor) return { icon: 'ri-align-justify', title: '对齐', active: false };

    if (editor.isActive({ textAlign: 'left' }))
      return { icon: 'ri-align-left', title: '左对齐', active: true };

    if (editor.isActive({ textAlign: 'center' }))
      return { icon: 'ri-align-center', title: '居中对齐', active: true };

    if (editor.isActive({ textAlign: 'right' }))
      return { icon: 'ri-align-right', title: '右对齐', active: true };

    if (editor.isActive({ textAlign: 'justify' }))
      return { icon: 'ri-align-justify', title: '两端对齐', active: true };

    return { icon: 'ri-align-justify', title: '对齐', active: false };
  }, [editor]);
};

/**
 * 计算表格菜单状态
 */
export const useTableState = (editor: Editor | null): MenuTriggerState => {
  return useMemo(() => {
    const isInTable = editor?.isActive('table') ?? false;
    return { icon: 'ri-table-2', title: '表格', active: isInTable };
  }, [editor]);
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
