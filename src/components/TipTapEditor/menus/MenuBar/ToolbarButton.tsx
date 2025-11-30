/**
 * 工具栏按钮组件
 * 可复用的工具栏按钮,支持激活状态和禁用状态
 */

import React from 'react';

export interface ToolbarButtonProps {
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  title?: string;
  icon: string;
  children?: React.ReactNode;
}

/**
 * 工具栏按钮
 */
export const ToolbarButton: React.FC<ToolbarButtonProps> = ({
  onClick,
  isActive = false,
  disabled = false,
  title,
  icon,
}) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={isActive ? 'is-active' : ''}
      title={title}
      type="button"
    >
      <i className={icon} />
    </button>
  );
};
