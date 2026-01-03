/**
 * BaseCard - 极简卡片基础组件
 *
 * 只提供：卡片容器 + 主题 + 选中状态
 * 子卡片通过 renderIcon 自定义图标装饰
 */

import React, { useState, useEffect, useMemo, createContext, useContext } from 'react';
import { Button } from 'antd';
import { PushpinOutlined } from '@ant-design/icons';
import { getThemeColor } from '../../theme/theme';
import { useNoteCardTheme, type NoteCardColor } from '../../hooks/useNoteCardTheme';
import './BaseCard.css';

// ============================================================
// 类型
// ============================================================

export interface BaseCardProps {
  id?: string;
  title: string;
  content: string;
  color?: NoteCardColor;
  /** 是否支持颜色主题 */
  colorable?: boolean;
  /** 是否支持钉住 */
  pinnable?: boolean;
  /** 渲染左下角图标装饰 */
  renderIcon?: () => React.ReactNode;
  onClick?: () => void;
  onPin?: () => void;
  onDoubleClick?: () => void;
  actions?: React.ReactNode;
  className?: string;
}

// ============================================================
// Context（列表场景批量传递 selectedId）
// ============================================================

export interface CardListContextValue {
  selectedId?: string;
}

export const CardListContext = createContext<CardListContextValue | undefined>(undefined);

// ============================================================
// 主题 Hook
// ============================================================

function useCardTheme(color: NoteCardColor, isInteractive: boolean, colorable: boolean) {
  const [themeColor, setThemeColor] = useState(getThemeColor());
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      if (e instanceof CustomEvent && typeof e.detail === 'string') {
        setThemeColor(e.detail);
      }
    };
    window.addEventListener('theme-color-change', handler);
    return () => window.removeEventListener('theme-color-change', handler);
  }, []);

  useEffect(() => {
    const check = () =>
      setIsDarkMode(document.documentElement.getAttribute('data-theme') === 'dark');
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => observer.disconnect();
  }, []);

  const { bgColor: computedBg, borderColor } = useNoteCardTheme(
    colorable ? color : 'ffffff',
    themeColor,
    isInteractive,
  );

  const bgColor = useMemo(() => {
    return colorable ? computedBg : isDarkMode ? '#262626' : '#ffffff';
  }, [colorable, computedBg, isDarkMode]);

  return { bgColor, borderColor };
}

// ============================================================
// BaseCard 组件
// ============================================================

const BaseCard: React.FC<BaseCardProps> = ({
  id,
  title,
  content,
  color = 'ffffff',
  colorable = true,
  pinnable = false,
  renderIcon,
  onClick,
  onDoubleClick,
  onPin,
  actions,
  className = '',
}) => {
  const [hovered, setHovered] = useState(false);

  const ctx = useContext(CardListContext);
  const isSelected = ctx?.selectedId === id;

  const { bgColor, borderColor } = useCardTheme(color, isSelected || hovered, colorable);

  return (
    <div
      className={`base-card ${isSelected ? 'base-card--selected' : ''} ${className}`}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      style={{ background: bgColor, borderColor }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* 图标装饰 */}
      {renderIcon && <div className="base-card__icon">{renderIcon()}</div>}

      {/* 内容 */}
      <div className="base-card__body">
        <div className="base-card__title" title={title}>
          {title}
        </div>
        <div className="base-card__content">{content}</div>
      </div>

      {/* 操作区 */}
      <div className="base-card__actions">
        {pinnable && onPin && (
          <Button
            type="text"
            size="small"
            icon={<PushpinOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              onPin();
            }}
          />
        )}
        {actions}
      </div>
    </div>
  );
};

// 使用 React.memo 优化性能，避免不必要的重渲染
export default React.memo(BaseCard);
