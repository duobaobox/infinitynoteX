/**
 * SyncStatus - 同步状态卡片组件
 * 纯展示组件：显示当前同步状态信息
 */

import React from 'react';
import { Card, Tag, Typography } from 'antd';
import {
  SyncOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  CloudOutlined,
  SettingOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { useSettingsStore } from '../../../../../store/settingsStore';
import { getProviderById, SYNC_PROVIDERS } from '../providers';

const { Text } = Typography;

const SyncStatus: React.FC = () => {
  const { syncStatus, selectedSyncProvider, syncConfigs } = useSettingsStore();

  // 智能获取当前使用的provider：优先使用选中的，否则检测已配置的
  const getActiveProviderId = (): string | null => {
    if (selectedSyncProvider) return selectedSyncProvider;

    // 检查是否有已配置的provider（有url等必填信息的）
    for (const provider of SYNC_PROVIDERS) {
      const config = syncConfigs[provider.id];
      if (config && config.url) {
        return provider.id;
      }
    }
    return SYNC_PROVIDERS[0]?.id || null;
  };

  const activeProviderId = getActiveProviderId();
  const currentProvider = activeProviderId ? getProviderById(activeProviderId) : null;
  const currentConfig = activeProviderId ? syncConfigs[activeProviderId] : null;

  // 检查配置是否完整（针对webdav）
  const isConfigComplete = (config: any): boolean => {
    if (!config) return false;
    return !!(config.url && config.username && config.password);
  };

  const formatLastSync = (timestamp: number | null) => {
    if (!timestamp) return '从未同步';
    const now = Date.now();
    const diff = now - timestamp;

    if (diff < 60 * 1000) return '刚刚';
    if (diff < 60 * 60 * 1000) {
      return `${Math.floor(diff / (60 * 1000))}分钟前`;
    }
    if (diff < 24 * 60 * 60 * 1000) {
      return `${Math.floor(diff / (60 * 60 * 1000))}小时前`;
    }
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const configComplete = isConfigComplete(currentConfig);
  const isEnabled = currentConfig?.enabled ?? false;

  const getStatusInfo = () => {
    // 未配置
    if (!currentProvider || !configComplete) {
      return {
        tag: (
          <Tag icon={<SettingOutlined />} color="default">
            未配置
          </Tag>
        ),
        color: '#8c8c8c',
        description: '请选择同步方案并完成配置',
      };
    }
    // 未启用
    if (!isEnabled) {
      return {
        tag: <Tag color="default">未启用</Tag>,
        color: '#8c8c8c',
        description: '已配置，请在下方启用同步',
      };
    }
    // 同步中
    if (syncStatus.syncing) {
      return {
        tag: (
          <Tag icon={<SyncOutlined spin />} color="processing">
            同步中
          </Tag>
        ),
        color: '#1677ff',
        description: '正在同步数据...',
      };
    }
    // 同步失败
    if (syncStatus.error) {
      return {
        tag: (
          <Tag icon={<CloseCircleOutlined />} color="error">
            同步失败
          </Tag>
        ),
        color: '#ff4d4f',
        description: syncStatus.error,
      };
    }
    // 已同步
    if (syncStatus.lastSync) {
      return {
        tag: (
          <Tag icon={<CheckCircleOutlined />} color="success">
            已同步
          </Tag>
        ),
        color: '#52c41a',
        description: `上次同步: ${formatLastSync(syncStatus.lastSync)}`,
      };
    }
    // 待同步
    return {
      tag: (
        <Tag icon={<ExclamationCircleOutlined />} color="warning">
          待同步
        </Tag>
      ),
      color: '#faad14',
      description: '已启用，等待首次同步',
    };
  };

  const statusInfo = getStatusInfo();

  return (
    <Card className="sync-status-card" size="small" bordered>
      <div className="sync-status-card-inner">
        <div className="sync-status-main">
          <div className="sync-status-icon">
            <CloudOutlined style={{ fontSize: 24, color: statusInfo.color }} />
          </div>
          <div className="sync-status-info">
            <div className="sync-status-title">
              <Text strong style={{ fontSize: 15 }}>
                {configComplete ? currentProvider?.name : '数据同步'}
              </Text>
              {statusInfo.tag}
            </div>
            <Text type="secondary" className="sync-status-desc">
              {statusInfo.description}
            </Text>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default SyncStatus;
