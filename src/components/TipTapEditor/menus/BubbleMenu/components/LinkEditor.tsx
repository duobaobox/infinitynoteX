/**
 * LinkEditor 链接编辑组件
 * 用于 BubbleMenu 中的链接添加/编辑
 */

import React, { useState, useRef, useEffect } from 'react';
import { Link as LinkIcon, ExternalLink, Unlink, Check, X } from 'lucide-react';
import './LinkEditor.css';

interface LinkEditorProps {
  /** 当前链接 URL */
  currentUrl?: string;
  /** 是否有链接 */
  hasLink: boolean;
  /** 设置链接 */
  onSetLink: (url: string) => void;
  /** 取消链接 */
  onUnsetLink: () => void;
}

export const LinkEditor: React.FC<LinkEditorProps> = ({
  currentUrl,
  hasLink,
  onSetLink,
  onUnsetLink,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(currentUrl || '');
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 点击链接按钮时
  const handleTriggerClick = () => {
    if (hasLink) {
      // 已有链接，展开编辑面板
      setInputValue(currentUrl || '');
      setIsEditing(true);
    } else {
      // 无链接，展开输入面板
      setInputValue('');
      setIsEditing(true);
    }
  };

  // 确认链接
  const handleConfirm = () => {
    if (inputValue.trim()) {
      // 自动补全协议
      let url = inputValue.trim();
      if (!/^https?:\/\//i.test(url) && !/^mailto:/i.test(url)) {
        url = 'https://' + url;
      }
      onSetLink(url);
    }
    setIsEditing(false);
  };

  // 取消编辑
  const handleCancel = () => {
    setIsEditing(false);
    setInputValue(currentUrl || '');
  };

  // 打开链接
  const handleOpenLink = () => {
    if (currentUrl) {
      window.open(currentUrl, '_blank', 'noopener,noreferrer');
    }
  };

  // 聚焦输入框
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        handleCancel();
      }
    };
    if (isEditing) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isEditing]);

  // 回车确认
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleConfirm();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  return (
    <div className="link-editor-container" ref={containerRef}>
      <button
        type="button"
        className={`link-editor-trigger ${hasLink ? 'has-link' : ''} ${isEditing ? 'is-editing' : ''}`}
        onClick={handleTriggerClick}
        title={hasLink ? '编辑链接' : '添加链接'}
      >
        <LinkIcon size={16} />
      </button>

      {isEditing && (
        <div className="link-editor-dropdown">
          <div className="link-input-row">
            <input
              ref={inputRef}
              type="text"
              className="link-input"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入链接地址..."
            />
            <button
              type="button"
              className="link-action-btn confirm"
              onClick={handleConfirm}
              title="确认"
            >
              <Check size={14} />
            </button>
            <button
              type="button"
              className="link-action-btn cancel"
              onClick={handleCancel}
              title="取消"
            >
              <X size={14} />
            </button>
          </div>

          {hasLink && (
            <div className="link-actions-row">
              <button type="button" className="link-secondary-btn" onClick={handleOpenLink}>
                <ExternalLink size={12} />
                <span>打开链接</span>
              </button>
              <button
                type="button"
                className="link-secondary-btn danger"
                onClick={() => {
                  onUnsetLink();
                  setIsEditing(false);
                }}
              >
                <Unlink size={12} />
                <span>取消链接</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default LinkEditor;
