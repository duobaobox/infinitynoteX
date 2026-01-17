import React from 'react';
import { Eraser } from 'lucide-react';
import './ColorPalette.css';

export interface ColorPaletteProps {
  /** 当前选中的颜色 */
  activeColor?: string;
  /** 颜色选择回调 */
  onSelect: (color: string | null) => void;
  /** 自定义颜色列表 */
  colors?: { value: string; label: string }[];
  /** 每行显示的列数，默认 5 */
  columns?: number;
  /** 是否显示清除按钮的文字，默认 true */
  showClearText?: boolean;
}

import { DEFAULT_COLORS, HIGHLIGHT_COLORS } from './constants';
export { DEFAULT_COLORS, HIGHLIGHT_COLORS };

export const ColorPalette: React.FC<ColorPaletteProps> = ({
  activeColor,
  onSelect,
  colors = DEFAULT_COLORS,
  columns = 5,
  showClearText = true,
}) => {
  return (
    <div className="color-palette-container">
      <div className="color-palette-grid" style={{ '--columns': columns } as React.CSSProperties}>
        {colors.map((color) => (
          <button
            key={color.value}
            type="button"
            className={`color-palette-swatch ${activeColor === color.value ? 'is-active' : ''}`}
            style={{ backgroundColor: color.value }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onSelect(color.value);
            }}
            title={color.label}
          />
        ))}
      </div>
      <button
        type="button"
        className="color-palette-clear-btn"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onSelect(null);
        }}
        title="清除颜色"
      >
        <Eraser size={14} />
        {showClearText && <span>清除颜色</span>}
      </button>
    </div>
  );
};

export default ColorPalette;
