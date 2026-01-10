/**
 * TableBubbleMenu 表格气泡菜单组件
 * 选中表格单元格时弹出的操作菜单
 */

import { BubbleMenu } from '@tiptap/react/menus';
import type { Editor } from '@tiptap/react';
import {
  RowsIcon,
  Columns3Icon,
  PlusIcon,
  Trash2Icon,
  MergeIcon,
  SplitIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  TableIcon,
} from 'lucide-react';
import './TableBubbleMenu.css';

interface TableBubbleMenuProps {
  editor: Editor;
}

/**
 * 表格气泡菜单 - 选中表格单元格时显示
 */
export const TableBubbleMenu: React.FC<TableBubbleMenuProps> = ({ editor }) => {
  if (!editor) {
    return null;
  }

  return (
    <BubbleMenu
      className="table-bubble-menu"
      editor={editor}
      options={{
        placement: 'top',
      }}
      shouldShow={({ editor: e }) => {
        // 只在表格内显示
        return e.isActive('table');
      }}
    >
      {/* 行操作 */}
      <div className="menu-group">
        <span className="group-label">
          <RowsIcon size={12} /> 行
        </span>
        <button
          type="button"
          onClick={() => editor.chain().focus().addRowBefore().run()}
          title="在上方插入行"
          disabled={!editor.can().addRowBefore()}
        >
          <ArrowUpIcon size={14} />
          <PlusIcon size={10} className="plus-icon" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().addRowAfter().run()}
          title="在下方插入行"
          disabled={!editor.can().addRowAfter()}
        >
          <ArrowDownIcon size={14} />
          <PlusIcon size={10} className="plus-icon" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().deleteRow().run()}
          title="删除行"
          disabled={!editor.can().deleteRow()}
          className="danger"
        >
          <Trash2Icon size={14} />
        </button>
      </div>

      <span className="divider" />

      {/* 列操作 */}
      <div className="menu-group">
        <span className="group-label">
          <Columns3Icon size={12} /> 列
        </span>
        <button
          type="button"
          onClick={() => editor.chain().focus().addColumnBefore().run()}
          title="在左侧插入列"
          disabled={!editor.can().addColumnBefore()}
        >
          <ArrowLeftIcon size={14} />
          <PlusIcon size={10} className="plus-icon" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().addColumnAfter().run()}
          title="在右侧插入列"
          disabled={!editor.can().addColumnAfter()}
        >
          <ArrowRightIcon size={14} />
          <PlusIcon size={10} className="plus-icon" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().deleteColumn().run()}
          title="删除列"
          disabled={!editor.can().deleteColumn()}
          className="danger"
        >
          <Trash2Icon size={14} />
        </button>
      </div>

      <span className="divider" />

      {/* 单元格操作 */}
      <div className="menu-group">
        <button
          type="button"
          onClick={() => editor.chain().focus().mergeCells().run()}
          title="合并单元格"
          disabled={!editor.can().mergeCells()}
        >
          <MergeIcon size={14} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().splitCell().run()}
          title="拆分单元格"
          disabled={!editor.can().splitCell()}
        >
          <SplitIcon size={14} />
        </button>
      </div>

      <span className="divider" />

      {/* 表头切换 */}
      <div className="menu-group">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeaderRow().run()}
          title="切换表头行"
          className={editor.isActive('tableHeader') ? 'is-active' : ''}
        >
          <RowsIcon size={14} />
          <span className="btn-text">表头</span>
        </button>
      </div>

      <span className="divider" />

      {/* 删除表格 */}
      <button
        type="button"
        onClick={() => editor.chain().focus().deleteTable().run()}
        title="删除表格"
        disabled={!editor.can().deleteTable()}
        className="danger"
      >
        <TableIcon size={14} />
        <Trash2Icon size={12} />
      </button>
    </BubbleMenu>
  );
};

export default TableBubbleMenu;
