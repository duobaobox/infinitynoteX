/**
 * TipTap Editor 扩展配置
 * 按照官方规范配置所有扩展
 */

import StarterKit from "@tiptap/starter-kit";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import { TableKit } from "@tiptap/extension-table";

/**
 * 获取编辑器扩展配置
 * 参考 TipTap 官方文档的推荐配置
 */
export const getExtensions = (placeholder?: string) => {
  return [
    // StarterKit 包含了大部分基础扩展
    StarterKit,

    // 任务列表扩展（官方推荐独立引入）
    TaskList.configure({
      HTMLAttributes: {
        class: "task-list",
      },
    }),

    // 任务项扩展
    TaskItem.configure({
      nested: true,
      HTMLAttributes: {
        class: "task-item",
      },
    }),

    // 图片扩展
    Image.configure({
      inline: true,
      allowBase64: true,
      HTMLAttributes: {
        class: "editor-image",
      },
    }),

    // 占位符扩展
    Placeholder.configure({
      placeholder: placeholder || "开始输入...",
      emptyEditorClass: "is-editor-empty",
      showOnlyWhenEditable: true,
      showOnlyCurrent: false,
    }),

    // 文本对齐扩展
    TextAlign.configure({
      types: ["heading", "paragraph"],
      alignments: ["left", "center", "right", "justify"],
      defaultAlignment: "left",
    }),

    // 下划线扩展
    Underline.configure({
      HTMLAttributes: {
        class: "underline",
      },
    }),

    // 表格扩展（使用官方推荐的 TableKit）
    // @see https://tiptap.dev/docs/editor/extensions/nodes/table
    TableKit.configure({
      table: {
        // 启用列宽调整
        resizable: true,
        // 调整手柄宽度（像素）
        handleWidth: 5,
        // 单元格最小宽度（像素）
        cellMinWidth: 50,
        // 允许调整最后一列宽度
        lastColumnResizable: true,
        // 是否允许选择整个表格节点
        allowTableNodeSelection: true,
        // 在不可编辑时也渲染包装器div，保持布局一致性
        renderWrapper: true,
        // 表格HTML属性
        HTMLAttributes: {
          class: "tiptap-table",
        },
      },
      tableCell: {
        HTMLAttributes: {
          class: "tiptap-table-cell",
        },
      },
      tableHeader: {
        HTMLAttributes: {
          class: "tiptap-table-header",
        },
      },
      tableRow: {
        HTMLAttributes: {
          class: "tiptap-table-row",
        },
      },
    }),
  ];
};
