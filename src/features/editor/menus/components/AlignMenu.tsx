/**
 * 对齐菜单组件
 */

import type { Editor } from '@tiptap/core';
import { MenuItemRow } from '../MenuBar/MenuItemRow';

export interface AlignMenuProps {
  editor: Editor;
}

/**
 * 获取对齐菜单项
 */
export const getAlignMenuItems = (editor: Editor) => {
  const entries: Array<{
    key: string;
    label: string;
    value: 'left' | 'center' | 'right' | 'justify';
    icon: string;
  }> = [
    { key: 'left', label: '左对齐', value: 'left', icon: 'ri-align-left' },
    { key: 'center', label: '居中对齐', value: 'center', icon: 'ri-align-center' },
    { key: 'right', label: '右对齐', value: 'right', icon: 'ri-align-right' },
    { key: 'justify', label: '两端对齐', value: 'justify', icon: 'ri-align-justify' },
  ];

  return entries.map((it) => ({
    key: it.key,
    node: (
      <MenuItemRow
        icon={it.icon}
        text={it.label}
        active={editor.isActive({ textAlign: it.value })}
        onClick={() => editor.chain().focus().setTextAlign(it.value).run()}
      />
    ),
  }));
};
