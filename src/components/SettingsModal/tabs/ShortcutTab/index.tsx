/**
 * ShortcutTab - 快捷键设置 Tab 组件
 * 参考截图布局：分组标题 + 左右对齐的快捷键行
 */

import React, { useState, useEffect, useRef } from 'react';
import { message } from 'antd';
import { useSettingsStore } from '../../../../store/settingsStore';
import './styles.css';

// 默认快捷键
const DEFAULT_SHORTCUT = 'CommandOrControl+Shift+Q';

// 检测是否为 Mac 平台
const isMac =
  navigator.platform.toUpperCase().indexOf('MAC') >= 0 ||
  navigator.userAgent.toUpperCase().indexOf('MAC') >= 0;

interface ShortcutRecorderProps {
  value: string;
  onChange: (value: string) => void;
}

const ShortcutRecorder: React.FC<ShortcutRecorderProps> = ({ value, onChange }) => {
  const [isRecording, setIsRecording] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // 解析快捷键字符串为显示用的按键数组（区分平台）
  const displayValue = value || DEFAULT_SHORTCUT;
  const displayKeys = displayValue.split('+').map((k) => {
    if (k === 'CommandOrControl') return isMac ? '⌘' : 'Ctrl';
    if (k === 'Shift') return isMac ? '⇧' : 'Shift';
    if (k === 'Alt') return isMac ? '⌥' : 'Alt';
    if (k === 'Ctrl' || k === 'Control') return isMac ? '⌃' : 'Ctrl';
    return k.toUpperCase();
  });

  const getElectronAccelerator = (e: React.KeyboardEvent) => {
    const keys = [];
    if (e.metaKey || e.ctrlKey) keys.push('CommandOrControl');
    if (e.altKey) keys.push('Alt');
    if (e.shiftKey) keys.push('Shift');

    let key = '';
    const code = e.code;

    if (code.startsWith('Key')) {
      key = code.slice(3);
    } else if (code.startsWith('Digit')) {
      key = code.slice(5);
    } else if (code.startsWith('Numpad')) {
      key = code.slice(6);
    } else if (code === 'Space') {
      key = 'Space';
    } else if (code.startsWith('Arrow')) {
      key = code.slice(5);
    } else {
      const codeMap: Record<string, string> = {
        Escape: 'Esc',
        Enter: 'Enter',
        Backspace: 'Backspace',
        Delete: 'Delete',
        Tab: 'Tab',
        Home: 'Home',
        End: 'End',
        PageUp: 'PageUp',
        PageDown: 'PageDown',
        Minus: '-',
        Equal: '=',
        BracketLeft: '[',
        BracketRight: ']',
        Backslash: '\\',
        Semicolon: ';',
        Quote: "'",
        Comma: ',',
        Period: '.',
        Slash: '/',
        Backquote: '`',
      };
      key = codeMap[code] || '';

      // 如果没有映射，检查是否为单个 ASCII 字符（排除修饰键）
      if (!key && e.key.length === 1) {
        const charCode = e.key.charCodeAt(0);
        const isAscii = charCode >= 32 && charCode <= 126; // 可打印 ASCII 范围
        const modifiers = ['META', 'CONTROL', 'ALT', 'SHIFT'];
        if (isAscii && !modifiers.includes(e.key.toUpperCase())) {
          key = e.key.toUpperCase();
        }
      }
    }

    if (!key) {
      return keys.length > 0 ? keys.join('+') : '';
    }

    keys.push(key);
    return keys.join('+');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isRecording) return;

    e.preventDefault();
    e.stopPropagation();

    if (e.key === 'Escape') {
      setIsRecording(false);
      return;
    }

    const accelerator = getElectronAccelerator(e);
    if (accelerator) {
      const parts = accelerator.split('+');
      const lastPart = parts[parts.length - 1];
      const isModifierOnly = ['CommandOrControl', 'Alt', 'Shift', 'Ctrl', 'Meta'].includes(
        lastPart,
      );

      if (!isModifierOnly) {
        onChange(accelerator);
        setIsRecording(false);
      }
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsRecording(false);
      }
    };

    if (isRecording) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isRecording]);

  return (
    <div
      ref={containerRef}
      className={`shortcut-recorder ${isRecording ? 'recording' : ''}`}
      onClick={() => setIsRecording(true)}
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {isRecording ? (
        <span className="recording-text">请按下快捷键...</span>
      ) : (
        <div className="keys-display">
          {displayKeys.map((k, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span className="key-separator">+</span>}
              <span className="key-cap">{k}</span>
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
};

const ShortcutTab: React.FC = () => {
  const { shortcutKeys, setShortcutKeys, loadShortcutKeys } = useSettingsStore();

  useEffect(() => {
    loadShortcutKeys();
  }, [loadShortcutKeys]);

  const handleShortcutChange = async (newShortcut: string) => {
    try {
      await setShortcutKeys({ aiChatWindow: newShortcut });
      message.success('快捷键已更新，重启应用后生效');
    } catch (error) {
      console.error('Failed to save shortcut:', error);
      message.error('保存失败');
    }
  };

  return (
    <div className="settings-panel shortcut-tab">
      {/* 分组标题 */}
      <h4 className="shortcut-group-title">全局</h4>

      {/* 快捷键行 */}
      <div className="shortcut-row">
        <span className="shortcut-label">唤起 AI 助手侧边栏</span>
        <ShortcutRecorder
          value={shortcutKeys.aiChatWindow || DEFAULT_SHORTCUT}
          onChange={handleShortcutChange}
        />
      </div>
    </div>
  );
};

export default ShortcutTab;
