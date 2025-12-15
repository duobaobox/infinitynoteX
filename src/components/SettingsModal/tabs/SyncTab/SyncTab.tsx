/**
 * SyncTab - 数据同步Tab组件
 * 提供插件化的同步provider选择和配置界面
 */

import React, { useState, useEffect } from 'react';
import { Card, Empty } from 'antd';
import { useSettingsStore } from '../../../../store/settingsStore';
import { SYNC_PROVIDERS, getProviderById } from './providers';
import ProviderCard from './components/ProviderCard';
import SyncStatus from './components/SyncStatus';
import './SyncTab.css';

interface SyncTabProps {
  /** @deprecated 不再使用，保留兼容性 */
  isVisible?: boolean;
}

const SyncTab: React.FC<SyncTabProps> = () => {
  const {
    selectedSyncProvider,
    syncConfigs,
    setSelectedSyncProvider,
    setSyncConfig,
    testSyncConnection,
    triggerSync,
    loadSyncConfigs,
    settingsModalOpenTrigger,
  } = useSettingsStore();

  const [localProvider, setLocalProvider] = useState(
    selectedSyncProvider || SYNC_PROVIDERS[0]?.id || null,
  );

  // 弹窗打开时刷新同步配置
  useEffect(() => {
    if (settingsModalOpenTrigger > 0) {
      loadSyncConfigs();
    }
  }, [settingsModalOpenTrigger, loadSyncConfigs]);

  const handleProviderClick = (providerId: string) => {
    setLocalProvider(providerId);
    setSelectedSyncProvider(providerId);
  };

  const currentProvider = localProvider ? getProviderById(localProvider) : null;

  // 如果没有任何provider
  if (SYNC_PROVIDERS.length === 0) {
    return (
      <div className="settings-panel sync-settings-panel">
        <h3>数据同步</h3>
        <Empty description="暂无可用的同步方案" />
      </div>
    );
  }

  return (
    <div className="settings-panel sync-settings-panel">
      <h3>数据同步</h3>

      {/* 同步状态卡片 */}
      <SyncStatus />

      {/* 两栏布局 */}
      <div className="sync-config-grid">
        {/* 左侧：Provider列表 */}
        <Card className="sync-provider-card" title="同步方案" size="small">
          <div className="sync-provider-list">
            {SYNC_PROVIDERS.map((provider) => (
              <ProviderCard
                key={provider.id}
                provider={provider}
                active={provider.id === localProvider}
                onClick={() => handleProviderClick(provider.id)}
              />
            ))}
          </div>
        </Card>

        {/* 右侧：当前Provider的配置组件 */}
        <div className="sync-config-forms">
          {currentProvider ? (
            <currentProvider.ConfigComponent
              provider={currentProvider}
              config={syncConfigs[currentProvider.id] || null}
              onConfigChange={(config) => {
                setSyncConfig(currentProvider.id, config);
              }}
              onTest={async () => {
                const config = syncConfigs[currentProvider.id];
                if (!config) {
                  return { ok: false, message: '请先配置同步参数' };
                }
                return await testSyncConnection(currentProvider.id, config);
              }}
              onSync={async () => {
                const config = syncConfigs[currentProvider.id];
                if (!config) {
                  throw new Error('请先配置同步参数');
                }
                return await triggerSync(currentProvider.id, config);
              }}
            />
          ) : (
            <Empty description="请选择一个同步方案" />
          )}
        </div>
      </div>
    </div>
  );
};

export default SyncTab;
