import React, { useEffect, useState } from 'react';
import { Segmented } from 'antd';
import { RobotOutlined, AppstoreOutlined, SettingOutlined } from '@ant-design/icons';
import { DEFAULT_TOOLS } from '../../../constants/tools';
import { AITab } from '../EditorPanel/AITab';
import AISettingsTab from './AISettingsTab';
import { useWorkspaceStore } from '../../../store/workspaceStore';
import './ToolPanel.css';

type ToolPanelTab = 'ai' | 'kit' | 'settings';

// ToolPanel 不再需要 props，直接使用 Store
const ToolPanel: React.FC = () => {
  // 从 Store 获取状态
  const { selectedToolId, selectedToolItemId } = useWorkspaceStore();
  // 本地状态
  const [activeTab, setActiveTab] = useState<ToolPanelTab>('ai');

  useEffect(() => {
    if (selectedToolId === 'ai-chat') {
      setActiveTab('ai');
    }
  }, [selectedToolId]);

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

    if (activeTab === 'settings') {
      return <AISettingsTab />;
    }

    const activeTool = DEFAULT_TOOLS.find((tool) => tool.id === selectedToolId);
    const title = '工具组件区开发中';

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
