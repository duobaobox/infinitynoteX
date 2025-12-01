/**
 * ConversationCard - AI对话卡片组件
 *
 * 基于 BaseCard 的 AI 对话卡片特化组件
 * 特性：
 * - 机器人背景装饰
 * - 固定白色/暗色背景（不支持颜色主题）
 * - 不支持钉住功能
 */

import React from 'react';
import BaseCard from '../../BaseCard';
import './ConversationCard.css';

export interface AIConversationCardProps {
  title: string;
  content: string;
  onClick?: () => void;
  actions?: React.ReactNode;
  id?: string;
}

const AIConversationCard: React.FC<AIConversationCardProps> = ({
  title,
  content,
  onClick,
  actions,
  id,
}) => (
  <BaseCard
    id={id}
    title={title}
    content={content}
    backgroundType="robot"
    features={{
      pinnable: false,
      colorable: false,
    }}
    onClick={onClick}
    actions={actions}
  />
);

export default AIConversationCard;
