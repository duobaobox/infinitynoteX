/**
 * BasePillWindow.tsx
 * 基础药丸窗口组件 - 提供装饰图标和标题插槽
 *
 * 便签和 Todo 药丸窗口均可复用此组件
 */

import React from 'react';
import './BasePillWindow.css';

export interface BasePillWindowProps {
  /** 标题文字 */
  title: string;
  /** 背景颜色 */
  bgColor?: string;
  /** 文字颜色 */
  textColor?: string;
  /** 装饰图标组件 */
  icon?: React.ReactNode;
  /** 恢复窗口回调 */
  onRestore: () => void;
  /** 自定义类名 */
  className?: string;
  /** hover 时的 title 提示 */
  tooltip?: string;
}

const BasePillWindow: React.FC<BasePillWindowProps> = ({
  title,
  bgColor = '#52c41a',
  textColor = '#ffffff',
  icon,
  onRestore,
  className = '',
  tooltip,
}) => {
  return (
    <div
      className={`base-pill-window ${className}`}
      style={{ backgroundColor: bgColor, color: textColor }}
    >
      {/* 装饰图标 */}
      {icon}

      {/* 标题 */}
      <span className="base-pill-title" title={tooltip || title}>
        {title}
      </span>

      {/* 恢复按钮 */}
      <div className="base-pill-buttons">
        <button
          className="base-pill-btn"
          title="恢复"
          onClick={onRestore}
          style={{ color: textColor }}
        >
          <i className="ri-fullscreen-line" />
        </button>
      </div>
    </div>
  );
};

export default BasePillWindow;
