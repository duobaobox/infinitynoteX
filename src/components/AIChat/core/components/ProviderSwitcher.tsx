import React from 'react';
import { Button, Dropdown, MenuProps } from 'antd';
import { DownOutlined } from '@ant-design/icons';
import { getProviderBrandColor } from '../../../../services/aiProviders';

interface ProviderOption {
  providerId: string;
  config: {
    provider: string;
    model: string;
  };
}

interface ProviderSwitcherProps {
  config: { model: string } | null;
  providerOptions: ProviderOption[];
  currentProviderId: string;
  isSwitching: boolean;
  onSwitch: (key: string) => void;
}

export const ProviderSwitcher: React.FC<ProviderSwitcherProps> = ({
  config,
  providerOptions,
  currentProviderId,
  isSwitching,
  onSwitch,
}) => {
  const hasProviderConfigs = providerOptions.length > 0;
  const providerColor = config ? getProviderBrandColor(currentProviderId) : '#d9d9d9';

  const providerMenuItems: MenuProps['items'] = providerOptions.map((option) => {
    const isActive = option.providerId === currentProviderId;
    return {
      key: option.providerId,
      label: (
        <div className="ai-meta-option">
          <div className="ai-meta-option__row">
            <span
              className="ai-meta-option__dot"
              style={{
                backgroundColor: getProviderBrandColor(option.providerId),
              }}
            />
            <span className="ai-meta-option__provider">{option.config.provider}</span>
            {isActive && <span className="ai-meta-option__badge">当前</span>}
          </div>
          <div className="ai-meta-option__model">{option.config.model}</div>
        </div>
      ),
    };
  });

  if (!hasProviderConfigs || !config) {
    return null;
  }

  return (
    <Dropdown
      menu={{
        items: providerMenuItems,
        onClick: ({ key }) => onSwitch(key as string),
      }}
      trigger={['click']}
      placement="topLeft"
    >
      <Button size="small" loading={isSwitching} className="ai-model-switcher">
        <span className="ai-chat-meta-dot" style={{ backgroundColor: providerColor }} />
        <span style={{ marginLeft: 6 }}>{config.model}</span>
        <DownOutlined style={{ fontSize: 10, marginLeft: 4, color: '#8c8c8c' }} />
      </Button>
    </Dropdown>
  );
};
