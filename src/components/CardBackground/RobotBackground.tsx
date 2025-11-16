import React from 'react';
import { RobotOutlined } from '@ant-design/icons';
import './RobotBackground.css';

export interface RobotBackgroundProps {
  className?: string;
}

/**
 * AI对话卡片背景装饰组件 - 机器人图标（倾斜样式）
 * 机器人直接替换整个卡片，不在卡片内部
 */
const RobotBackground: React.FC<RobotBackgroundProps> = ({ className = '' }) => {
  return (
    <div className={`card-background-pattern robot-card-wrapper ${className}`}>
      {/* 倾斜的机器人（替换整个便签卡片） */}
      <div className="robot-card">
        <RobotOutlined />
      </div>
    </div>
  );
};

export default RobotBackground;
