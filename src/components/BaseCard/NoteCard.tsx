/**
 * NoteCard - 便签卡片
 *
 * 配置：堆叠背景 + 支持颜色 + 支持钉住
 */

import React from 'react';
import BaseCard from './BaseCard';
import type { NoteCardColor } from '../../hooks/useNoteCardTheme';

export interface NoteCardProps {
  id?: string;
  title: string;
  content: string;
  color?: NoteCardColor;
  onClick?: () => void;
  onPin?: () => void;
  actions?: React.ReactNode;
}

const NoteCard: React.FC<NoteCardProps> = (props) => (
  <BaseCard {...props} backgroundType="stacked" pinnable colorable />
);

export default NoteCard;
