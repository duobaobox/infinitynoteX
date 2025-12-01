/**
 * BaseCard - 通用卡片组件
 *
 * 可扩展的卡片基础组件，支持按需配置：
 * - 背景装饰类型（堆叠卡片、机器人、无、自定义）
 * - 钉住/悬浮功能
 * - 颜色主题
 * - 操作按钮
 *
 * @example
 * // 便签卡片
 * <BaseCard
 *   title="便签"
 *   content="内容"
 *   color="ffd666"
 *   backgroundType="stacked"
 *   features={{ pinnable: true, colorable: true }}
 *   onPin={() => console.log('pin')}
 * />
 *
 * @example
 * // AI对话卡片
 * <BaseCard
 *   title="对话"
 *   content="内容"
 *   backgroundType="robot"
 *   features={{ pinnable: false, colorable: false }}
 * />
 *
 * @example
 * // 自定义背景
 * <BaseCard
 *   title="自定义"
 *   content="内容"
 *   renderBackground={() => <MyCustomBackground />}
 * />
 */

import React, { useState, useContext } from 'react';
import { Button } from 'antd';
import { PushpinOutlined } from '@ant-design/icons';
import { NoteCardListContext } from '../CardContext/CardContext';
import { CardBackgroundRenderer } from './CardBackgroundRenderer';
import { useCardTheme } from './useCardTheme';
import type { BaseCardProps } from './types';
import './BaseCard.css';

const BaseCard: React.FC<BaseCardProps> = ({
  id,
  title,
  content,
  color = 'ffffff',
  backgroundType = 'none',
  renderBackground,
  features = {},
  onClick,
  onPin,
  actions,
  extra,
  className = '',
  style,
}) => {
  const { pinnable = false, colorable = true } = features;

  // Hover 状态
  const [hovered, setHovered] = useState(false);

  // 从 Context 获取选中状态
  const listContext = useContext(NoteCardListContext);
  const isSelected = listContext?.selectedId === id;

  // 使用统一的主题 Hook
  const isInteractive = isSelected || hovered;
  const { bgColor, borderColor } = useCardTheme({
    color,
    isInteractive,
    colorable,
  });

  // 渲染背景装饰
  const renderBackgroundContent = () => {
    // 自定义背景优先
    if (renderBackground) {
      return renderBackground();
    }
    // 内置背景类型
    return <CardBackgroundRenderer type={backgroundType} />;
  };

  // 渲染钉住按钮
  const renderPinButton = () => {
    if (!pinnable || !onPin) return null;

    return (
      <Button
        type="text"
        size="small"
        icon={<PushpinOutlined />}
        onClick={(e) => {
          e.stopPropagation();
          onPin();
        }}
      />
    );
  };

  return (
    <div
      className={`base-card group ${isSelected ? 'base-card-selected' : ''} ${className}`}
      onClick={onClick}
      style={{
        background: bgColor,
        borderColor: borderColor,
        ...style,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* 背景装饰 */}
      {renderBackgroundContent()}

      {/* 卡片内容 */}
      <div className="base-card-content-wrapper">
        <div>
          <div className="base-card-title" title={title}>
            {title.length > 10 ? title.slice(0, 10) + '…' : title}
          </div>
          <div className="base-card-content">{content}</div>
        </div>
      </div>

      {/* 操作区（右上角） */}
      <div className="base-card-actions">
        {renderPinButton()}
        {actions}
      </div>

      {/* 扩展内容（预留接口） */}
      {extra}
    </div>
  );
};

export default BaseCard;
