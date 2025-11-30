/**
 * 基础扩展配置
 * 包含 StarterKit 等核心扩展
 */

import StarterKit from '@tiptap/starter-kit';

export interface EditorConfig {
  placeholder?: string;
}

/**
 * 获取基础扩展
 * StarterKit 包含了大部分基础功能:
 * - Document, Paragraph, Text
 * - Heading, Bold, Italic, Strike, Code
 * - BulletList, OrderedList, ListItem
 * - Blockquote, CodeBlock, HorizontalRule
 * - HardBreak, History (Undo/Redo)
 */
export const getBasicExtensions = () => {
  return [
    // StarterKit 包含了大部分基础扩展
    StarterKit,
  ];
};
