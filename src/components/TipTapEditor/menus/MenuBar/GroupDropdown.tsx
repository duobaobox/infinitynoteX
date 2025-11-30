/**
 * 下拉分组组件
 * 用于工具栏中的下拉菜单按钮
 */

import React from 'react';
import { Dropdown } from 'antd';

export interface GroupDropdownProps {
  label: string;
  icon?: string;
  active?: boolean;
  items: { key: string; node: React.ReactNode; disabled?: boolean }[];
}

/**
 * 组合分组下拉触发按钮
 */
export const GroupDropdown: React.FC<GroupDropdownProps> = ({ label, icon, active, items }) => {
  return (
    <Dropdown
      trigger={['click']}
      menu={{
        items: items.map((it) => ({
          key: it.key,
          label: it.node,
          disabled: it.disabled,
        })),
      }}
    >
      <button
        type="button"
        title={label}
        className={active ? 'is-active' : ''}
        onMouseDown={(e) => {
          // 防止按钮点击导致编辑器失焦
          e.preventDefault();
          e.stopPropagation();
        }}
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        {icon ? <i className={icon} /> : null}
        <i className="ri-arrow-down-s-line" style={{ marginLeft: 4 }} />
      </button>
    </Dropdown>
  );
};
