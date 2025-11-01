/**
 * TipTap 工具栏组件
 * 按照官方 Demo 规范，将工具栏独立为单独组件
 */

import React, { useRef } from "react";
import type { MenuBarProps } from "./types";

/**
 * 工具栏按钮组件
 */
const ToolbarButton: React.FC<{
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
      className={isActive ? "is-active" : ""}
      title={title}
      type="button"
    >
      <i className={icon} />
    </button>
  );
};

/**
 * 工具栏分隔符
 */
const ToolbarDivider: React.FC = () => {
  return <div className="toolbar-divider" />;
};

/**
 * 菜单栏组件
 * 参考 TipTap 官方 MenuBar 示例
 */
export const MenuBar: React.FC<MenuBarProps> = ({ editor }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!editor) {
    return null;
  }

  /**
   * 处理图片上传
   */
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const src = evt.target?.result as string;
      if (src) {
        editor.chain().focus().setImage({ src }).run();
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  return (
    <div
      className="tiptap-toolbar"
      onWheel={(e) => {
        // 将垂直滚动转换为水平滚动
        const target = e.currentTarget;
        const delta =
          Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
        if (delta !== 0) {
          e.preventDefault();
          target.scrollLeft += delta;
        }
      }}
    >
      {/* 文本格式 */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        disabled={!editor.can().chain().focus().toggleBold().run()}
        isActive={editor.isActive("bold")}
        title="粗体 (Ctrl+B)"
        icon="ri-bold"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        disabled={!editor.can().chain().focus().toggleItalic().run()}
        isActive={editor.isActive("italic")}
        title="斜体 (Ctrl+I)"
        icon="ri-italic"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        disabled={!editor.can().chain().focus().toggleUnderline().run()}
        isActive={editor.isActive("underline")}
        title="下划线 (Ctrl+U)"
        icon="ri-underline"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        disabled={!editor.can().chain().focus().toggleStrike().run()}
        isActive={editor.isActive("strike")}
        title="删除线"
        icon="ri-strikethrough"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCode().run()}
        disabled={!editor.can().chain().focus().toggleCode().run()}
        isActive={editor.isActive("code")}
        title="行内代码"
        icon="ri-code-line"
      />

      <ToolbarDivider />

      {/* 标题 */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        isActive={editor.isActive("heading", { level: 1 })}
        title="标题 1"
        icon="ri-h-1"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        isActive={editor.isActive("heading", { level: 2 })}
        title="标题 2"
        icon="ri-h-2"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        isActive={editor.isActive("heading", { level: 3 })}
        title="标题 3"
        icon="ri-h-3"
      />

      <ToolbarDivider />

      {/* 列表 */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        isActive={editor.isActive("bulletList")}
        title="无序列表"
        icon="ri-list-unordered"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        isActive={editor.isActive("orderedList")}
        title="有序列表"
        icon="ri-list-ordered"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleTaskList().run()}
        isActive={editor.isActive("taskList")}
        title="任务列表"
        icon="ri-checkbox-line"
      />

      <ToolbarDivider />

      {/* 对齐方式 */}
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign("left").run()}
        isActive={editor.isActive({ textAlign: "left" })}
        title="左对齐"
        icon="ri-align-left"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign("center").run()}
        isActive={editor.isActive({ textAlign: "center" })}
        title="居中对齐"
        icon="ri-align-center"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign("right").run()}
        isActive={editor.isActive({ textAlign: "right" })}
        title="右对齐"
        icon="ri-align-right"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign("justify").run()}
        isActive={editor.isActive({ textAlign: "justify" })}
        title="两端对齐"
        icon="ri-align-justify"
      />

      <ToolbarDivider />

      {/* 代码块和引用 */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        isActive={editor.isActive("codeBlock")}
        title="代码块"
        icon="ri-code-s-slash-line"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        isActive={editor.isActive("blockquote")}
        title="引用"
        icon="ri-double-quotes-l"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        title="分割线"
        icon="ri-separator"
      />

      <ToolbarDivider />

      {/* 图片 */}
      <ToolbarButton
        onClick={() => fileInputRef.current?.click()}
        title="插入图片"
        icon="ri-image-line"
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleImageUpload}
      />

      <ToolbarDivider />

      {/* 撤销/重做 */}
      <ToolbarButton
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().chain().focus().undo().run()}
        title="撤销 (Ctrl+Z)"
        icon="ri-arrow-go-back-line"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().chain().focus().redo().run()}
        title="重做 (Ctrl+Y)"
        icon="ri-arrow-go-forward-line"
      />
    </div>
  );
};

export default MenuBar;
