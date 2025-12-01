/**
 * CardBackgroundRenderer - 卡片背景渲染器
 * 根据类型渲染不同的背景装饰
 */

import React from 'react';
import CardBackground from '../CardBackground/CardBackground';
import RobotBackground from '../CardBackground/RobotBackground';
import type { CardBackgroundType } from './types';

interface CardBackgroundRendererProps {
  type: CardBackgroundType;
  className?: string;
}

/**
 * 背景渲染器组件
 * 根据 type 渲染对应的背景装饰
 */
export const CardBackgroundRenderer: React.FC<CardBackgroundRendererProps> = ({
  type,
  className = 'note-card-pattern',
}) => {
  switch (type) {
    case 'stacked':
      return <CardBackground className={className} />;
    case 'robot':
      return <RobotBackground className={className} />;
    case 'none':
    default:
      return null;
  }
};

export default CardBackgroundRenderer;
