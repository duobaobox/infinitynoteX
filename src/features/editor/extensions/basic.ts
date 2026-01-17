/**
 * 基础扩展配置
 * 包含 StarterKit 等核心扩展
 */

import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { common, createLowlight } from 'lowlight';
import { CodeBlockWithToolbar } from '../components/CodeBlockWithToolbar';

// 创建 lowlight 实例，使用常用语言包
const lowlight = createLowlight(common);

export interface EditorConfig {
  placeholder?: string;
  disableSlashCommand?: boolean;
}

/**
 * 自定义 CodeBlockLowlight 扩展
 * 使用 React NodeView 渲染，实现固定右上角工具栏
 */
const CustomCodeBlock = CodeBlockLowlight.extend({
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockWithToolbar);
  },
});

/**
 * 获取基础扩展
 * StarterKit 包含了大部分基础功能:
 * - Document, Paragraph, Text
 * - Heading, Bold, Italic, Strike, Code
 * - BulletList, OrderedList, ListItem
 * - Blockquote, HorizontalRule
 * - HardBreak, History (Undo/Redo)
 * - Dropcursor, Gapcursor
 * - ListKeymap, TrailingNode (v3 新增)
 *
 * 注意:
 * - 禁用了 StarterKit 自带的 CodeBlock，改用自定义 CodeBlockLowlight
 * - Link 和 Underline 不在 StarterKit 中，需单独添加
 */
export const getBasicExtensions = () => {
  return [
    // StarterKit 包含了大部分基础扩展
    // 禁用默认的 CodeBlock，使用 CustomCodeBlock 替代
    // 禁用 Link 和 Underline，使用自定义配置
    StarterKit.configure({
      codeBlock: false,
      link: false,
      underline: false,
      // 拖拽光标指示扩展配置
      dropcursor: {
        color: 'var(--theme-color, #1890ff)',
        width: 2,
        class: 'tiptap-dropcursor',
      },
    }),

    // Link 扩展（不在 StarterKit 中，需单独添加）
    Link.configure({
      openOnClick: false, // 编辑模式下点击不打开链接
      autolink: true, // 自动检测 URL 并转换为链接
      defaultProtocol: 'https',
      HTMLAttributes: {
        class: 'editor-link',
        target: '_blank',
        rel: 'noopener noreferrer',
      },
    }),

    // Underline 扩展（不在 StarterKit 中，需单独添加）
    Underline,

    // 代码块语法高亮扩展（带自定义 NodeView）
    CustomCodeBlock.configure({
      lowlight,
      enableTabIndentation: true, // 启用 Tab 缩进
      tabSize: 2, // Tab 空格数
      HTMLAttributes: {
        class: 'code-block-lowlight',
      },
    }),
  ];
};
