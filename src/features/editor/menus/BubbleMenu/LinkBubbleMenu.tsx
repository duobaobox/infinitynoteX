/**
 * LinkBubbleMenu 链接编辑菜单
 * 光标在链接上时显示的操作工具栏
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { BubbleMenu } from '@tiptap/react/menus';
import type { Editor } from '@tiptap/react';
import { ExternalLink, Copy, Unlink, Pencil, Check, X } from 'lucide-react';
import './BubbleMenu.css';

interface LinkBubbleMenuProps {
  editor: Editor;
}

/**
 * 链接编辑菜单 - 光标在链接上时显示
 */
export const LinkBubbleMenu: React.FC<LinkBubbleMenuProps> = ({ editor }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // 聚焦输入框 - hooks 必须在 early return 之前
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // 取消编辑
  const handleCancel = useCallback(() => {
    setIsEditing(false);
    setInputValue('');
  }, []);

  if (!editor) {
    return null;
  }

  const currentUrl = editor.getAttributes('link').href || '';

  // 开始编辑
  const startEditing = () => {
    setInputValue(currentUrl);
    setIsEditing(true);
  };

  // 确认修改
  const handleConfirm = () => {
    if (inputValue.trim()) {
      let url = inputValue.trim();
      if (!/^https?:\/\//i.test(url) && !/^mailto:/i.test(url)) {
        url = 'https://' + url;
      }
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    }
    setIsEditing(false);
  };

  // 打开链接
  const handleOpen = () => {
    if (currentUrl) {
      window.open(currentUrl, '_blank', 'noopener,noreferrer');
    }
  };

  // 复制链接
  const handleCopy = () => {
    if (currentUrl) {
      navigator.clipboard.writeText(currentUrl);
    }
  };

  // 取消链接
  const handleUnlink = () => {
    editor.chain().focus().extendMarkRange('link').unsetLink().run();
  };

  // 键盘事件
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleConfirm();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  return (
    <BubbleMenu
      className="bubble-menu link-bubble-menu"
      editor={editor}
      pluginKey="link-bubble-menu"
      options={{
        placement: 'bottom',
      }}
      shouldShow={({ editor: e, state }) => {
        // 只在链接上显示，且没有选区（避免与 TextBubbleMenu 冲突）
        const { from, to } = state.selection;
        const noSelection = from === to;
        return e.isActive('link') && noSelection;
      }}
    >
      {isEditing ? (
        // 编辑模式
        <div className="link-edit-inline">
          <input
            ref={inputRef}
            type="text"
            className="link-inline-input"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入链接地址..."
          />
          <button type="button" onClick={handleConfirm} className="confirm-btn" title="确认">
            <Check size={14} />
          </button>
          <button type="button" onClick={handleCancel} title="取消">
            <X size={14} />
          </button>
        </div>
      ) : (
        // 预览模式
        <>
          <span className="link-preview" title={currentUrl}>
            {currentUrl.length > 30 ? currentUrl.slice(0, 30) + '...' : currentUrl}
          </span>

          <span className="divider" />

          <button type="button" onClick={startEditing} title="编辑链接">
            <Pencil size={14} />
          </button>

          <button type="button" onClick={handleOpen} title="打开链接">
            <ExternalLink size={14} />
          </button>

          <button type="button" onClick={handleCopy} title="复制链接">
            <Copy size={14} />
          </button>

          <button type="button" onClick={handleUnlink} className="danger" title="取消链接">
            <Unlink size={14} />
          </button>
        </>
      )}
    </BubbleMenu>
  );
};

export default LinkBubbleMenu;
