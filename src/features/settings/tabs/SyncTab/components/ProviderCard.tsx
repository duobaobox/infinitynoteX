/**
 * ProviderCard - 同步Provider卡片组件
 * UI设计与AI厂商卡片保持一致
 */

import React from 'react';
import { Tag } from 'antd';
import type { SyncProvider } from '../providers/types';
import { useSettingsStore } from '../../../../../store/settingsStore';

interface ProviderCardProps {
  provider: SyncProvider;
  active: boolean;
  onClick: () => void;
}

// Provider品牌颜色
const getProviderBrandColor = (providerId: string): string => {
  const colors: Record<string, string> = {
    webdav: '#f5a623',
    icloud: '#147ce5',
    dropbox: '#0061fe',
    onedrive: '#0078d4',
  };
  return colors[providerId] || '#8c8c8c';
};

// 状态元数据
const getStatusMeta = (
  config: { url?: string; username?: string; password?: string; enabled?: boolean } | null,
): { label: string; color: string } => {
  if (!config) return { label: '待配置', color: '#8c8c8c' };
  if (!config.url || !config.username || !config.password) {
    return { label: '待配置', color: '#8c8c8c' };
  }
  if (!config.enabled) return { label: '未启用', color: '#faad14' };
  return { label: '就绪', color: '#52c41a' };
};

const ProviderCard: React.FC<ProviderCardProps> = ({ provider, active, onClick }) => {
  const { syncConfigs, selectedSyncProvider } = useSettingsStore();
  const isUpcoming = provider.status === 'upcoming';
  const config = syncConfigs[provider.id];
  const statusMeta = getStatusMeta(config);
  const isCurrentProvider = provider.id === selectedSyncProvider && config?.enabled;
  const brandColor = getProviderBrandColor(provider.id);

  return (
    <div
      className={`sync-provider-item${active ? ' active' : ''}`}
      data-status={provider.status}
      onClick={isUpcoming ? undefined : onClick}
      role="button"
      tabIndex={isUpcoming ? -1 : 0}
      onKeyDown={(event) => {
        if (!isUpcoming && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          onClick();
        }
      }}
    >
      <div className="sync-provider-item__header">
        <div className="sync-provider-item__title">
          <span className="sync-provider-item__dot" style={{ backgroundColor: brandColor }} />
          <span className="sync-provider-name">{provider.name}</span>
        </div>
        {isUpcoming ? (
          <Tag color="default" style={{ fontSize: 11 }}>
            即将推出
          </Tag>
        ) : isCurrentProvider ? (
          <Tag color={brandColor}>当前</Tag>
        ) : null}
      </div>
      <div className="sync-provider-item__status" style={{ color: statusMeta.color }}>
        {statusMeta.label}
      </div>
    </div>
  );
};

export default ProviderCard;
