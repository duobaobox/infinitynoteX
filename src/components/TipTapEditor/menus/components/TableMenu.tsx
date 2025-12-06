/**
 * 表格菜单组件
 */

import type { Editor } from '@tiptap/core';
import { MenuItemRow } from '../MenuBar/MenuItemRow';

export interface TableMenuProps {
  editor: Editor;
}

/**
 * 获取表格菜单项
 */
export const getTableMenuItems = (editor: Editor) => {
  return [
    // 插入表格
    {
      key: 'insert-table',
      node: (
        <MenuItemRow
          icon="ri-table-2"
          text="插入表格 (3×3)"
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
    // 分隔符
    {
      key: 'divider-1',
      node: <div style={{ borderTop: '1px solid #f0f0f0', margin: '4px 0' }} />,
    },
    // 行操作
    {
      key: 'add-row-before',
      node: (
        <MenuItemRow
          icon="ri-insert-row-top"
          text="在上方插入行"
          onClick={() => editor.commands.addRowBefore()}
        />
      ),
    },
    {
      key: 'add-row-after',
      node: (
        <MenuItemRow
          icon="ri-insert-row-bottom"
          text="在下方插入行"
          onClick={() => editor.commands.addRowAfter()}
        />
      ),
    },
    {
      key: 'delete-row',
      node: (
        <MenuItemRow
          icon="ri-delete-row"
          text="删除当前行"
          onClick={() => editor.commands.deleteRow()}
        />
      ),
    },
    // 分隔符
    {
      key: 'divider-2',
      node: <div style={{ borderTop: '1px solid #f0f0f0', margin: '4px 0' }} />,
    },
    // 列操作
    {
      key: 'add-column-before',
      node: (
        <MenuItemRow
          icon="ri-insert-column-left"
          text="在左侧插入列"
          onClick={() => editor.commands.addColumnBefore()}
        />
      ),
    },
    {
      key: 'add-column-after',
      node: (
        <MenuItemRow
          icon="ri-insert-column-right"
          text="在右侧插入列"
          onClick={() => editor.commands.addColumnAfter()}
        />
      ),
    },
    {
      key: 'delete-column',
      node: (
        <MenuItemRow
          icon="ri-delete-column"
          text="删除当前列"
          onClick={() => editor.commands.deleteColumn()}
        />
      ),
    },
    // 分隔符
    {
      key: 'divider-3',
      node: <div style={{ borderTop: '1px solid #f0f0f0', margin: '4px 0' }} />,
    },
    // 单元格操作
    {
      key: 'merge-cells',
      node: (
        <MenuItemRow
          icon="ri-merge-cells-horizontal"
          text="合并单元格"
          onClick={() => editor.commands.mergeCells()}
        />
      ),
    },
    {
      key: 'split-cell',
      node: (
        <MenuItemRow
          icon="ri-split-cells-horizontal"
          text="拆分单元格"
          onClick={() => editor.commands.splitCell()}
        />
      ),
    },
    // 分隔符
    {
      key: 'divider-4',
      node: <div style={{ borderTop: '1px solid #f0f0f0', margin: '4px 0' }} />,
    },
    // 表头切换
    {
      key: 'toggle-header-row',
      node: (
        <MenuItemRow
          icon="ri-layout-row-line"
          text="切换表头行"
          onClick={() => editor.commands.toggleHeaderRow()}
        />
      ),
    },
    {
      key: 'toggle-header-column',
      node: (
        <MenuItemRow
          icon="ri-layout-column-line"
          text="切换表头列"
          onClick={() => editor.commands.toggleHeaderColumn()}
        />
      ),
    },
    {
      key: 'toggle-header-cell',
      node: (
        <MenuItemRow
          icon="ri-checkbox-blank-line"
          text="切换单元格表头"
          onClick={() => editor.commands.toggleHeaderCell()}
        />
      ),
    },
    // 分隔符
    {
      key: 'divider-5',
      node: <div style={{ borderTop: '1px solid #f0f0f0', margin: '4px 0' }} />,
    },
    // 删除表格
    {
      key: 'delete-table',
      node: (
        <MenuItemRow
          icon="ri-delete-bin-line"
          text="删除整个表格"
          onClick={() => editor.commands.deleteTable()}
        />
      ),
    },
  ];
};
