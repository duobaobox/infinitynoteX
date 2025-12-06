/**
 * BubbleMenu 气泡菜单组件
 * 选中文字时弹出的格式化工具栏
 *
 * @see https://tiptap.dev/docs/editor/extensions/functionality/floatingmenu
 */

import React from 'react';
import { BubbleMenu as TipTapBubbleMenu } from '@tiptap/react/menus';
import type { Editor } from '@tiptap/react';
import { Bold, Italic, Underline, Strikethrough, Code, Link, Highlighter } from 'lucide-react';
import './BubbleMenu.css';

interface BubbleMenuProps {
  editor: Editor;
}

/**
 * 气泡菜单 - 选中文字时显示的格式化工具栏
 */
export const BubbleMenu: React.FC<BubbleMenuProps> = ({ editor }) => {
  if (!editor) {
    return null;
  }

  // 设置链接
  const setLink = () => {
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('输入链接地址:', previousUrl);

    if (url === null) {
      return; // 用户取消
    }

    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  return (
    <TipTapBubbleMenu
      className="bubble-menu"
      editor={editor}
      options={{
        placement: 'top',
      }}
    >
      {/* 粗体 */}
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={editor.isActive('bold') ? 'is-active' : ''}
        title="粗体 (Ctrl+B)"
      >
        <Bold size={16} />
      </button>

      {/* 斜体 */}
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={editor.isActive('italic') ? 'is-active' : ''}
        title="斜体 (Ctrl+I)"
      >
        <Italic size={16} />
      </button>

      {/* 下划线 */}
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        className={editor.isActive('underline') ? 'is-active' : ''}
        title="下划线 (Ctrl+U)"
      >
        <Underline size={16} />
      </button>

      {/* 删除线 */}
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleStrike().run()}
        className={editor.isActive('strike') ? 'is-active' : ''}
        title="删除线"
      >
        <Strikethrough size={16} />
      </button>

      {/* 行内代码 */}
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleCode().run()}
        className={editor.isActive('code') ? 'is-active' : ''}
        title="行内代码"
      >
        <Code size={16} />
      </button>

      <span className="divider" />

      {/* 高亮 */}
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHighlight().run()}
        className={editor.isActive('highlight') ? 'is-active' : ''}
        title="高亮"
      >
        <Highlighter size={16} />
      </button>

      {/* 链接 */}
      <button
        type="button"
        onClick={setLink}
        className={editor.isActive('link') ? 'is-active' : ''}
        title="链接"
      >
        <Link size={16} />
      </button>
    </TipTapBubbleMenu>
  );
};

export default BubbleMenu;
