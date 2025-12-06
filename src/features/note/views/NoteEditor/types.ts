/**
 * NoteEditor 模块的类型定义
 *
 * 【文件职责】
 * 集中管理 NoteEditor 相关的 TypeScript 类型定义
 */

import type { TipTapJSONContent } from '../../../../services/types';

// ============ Tab 类型 ============

/**
 * Tab 键类型
 * - edit: 编辑（富文本编辑器）
 * - tools: 工具（颜色、悬浮窗设置等）
 * - ai: AI 对话
 * - other: 其他功能（扩展预留）
 */
export type TabKeyType = 'edit' | 'tools' | 'ai' | 'other';

// ============ 数据结构 ============

/**
 * 待保存数据结构
 * 用于防抖保存机制，暂存编辑中的内容
 */
export interface PendingSave {
  /** 便签 ID */
  noteId: string;
  /** 便签标题 */
  title: string;
  /** 便签内容 (TipTap JSON 格式) */
  content: TipTapJSONContent;
}
