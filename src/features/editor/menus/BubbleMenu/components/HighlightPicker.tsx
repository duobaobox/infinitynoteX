/**
 * HighlightPicker 高亮颜色选择器组件
 * 用于 BubbleMenu 中的文本高亮颜色选择
 */

import React, { useState, useRef, useEffect } from 'react';
import { Highlighter, Eraser } from 'lucide-react';
import './HighlightPicker.css';

interface HighlightPickerProps {
  /** 当前高亮颜色 */
  currentColor?: string;
  /** 是否处于高亮状态 */
  isActive: boolean;
  /** 设置高亮颜色 */
  onSetHighlight: (color: string) => void;
  /** 取消高亮 */
  onUnsetHighlight: () => void;
}

// 预设高亮颜色 - 半透明背景色
const HIGHLIGHT_COLORS = [
  { value: '#fef08a', label: '黄色', bg: 'rgba(254, 240, 138, 0.5)' },
  { value: '#bbf7d0', label: '绿色', bg: 'rgba(187, 247, 208, 0.5)' },
  { value: '#bfdbfe', label: '蓝色', bg: 'rgba(191, 219, 254, 0.5)' },
  { value: '#fecaca', label: '红色', bg: 'rgba(254, 202, 202, 0.5)' },
  { value: '#e9d5ff', label: '紫色', bg: 'rgba(233, 213, 255, 0.5)' },
  { value: '#fed7aa', label: '橙色', bg: 'rgba(254, 215, 170, 0.5)' },
];

export const HighlightPicker: React.FC<HighlightPickerProps> = ({
  currentColor,
  isActive,
  onSetHighlight,
  onUnsetHighlight,
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

  const handleColorSelect = (color: string) => {
    onSetHighlight(color);
    setIsOpen(false);
  };

  const handleClear = () => {
    onUnsetHighlight();
    setIsOpen(false);
  };

  return (
    <div className="highlight-picker-container" ref={containerRef}>
      <button
        type="button"
        className={`highlight-picker-trigger ${isOpen ? 'is-open' : ''} ${isActive ? 'is-active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        title="高亮颜色"
      >
        <Highlighter size={16} />
        <span
          className="highlight-indicator"
          style={{ backgroundColor: currentColor || '#fef08a' }}
        />
      </button>

      {isOpen && (
        <div className="highlight-picker-dropdown">
          <div className="highlight-color-grid">
            {HIGHLIGHT_COLORS.map((color) => (
              <button
                key={color.value}
                type="button"
                className={`highlight-color-swatch ${currentColor === color.value ? 'is-active' : ''}`}
                style={{ backgroundColor: color.bg }}
                onClick={() => handleColorSelect(color.value)}
                title={color.label}
              />
            ))}
            {/* 清除高亮 - 只显示删除图标 */}
            {isActive && (
              <button
                type="button"
                className="highlight-color-swatch clear-swatch"
                onClick={handleClear}
                title="清除高亮"
              >
                <Eraser size={14} />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default HighlightPicker;
