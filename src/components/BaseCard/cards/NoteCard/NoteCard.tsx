/**
 * NoteCard - 便签卡片组件
 *
 * 基于 BaseCard 的便签卡片特化组件
 * 特性：
 * - 堆叠卡片背景装饰
 * - 支持颜色主题
 * - 支持钉住/悬浮功能
 */

import React from 'react';
import BaseCard from '../../BaseCard';
import type { NoteCardColor } from '../../../../hooks/useNoteCardTheme';
import './NoteCard.css';

export interface NoteCardProps {
  title: string;
  content: string;
  color?: NoteCardColor;
  onClick?: () => void;
  onPin?: () => void;
  actions?: React.ReactNode;
  id?: string;
}

const NoteCard: React.FC<NoteCardProps> = ({
  title,
  content,
  color = 'ffffff',
  onClick,
  onPin,
  actions,
  id,
}) => (
  <BaseCard
    id={id}
    title={title}
    content={content}
    color={color}
    backgroundType="stacked"
    features={{
      pinnable: true,
      colorable: true,
    }}
    onClick={onClick}
    onPin={onPin}
    actions={actions}
  />
);

export default NoteCard;
