import React from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import "./TipTapEditor.css";

interface TipTapEditorProps {
  initialContent?: string;
  onContentChange?: (content: string) => void;
}

const TipTapEditor: React.FC<TipTapEditorProps> = ({
  initialContent = "<p>开始编写...</p>",
  onContentChange,
}) => {
  const editor = useEditor({
    extensions: [StarterKit],
    content: initialContent,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onContentChange?.(html);
    },
    editorProps: {
      attributes: {
        class: "tiptap-editor",
      },
    },
  });

  if (!editor) {
    return null;
  }

  return (
    <div className="tiptap-container">
      <div className="tiptap-toolbar">
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          disabled={!editor.can().chain().focus().toggleBold().run()}
          className={editor.isActive("bold") ? "is-active" : ""}
          title="粗体 (Ctrl+B)"
        >
          <strong>B</strong>
        </button>

        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          disabled={!editor.can().chain().focus().toggleItalic().run()}
          className={editor.isActive("italic") ? "is-active" : ""}
          title="斜体 (Ctrl+I)"
        >
          <em>I</em>
        </button>

        <button
          onClick={() => editor.chain().focus().toggleStrike().run()}
          disabled={!editor.can().chain().focus().toggleStrike().run()}
          className={editor.isActive("strike") ? "is-active" : ""}
          title="删除线"
        >
          <s>S</s>
        </button>

        <button
          onClick={() => editor.chain().focus().toggleCode().run()}
          disabled={!editor.can().chain().focus().toggleCode().run()}
          className={editor.isActive("code") ? "is-active" : ""}
          title="代码"
        >
          <code>&lt;&gt;</code>
        </button>

        <div className="toolbar-divider" />

        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={editor.isActive("heading", { level: 1 }) ? "is-active" : ""}
          title="标题 1"
        >
          H1
        </button>

        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={editor.isActive("heading", { level: 2 }) ? "is-active" : ""}
          title="标题 2"
        >
          H2
        </button>

        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={editor.isActive("heading", { level: 3 }) ? "is-active" : ""}
          title="标题 3"
        >
          H3
        </button>

        <div className="toolbar-divider" />

        <button
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={editor.isActive("bulletList") ? "is-active" : ""}
          title="无序列表"
        >
          • 列表
        </button>

        <button
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={editor.isActive("orderedList") ? "is-active" : ""}
          title="有序列表"
        >
          1. 列表
        </button>

        <button
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className={editor.isActive("codeBlock") ? "is-active" : ""}
          title="代码块"
        >
          &lt;/&gt;
        </button>

        <div className="toolbar-divider" />

        <button
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={editor.isActive("blockquote") ? "is-active" : ""}
          title="引用"
        >
          ″
        </button>

        <button
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          title="分割线"
        >
          ─
        </button>

        <div className="toolbar-divider" />

        <button
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().chain().focus().undo().run()}
          title="撤销 (Ctrl+Z)"
        >
          ↶
        </button>

        <button
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().chain().focus().redo().run()}
          title="重做 (Ctrl+Y)"
        >
          ↷
        </button>
      </div>

      <div className="tiptap-editor-wrapper">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
};

export default TipTapEditor;
