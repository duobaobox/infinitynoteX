/**
 * ColorPicker 颜色选择器组件
 * 用于 BubbleMenu 中的文字颜色和背景颜色选择
 */

import React, { useState, useRef, useEffect } from 'react';
import { Palette } from 'lucide-react';
import { ColorPalette } from '../../../components/ColorPalette/ColorPalette';
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
          <ColorPalette
            activeColor={currentColor}
            onSelect={handleColorSelect}
            columns={3}
            showClearText={false}
          />
        </div>
      )}
    </div>
  );
};

export default ColorPicker;
