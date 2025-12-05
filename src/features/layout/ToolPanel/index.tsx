/**
 * ToolPanel - 工具面板容器
 * 管理工具 tabs 切换
 */

import React, { useEffect, useState, useMemo } from 'react';
import { Segmented } from 'antd';
import { useWorkspaceStore } from '../../../store/workspaceStore';
import { AITab, KitTab, SettingsTab, TAB_CONFIG, type TabKeyType } from './tabs';
import './ToolPanel.css';

/**
 * ToolPanel - 工具面板组件
 */
const ToolPanel: React.FC = () => {
  // 从 Store 获取状态
  const selectedToolId = useWorkspaceStore((state) => state.selectedToolId);
  const selectedToolItemId = useWorkspaceStore((state) => state.selectedToolItemId);
  const resetEditorTabTrigger = useWorkspaceStore((state) => state.resetEditorTabTrigger);

  // 本地状态
  const [activeTab, setActiveTab] = useState<TabKeyType>('ai');

  // AI Chat 工具被选中时切换到 AI Tab
  useEffect(() => {
    if (selectedToolId === 'ai-chat') {
      setActiveTab('ai');
    }
  }, [selectedToolId]);

  // 监听 tab 重置信号
  useEffect(() => {
    setActiveTab('ai');
  }, [resetEditorTabTrigger]);

  // 使用配置生成 Segmented 选项
  const segmentOptions = useMemo(
    () =>
      TAB_CONFIG.map(({ key, icon: Icon }) => ({
        label: (
          <span>
            <Icon style={{ marginRight: 4 }} />
          </span>
        ),
        value: key,
      })),
    [],
  );

  // 渲染当前 Tab 内容
  const renderTabContent = () => {
    switch (activeTab) {
      case 'ai':
        return <AITab conversationId={selectedToolItemId} />;
      case 'settings':
        return <SettingsTab />;
      case 'kit':
        return <KitTab />;
      default:
        return null;
    }
  };

  return (
    <div className="layout-panel editor-container">
      <div className="flex-vertical-equal">
        {/* 标签栏 */}
        <div style={{ display: 'inline-block' }}>
          <Segmented
            options={segmentOptions}
            value={activeTab}
            onChange={(value) => setActiveTab(value as TabKeyType)}
          />
        </div>

        {/* Tab 内容区 */}
        <div className="editor-inner-tab-container">{renderTabContent()}</div>
      </div>
    </div>
  );
};

export default ToolPanel;
