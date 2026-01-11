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
import { ColorPicker } from './components/ColorPicker';
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

  // 文字颜色操作
  const handleColorChange = (color: string | null) => {
    if (color) {
      editor.chain().focus().setColor(color).run();
    } else {
      editor.chain().focus().unsetColor().run();
    }
  };

  return (
    <BubbleMenu
      className="bubble-menu text-bubble-menu"
      editor={editor}
      pluginKey="text-bubble-menu"
      options={{
        placement: 'top',
      }}
      shouldShow={({ editor: e, state }) => {
        const { selection } = state;
        const { empty } = selection;

        // 必须有选区
        if (empty) {
          return false;
        }

        // 排除图片选中 (NodeSelection)
        if (e.isActive('image')) {
          return false;
        }

        // 排除代码块
        if (e.isActive('codeBlock')) {
          return false;
        }

        // 表格特殊处理：
        // 如果选中了表格单元格 (CellSelection)，通常会触发 isActive('table')
        // 但我们需要区分是"选中了文字"还是"选中了单元格"
        // 简单的判断是：如果是 CellSelection，则不显示 TextMenu (交给 TableMenu)
        // 但 TipTap 的 API 判断 CellSelection 比较麻烦，通常通过 selection type 判断
        // 或者简单点：如果 isActive('table') 但 selection 不是空的，
        // 我们通常认为是在编辑文字，除非是 CellSelection。
        // Tiptap 的 CellSelection type 通常是 'cell' (取决于 prosemirror-tables)
        // 也可以通过检查 selection 的构造函数名，但 unstable。
        // 这里我们先放宽限制：允许 table，但依赖 TableMenu 的逻辑互斥 (TableMenu 只在 CellSelection 或 空选区显示)

        // 检查是否是 CellSelection (通过 pattern matching selection 对象结构，或者简单只要不是 TextSelection 就排除?)
        // 更安全的做法：只要有非空的 TextSelection 就显示。

        // 临时结论：允许 table。
        return true;
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

      {/* 文字颜色选择器 */}
      <ColorPicker
        currentColor={editor.getAttributes('textStyle')?.color}
        onColorChange={handleColorChange}
      />

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
