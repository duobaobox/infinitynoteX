/**
 * ChatEditor - AI 工作台编辑器
 *
 * 【组件职责】
 * - 管理 AI 对话区域的多 Tab 切换 (AI对话 / 工具 / 设置)
 * - 作为 AI Workbench 的右侧主编辑区
 *
 * 【数据流】
 * 1. 从 workspaceStore 获取当前选中的工具ID和对话ID
 * 2. 根据 activeTab 状态渲染对应的 Tab 组件
 * 3. Tab 切换通过 Ant Design Segmented 组件实现
 *
 * 【如何添加新 Tab】
 * 1. 在 tabs/ 目录创建新组件 (如 MyTab.tsx)
 * 2. 在 tabs/index.ts 的 TAB_CONFIG 中添加配置
 * 3. 在 renderTabContent() 的 switch 中添加 case
 */

import React, { useEffect, useState, useMemo } from 'react';
import { Segmented } from 'antd';
import { useWorkspaceStore } from '../../../../store/workspaceStore';
import { AITab, KitTab, SettingsTab, TAB_CONFIG, type TabKeyType } from './tabs';

/**
 * ChatEditor 主组件
 */
export const ChatEditor: React.FC = () => {
  // ============ Store 状态 ============
  const selectedToolId = useWorkspaceStore((state) => state.selectedToolId);
  const selectedToolItemId = useWorkspaceStore((state) => state.selectedToolItemId);
  const resetEditorTabTrigger = useWorkspaceStore((state) => state.resetEditorTabTrigger);

  // ============ 本地状态 ============
  const [activeTab, setActiveTab] = useState<TabKeyType>('ai');

  // ============ 副作用 ============

  // AI Chat 工具被选中时，自动切换到 AI Tab
  useEffect(() => {
    if (selectedToolId === 'ai-chat') {
      setActiveTab('ai');
    }
  }, [selectedToolId]);

  // 监听 tab 重置信号（切换对话时重置到默认 Tab）
  useEffect(() => {
    setActiveTab('ai');
  }, [resetEditorTabTrigger]);

  // ============ 派生数据 ============

  // 根据 TAB_CONFIG 生成 Segmented 选项
  const segmentOptions = useMemo(
    () =>
      TAB_CONFIG.map(({ key, icon: Icon, label }) => ({
        label: (
          <span>
            <Icon style={{ marginRight: 4 }} />
            {label}
          </span>
        ),
        value: key,
      })),
    [],
  );

  // ============ 渲染函数 ============

  /**
   * 根据当前 activeTab 渲染对应的 Tab 内容
   */
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

  // ============ 主渲染 ============

  return (
    <div className="layout-panel editor-container">
      <div className="flex-vertical-equal">
        {/* Tab 切换栏 */}
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

export default ChatEditor;
