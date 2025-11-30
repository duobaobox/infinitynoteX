/**
 * 列表菜单组件
 */

import type { Editor } from '@tiptap/core';
import { MenuItemRow } from '../MenuBar/MenuItemRow';

export interface ListMenuProps {
  editor: Editor;
}

/**
 * 获取列表菜单项
 */
export const getListMenuItems = (editor: Editor) => {
  return [
    {
      key: 'bullet',
      node: (
        <MenuItemRow
          icon="ri-list-unordered"
          text="无序列表"
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        />
      ),
    },
    {
      key: 'ordered',
      node: (
        <MenuItemRow
          icon="ri-list-ordered"
          text="有序列表"
          active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        />
      ),
    },
    {
      key: 'task',
      node: (
        <MenuItemRow
          icon="ri-checkbox-line"
          text="任务列表"
          active={editor.isActive('taskList')}
          onClick={() => editor.chain().focus().toggleTaskList().run()}
        />
      ),
    },
  ];
};
