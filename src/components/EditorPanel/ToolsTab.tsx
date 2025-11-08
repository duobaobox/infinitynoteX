/**
 * ToolsTab.tsx
 * 工具页面 - 便签颜色选择、悬浮便签大小调整、其他工具
 */

import React, { useState, useEffect } from 'react';
import { message, Tooltip, Slider } from 'antd';
import { CheckOutlined } from '@ant-design/icons';
import type { NoteColor as NoteColorType } from '../../services/types';

interface ToolsTabProps {
  noteId: string | null;
  noteColor: NoteColorType;
  onColorChange: (color: NoteColorType) => void;
}

export const ToolsTab: React.FC<ToolsTabProps> = ({ noteId, noteColor, onColorChange }) => {
  const [floatingWindowWidth, setFloatingWindowWidth] = useState<number>(400);
  const [floatingWindowHeight, setFloatingWindowHeight] = useState<number>(600);

  // 预设 6 色（与 NoteCard 约定相同）- 仅此 Tab 使用，放在本地即可
  const PRESET_COLORS: Array<{ key: NoteColorType; label: string }> = [
    { key: 'ffffff', label: '白色' },
    { key: 'bae0ff', label: '蓝' },
    { key: 'd6e4ff', label: '靛蓝' },
    { key: 'd9f7be', label: '绿' },
    { key: 'ffd666', label: '金' },
    { key: 'ffd6e7', label: '粉' },
  ];

  // 从存储中加载悬浮便签大小设置
  useEffect(() => {
    const loadFloatingWindowSize = async () => {
      try {
        const config = await window.ipcRenderer?.invoke('config:getFloatingWindowSize', noteId);
        if (config) {
          setFloatingWindowWidth(config.width || 400);
          setFloatingWindowHeight(config.height || 600);
        }
      } catch (error) {
        console.error('Failed to load floating window size:', error);
      }
    };

    if (noteId) {
      loadFloatingWindowSize();
    }
  }, [noteId]);

  // 保存悬浮便签宽度
  const handleWidthChange = (value: number | number[]) => {
    const newWidth = Array.isArray(value) ? value[0] : value;
    setFloatingWindowWidth(newWidth);
    if (noteId) {
      window.ipcRenderer
        ?.invoke('config:setFloatingWindowSize', noteId, {
          width: newWidth,
          height: floatingWindowHeight,
        })
        .catch((error) => {
          console.error('Failed to save floating window width:', error);
        });
    }
  };

  // 保存悬浮便签高度
  const handleHeightChange = (value: number | number[]) => {
    const newHeight = Array.isArray(value) ? value[0] : value;
    setFloatingWindowHeight(newHeight);
    if (noteId) {
      window.ipcRenderer
        ?.invoke('config:setFloatingWindowSize', noteId, {
          width: floatingWindowWidth,
          height: newHeight,
        })
        .catch((error) => {
          console.error('Failed to save floating window height:', error);
        });
    }
  };

  const handleChangeColor = async (color: NoteColorType) => {
    if (!noteId) {
      message.warning('请先选择便签');
      return;
    }
    try {
      await window.storage.updateNote(noteId, { color });
      onColorChange(color);
      // 通知所有悬浮窗口更新该便签的数据
      window.ipcRenderer?.send('note:changed', noteId);
      // 颜色更改成功不再弹窗提醒
    } catch (e) {
      console.error('Failed to update color:', e);
      message.error('更新颜色失败');
    }
  };

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

      {/* 悬浮便签大小调整 */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ marginBottom: 8, fontWeight: 600 }}>悬浮便签大小</div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8, fontSize: 12, color: 'rgba(0,0,0,0.65)' }}>
            宽度: {floatingWindowWidth}px
          </div>
          <Slider
            min={300}
            max={800}
            step={10}
            value={floatingWindowWidth}
            onChange={handleWidthChange}
            disabled={!noteId}
          />
        </div>
        <div>
          <div style={{ marginBottom: 8, fontSize: 12, color: 'rgba(0,0,0,0.65)' }}>
            高度: {floatingWindowHeight}px
          </div>
          <Slider
            min={300}
            max={1000}
            step={10}
            value={floatingWindowHeight}
            onChange={handleHeightChange}
            disabled={!noteId}
          />
        </div>
      </div>

      {/* 后续可添加其他工具功能 */}
    </div>
  );
};

export default ToolsTab;
