import React, { useEffect, useState } from 'react';
import { Segmented } from 'antd';
import {
  RobotOutlined,
  ClockCircleOutlined,
  AppstoreOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import type { ToolDefinition } from '../../../constants/tools';
import { AITab } from '../EditorPanel/AITab';
import './ToolPanel.css';

type ToolPanelTab = 'ai' | 'timer' | 'kit' | 'settings';

interface ToolPanelProps {
  toolId: string | null;
  tools: ToolDefinition[];
  selectedToolItemId: string | null;
}

const ToolPanel: React.FC<ToolPanelProps> = ({ toolId, tools, selectedToolItemId }) => {
  const [activeTab, setActiveTab] = useState<ToolPanelTab>('ai');

  useEffect(() => {
    if (toolId === 'ai-chat') {
      setActiveTab('ai');
    } else if (toolId === 'timer') {
      setActiveTab('timer');
    }
  }, [toolId]);

  const segmentOptions = [
    {
      label: (
        <span>
          <RobotOutlined style={{ marginRight: 4 }} />
        </span>
      ),
      value: 'ai',
    },
    {
      label: (
        <span>
          <ClockCircleOutlined style={{ marginRight: 4 }} />
        </span>
      ),
      value: 'timer',
    },
    {
      label: (
        <span>
          <AppstoreOutlined style={{ marginRight: 4 }} />
        </span>
      ),
      value: 'kit',
    },
    {
      label: (
        <span>
          <SettingOutlined style={{ marginRight: 4 }} />
        </span>
      ),
      value: 'settings',
    },
  ];

  const renderTabContent = () => {
    if (activeTab === 'ai') {
      return <AITab noteId={selectedToolItemId} />;
    }

    const activeTool = tools.find((tool) => tool.id === toolId);
    const title =
      activeTab === 'timer'
        ? '计时器面板建设中'
        : activeTab === 'kit'
          ? '工具组件区开发中'
          : '更多功能开发中';

    return (
      <div className="tool-panel-placeholder">
        <div className="tool-panel-placeholder-title">{title}</div>
        <div className="tool-panel-placeholder-desc">
          {activeTool
            ? `「${activeTool.name}」功能将在此处呈现，当前仅展示共享框架以便持续复用。`
            : '尚未选择具体工具。'}
        </div>
      </div>
    );
  };

  return (
    <div className="layout-panel editor-container">
      <div className="flex-vertical-equal">
        {/* 标签栏 */}
        <div style={{ display: 'inline-block' }}>
          <Segmented
            options={segmentOptions}
            value={activeTab}
            onChange={(value) => setActiveTab(value as ToolPanelTab)}
          />
        </div>
        <div className="editor-inner-tab-container">{renderTabContent()}</div>
      </div>
    </div>
  );
};

export default ToolPanel;
