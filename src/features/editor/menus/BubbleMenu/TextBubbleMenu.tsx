/**
 * TextBubbleMenu 文本格式化菜单
 * 选中普通文本时显示的格式化工具栏
 */

import React from 'react';
import { BubbleMenu } from '@tiptap/react/menus';
import type { Editor } from '@tiptap/react';
import { Bold, Italic, Underline, Strikethrough, Code } from 'lucide-react';
import { LinkEditor } from './components/LinkEditor';
import { HighlightPicker } from './components/HighlightPicker';
import './BubbleMenu.css';

interface TextBubbleMenuProps {
  editor: Editor;
}

/**
 * 文本格式化菜单 - 选中普通文本时显示
 * 排除：图片、表格、代码块
 */
export const TextBubbleMenu: React.FC<TextBubbleMenuProps> = ({ editor }) => {
  if (!editor) {
    return null;
  }

  // 链接操作
  const handleSetLink = (url: string) => {
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  const handleUnsetLink = () => {
    editor.chain().focus().extendMarkRange('link').unsetLink().run();
  };

  // 高亮操作
  const handleSetHighlight = (color: string) => {
    editor.chain().focus().toggleHighlight({ color }).run();
  };

  const handleUnsetHighlight = () => {
    editor.chain().focus().unsetHighlight().run();
  };

  return (
    <BubbleMenu
      className="bubble-menu text-bubble-menu"
      editor={editor}
      options={{
        placement: 'top',
      }}
      shouldShow={({ editor: e, state }) => {
        const { from, to } = state.selection;
        const hasSelection = from !== to;

        // 排除特殊节点
        const isImage = e.isActive('image');
        const isTable = e.isActive('table');
        const isCodeBlock = e.isActive('codeBlock');

        return hasSelection && !isImage && !isTable && !isCodeBlock;
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

      {/* 高亮颜色选择器 */}
      <HighlightPicker
        currentColor={editor.getAttributes('highlight').color}
        isActive={editor.isActive('highlight')}
        onSetHighlight={handleSetHighlight}
        onUnsetHighlight={handleUnsetHighlight}
      />

      {/* 链接编辑器 */}
      <LinkEditor
        currentUrl={editor.getAttributes('link').href}
        hasLink={editor.isActive('link')}
        onSetLink={handleSetLink}
        onUnsetLink={handleUnsetLink}
      />
    </BubbleMenu>
  );
};

export default TextBubbleMenu;
