/**
 * Todo 模块类型定义
 */

import type { TipTapJSONContent } from '../../services/types';

// Todo 视图 / 默认清单常量 - 单一来源在 src/shared/constants/todoConstants.ts
export {
  DEFAULT_MANUAL_TODO_LIST_ID,
  DEFAULT_MANUAL_TODO_LIST_NAME,
  NOTE_TASKS_LIST_COLOR,
  NOTE_TASKS_LIST_DESCRIPTION,
  NOTE_TASKS_LIST_ID,
  NOTE_TASKS_LIST_NAME,
} from '../../shared/constants/todoConstants';

/**
 * 从便签解析出的任务项
 */
export interface ParsedTask {
  /** 唯一标识：noteId#path，如 "abc123#0.1" */
  id: string;
  /** 来源便签 ID */
  noteId: string;
  /** 来源便签标题 */
  noteTitle: string;
  /** 来源文件夹 ID */
  folderId: string;
  /** 任务在 JSON 中的路径索引数组 */
  path: number[];
  /** 任务文本内容 */
  text: string;
  /** 是否完成 */
  checked: boolean;
  /** 截止日期（可选） */
  dueDate?: number;
  /** 便签更新时间 */
  updatedAt: number;
}

/**
 * 从 TipTap JSON 内容中提取纯文本
 */
export function extractTextFromNode(node: TipTapJSONContent): string {
  if (node.type === 'text' && typeof node.text === 'string') {
    return node.text;
  }
  if (node.content && Array.isArray(node.content)) {
    return node.content.map(extractTextFromNode).join('');
  }
  return '';
}

// 导出 TodoList 相关类型
export type { TodoList, ManualTask, ManualTaskIndex } from '../../services/types';
