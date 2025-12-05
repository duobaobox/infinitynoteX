/**
 * 工具相关常量和类型定义
 *
 * 注意: WorkspaceView 和 ToolDefinition 类型已迁移到 config/featureRegistry.tsx
 * 此文件保留用于其他常量和类型定义
 */

import type { NoteColor } from '../services/types';

// WorkspaceView 类型从 featureRegistry 重新导出以保持向后兼容
export type { WorkspaceViewType as WorkspaceView } from '../config/featureRegistry';

export interface AIConversationPreview {
  id: string;
  title: string;
  excerpt: string;
  updatedAt: number;
  color?: NoteColor;
}

export const DEFAULT_AI_CONVERSATIONS: AIConversationPreview[] = [
  {
    id: 'ai-session-default',
    title: '新建对话',
    excerpt: '开始对话，与 AI 互动',
    updatedAt: Date.now(),
    color: 'd6e4ff',
  },
];
