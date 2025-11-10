import React from 'react';
import './CardBackground.css';

export interface CardBackgroundProps {
  className?: string;
}

/**
 * 可复用的卡片背景装饰组件 - 堆叠卡片效果
 * 用于NoteCard和PillWindow等组件
 */
const CardBackground: React.FC<CardBackgroundProps> = ({ className = '' }) => {
  return (
    <div className={`card-background-pattern ${className}`}>
      {/* 第一层卡片 */}
      <div className="stacked-card stacked-blue">
        <div className="stacked-card-shine" />
        <div className="stacked-card-lines" />
      </div>
    </div>
  );
};

export default CardBackground;
