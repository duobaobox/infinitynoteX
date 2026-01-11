import React, { useState } from 'react';
import { Dropdown } from 'antd';
import type { Editor } from '@tiptap/core';
import { ColorPalette, HIGHLIGHT_COLORS } from '../../components/ColorPalette/ColorPalette';

interface ToolbarHighlightPickerProps {
  editor: Editor;
}

export const ToolbarHighlightPicker: React.FC<ToolbarHighlightPickerProps> = ({ editor }) => {
  const [open, setOpen] = useState(false);
  const currentHighlight = editor.getAttributes('highlight');
  // highlight extension usually stores color in 'color' attribute
  const currentColor = currentHighlight?.color;
  const isActive = editor.isActive('highlight');

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
                editor.chain().focus().toggleHighlight({ color }).run();
              } else {
                editor.chain().focus().unsetHighlight().run();
              }
              setOpen(false);
            }}
            colors={HIGHLIGHT_COLORS}
            columns={3}
          />
        </div>
      )}
    >
      <button
        type="button"
        title="高亮"
        className={open || isActive ? 'is-active' : ''}
        onMouseDown={(e) => {
          // 防止按钮点击导致编辑器失焦
          e.preventDefault();
        }}
        onClick={(e) => {
          e.preventDefault();
        }}
      >
        <i className="ri-mark-pen-line" />
        <i className="ri-arrow-down-s-line" style={{ marginLeft: 4 }} />
      </button>
    </Dropdown>
  );
};
