import React, { useState } from 'react';
import { Dropdown } from 'antd';
import type { Editor } from '@tiptap/core';
import { ColorPalette } from '../../components/ColorPalette/ColorPalette';

interface ToolbarColorPickerProps {
  editor: Editor;
}

export const ToolbarColorPicker: React.FC<ToolbarColorPickerProps> = ({ editor }) => {
  const [open, setOpen] = useState(false);
  const currentColor = editor.getAttributes('textStyle')?.color;

  return (
    <Dropdown
      open={open}
      onOpenChange={setOpen}
      trigger={['click']}
      dropdownRender={() => (
        <div
          style={{
            background: 'var(--panel-bg, #fff)',
            boxShadow:
              '0 3px 6px -4px rgba(0, 0, 0, 0.12), 0 6px 16px 0 rgba(0, 0, 0, 0.08), 0 9px 28px 8px rgba(0, 0, 0, 0.05)',
            borderRadius: '8px',
            padding: '4px',
            border: '1px solid var(--border-color, #f0f0f0)',
          }}
        >
          <ColorPalette
            activeColor={currentColor}
            onSelect={(color) => {
              if (color) {
                editor.chain().focus().setColor(color).run();
              } else {
                editor.chain().focus().unsetColor().run();
              }
              setOpen(false);
            }}
          />
        </div>
      )}
    >
      <button
        type="button"
        title="文字颜色"
        className={open || currentColor ? 'is-active' : ''}
        onMouseDown={(e) => {
          // 防止按钮点击导致编辑器失焦
          e.preventDefault();
        }}
        onClick={(e) => {
          e.preventDefault();
        }}
      >
        <i
          className="ri-font-color"
          style={{
            color: currentColor,
            transition: 'color 0.2s',
          }}
        />
        <i className="ri-arrow-down-s-line" style={{ marginLeft: 4 }} />
      </button>
    </Dropdown>
  );
};
