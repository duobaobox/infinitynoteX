/**
 * 高亮菜单获取函数
 * 用于工具栏的高亮颜色选择
 */

import React from 'react';
import type { Editor } from '@tiptap/core';

// 高亮颜色预设
const HIGHLIGHT_COLORS = [
  { value: '#fef08a', label: '黄色' },
  { value: '#bbf7d0', label: '绿色' },
  { value: '#bfdbfe', label: '蓝色' },
  { value: '#fecaca', label: '红色' },
  { value: '#e9d5ff', label: '紫色' },
  { value: '#fed7aa', label: '橙色' },
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
 * 获取高亮菜单项
 */
export const getHighlightMenuItems = (editor: Editor) => {
  const isActive = editor.isActive('highlight');

  return [
    // 颜色选项
    ...HIGHLIGHT_COLORS.map((color) => ({
      key: `highlight-${color.value}`,
      node: (
        <ColorMenuItem
          color={color.value}
          label={color.label}
          isActive={editor.getAttributes('highlight').color === color.value}
          onClick={() => editor.chain().focus().toggleHighlight({ color: color.value }).run()}
        />
      ),
    })),
    // 清除高亮 - 仅当已高亮时显示
    ...(isActive
      ? [
          {
            key: 'divider',
            node: <div style={{ borderTop: '1px solid #f0f0f0', margin: '4px 0' }} />,
          },
          {
            key: 'clear-highlight',
            node: (
              <div
                onMouseDown={(e) => {
                  e.preventDefault();
                  editor.chain().focus().unsetHighlight().run();
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
                <span>清除</span>
              </div>
            ),
          },
        ]
      : []),
  ];
};
