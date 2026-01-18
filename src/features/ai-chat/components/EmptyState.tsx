import React from 'react';
import { CommentOutlined } from '@ant-design/icons';
import { Result, Button } from 'antd';
import { useSettingsStore } from '../../../store/settingsStore';

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

export const UnconfiguredState: React.FC<UnconfiguredStateProps> = ({ className }) => {
  const setSettingsModalOpen = useSettingsStore((state) => state.setSettingsModalOpen);
  const setActiveSettingsTab = useSettingsStore((state) => state.setActiveSettingsTab);

  return (
    <div className={`ai-chat-container ${className}`}>
      <div
        className="ai-chat-messages-empty"
        style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <Result
          status="warning"
          title="未配置 AI 模型"
          subTitle="请先配置 AI 模型信息以开启对话能力"
          extra={
            <Button
              type="primary"
              key="settings"
              onClick={() => {
                setActiveSettingsTab('ai');
                setSettingsModalOpen(true);
              }}
            >
              前往设置
            </Button>
          }
        />
      </div>
    </div>
  );
};
