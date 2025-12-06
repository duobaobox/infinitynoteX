/**
 * 格式化扩展配置
 * 包含文本对齐、下划线、链接、高亮等格式化功能
 */

import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Highlight from '@tiptap/extension-highlight';

/**
 * 获取格式化扩展
 * - TextAlign: 文本对齐 (左/中/右/两端)
 * - Underline: 下划线
 * - Link: 超链接 (支持自动检测 URL)
 * - Highlight: 文本高亮 (支持多颜色)
 */
export const getFormattingExtensions = () => {
  return [
    // 文本对齐扩展
    TextAlign.configure({
      types: ['heading', 'paragraph'],
      alignments: ['left', 'center', 'right', 'justify'],
      defaultAlignment: 'left',
    }),

    // 下划线扩展
    Underline.configure({
      HTMLAttributes: {
        class: 'underline',
      },
    }),

    // 链接扩展
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

    // 高亮扩展
    Highlight.configure({
      multicolor: true, // 支持多种颜色高亮
      HTMLAttributes: {
        class: 'editor-highlight',
      },
    }),
  ];
};
