/**
 * SettingsStore 测试
 * 测试设置状态管理
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useSettingsStore } from '../../../../src/store/settingsStore';

// 扩展 Window 接口以支持测试中使用的自定义属性
declare global {
  interface Window {
    appInfo?: {
      getVersion: () => Promise<string>;
    };
  }
}

// Mock window APIs
const mockAI = {
  getConfig: vi.fn(),
  setConfig: vi.fn(),
  testConnection: vi.fn(),
};

const mockStorage = {
  getCurrentPath: vi.fn(),
  getStats: vi.fn(),
};

const mockSync = {
  getConfig: vi.fn(),
  setConfig: vi.fn(),
  testConnection: vi.fn(),
  execute: vi.fn(),
};

const mockAppInfo = {
  getVersion: vi.fn(),
};

// Setup global mocks
Object.assign(window, {
  ai: mockAI,
  storage: mockStorage,
  sync: mockSync,
  appInfo: mockAppInfo,
});

// Mock services that might be used
vi.mock('../../../../src/services/aiConfigStore', () => ({
  initializeAIConfigCache: vi.fn(),
  readStoredProviderConfigs: vi.fn(() => ({})),
  persistProviderConfigs: vi.fn(),
  emitAIConfigChanged: vi.fn(),
}));

vi.mock('../../../../src/services/aiProviders', () => ({
  DEFAULT_PROVIDER_ID: 'openai',
  CUSTOM_PROVIDER_ID: 'custom',
  createDefaultAIConfig: vi.fn(() => ({})),
  ensureAIConfigDefaults: vi.fn((c) => c),
  findProviderPresetById: vi.fn(),
}));

describe('SettingsStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSettingsStore.setState({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      aiConfig: {} as any,
      providerConfigs: {},
      aiLoading: false,
      aiTestResult: null,
      appVersion: '0.0.0',
    });
  });

  describe('Appearance', () => {
    it('should set primary color', () => {
      useSettingsStore.getState().setPrimaryColor('#ff0000');
      expect(useSettingsStore.getState().primaryColor).toBe('#ff0000');
    });

    it('should set theme mode', () => {
      useSettingsStore.getState().setThemeModeState('dark');
      expect(useSettingsStore.getState().themeMode).toBe('dark');
    });
  });

  describe('AI Config', () => {
    it('should load AI config', async () => {
      const mockConfig = { providerId: 'openai', apiKey: 'test' };
      mockAI.getConfig.mockResolvedValue(mockConfig);

      await useSettingsStore.getState().loadAIConfig();

      expect(mockAI.getConfig).toHaveBeenCalled();
      expect(useSettingsStore.getState().aiConfig).toEqual(mockConfig);
    });

    it('should test connection', async () => {
      mockAI.testConnection.mockResolvedValue({ ok: true, message: 'Success' });

      await useSettingsStore.getState().testAIConnection();

      expect(mockAI.testConnection).toHaveBeenCalled();
      expect(useSettingsStore.getState().aiTestResult).toEqual({ ok: true, message: 'Success' });
    });
  });

  describe('Storage Info', () => {
    it('should load storage info', async () => {
      mockStorage.getCurrentPath.mockResolvedValue('/path/to/data');
      mockStorage.getStats.mockResolvedValue({ noteCount: 10 });

      await useSettingsStore.getState().loadStorageInfo();

      expect(mockStorage.getCurrentPath).toHaveBeenCalled();
      expect(useSettingsStore.getState().currentPath).toBe('/path/to/data');
      expect(useSettingsStore.getState().stats).toEqual({ noteCount: 10 });
    });
  });

  describe('App Info', () => {
    it('should load app version', async () => {
      mockAppInfo.getVersion.mockResolvedValue('1.2.3');

      await useSettingsStore.getState().loadAppInfo();

      expect(mockAppInfo.getVersion).toHaveBeenCalled();
      expect(useSettingsStore.getState().appVersion).toBe('1.2.3');
    });

    it('should handle missing appInfo gracefully', async () => {
      // Temporarily remove appInfo
      const originalAppInfo = window.appInfo;
      delete window.appInfo;

      await useSettingsStore.getState().loadAppInfo();

      expect(useSettingsStore.getState().appVersion).toBe('0.0.0');

      // Restore
      window.appInfo = originalAppInfo;
    });
  });
});
