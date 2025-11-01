/**
 * TipTap Editor 类型定义
 * 按照官方规范定义编辑器相关类型
 */

import { Editor } from "@tiptap/react";

export interface TipTapEditorProps {
  /** 初始内容（HTML 格式） */
  initialContent?: string;
  /** 内容变化回调 */
  onContentChange?: (content: string) => void;
  /** 编辑器占位符 */
  placeholder?: string;
  /** 是否可编辑 */
  editable?: boolean;
  /** 是否自动聚焦 */
  autofocus?: boolean | "start" | "end" | number;
  /** 编辑器类名 */
  className?: string;
  /** 是否显示工具栏 */
  showMenuBar?: boolean;
  /** 笔记标题 */
  title?: string;
  /** 标题变化回调 */
  onTitleChange?: (title: string) => void;
}

export interface MenuBarProps {
  editor: Editor | null;
}

export interface ToolbarButtonProps {
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  title?: string;
  icon: string;
  children?: React.ReactNode;
}
