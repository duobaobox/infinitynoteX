/**
 * TipTap Editor 类型定义
 * 按照官方规范定义编辑器相关类型
 */

import { Editor } from '@tiptap/react';
import type { TipTapJSONContent } from '../../services/types';

export interface TipTapEditorProps {
  /** 初始内容（支持 HTML 字符串或 TipTap JSON） */
  initialContent?: string | TipTapJSONContent;
  /** 内容唯一标识符（如便签 ID），用于区分是内容更新还是切换了便签 */
  contentId?: string;
  /** 内容变化回调（TipTap JSON） */
  onContentChange?: (content: TipTapJSONContent) => void;
  /** 编辑器占位符 */
  placeholder?: string;
  /** 是否可编辑 */
  editable?: boolean;
  /** 是否自动聚焦 */
  autofocus?: boolean | 'start' | 'end' | number;
  /** 编辑器类名 */
  className?: string;
  /** 是否显示工具栏 */
  showMenuBar?: boolean;
  /** 笔记标题 */
  title?: string;
  /** 标题变化回调 */
  onTitleChange?: (title: string) => void;
  /** 是否显示标题输入框 */
  showTitleInput?: boolean;
  /** 任务路径（用于定位到特定任务）*/
  taskPath?: number[] | null;
  /** 任务路径定位完成后的回调 */
  onTaskLocated?: () => void;
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
