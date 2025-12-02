/**
 * ProviderCard - 同步Provider卡片组件
 */

import React from 'react';
import { Tag } from 'antd';
import type { SyncProvider } from '../providers/types';

interface ProviderCardProps {
  provider: SyncProvider;
  active: boolean;
  onClick: () => void;
}

const ProviderCard: React.FC<ProviderCardProps> = ({ provider, active, onClick }) => {
  const isUpcoming = provider.status === 'upcoming';

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
          <span className="sync-provider-icon">{provider.icon}</span>
          <span className="sync-provider-name">{provider.name}</span>
        </div>
        {isUpcoming && (
          <Tag color="default" style={{ fontSize: 11 }}>
            即将推出
          </Tag>
        )}
      </div>
      <div className="sync-provider-item__description">{provider.description}</div>
    </div>
  );
};

export default ProviderCard;
