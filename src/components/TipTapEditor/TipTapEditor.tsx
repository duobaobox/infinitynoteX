import React from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TaskList, TaskItem } from "@tiptap/extension-list";
import Image from "@tiptap/extension-image";
// Remix Icon 通过CDN全局引入，无需import
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
    extensions: [
      StarterKit,
      TaskList.configure({}),
      TaskItem.configure({ nested: true }),
      Image.configure({ allowBase64: true }),
    ],
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
  // 图片上传 input 引用
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  if (!editor) {
    return null;
  }

  return (
    <div className="tiptap-container">
      <div
        className="tiptap-toolbar"
        onWheel={(e) => {
          // 将垂直滚动转换为水平滚动，不需要按 Shift
          const target = e.currentTarget;
          const delta =
            Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
          if (delta !== 0) {
            e.preventDefault();
            target.scrollLeft += delta;
          }
        }}
      >
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          disabled={!editor.can().chain().focus().toggleBold().run()}
          className={editor.isActive("bold") ? "is-active" : ""}
          title="粗体 (Ctrl+B)"
        >
          <i className="ri-bold" />
        </button>

        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          disabled={!editor.can().chain().focus().toggleItalic().run()}
          className={editor.isActive("italic") ? "is-active" : ""}
          title="斜体 (Ctrl+I)"
        >
          <i className="ri-italic" />
        </button>

        <button
          onClick={() => editor.chain().focus().toggleStrike().run()}
          disabled={!editor.can().chain().focus().toggleStrike().run()}
          className={editor.isActive("strike") ? "is-active" : ""}
          title="删除线"
        >
          <i className="ri-strikethrough" />
        </button>

        <button
          onClick={() => editor.chain().focus().toggleCode().run()}
          disabled={!editor.can().chain().focus().toggleCode().run()}
          className={editor.isActive("code") ? "is-active" : ""}
          title="代码"
        >
          <i className="ri-code-line" />
        </button>

        <div className="toolbar-divider" />

        <button
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 1 }).run()
          }
          className={
            editor.isActive("heading", { level: 1 }) ? "is-active" : ""
          }
          title="标题 1"
        >
          <i className="ri-h-1" />
        </button>
        <button
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
          className={
            editor.isActive("heading", { level: 2 }) ? "is-active" : ""
          }
          title="标题 2"
        >
          <i className="ri-h-2" />
        </button>
        <button
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
          className={
            editor.isActive("heading", { level: 3 }) ? "is-active" : ""
          }
          title="标题 3"
        >
          <i className="ri-h-3" />
        </button>

        <div className="toolbar-divider" />

        <button
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={editor.isActive("bulletList") ? "is-active" : ""}
          title="无序列表"
        >
          <i className="ri-list-unordered" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={editor.isActive("orderedList") ? "is-active" : ""}
          title="有序列表"
        >
          <i className="ri-list-ordered" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          className={editor.isActive("taskList") ? "is-active" : ""}
          title="任务列表"
        >
          <i className="ri-checkbox-line" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className={editor.isActive("codeBlock") ? "is-active" : ""}
          title="代码块"
        >
          <i className="ri-code-s-slash-line" />
        </button>

        <div className="toolbar-divider" />

        <button
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={editor.isActive("blockquote") ? "is-active" : ""}
          title="引用"
        >
          <i className="ri-double-quotes-l" />
        </button>

        <button
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          title="分割线"
        >
          <i className="ri-separator" />
        </button>

        {/* 图片按钮单独区域 */}
        <div className="toolbar-divider" />
        <button onClick={() => fileInputRef.current?.click()} title="插入图片">
          <i className="ri-image-line" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (evt) => {
              const src = evt.target?.result as string;
              editor?.chain().focus().setImage({ src }).run();
            };
            reader.readAsDataURL(file);
            e.target.value = "";
          }}
        />
        <div className="toolbar-divider" />

        <button
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().chain().focus().undo().run()}
          title="撤销 (Ctrl+Z)"
        >
          <i className="ri-arrow-go-back-line" />
        </button>
        <button
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().chain().focus().redo().run()}
          title="重做 (Ctrl+Y)"
        >
          <i className="ri-arrow-go-forward-line" />
        </button>
      </div>

      <div className="tiptap-editor-wrapper">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
};

export default TipTapEditor;
