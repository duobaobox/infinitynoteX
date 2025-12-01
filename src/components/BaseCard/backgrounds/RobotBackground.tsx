/**
 * RobotBackground - 机器人背景装饰
 * 用于 AI 对话卡片 (ConversationCard)
 */

import React from 'react';
import { RobotOutlined } from '@ant-design/icons';

export interface RobotBackgroundProps {
  className?: string;
}

const RobotBackground: React.FC<RobotBackgroundProps> = ({ className = '' }) => {
  return (
    <div className={`card-bg card-bg-robot ${className}`}>
      <div className="card-bg-robot__icon">
        <RobotOutlined />
      </div>
    </div>
  );
};

export default RobotBackground;
