/**
 * NoteEditor 模块的类型定义
 */

import type { TipTapJSONContent } from '../../../../services/types';

/**
 * Tab 键类型
 */
export type TabKeyType = 'edit' | 'tools' | 'ai' | 'other';

/**
 * 待保存数据结构
 */
export interface PendingSave {
  noteId: string;
  title: string;
  content: TipTapJSONContent;
}
