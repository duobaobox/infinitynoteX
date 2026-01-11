/**
 * HighlightPicker 高亮颜色选择器组件
 * 用于 BubbleMenu 中的文本高亮颜色选择
 */

import React, { useState, useRef, useEffect } from 'react';
import { Highlighter } from 'lucide-react';
import { ColorPalette, HIGHLIGHT_COLORS } from '../../../components/ColorPalette/ColorPalette';
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

  const handleColorSelect = (color: string | null) => {
    if (color) {
      onSetHighlight(color);
    } else {
      onUnsetHighlight();
    }
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
          <ColorPalette
            activeColor={currentColor}
            onSelect={handleColorSelect}
            colors={HIGHLIGHT_COLORS}
            columns={3}
            showClearText={false}
          />
        </div>
      )}
    </div>
  );
};

export default HighlightPicker;
