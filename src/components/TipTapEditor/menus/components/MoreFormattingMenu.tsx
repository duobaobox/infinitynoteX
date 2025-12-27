/**
 * 更多格式菜单组件
 * 包含使用频率较低的格式选项：上标、下标、清除格式等
 */

import type { Editor } from '@tiptap/core';
import { MenuItemRow } from '../MenuBar/MenuItemRow';

/**
 * 获取更多格式菜单项
 */
export const getMoreFormattingMenuItems = (editor: Editor) => {
  return [
    {
      key: 'subscript',
      node: (
        <MenuItemRow
          icon="ri-subscript-2"
          text="下标"
          active={editor.isActive('subscript')}
          onClick={() => editor.chain().focus().toggleSubscript().run()}
        />
      ),
    },
    {
      key: 'superscript',
      node: (
        <MenuItemRow
          icon="ri-superscript-2"
          text="上标"
          active={editor.isActive('superscript')}
          onClick={() => editor.chain().focus().toggleSuperscript().run()}
        />
      ),
    },
  ];
};
