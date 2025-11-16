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
    id: 'ai-session-quicknote',
    title: '速记助手',
    excerpt: '帮我总结今天的会议要点并生成三条行动项。',
    updatedAt: Date.now() - 1000 * 60 * 3,
    color: 'd6e4ff',
  },
  {
    id: 'ai-session-brainstorm',
    title: '灵感共创',
    excerpt: '结合主视觉，想三个有记忆点的标语备选。',
    updatedAt: Date.now() - 1000 * 60 * 60,
    color: 'ffd6e7',
  },
  {
    id: 'ai-session-learning',
    title: '学习伙伴',
    excerpt: '解释一下 Electron 主进程与渲染进程通讯的关键点。',
    updatedAt: Date.now() - 1000 * 60 * 60 * 4,
    color: 'bae0ff',
  },
];
