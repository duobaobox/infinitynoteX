/**
 * NoteCard - 便签卡片
 * 配置：堆叠便签图标 + 支持颜色 + 支持钉住
 */

import React from 'react';
import BaseCard, { CardListContext } from '../../index';
import type { BaseCardProps } from '../../index';
import './NoteCard.css';

// 便签图标组件 - 使用 memo 避免不必要的重渲染
const NoteIcon: React.FC = React.memo(() => (
  <div className="note-icon">
    <div className="note-icon__card">
      <div className="note-icon__shine" />
      <div className="note-icon__lines" />
    </div>
  </div>
));

NoteIcon.displayName = 'NoteIcon';

export interface NoteCardProps extends Omit<
  BaseCardProps,
  'renderIcon' | 'colorable' | 'pinnable'
> {}

const NoteCard: React.FC<NoteCardProps> = (props) => (
  <BaseCard {...props} colorable pinnable renderIcon={() => <NoteIcon />} className="note-card" />
);

// 使用 React.memo 优化性能
export default React.memo(NoteCard);
export { CardListContext };
