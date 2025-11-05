/**
 * ToolsTab.tsx
 * 工具页面 - 便签颜色选择、其他工具
 */

import React from 'react';
import { message, Tooltip } from 'antd';
import { CheckOutlined } from '@ant-design/icons';
import type { NoteColor as NoteColorType } from '../../services/types';

interface ToolsTabProps {
  noteId: string | null;
  noteColor: NoteColorType;
  onColorChange: (color: NoteColorType) => void;
}

export const ToolsTab: React.FC<ToolsTabProps> = ({ noteId, noteColor, onColorChange }) => {
  // 预设 6 色（与 NoteCard 约定相同）- 仅此 Tab 使用，放在本地即可
  const PRESET_COLORS: Array<{ key: NoteColorType; label: string }> = [
    { key: 'ffffff', label: '白色' },
    { key: 'bae0ff', label: '蓝' },
    { key: 'd6e4ff', label: '靛蓝' },
    { key: 'd9f7be', label: '绿' },
    { key: 'ffd666', label: '金' },
    { key: 'ffd6e7', label: '粉' },
  ];
  const handleChangeColor = async (color: NoteColorType) => {
    if (!noteId) {
      message.warning('请先选择便签');
      return;
    }
    try {
      await window.storage.updateNote(noteId, { color });
      onColorChange(color);
      // 颜色更改成功不再弹窗提醒
    } catch (e) {
      console.error('Failed to update color:', e);
      message.error('更新颜色失败');
    }
  };

  return (
    <div style={{ padding: '16px' }}>
      <div style={{ marginBottom: 16 }}>
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

      {/* 后续可添加其他工具功能 */}
    </div>
  );
};

export default ToolsTab;
