/**
 * 内容扩展配置
 * 包含图片、表格、占位符等内容类扩展
 */

import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { TableKit } from '@tiptap/extension-table';
import type { EditorConfig } from './basic';

/**
 * 获取内容扩展
 * - Image: 图片
 * - Placeholder: 占位符
 * - TableKit: 表格套件
 */
export const getContentExtensions = (config?: EditorConfig) => {
  return [
    // 图片扩展
    Image.configure({
      inline: true,
      allowBase64: true,
      HTMLAttributes: {
        class: 'editor-image',
      },
    }),

    // 占位符扩展
    Placeholder.configure({
      placeholder: config?.placeholder || '开始输入...',
      emptyEditorClass: 'is-editor-empty',
      showOnlyWhenEditable: true,
      showOnlyCurrent: false,
    }),

    // 表格扩展 (使用官方推荐的 TableKit)
    TableKit.configure({
      table: {
        resizable: true,
        handleWidth: 5,
        cellMinWidth: 50,
        lastColumnResizable: true,
        allowTableNodeSelection: true,
        renderWrapper: true,
        HTMLAttributes: {
          class: 'tiptap-table',
        },
      },
      tableCell: {
        HTMLAttributes: {
          class: 'tiptap-table-cell',
        },
      },
      tableHeader: {
        HTMLAttributes: {
          class: 'tiptap-table-header',
        },
      },
      tableRow: {
        HTMLAttributes: {
          class: 'tiptap-table-row',
        },
      },
    }),
  ];
};
