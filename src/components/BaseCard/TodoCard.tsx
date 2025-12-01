/**
 * TodoCard - 待办卡片
 *
 * 配置：清单背景 + 支持颜色 + 支持钉住
 *
 * 这是一个示例，展示如何扩展新的卡片类型
 * 只需要指定 backgroundType，无需创建额外的背景组件文件
 */

import React from 'react';
import BaseCard from './BaseCard';
import type { NoteCardColor } from '../../hooks/useNoteCardTheme';

export interface TodoCardProps {
  id?: string;
  title: string;
  content: string;
  color?: NoteCardColor;
  onClick?: () => void;
  onPin?: () => void;
  actions?: React.ReactNode;
}

const TodoCard: React.FC<TodoCardProps> = (props) => (
  <BaseCard {...props} backgroundType="checklist" pinnable colorable />
);

export default TodoCard;
