/**
 * BaseCard - 通用卡片基础组件
 *
 * 设计理念：
 * - 一个基础模板，N 个配置文件
 * - 所有核心逻辑集中在此文件
 * - 特化卡片只需配置，无需重复代码
 *
 * 扩展方式：
 * 1. 复制 NoteCard.tsx 为新文件
 * 2. 修改配置参数（backgroundType）
 * 3. 在 index.ts 中导出
 *
 * 添加新背景类型：
 * 1. 在 backgrounds/ 目录创建组件
 * 2. 在 backgrounds/index.ts 注册
 * 3. 完成！无需修改 BaseCard.tsx
 */

import React, { useState, useEffect, useMemo, createContext, useContext } from 'react';
import { Button } from 'antd';
import { PushpinOutlined } from '@ant-design/icons';
import { renderCardBackground, type CardBackgroundType } from './backgrounds';
import { getThemeColor } from '../../theme/theme';
import { useNoteCardTheme, type NoteCardColor } from '../../hooks/useNoteCardTheme';
import './BaseCard.css';

// 重新导出背景类型，方便外部使用
export type { CardBackgroundType } from './backgrounds';

/** BaseCard Props */
export interface BaseCardProps {
  id?: string;
  title: string;
  content: string;
  color?: NoteCardColor;
  backgroundType?: CardBackgroundType;
  renderBackground?: () => React.ReactNode;
  pinnable?: boolean;
  colorable?: boolean;
  onClick?: () => void;
  onPin?: () => void;
  actions?: React.ReactNode;
  selectedId?: string; // 直接传入，替代 Context
}

// ============================================================
// Context（用于列表场景批量传递 selectedId）
// ============================================================

export interface CardListContextValue {
  selectedId?: string;
}

export const CardListContext = createContext<CardListContextValue | undefined>(undefined);

// ============================================================
// 主题 Hook（内联，避免额外文件）
// ============================================================

function useCardTheme(color: NoteCardColor, isInteractive: boolean, colorable: boolean) {
  const [themeColor, setThemeColor] = useState(getThemeColor());
  const [isDarkMode, setIsDarkMode] = useState(false);

  // 监听主题色变化
  useEffect(() => {
    const handler = (e: Event) => {
      if (e instanceof CustomEvent && typeof e.detail === 'string') {
        setThemeColor(e.detail);
      }
    };
    window.addEventListener('theme-color-change', handler);
    return () => window.removeEventListener('theme-color-change', handler);
  }, []);

  // 检测暗色模式
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
  backgroundType = 'none',
  renderBackground,
  pinnable = false,
  colorable = true,
  onClick,
  onPin,
  actions,
  selectedId: propSelectedId,
}) => {
  const [hovered, setHovered] = useState(false);

  // 支持 props 或 Context 传入 selectedId
  const ctx = useContext(CardListContext);
  const selectedId = propSelectedId ?? ctx?.selectedId;
  const isSelected = selectedId === id;

  // 主题
  const { bgColor, borderColor } = useCardTheme(color, isSelected || hovered, colorable);

  return (
    <div
      className={`base-card group ${isSelected ? 'base-card-selected' : ''}`}
      onClick={onClick}
      style={{ background: bgColor, borderColor }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* 背景 */}
      {renderBackground ? renderBackground() : renderCardBackground(backgroundType)}

      {/* 内容 */}
      <div className="base-card-content-wrapper">
        <div className="base-card-title" title={title}>
          {title.length > 10 ? title.slice(0, 10) + '…' : title}
        </div>
        <div className="base-card-content">{content}</div>
      </div>

      {/* 操作区 */}
      <div className="base-card-actions">
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

export default BaseCard;
