/**
 * BubbleMenus 统一入口
 * 根据选中内容上下文渲染不同的气泡菜单
 */

import React from 'react';
import type { Editor } from '@tiptap/react';
import { TextBubbleMenu } from './TextBubbleMenu';
import { ImageBubbleMenu } from './ImageBubbleMenu';
import { LinkBubbleMenu } from './LinkBubbleMenu';
import { CodeBlockBubbleMenu } from './CodeBlockBubbleMenu';

interface BubbleMenusProps {
  editor: Editor;
}

/**
 * 上下文感知的气泡菜单组
 *
 * 各菜单的 shouldShow 逻辑：
 * - TextBubbleMenu: 选中文本且不在 image/table/codeBlock 中
 * - ImageBubbleMenu: 选中图片节点
 * - LinkBubbleMenu: 光标在链接上（无选区时）
 * - CodeBlockBubbleMenu: 光标在代码块内
 *
 * 注意：TableBubbleMenu 由 TipTapEditor 单独引入
 */
export const BubbleMenus: React.FC<BubbleMenusProps> = ({ editor }) => {
  if (!editor) {
    return null;
  }

  return (
    <>
      <TextBubbleMenu editor={editor} />
      <ImageBubbleMenu editor={editor} />
      <LinkBubbleMenu editor={editor} />
      <CodeBlockBubbleMenu editor={editor} />
    </>
  );
};

// 保持向后兼容，同时导出单独的菜单
export { TextBubbleMenu, ImageBubbleMenu, LinkBubbleMenu, CodeBlockBubbleMenu };

// 默认导出整合版
export default BubbleMenus;
