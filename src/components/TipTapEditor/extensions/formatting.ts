/**
 * 格式化扩展配置
 * 包含文本对齐、下划线等格式化功能
 */

import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';

/**
 * 获取格式化扩展
 * - TextAlign: 文本对齐 (左/中/右/两端)
 * - Underline: 下划线
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
  ];
};
