/**
 * StackedBackground - 堆叠卡片背景装饰
 * 用于便签卡片 (NoteCard)
 */

import React from 'react';

export interface StackedBackgroundProps {
  className?: string;
}

const StackedBackground: React.FC<StackedBackgroundProps> = ({ className = '' }) => {
  return (
    <div className={`card-bg card-bg-stacked ${className}`}>
      <div className="card-bg-stacked__card">
        <div className="card-bg-stacked__shine" />
        <div className="card-bg-stacked__lines" />
      </div>
    </div>
  );
};

export default StackedBackground;
