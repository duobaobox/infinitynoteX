/**
 * SyncStatus - 同步状态卡片组件
 */

import React from 'react';
import { Card, Tag, Typography } from 'antd';
import { useSettingsStore } from '../../../../../store/settingsStore';
import { getProviderById } from '../providers';

const { Text } = Typography;

const SyncStatus: React.FC = () => {
  const { syncStatus, selectedSyncProvider } = useSettingsStore();

  const formatLastSync = (timestamp: number | null) => {
    if (!timestamp) return '从未同步';
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN');
  };

  const getStatusTag = () => {
    if (!selectedSyncProvider) {
      return <Tag color="default">未启用</Tag>;
    }
    if (syncStatus.syncing) {
      return <Tag color="blue">同步中</Tag>;
    }
    if (syncStatus.error) {
      return <Tag color="error">同步失败</Tag>;
    }
    if (syncStatus.lastSync) {
      return <Tag color="success">已同步</Tag>;
    }
    return <Tag color="default">未同步</Tag>;
  };

  const currentProvider = selectedSyncProvider ? getProviderById(selectedSyncProvider) : null;

  return (
    <Card className="sync-status-card" size="small" bordered>
      <div className="sync-status-card-inner">
        <div className="sync-status-field">
          <Text type="secondary">同步方式</Text>
          <Text strong>{currentProvider?.name || '未选择'}</Text>
        </div>
        <div className="sync-status-field">
          <Text type="secondary">状态</Text>
          {getStatusTag()}
        </div>
        <div className="sync-status-field">
          <Text type="secondary">最后同步</Text>
          <Text>{formatLastSync(syncStatus.lastSync)}</Text>
        </div>
        {syncStatus.error && (
          <div className="sync-status-error">
            <Text type="danger">{syncStatus.error}</Text>
          </div>
        )}
      </div>
    </Card>
  );
};

export default SyncStatus;
