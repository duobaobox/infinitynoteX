import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AITab from './AITab';

function mockMatchMedia(): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

const mockSettingsState = {
  aiConfig: {
    providerId: 'custom',
    provider: '自定义服务',
    baseURL: 'https://api.example.com/v1',
    apiKey: 'sk-visible-only-after-eye-click',
    model: 'custom-model',
    stream: true,
  },
  providerConfigs: {},
  selectedProviderId: 'custom',
  activeProviderId: 'custom',
  aiLoading: false,
  aiTestLoading: false,
  aiTestResult: null,
  syncCurrentConfig: vi.fn(),
  handleProviderSelect: vi.fn(),
  loadAIConfig: vi.fn(),
  saveAIConfig: vi.fn(),
  testAIConnection: vi.fn(),
  setAITestResult: vi.fn(),
};

vi.mock('../../../../store/settingsStore', () => {
  const useSettingsStore = vi.fn(() => mockSettingsState);
  Object.assign(useSettingsStore, {
    getState: vi.fn(() => mockSettingsState),
  });

  return {
    useSettingsStore,
    PROVIDER_STATUS_META: {
      ready: { label: '已配置', color: '#52c41a' },
      missingKey: { label: '待填密钥', color: '#faad14' },
      incomplete: { label: '未完成', color: '#ff4d4f' },
    },
    getProviderStatus: vi.fn(() => 'ready'),
  };
});

describe('AITab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMatchMedia();
  });

  it('默认隐藏 AI API Key，并通过 Ant Design 小眼睛控制显示', () => {
    render(<AITab />);

    const apiKeyInput = screen.getByPlaceholderText('输入 API Key（仅本地保存）');

    expect(apiKeyInput).toHaveAttribute('type', 'password');
  });
});
