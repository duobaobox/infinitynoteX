/**
 * App Slice - 应用杂项状态管理
 * 包含：应用信息、知识库、外部AI、快捷键、弹窗状态
 */

import type { StateCreator } from 'zustand';

// ============ 常量定义 ============
/** 外部AI页面URL的localStorage键 */
const EXTERNAL_AI_URL_KEY = 'note_external_ai_url';
/** 无限画布开启状态的localStorage键 */
const INFINITE_CANVAS_ENABLED_KEY = 'note_infinite_canvas_enabled';

/** 默认外部AI页面URL（豆包） */
export const DEFAULT_EXTERNAL_AI_URL = 'https://www.doubao.com/chat/';

// ============ Slice 类型定义 ============
export interface AppSlice {
  // 状态
  appVersion: string;
  knowledgeBaseEnabled: boolean;
  externalAiUrl: string;
  enableInfiniteCanvas: boolean; // 新增：是否启用无限画布
  shortcutKeys: {
    aiChatWindow: string;
  };
  settingsModalOpenTrigger: number;
  isSettingsModalOpen: boolean;
  activeSettingsTab: string; // 新增：当前选中的设置 Tab

  // Actions - 应用信息
  setAppVersion: (version: string) => void;
  loadAppInfo: () => Promise<void>;

  // Actions - 知识库
  setKnowledgeBaseEnabled: (enabled: boolean) => void;
  loadKnowledgeBaseConfig: () => Promise<void>;

  // Actions - 外部AI页面
  setExternalAiUrl: (url: string) => void;
  loadExternalAiUrl: () => void;

  // Actions - 无限画布
  setEnableInfiniteCanvas: (enabled: boolean) => void;

  // Actions - 快捷键
  setShortcutKeys: (keys: { aiChatWindow: string }) => Promise<void>;
  loadShortcutKeys: () => void;

  // Actions - 设置弹窗
  setSettingsModalOpen: (open: boolean) => void;
  setActiveSettingsTab: (tab: string) => void; // 新增：切换设置 Tab
  triggerSettingsModalRefresh: () => void;
}

// ============ Slice 创建函数 ============
export const createAppSlice: StateCreator<AppSlice, [], [], AppSlice> = (set) => ({
  // 初始状态
  appVersion: '0.0.0',
  knowledgeBaseEnabled: false,
  externalAiUrl: localStorage.getItem(EXTERNAL_AI_URL_KEY) || DEFAULT_EXTERNAL_AI_URL,
  enableInfiniteCanvas: localStorage.getItem(INFINITE_CANVAS_ENABLED_KEY) === 'true', // 默认为 false
  shortcutKeys: {
    aiChatWindow: 'CommandOrControl+Shift+Q', // 默认值
  },
  settingsModalOpenTrigger: 0,
  isSettingsModalOpen: false,
  activeSettingsTab: 'appearance',

  // Actions - 应用信息
  setAppVersion: (version) => set({ appVersion: version }),

  loadAppInfo: async () => {
    try {
      const version = (await window.appInfo?.getVersion?.()) ?? '0.0.0';
      set({ appVersion: version });
    } catch (error) {
      console.error('Failed to load app info:', error);
      set({ appVersion: '0.0.0' });
    }
  },

  // Actions - 知识库
  setKnowledgeBaseEnabled: (enabled) => set({ knowledgeBaseEnabled: enabled }),

  loadKnowledgeBaseConfig: async () => {
    try {
      const config = await window.knowledge?.getConfig();
      set({ knowledgeBaseEnabled: config?.enabled ?? false });
    } catch (error) {
      console.error('Failed to load knowledge base config:', error);
      set({ knowledgeBaseEnabled: false });
    }
  },

  // Actions - 外部AI页面
  setExternalAiUrl: (url) => {
    localStorage.setItem(EXTERNAL_AI_URL_KEY, url);
    set({ externalAiUrl: url });
  },

  loadExternalAiUrl: () => {
    const saved = localStorage.getItem(EXTERNAL_AI_URL_KEY);
    set({ externalAiUrl: saved || DEFAULT_EXTERNAL_AI_URL });
  },

  // Actions - 无限画布
  setEnableInfiniteCanvas: (enabled) => {
    localStorage.setItem(INFINITE_CANVAS_ENABLED_KEY, String(enabled));
    set({ enableInfiniteCanvas: enabled });
  },

  // Actions - 快捷键
  setShortcutKeys: async (keys) => {
    try {
      // 保存到主进程配置
      await window.config?.setShortcutKeys?.(keys);
      set({ shortcutKeys: keys });
    } catch (error) {
      console.error('Failed to save shortcut keys:', error);
      throw error;
    }
  },

  loadShortcutKeys: () => {
    // 从主进程加载快捷键配置
    window.config
      ?.getShortcutKeys?.()
      .then((keys) => {
        if (keys) {
          set({ shortcutKeys: keys });
        }
      })
      .catch((error) => {
        console.error('Failed to load shortcut keys:', error);
      });
  },

  // Actions - 设置弹窗
  setSettingsModalOpen: (open) => set({ isSettingsModalOpen: open }),
  setActiveSettingsTab: (tab) => set({ activeSettingsTab: tab }),
  triggerSettingsModalRefresh: () => {
    set((state) => ({ settingsModalOpenTrigger: state.settingsModalOpenTrigger + 1 }));
  },
});
