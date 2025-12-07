/**
 * ColorPicker 颜色选择器组件
 * 用于 BubbleMenu 中的文字颜色和背景颜色选择
 */

import React, { useState, useRef, useEffect } from 'react';
import { Palette, Eraser } from 'lucide-react';
import './ColorPicker.css';

interface ColorPickerProps {
  /** 当前颜色值 */
  currentColor?: string;
  /** 颜色变化回调 */
  onColorChange: (color: string | null) => void;
  /** 图标类型 */
  type?: 'text' | 'background';
  /** 按钮标题 */
  title?: string;
}

// 预设颜色面板
const PRESET_COLORS = [
  // 第一行 - 基础色
  { value: '#262626', label: '黑色' },
  { value: '#595959', label: '深灰' },
  { value: '#8c8c8c', label: '灰色' },
  { value: '#bfbfbf', label: '浅灰' },
  // 第二行 - 彩色
  { value: '#f5222d', label: '红色' },
  { value: '#fa8c16', label: '橙色' },
  { value: '#fadb14', label: '黄色' },
  { value: '#52c41a', label: '绿色' },
  { value: '#1890ff', label: '蓝色' },
  { value: '#722ed1', label: '紫色' },
];

export const ColorPicker: React.FC<ColorPickerProps> = ({
  currentColor,
  onColorChange,
  type = 'text',
  title,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleColorSelect = (color: string | null) => {
    onColorChange(color);
    setIsOpen(false);
  };

  const buttonTitle = title || (type === 'text' ? '文字颜色' : '背景颜色');

  return (
    <div className="color-picker-container" ref={containerRef}>
      <button
        type="button"
        className={`color-picker-trigger ${isOpen ? 'is-open' : ''} ${currentColor ? 'has-color' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        title={buttonTitle}
      >
        {type === 'text' ? (
          <span className="color-icon-text" style={{ color: currentColor || 'currentColor' }}>
            A
          </span>
        ) : (
          <Palette size={16} style={{ color: currentColor || 'currentColor' }} />
        )}
        <span
          className="color-indicator"
          style={{ backgroundColor: currentColor || 'transparent' }}
        />
      </button>

      {isOpen && (
        <div className="color-picker-dropdown">
          <div className="color-grid">
            {PRESET_COLORS.map((color) => (
              <button
                key={color.value}
                type="button"
                className={`color-swatch ${currentColor === color.value ? 'is-active' : ''}`}
                style={{ backgroundColor: color.value }}
                onClick={() => handleColorSelect(color.value)}
                title={color.label}
              />
            ))}
          </div>
          <button type="button" className="clear-color-btn" onClick={() => handleColorSelect(null)}>
            <Eraser size={14} />
            <span>清除颜色</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default ColorPicker;
