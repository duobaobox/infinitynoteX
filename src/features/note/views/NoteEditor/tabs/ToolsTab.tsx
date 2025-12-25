/**
 * ToolsTab.tsx
 * 工具页面 - 便签颜色选择、悬浮便签大小调整、其他工具
 */

import React, { useState, useEffect } from 'react';
import { message, Tooltip, Slider } from 'antd';
import { CheckOutlined, ToolOutlined } from '@ant-design/icons';
import type { NoteColor as NoteColorType } from '../../../../../services/types';
import { PRESET_COLORS } from '../../../../../hooks/useNoteCardTheme';
import './EmptyState.css';

/**
 * 空状态组件 - 当没有便签选中时显示
 */
const EmptyState: React.FC = () => (
  <div className="editor-empty-state">
    <ToolOutlined className="editor-empty-icon" />
    <p className="editor-empty-text">选择一个便签后可以使用工具</p>
  </div>
);

interface ToolsTabProps {
  noteId: string | null;
  noteColor: NoteColorType;
  onColorChange: (color: NoteColorType) => void;
}

export const ToolsTab: React.FC<ToolsTabProps> = ({ noteId, noteColor, onColorChange }) => {
  const [defaultFloatingWindowWidth, setDefaultFloatingWindowWidth] = useState<number>(400);
  const [defaultFloatingWindowHeight, setDefaultFloatingWindowHeight] = useState<number>(400);

  // 从存储中加载默认悬浮便签大小设置
  useEffect(() => {
    const loadDefaultFloatingWindowSize = async () => {
      try {
        const config = await window.ipcRenderer?.invoke('config:getDefaultFloatingWindowSize');
        if (config) {
          setDefaultFloatingWindowWidth(config.width || 400);
          setDefaultFloatingWindowHeight(config.height || 400);
        }
      } catch (error) {
        console.error('Failed to load default floating window size:', error);
      }
    };

    loadDefaultFloatingWindowSize();
  }, []);

  // 保存默认悬浮便签宽度
  const handleDefaultWidthChange = (value: number | number[]) => {
    const newWidth = Array.isArray(value) ? value[0] : value;
    setDefaultFloatingWindowWidth(newWidth);
    window.ipcRenderer
      ?.invoke('config:setDefaultFloatingWindowSize', {
        width: newWidth,
        height: defaultFloatingWindowHeight,
      })
      .catch((error) => {
        console.error('Failed to save default floating window width:', error);
      });
  };

  // 保存默认悬浮便签高度
  const handleDefaultHeightChange = (value: number | number[]) => {
    const newHeight = Array.isArray(value) ? value[0] : value;
    setDefaultFloatingWindowHeight(newHeight);
    window.ipcRenderer
      ?.invoke('config:setDefaultFloatingWindowSize', {
        width: defaultFloatingWindowWidth,
        height: newHeight,
      })
      .catch((error) => {
        console.error('Failed to save default floating window height:', error);
      });
  };

  const handleChangeColor = (color: NoteColorType) => {
    if (!noteId) {
      message.warning('请先选择便签');
      return;
    }
    // 直接调用父组件的回调，由父组件统一处理保存和通知
    onColorChange(color);
  };

  // 没有选中便签时，显示空状态
  if (!noteId) {
    return <EmptyState />;
  }

  return (
    <div style={{ padding: '16px' }}>
      {/* 便签颜色选择 */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ marginBottom: 8, fontWeight: 600 }}>便签颜色</div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {PRESET_COLORS.map((c) => (
            <Tooltip key={c.key} title={c.label}>
              <button
                aria-label={`设为${c.label}`}
                onClick={() => handleChangeColor(c.key)}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 6,
                  backgroundColor: `#${c.key}`,
                  border:
                    c.key === noteColor
                      ? '2px solid var(--ant-color-primary)'
                      : '1px solid var(--border-color)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxShadow: c.key === noteColor ? '0 0 0 2px rgba(24,144,255,0.15)' : 'none',
                  transition: 'all 0.2s ease',
                }}
              >
                {c.key === noteColor ? <CheckOutlined style={{ color: '#1677ff' }} /> : null}
              </button>
            </Tooltip>
          ))}
        </div>
      </div>

      {/* 默认悬浮便签大小设置 */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ marginBottom: 8, fontWeight: 600 }}>默认悬浮便签大小</div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8, fontSize: 12, color: 'rgba(0,0,0,0.65)' }}>
            默认宽度: {defaultFloatingWindowWidth}px
          </div>
          <Slider
            min={300}
            max={800}
            step={10}
            value={defaultFloatingWindowWidth}
            onChange={handleDefaultWidthChange}
          />
        </div>
        <div>
          <div style={{ marginBottom: 8, fontSize: 12, color: 'rgba(0,0,0,0.65)' }}>
            默认高度: {defaultFloatingWindowHeight}px
          </div>
          <Slider
            min={300}
            max={1000}
            step={10}
            value={defaultFloatingWindowHeight}
            onChange={handleDefaultHeightChange}
          />
        </div>
      </div>

      {/* 后续可添加其他工具功能 */}
    </div>
  );
};

export default ToolsTab;
