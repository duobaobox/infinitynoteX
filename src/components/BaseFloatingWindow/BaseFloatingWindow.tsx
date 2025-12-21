/**
 * BaseFloatingWindow.tsx
 * 基础悬浮窗口组件 - 提供标题栏和内容插槽
 *
 * 便签和 Todo 悬浮窗口均可复用此组件
 */

import React from 'react';
import './BaseFloatingWindow.css';

export interface BaseFloatingWindowProps {
  /** 标题文字 */
  title: string;
  /** 标题栏背景色 */
  headerColor?: string;
  /** 标题文字颜色 */
  titleColor?: string;
  /** 关闭回调 */
  onClose: () => void;
  /** 最小化回调 */
  onMinimize?: () => void;
  /** 内容区 */
  children: React.ReactNode;
  /** 底部区域（可选） */
  footer?: React.ReactNode;
  /** 自定义类名 */
  className?: string;
}

const BaseFloatingWindow: React.FC<BaseFloatingWindowProps> = ({
  title,
  headerColor = '#8f8f8fff',
  titleColor = '#ffffff',
  onClose,
  onMinimize,
  children,
  footer,
  className = '',
}) => {
  return (
    <div className={`base-floating-window ${className}`}>
      {/* 标题栏 */}
      <div className="base-floating-titlebar" style={{ backgroundColor: headerColor }}>
        <span className="base-floating-title" style={{ color: titleColor }}>
          {title}
        </span>
        <div className="base-floating-controls">
          {onMinimize && (
            <button
              className="base-floating-btn"
              onClick={onMinimize}
              title="最小化为药丸"
              style={{ color: titleColor }}
            >
              <i className="ri-subtract-line" />
            </button>
          )}
          <button
            className="base-floating-btn base-floating-close-btn"
            onClick={onClose}
            title="关闭"
            style={{ color: titleColor }}
          >
            <i className="ri-close-line" />
          </button>
        </div>
      </div>

      {/* 内容区 */}
      <div className="base-floating-content">{children}</div>

      {/* 底部区域（可选） */}
      {footer && <div className="base-floating-footer">{footer}</div>}
    </div>
  );
};

export default BaseFloatingWindow;
