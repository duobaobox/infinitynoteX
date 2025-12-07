/**
 * 基础扩展配置
 * 包含 StarterKit 等核心扩展
 */

import StarterKit from '@tiptap/starter-kit';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';

// 创建 lowlight 实例，使用常用语言包
const lowlight = createLowlight(common);

export interface EditorConfig {
  placeholder?: string;
}

/**
 * 获取基础扩展
 * StarterKit 包含了大部分基础功能:
 * - Document, Paragraph, Text
 * - Heading, Bold, Italic, Strike, Code
 * - BulletList, OrderedList, ListItem
 * - Blockquote, HorizontalRule
 * - HardBreak, History (Undo/Redo)
 * - Link, Underline (v3 新增)
 *
 * 注意: 禁用了 StarterKit 自带的 CodeBlock，改用 CodeBlockLowlight
 */
export const getBasicExtensions = () => {
  return [
    // StarterKit 包含了大部分基础扩展
    // 禁用默认的 CodeBlock，使用 CodeBlockLowlight 替代
    // 配置 Link 扩展选项
    StarterKit.configure({
      codeBlock: false,
      link: {
        openOnClick: false, // 编辑模式下点击不打开链接
        autolink: true, // 自动检测 URL 并转换为链接
        defaultProtocol: 'https',
        HTMLAttributes: {
          class: 'editor-link',
          target: '_blank',
          rel: 'noopener noreferrer',
        },
      },
    }),

    // 代码块语法高亮扩展
    CodeBlockLowlight.configure({
      lowlight,
      defaultLanguage: 'plaintext',
      HTMLAttributes: {
        class: 'code-block-lowlight',
      },
    }),
  ];
};
