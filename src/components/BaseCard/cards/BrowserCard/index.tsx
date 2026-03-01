/**
 * BrowserCard - 网页看板卡片
 * 配置：地球图标 + 固定颜色 + 无钉住
 * 样式与 ConversationCard 保持一致
 */

import React from 'react';
import { GlobalOutlined } from '@ant-design/icons';
import BaseCard, { CardListContext } from '../../index';
import type { BaseCardProps } from '../../index';
import './BrowserCard.css';

// 地球图标组件 - 使用 memo 避免不必要的重渲染
const WebIcon: React.FC = React.memo(() => (
  <div className="web-icon">
    <div className="web-icon__box">
      <GlobalOutlined />
    </div>
  </div>
));

WebIcon.displayName = 'WebIcon';

export interface BrowserCardProps extends Omit<
  BaseCardProps,
  'renderIcon' | 'colorable' | 'pinnable' | 'color'
> {}

const BrowserCard: React.FC<BrowserCardProps> = (props) => (
  <BaseCard
    {...props}
    colorable={false}
    pinnable={false}
    renderIcon={() => <WebIcon />}
    className="browser-card"
  />
);

// 使用 React.memo 优化性能
export default React.memo(BrowserCard);
export { CardListContext };
