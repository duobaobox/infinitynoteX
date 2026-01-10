/**
 * 菜单项行组件
 * 用于下拉菜单中的单项
 */

import React from 'react';
import { getThemeColor } from '../../../../theme/theme';

export interface MenuItemRowProps {
  icon?: string;
  text: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

/**
 * 下拉菜单单项行
 */
export const MenuItemRow: React.FC<MenuItemRowProps> = ({
  icon,
  text,
  active,
  disabled,
  onClick,
}) => {
  const themeColor = getThemeColor();

  return (
    <div
      onMouseDown={(e) => {
        // 提前触发以避免编辑器失焦
        e.preventDefault();
        if (!disabled) onClick();
      }}
      onClick={(e) => {
        e.stopPropagation();
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        opacity: disabled ? 0.45 : 1,
        color: active ? themeColor : undefined,
      }}
    >
      {icon ? <i className={icon} /> : null}
      <span style={{ flex: 1 }}>{text}</span>
      {active ? <i className="ri-check-line" /> : null}
    </div>
  );
};
