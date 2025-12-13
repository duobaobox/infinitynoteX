/**
 * KnowledgeBaseTab - 知识库设置路由容器
 * 参考 AITab 布局规范
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Tabs, Card, Switch, Typography, message } from 'antd';
import { DatabaseOutlined, FileTextOutlined, ApartmentOutlined } from '@ant-design/icons';
import ConfigurationTab from './tabs/ConfigurationTab';
import DebugTab from './tabs/DebugTab';
import './KnowledgeBaseTab.css';

const { Text } = Typography;

const KnowledgeBaseTab: React.FC = () => {
  const [enabled, setEnabled] = useState(false);
  const [stats, setStats] = useState({ indexedNotes: 0, totalVectors: 0 });

  // 加载配置和统计
  useEffect(() => {
    const loadData = async () => {
      try {
        const config = await window.knowledge?.getConfig();
        if (config) {
          setEnabled(config.enabled);
        }
        const statsData = await window.knowledge?.getStats();
        if (statsData) {
          setStats({
            indexedNotes: statsData.indexedNotes,
            totalVectors: statsData.totalVectors,
          });
        }
      } catch (error) {
        console.error('Failed to load data:', error);
      }
    };
    loadData();
  }, []);

  // 切换启用状态
  const handleToggleEnabled = useCallback(async (checked: boolean) => {
    setEnabled(checked);
    try {
      const config = await window.knowledge?.getConfig();
      await window.knowledge?.setConfig({
        ...config,
        enabled: checked,
      });
      message.success(checked ? '知识库已启用' : '知识库已禁用');
    } catch {
      message.error('操作失败');
    }
  }, []);

  const tabItems = [
    {
      key: 'config',
      label: '配置与索引',
      children: <ConfigurationTab onStatsChange={setStats} />,
    },
    {
      key: 'debug',
      label: '调试与维护',
      children: <DebugTab />,
    },
  ];

  return (
    <div className="settings-panel knowledge-base-panel">
      <h3>知识库管理</h3>

      {/* 头部卡片 - 参考 ai-settings-header */}
      <div className="kb-settings-header">
        {/* 知识库功能 */}
        <Card className="kb-status-card kb-card kb-card-glow" size="small" variant="outlined">
          <div className="kb-glow kb-glow--blue" />
          <div className="kb-card-header">
            <div className="kb-card-icon kb-card-icon--blue">
              <DatabaseOutlined />
            </div>
            <Switch checked={enabled} onChange={handleToggleEnabled} />
          </div>
          <div className="kb-card-title">知识库功能</div>
          <Text type="secondary" className="kb-card-desc">
            {enabled ? '运行正常，随时准备回答' : '未启用，点击开关启用'}
          </Text>
        </Card>

        {/* 已索引笔记 */}
        <Card className="kb-stats-card kb-card kb-card-glow" size="small" variant="outlined">
          <div className="kb-glow kb-glow--green" />
          <div className="kb-card-inner">
            <div className="kb-card-icon kb-card-icon--green">
              <FileTextOutlined />
            </div>
            <span className="kb-card-number">{stats.indexedNotes}</span>
          </div>
          <Text type="secondary" className="kb-card-label">
            已索引笔记
          </Text>
        </Card>

        {/* 向量数据块 */}
        <Card className="kb-stats-card kb-card kb-card-glow" size="small" variant="outlined">
          <div className="kb-glow kb-glow--purple" />
          <div className="kb-card-inner">
            <div className="kb-card-icon kb-card-icon--purple">
              <ApartmentOutlined />
            </div>
            <span className="kb-card-number">{stats.totalVectors}</span>
          </div>
          <Text type="secondary" className="kb-card-label">
            向量数据块
          </Text>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs items={tabItems} className="kb-inner-tabs" size="small" />
    </div>
  );
};

export default KnowledgeBaseTab;
