/**
 * 格式化扩展配置
 * 包含文本对齐、高亮等格式化功能
 *
 * 注意: Underline 和 Link 已包含在 StarterKit v3 中，无需重复添加
 */

import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';

/**
 * 获取格式化扩展
 * - TextAlign: 文本对齐 (左/中/右/两端)
 * - Highlight: 文本高亮 (支持多颜色)
 *
 * StarterKit v3 已包含:
 * - Underline: 下划线
 * - Link: 超链接
 */
export const getFormattingExtensions = () => {
  return [
    // 文本对齐扩展
    TextAlign.configure({
      types: ['heading', 'paragraph'],
      alignments: ['left', 'center', 'right', 'justify'],
      defaultAlignment: 'left',
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
