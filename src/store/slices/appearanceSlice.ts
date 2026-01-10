/**
 * Appearance Slice - 外观设置状态管理
 */

import type { StateCreator } from 'zustand';
import {
  getThemeColor,
  setThemeColor,
  getThemeMode,
  setThemeMode,
  getThemeBgLight,
  setThemeBgLight,
  getThemeBgDark,
  setThemeBgDark,
  ThemeMode,
} from '../../theme/theme';

// ============ Slice 类型定义 ============
export interface AppearanceSlice {
  // 状态
  primaryColor: string;
  themeMode: ThemeMode;
  bgLight: string;
  bgDark: string;

  // Actions
  setPrimaryColor: (color: string) => void;
  applyPrimaryColor: (color: string) => void;
  setThemeModeState: (mode: ThemeMode) => void;
  applyThemeMode: (mode: ThemeMode) => void;
  setBgLight: (bg: string) => void;
  setBgDark: (bg: string) => void;
  applyBackground: (bg: string, mode: 'light' | 'dark') => void;
  initAppearance: () => void;
}

// ============ Slice 创建函数 ============
export const createAppearanceSlice: StateCreator<AppearanceSlice, [], [], AppearanceSlice> = (
  set,
) => ({
  // 初始状态
  primaryColor: getThemeColor(),
  themeMode: getThemeMode(),
  bgLight: getThemeBgLight(),
  bgDark: getThemeBgDark(),

  // Actions
  setPrimaryColor: (color) => set({ primaryColor: color }),

  applyPrimaryColor: (color) => {
    set({ primaryColor: color });
    setThemeColor(color);
  },

  setThemeModeState: (mode) => set({ themeMode: mode }),

  applyThemeMode: (mode) => {
    set({ themeMode: mode });
    setThemeMode(mode);
  },

  setBgLight: (bg) => set({ bgLight: bg }),

  setBgDark: (bg) => set({ bgDark: bg }),

  applyBackground: (bg, mode) => {
    if (mode === 'dark') {
      set({ bgDark: bg });
      setThemeBgDark(bg);
    } else {
      set({ bgLight: bg });
      setThemeBgLight(bg);
    }
  },

  initAppearance: () => {
    set({
      primaryColor: getThemeColor(),
      themeMode: getThemeMode(),
      bgLight: getThemeBgLight(),
      bgDark: getThemeBgDark(),
    });
  },
});
