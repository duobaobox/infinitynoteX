/**
 * ConversationCard - AI对话卡片
 * 配置：机器人图标 + 固定颜色 + 无钉住
 */

import React from 'react';
import { RobotOutlined } from '@ant-design/icons';
import BaseCard, { CardListContext } from '../../index';
import type { BaseCardProps } from '../../index';
import './ConversationCard.css';

// 机器人图标组件 - 使用 memo 避免不必要的重渲染
const RobotIcon: React.FC = React.memo(() => (
  <div className="robot-icon">
    <div className="robot-icon__box">
      <RobotOutlined />
    </div>
  </div>
));

RobotIcon.displayName = 'RobotIcon';

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

// 使用 React.memo 优化性能
export default React.memo(ConversationCard);
export { CardListContext };
