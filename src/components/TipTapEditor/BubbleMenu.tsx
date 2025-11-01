/**
 * TipTap 气泡菜单组件
 * 选中文本时浮动显示，提供快捷格式化操作
 */

import React, { useCallback } from "react";
import { BubbleMenu as TipTapBubbleMenu } from "@tiptap/react/menus";
import type { Editor } from "@tiptap/core";
import "./BubbleMenu.css";

interface BubbleMenuProps {
  editor: Editor | null;
}

/**
 * 气泡菜单按钮
 */
const BubbleMenuButton: React.FC<{
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  title?: string;
  icon: string;
}> = ({ onClick, isActive = false, disabled = false, title, icon }) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`bubble-menu-button ${isActive ? "is-active" : ""}`}
      title={title}
      type="button"
    >
      <i className={icon} />
    </button>
  );
};

/**
 * 气泡菜单分隔符
 */
const BubbleMenuDivider: React.FC = () => {
  return <div className="bubble-menu-divider" />;
};

export const BubbleMenu: React.FC<BubbleMenuProps> = ({ editor }) => {
  if (!editor) {
    return null;
  }

  /**
   * 复制选中文本到剪贴板
   */
  const handleCopy = useCallback(() => {
    const text = editor.state.selection.$from.parent.textContent;
    if (text) {
      navigator.clipboard.writeText(text).catch((err) => {
        console.error("复制失败:", err);
      });
    }
  }, [editor]);

  return (
    <TipTapBubbleMenu editor={editor} className="bubble-menu">
      {/* 文本格式 */}
      <BubbleMenuButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        disabled={!editor.can().chain().focus().toggleBold().run()}
        isActive={editor.isActive("bold")}
        title="粗体 (Ctrl+B)"
        icon="ri-bold"
      />

      <BubbleMenuButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        disabled={!editor.can().chain().focus().toggleItalic().run()}
        isActive={editor.isActive("italic")}
        title="斜体 (Ctrl+I)"
        icon="ri-italic"
      />

      <BubbleMenuButton
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        disabled={!editor.can().chain().focus().toggleUnderline().run()}
        isActive={editor.isActive("underline")}
        title="下划线 (Ctrl+U)"
        icon="ri-underline"
      />

      <BubbleMenuButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        disabled={!editor.can().chain().focus().toggleStrike().run()}
        isActive={editor.isActive("strike")}
        title="删除线"
        icon="ri-strikethrough"
      />

      <BubbleMenuButton
        onClick={() => editor.chain().focus().toggleCode().run()}
        disabled={!editor.can().chain().focus().toggleCode().run()}
        isActive={editor.isActive("code")}
        title="行内代码"
        icon="ri-code-line"
      />

      <BubbleMenuDivider />

      {/* 快捷操作 */}
      <BubbleMenuButton
        onClick={handleCopy}
        title="复制"
        icon="ri-file-copy-line"
      />

      <BubbleMenuButton
        onClick={() => {
          editor.chain().focus().deleteSelection().run();
        }}
        title="删除"
        icon="ri-delete-bin-line"
      />
    </TipTapBubbleMenu>
  );
};

export default BubbleMenu;
