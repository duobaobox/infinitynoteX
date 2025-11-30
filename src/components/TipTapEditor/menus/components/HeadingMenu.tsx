/**
 * 标题菜单组件
 */

import type { Editor } from '@tiptap/core';
import { MenuItemRow } from '../MenuBar/MenuItemRow';

export interface HeadingMenuProps {
  editor: Editor;
}

/**
 * 获取标题菜单项
 */
export const getHeadingMenuItems = (editor: Editor) => {
  return [1, 2, 3].map((lv) => ({
    key: `h${lv}`,
    node: (
      <MenuItemRow
        icon={`ri-h-${lv}`}
        text={`标题 ${lv}`}
        active={editor.isActive('heading', { level: lv })}
        onClick={() =>
          editor
            .chain()
            .focus()
            .toggleHeading({ level: lv as 1 | 2 | 3 })
            .run()
        }
      />
    ),
  }));
};
