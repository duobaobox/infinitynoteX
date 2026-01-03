import React from 'react';
import { Space, Tooltip, Button, Input, Alert } from 'antd';
import { ReloadOutlined, DeleteOutlined } from '@ant-design/icons';

interface ChatHeaderProps {
  title: string;
  isEditing: boolean;
  tempTitle: string;
  error: string | null;
  hasMessages: boolean;
  onEditStart: () => void;
  onEditSave: () => void;
  onEditCancel: () => void;
  onTitleChange: (val: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onClearError: () => void;
  onClearChat: () => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  title,
  isEditing,
  tempTitle,
  error,
  hasMessages,
  onEditStart,
  onEditSave,
  onTitleChange,
  onKeyDown,
  onClearError,
  onClearChat,
}) => {
  return (
    <>
      <div className="ai-chat-header">
        <div className="ai-chat-header-left">
          {isEditing ? (
            <Input
              value={tempTitle}
              onChange={(e) => onTitleChange(e.target.value)}
              onBlur={onEditSave}
              onKeyDown={onKeyDown}
              autoFocus
              size="small"
              style={{
                width: '200px',
                fontSize: '13px',
                fontWeight: 500,
              }}
              placeholder="输入对话标题"
            />
          ) : (
            <span
              className="ai-chat-header-title"
              onDoubleClick={onEditStart}
              style={{ cursor: 'pointer' }}
              title="双击编辑标题"
            >
              {title}
            </span>
          )}
        </div>

        <Space size="small">
          <Tooltip title="清除错误">
            <Button
              type="text"
              size="small"
              icon={<ReloadOutlined />}
              onClick={onClearError}
              disabled={!error}
            />
          </Tooltip>
          <Tooltip title="清空对话">
            <Button
              type="text"
              size="small"
              icon={<DeleteOutlined />}
              onClick={onClearChat}
              disabled={!hasMessages}
            />
          </Tooltip>
        </Space>
      </div>

      {/* 错误提示 */}
      {error && (
        <Alert
          message="出错"
          description={error}
          type="error"
          showIcon
          closable
          onClose={onClearError}
          className="ai-chat-alert"
        />
      )}
    </>
  );
};
