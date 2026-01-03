import React from 'react';
import { CommentOutlined } from '@ant-design/icons';
import { Alert } from 'antd';

export const EmptyState: React.FC = () => (
  <div className="ai-chat-empty-state">
    <CommentOutlined className="ai-chat-empty-icon" />
    <p className="ai-chat-empty-text">选择或创建一个对话开始聊天</p>
  </div>
);

export const InitializingState: React.FC = () => (
  <div className="ai-chat-messages-empty">
    <div style={{ textAlign: 'center', color: '#999' }}>初始化中...</div>
  </div>
);

interface UnconfiguredStateProps {
  className?: string;
}

export const UnconfiguredState: React.FC<UnconfiguredStateProps> = ({ className }) => (
  <div className={`ai-chat-container ${className}`}>
    <div className="ai-chat-messages-empty">
      <Alert
        message="未配置 AI 模型"
        description="请先在设置页面中配置 AI 模型信息（设置 > AI 管理）以开始对话"
        type="warning"
        showIcon
        style={{ maxWidth: '500px', marginBottom: '16px' }}
      />
      <div style={{ color: '#666', fontSize: '13px', maxWidth: '500px', textAlign: 'center' }}>
        <p style={{ marginBottom: '8px' }}>支持以下模型：</p>
        <ul style={{ textAlign: 'left', display: 'inline-block' }}>
          <li>OpenAI: gpt-4o, gpt-3.5-turbo</li>
          <li>本地 Ollama: mistral, llama2 等</li>
          <li>其他 OpenAI 兼容服务</li>
        </ul>
      </div>
    </div>
  </div>
);
