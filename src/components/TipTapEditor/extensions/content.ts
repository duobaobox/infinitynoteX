/**
 * 内容扩展配置
 * 包含图片、表格、占位符等内容类扩展
 */

import Placeholder from '@tiptap/extension-placeholder';
import { TableKit } from '@tiptap/extension-table';
import { ResizableImage } from './ResizableImage';
import { ImagePasteHandler } from './ImagePasteHandler';
import { TableHandles } from './TableHandles';
import type { EditorConfig } from './basic';

/**
 * 获取内容扩展
 * - ResizableImage: 可调整大小的图片（仿官方 TipTap demo 风格）
 * - Placeholder: 占位符
 * - TableKit: 表格套件
 * - TableHandles: Notion 风格表格行/列手柄
 */
export const getContentExtensions = (config?: EditorConfig) => {
  return [
    // 使用自定义的可调整大小图片扩展
    ResizableImage.configure({
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

    // Notion 风格表格手柄扩展
    // 悬停行/列边缘显示手柄，点击弹出操作菜单
    TableHandles,

    // 图片粘贴/拖放处理扩展
    // 拦截粘贴和拖放事件，将图片保存到 attachments 目录
    ImagePasteHandler,
  ];
};
