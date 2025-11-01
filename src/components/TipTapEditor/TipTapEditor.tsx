/**
 * TipTap Editor 主组件
 * 按照官方规范开发的富文本编辑器
 *
 * @see https://tiptap.dev/docs/editor/getting-started/overview
 */

import React, { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { MenuBar } from "./MenuBar";
import { getExtensions } from "./extensions";
import type { TipTapEditorProps } from "./types";
import "./TipTapEditor.css";

/**
 * TipTap 编辑器组件
 *
 * 特性：
 * - 完整的富文本编辑功能
 * - 支持任务列表、图片、代码块等
 * - 响应式工具栏
 * - TypeScript 类型安全
 */
const TipTapEditor: React.FC<TipTapEditorProps> = ({
  initialContent = "<p>开始编写...</p>",
  onContentChange,
  placeholder = "开始输入...",
  editable = true,
  autofocus = false,
  className = "",
  showMenuBar = true,
}) => {
  // 使用 useEditor Hook 创建编辑器实例
  const editor = useEditor({
    extensions: getExtensions(placeholder),
    content: initialContent,
    editable,
    autofocus,
    // 内容更新回调
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onContentChange?.(html);
    },
    // 编辑器属性配置
    editorProps: {
      attributes: {
        class: `tiptap-editor ${className}`,
      },
    },
  });

  // 组件卸载时销毁编辑器实例（官方推荐）
  useEffect(() => {
    return () => {
      editor?.destroy();
    };
  }, [editor]);

  if (!editor) {
    return null;
  }

  return (
    <div className="tiptap-container">
      {/* 可选的菜单栏 */}
      {showMenuBar && <MenuBar editor={editor} />}

      {/* 编辑器内容区域 */}
      <div className="tiptap-editor-wrapper">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
};

export default TipTapEditor;
