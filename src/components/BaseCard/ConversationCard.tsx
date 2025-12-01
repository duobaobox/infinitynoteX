/**
 * ConversationCard - AI对话卡片
 *
 * 配置：机器人背景 + 固定颜色 + 无钉住
 */

import React from 'react';
import BaseCard from './BaseCard';

export interface ConversationCardProps {
  id?: string;
  title: string;
  content: string;
  onClick?: () => void;
  actions?: React.ReactNode;
}

const ConversationCard: React.FC<ConversationCardProps> = (props) => (
  <BaseCard {...props} backgroundType="robot" pinnable={false} colorable={false} />
);

export default ConversationCard;
