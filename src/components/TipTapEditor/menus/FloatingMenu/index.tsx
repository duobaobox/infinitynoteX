/**
 * FloatingMenu 浮动菜单组件
 * 空行时弹出的快捷插入菜单
 *
 * @see https://tiptap.dev/docs/editor/extensions/functionality/floatingmenu
 */

import React from 'react';
import { FloatingMenu as TipTapFloatingMenu } from '@tiptap/react/menus';
import type { Editor } from '@tiptap/react';
import {
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Code,
  Minus,
  Table,
  Image,
} from 'lucide-react';
import './FloatingMenu.css';

interface FloatingMenuProps {
  editor: Editor;
  onInsertImage?: () => void;
}

/**
 * 浮动菜单 - 空行时显示的快捷插入菜单
 */
export const FloatingMenu: React.FC<FloatingMenuProps> = ({ editor, onInsertImage }) => {
  if (!editor) {
    return null;
  }

  return (
    <TipTapFloatingMenu
      className="floating-menu"
      editor={editor}
      options={{
        placement: 'left-start',
      }}
    >
      {/* 标题 */}
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        className={editor.isActive('heading', { level: 1 }) ? 'is-active' : ''}
        title="标题 1"
      >
        <Heading1 size={16} />
      </button>

      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        className={editor.isActive('heading', { level: 2 }) ? 'is-active' : ''}
        title="标题 2"
      >
        <Heading2 size={16} />
      </button>

      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        className={editor.isActive('heading', { level: 3 }) ? 'is-active' : ''}
        title="标题 3"
      >
        <Heading3 size={16} />
      </button>

      <span className="divider" />

      {/* 列表 */}
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={editor.isActive('bulletList') ? 'is-active' : ''}
        title="无序列表"
      >
        <List size={16} />
      </button>

      <button
        type="button"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={editor.isActive('orderedList') ? 'is-active' : ''}
        title="有序列表"
      >
        <ListOrdered size={16} />
      </button>

      <button
        type="button"
        onClick={() => editor.chain().focus().toggleTaskList().run()}
        className={editor.isActive('taskList') ? 'is-active' : ''}
        title="任务列表"
      >
        <CheckSquare size={16} />
      </button>

      <span className="divider" />

      {/* 块级元素 */}
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        className={editor.isActive('blockquote') ? 'is-active' : ''}
        title="引用"
      >
        <Quote size={16} />
      </button>

      <button
        type="button"
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        className={editor.isActive('codeBlock') ? 'is-active' : ''}
        title="代码块"
      >
        <Code size={16} />
      </button>

      <button
        type="button"
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        title="分割线"
      >
        <Minus size={16} />
      </button>

      <span className="divider" />

      {/* 插入 */}
      <button
        type="button"
        onClick={() =>
          editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
        }
        title="表格"
      >
        <Table size={16} />
      </button>

      {onInsertImage && (
        <button type="button" onClick={onInsertImage} title="图片">
          <Image size={16} />
        </button>
      )}
    </TipTapFloatingMenu>
  );
};

export default FloatingMenu;
