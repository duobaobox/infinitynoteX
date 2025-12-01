/**
 * ChecklistBackground - 待办清单背景装饰
 * 用于待办卡片 (TodoCard)
 */

import React from 'react';
import { CheckSquareOutlined } from '@ant-design/icons';

export interface ChecklistBackgroundProps {
  className?: string;
}

const ChecklistBackground: React.FC<ChecklistBackgroundProps> = ({ className = '' }) => {
  return (
    <div className={`card-bg card-bg-checklist ${className}`}>
      <div className="card-bg-checklist__icon">
        <CheckSquareOutlined />
      </div>
    </div>
  );
};

export default ChecklistBackground;
