/**
 * 文字颜色菜单获取函数
 * 用于工具栏的文字颜色选择
 */

import React from 'react';
import type { Editor } from '@tiptap/core';

// 文字颜色预设
const TEXT_COLORS = [
  { value: '#ef4444', label: '红色' },
  { value: '#f97316', label: '橙色' },
  { value: '#eab308', label: '黄色' },
  { value: '#22c55e', label: '绿色' },
  { value: '#3b82f6', label: '蓝色' },
  { value: '#a855f7', label: '紫色' },
  { value: '#ec4899', label: '粉色' },
  { value: '#6b7280', label: '灰色' },
];

// 颜色菜单项组件
const ColorMenuItem: React.FC<{
  color: string;
  label: string;
  isActive: boolean;
  onClick: () => void;
}> = ({ color, label, isActive, onClick }) => (
  <div
    onMouseDown={(e) => {
      e.preventDefault();
      onClick();
    }}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '6px 12px',
      cursor: 'pointer',
      borderRadius: 4,
      color: isActive ? 'var(--theme-color, #1890ff)' : undefined,
    }}
  >
    <span
      style={{
        width: 16,
        height: 16,
        borderRadius: 3,
        backgroundColor: color,
        border: '1px solid rgba(0,0,0,0.1)',
      }}
    />
    <span style={{ flex: 1 }}>{label}</span>
    {isActive && <i className="ri-check-line" />}
  </div>
);

/**
 * 获取文字颜色菜单项
 */
export const getTextColorMenuItems = (editor: Editor) => {
  const currentColor = editor.getAttributes('textStyle')?.color;
  const hasColor = !!currentColor;

  return [
    // 颜色选项
    ...TEXT_COLORS.map((color) => ({
      key: `color-${color.value}`,
      node: (
        <ColorMenuItem
          color={color.value}
          label={color.label}
          isActive={currentColor === color.value}
          onClick={() => editor.chain().focus().setColor(color.value).run()}
        />
      ),
    })),
    // 清除颜色 - 仅当已设置颜色时显示
    ...(hasColor
      ? [
          {
            key: 'divider',
            node: <div style={{ borderTop: '1px solid #f0f0f0', margin: '4px 0' }} />,
          },
          {
            key: 'clear-color',
            node: (
              <div
                onMouseDown={(e) => {
                  e.preventDefault();
                  editor.chain().focus().unsetColor().run();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 12px',
                  cursor: 'pointer',
                  borderRadius: 4,
                  color: '#ff4d4f',
                }}
              >
                <i className="ri-eraser-line" />
                <span>重置</span>
              </div>
            ),
          },
        ]
      : []),
  ];
};
