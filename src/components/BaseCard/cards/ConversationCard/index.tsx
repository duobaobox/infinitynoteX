/**
 * ConversationCard - AI对话卡片
 * 配置：机器人图标 + 固定颜色 + 无钉住
 */

import React from 'react';
import { RobotOutlined } from '@ant-design/icons';
import BaseCard, { CardListContext } from '../../index';
import type { BaseCardProps } from '../../index';
import './ConversationCard.css';

// 机器人图标组件
const RobotIcon: React.FC = () => (
  <div className="robot-icon">
    <div className="robot-icon__box">
      <RobotOutlined />
    </div>
  </div>
);

export interface ConversationCardProps
  extends Omit<BaseCardProps, 'renderIcon' | 'colorable' | 'pinnable' | 'color'> {}

const ConversationCard: React.FC<ConversationCardProps> = (props) => (
  <BaseCard
    {...props}
    colorable={false}
    pinnable={false}
    renderIcon={() => <RobotIcon />}
    className="conversation-card"
  />
);

export default ConversationCard;
export { CardListContext };
