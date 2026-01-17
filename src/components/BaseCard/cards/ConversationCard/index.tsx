/**
 * ConversationCard - AI对话卡片
 * 配置：机器人图标 + 根据来源显示不同颜色 + 无钉住
 */

import React from 'react';
import { RobotOutlined } from '@ant-design/icons';
import BaseCard, { CardListContext } from '../../index';
import type { BaseCardProps } from '../../index';
import './ConversationCard.css';

interface RobotIconProps {
  /** 对话来源：note=便签(橙色), workbench=AI工坊(黑白), canvas=画布 */
  source?: 'note' | 'workbench' | 'canvas' | 'global';
}

// 机器人图标组件 - 根据来源显示不同颜色
const RobotIcon: React.FC<RobotIconProps> = React.memo(({ source }) => {
  // 便签来源显示橙色，其他显示默认黑白
  const isNoteSource = source === 'note';

  return (
    <div className={`robot-icon ${isNoteSource ? 'robot-icon--note' : ''}`}>
      <div className="robot-icon__box">
        <RobotOutlined />
      </div>
    </div>
  );
});

RobotIcon.displayName = 'RobotIcon';

export interface ConversationCardProps extends Omit<
  BaseCardProps,
  'renderIcon' | 'colorable' | 'pinnable' | 'color'
> {
  /* 对话来源：note=便签, workbench=AI工坊, canvas=画布, global=全局 */
  source?: 'note' | 'workbench' | 'canvas' | 'global';
}

const ConversationCard: React.FC<ConversationCardProps> = ({ source, ...props }) => (
  <BaseCard
    {...props}
    colorable={false}
    pinnable={false}
    renderIcon={() => <RobotIcon source={source} />}
    className="conversation-card"
  />
);

// 使用 React.memo 优化性能
export default React.memo(ConversationCard);
export { CardListContext };
