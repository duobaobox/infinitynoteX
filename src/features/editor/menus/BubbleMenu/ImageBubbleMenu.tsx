/**
 * ImageBubbleMenu 图片操作菜单
 * 选中图片时显示的操作工具栏
 */

import React from 'react';
import { BubbleMenu } from '@tiptap/react/menus';
import type { Editor } from '@tiptap/react';
import { AlignLeft, AlignCenter, AlignRight, Trash2, ExternalLink } from 'lucide-react';
import './BubbleMenu.css';

interface ImageBubbleMenuProps {
  editor: Editor;
}

/**
 * 图片操作菜单 - 选中图片时显示
 */
export const ImageBubbleMenu: React.FC<ImageBubbleMenuProps> = ({ editor }) => {
  if (!editor) {
    return null;
  }

  const getImageSrc = (): string | undefined => {
    const { selection } = editor.state;
    const { node } = selection as unknown as {
      node?: { type?: { name?: string }; attrs?: { src?: string } };
    };
    if (node?.type?.name === 'image') {
      return node.attrs?.src;
    }
    return undefined;
  };

  // 查看原图
  const handleViewOriginal = () => {
    const src = getImageSrc();
    if (src) {
      window.open(src, '_blank');
    }
  };

  // 删除图片
  const handleDelete = () => {
    editor.chain().focus().deleteSelection().run();
  };

  return (
    <BubbleMenu
      className="bubble-menu image-bubble-menu"
      editor={editor}
      options={{
        placement: 'top',
      }}
      shouldShow={({ editor: e }) => e.isActive('image')}
    >
      {/* 左对齐 */}
      <button
        type="button"
        onClick={() => editor.chain().focus().setTextAlign('left').run()}
        className={editor.isActive({ textAlign: 'left' }) ? 'is-active' : ''}
        title="左对齐"
      >
        <AlignLeft size={16} />
      </button>

      {/* 居中 */}
      <button
        type="button"
        onClick={() => editor.chain().focus().setTextAlign('center').run()}
        className={editor.isActive({ textAlign: 'center' }) ? 'is-active' : ''}
        title="居中"
      >
        <AlignCenter size={16} />
      </button>

      {/* 右对齐 */}
      <button
        type="button"
        onClick={() => editor.chain().focus().setTextAlign('right').run()}
        className={editor.isActive({ textAlign: 'right' }) ? 'is-active' : ''}
        title="右对齐"
      >
        <AlignRight size={16} />
      </button>

      <span className="divider" />

      {/* 查看原图 */}
      <button type="button" onClick={handleViewOriginal} title="查看原图">
        <ExternalLink size={16} />
      </button>

      {/* 删除图片 */}
      <button type="button" onClick={handleDelete} className="danger" title="删除图片">
        <Trash2 size={16} />
      </button>
    </BubbleMenu>
  );
};

export default ImageBubbleMenu;
