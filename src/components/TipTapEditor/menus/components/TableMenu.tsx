/**
 * 表格菜单组件
 * 精简版：仅保留插入表格功能
 * 行/列/单元格操作通过 TableHandles 和 TableBubbleMenu 提供
 */

import type { Editor } from '@tiptap/core';
import { MenuItemRow } from '../MenuBar/MenuItemRow';

export interface TableMenuProps {
  editor: Editor;
}

/**
 * 获取表格菜单项（精简版）
 * 行/列操作已移至表格手柄（TableHandles）
 */
export const getTableMenuItems = (editor: Editor) => {
  return [
    // 插入 3×3 表格
    {
      key: 'insert-table-3x3',
      node: (
        <MenuItemRow
          icon="ri-grid-line"
          text="3×3 表格"
          onClick={() =>
            editor.commands.insertTable({
              rows: 3,
              cols: 3,
              withHeaderRow: true,
            })
          }
        />
      ),
    },
    // 插入 4×4 表格
    {
      key: 'insert-table-4x4',
      node: (
        <MenuItemRow
          icon="ri-layout-grid-line"
          text="4×4 表格"
          onClick={() =>
            editor.commands.insertTable({
              rows: 4,
              cols: 4,
              withHeaderRow: true,
            })
          }
        />
      ),
    },
    // 插入 2×2 表格（简单）
    {
      key: 'insert-table-2x2',
      node: (
        <MenuItemRow
          icon="ri-layout-4-line"
          text="2×2 表格"
          onClick={() =>
            editor.commands.insertTable({
              rows: 2,
              cols: 2,
              withHeaderRow: false,
            })
          }
        />
      ),
    },
  ];
};
