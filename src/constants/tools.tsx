import type { ReactNode } from 'react';
import { ClockCircleOutlined, RobotOutlined } from '@ant-design/icons';
import type { NoteColor } from '../services/types';

export type WorkspaceView = 'note' | 'tool';

export interface ToolDefinition {
  id: string;
  name: string;
  description: string;
  icon: ReactNode;
}

export const DEFAULT_TOOLS: ToolDefinition[] = [
  {
    id: 'ai-chat',
    name: 'AI对话',
    description: '与智能助手的多轮对话空间。',
    icon: <RobotOutlined />,
  },
  {
    id: 'timer',
    name: '计时器',
    description: '轻量计时与番茄钟管理。',
    icon: <ClockCircleOutlined />,
  },
];

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
