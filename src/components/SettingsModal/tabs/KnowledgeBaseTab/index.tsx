/**
 * KnowledgeBaseTab - 知识库设置路由容器
 */

import React from 'react';
import { Tabs } from 'antd';
import { SettingOutlined, BugOutlined } from '@ant-design/icons';
import ConfigurationTab from './tabs/ConfigurationTab';
import DebugTab from './tabs/DebugTab';
import './KnowledgeBaseTab.css';

const tabItems = [
  {
    key: 'config',
    label: '配置与索引',
    icon: <SettingOutlined />,
    children: <ConfigurationTab />,
  },
  {
    key: 'debug',
    label: '调试与维护',
    icon: <BugOutlined />,
    children: <DebugTab />,
  },
];

const KnowledgeBaseTab: React.FC = () => {
  return (
    <div className="settings-panel knowledge-base-panel">
      <div className="kb-header">
        <h3>知识库管理</h3>
      </div>
      <Tabs items={tabItems} className="kb-inner-tabs" size="small" tabBarGutter={24} />
    </div>
  );
};

export default KnowledgeBaseTab;
