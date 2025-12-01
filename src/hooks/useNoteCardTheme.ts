/**
 * useNoteCardTheme.ts
 *
 * 便签卡片主题 Hook - 集中管理卡片颜色、暗色模式检测和相关业务逻辑
 * 将 colorUtils 与 NoteCard 的主题逻辑结合，提高可维护性
 */

import React from 'react';

/**
 * 便签卡片支持的 6 种颜色
 */
export type NoteCardColor = 'bae0ff' | 'd9f7be' | 'ffd6e7' | 'd6e4ff' | 'ffd666' | 'ffffff';

/**
 * 预定义的颜色 hex 值及其对应的暗色版本
 *
 * 设计原则：
 * - 亮色模式：浅色系，易于区分
 * - 暗色模式：深色系，更高饱和度，确保在深色背景上清晰可见
 */
const CARD_COLOR_PALETTE: Record<NoteCardColor, { light: string; dark: string }> = {
  bae0ff: {
    light: '#bae0ff', // 浅蓝
    dark: '#3a5a7a', // 深蓝灰
  },
  d9f7be: {
    light: '#d9f7be', // 浅绿
    dark: '#4a6b3e', // 深绿
  },
  ffd6e7: {
    light: '#ffd6e7', // 浅粉
    dark: '#7a4a5e', // 深粉紫
  },
  d6e4ff: {
    light: '#d6e4ff', // 淡蓝紫
    dark: '#3e4a6b', // 深蓝紫
  },
  ffd666: {
    light: '#ffd666', // 浅黄
    dark: '#6b5a2e', // 深金黄
  },
  ffffff: {
    light: '#ffffff', // 白
    dark: '#2d2d2d', // 深灰
  },
};

/**
 * 预设颜色选项（供 UI 选择器使用）
 */
export const PRESET_COLORS: Array<{ key: NoteCardColor; label: string }> = [
  { key: 'ffffff', label: '白色' },
  { key: 'bae0ff', label: '蓝' },
  { key: 'd6e4ff', label: '靛蓝' },
  { key: 'd9f7be', label: '绿' },
  { key: 'ffd666', label: '金' },
  { key: 'ffd6e7', label: '粉' },
];

/**
 * 边框颜色 - 根据主题自适应
 */
const BORDER_COLOR = {
  light: 'rgba(0, 0, 0, 0.1)',
  dark: 'rgba(255, 255, 255, 0.15)',
};

/**
 * 获取卡片背景色
 * @param colorKey 颜色键值
 * @param isDark 是否暗色模式
 */
function getCardBackgroundColor(colorKey: NoteCardColor | string, isDark: boolean): string {
  const palette = CARD_COLOR_PALETTE[colorKey as NoteCardColor] || CARD_COLOR_PALETTE.ffffff;
  return isDark ? palette.dark : palette.light;
}

/**
 * 获取边框色
 * @param isDark 是否暗色模式
 * @param isInteractive 是否处于交互状态（悬浮/选中）- 如果是，返回主题色
 * @param themeColor 主题色（可选，用于交互状态）
 */
function getBorderColor(isDark: boolean, isInteractive: boolean, themeColor?: string): string {
  if (isInteractive && themeColor) {
    return themeColor;
  }
  return isDark ? BORDER_COLOR.dark : BORDER_COLOR.light;
}

/**
 * useNoteCardTheme Hook
 *
 * 提供便签卡片所需的所有主题相关数据：
 * - 检测暗色模式状态
 * - 根据模式返回卡片背景色
 * - 返回合适的边框色
 *
 * @param colorKey 卡片颜色键值
 * @param themeColor 当前主题色（用于悬浮/选中时的高亮）
 * @param isInteractive 是否处于交互状态（悬浮/选中）
 *
 * @returns { isDark, bgColor, borderColor }
 */
export function useNoteCardTheme(
  colorKey: NoteCardColor | string = 'ffffff',
  themeColor: string = '#fa8c16',
  isInteractive: boolean = false,
) {
  // 检测暗色模式状态
  const [isDark, setIsDark] = React.useState(
    document.documentElement.getAttribute('data-theme') === 'dark',
  );

  // 监听主题模式变化
  React.useEffect(() => {
    const updateDarkMode = () => {
      setIsDark(document.documentElement.getAttribute('data-theme') === 'dark');
    };

    // 初始检测
    updateDarkMode();

    // 监听主题模式变化事件（light/dark/auto 切换时触发）
    const onThemeModeChange = () => {
      updateDarkMode();
    };

    window.addEventListener('theme-mode-change', onThemeModeChange);

    // 回退：仍保留 MutationObserver，以防外部样式直接修改 data-theme
    const observer = new MutationObserver(updateDarkMode);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    return () => {
      window.removeEventListener('theme-mode-change', onThemeModeChange);
      observer.disconnect();
    };
  }, []);

  // 计算并返回卡片样式值（memoized 减少重复计算）
  const bgColor = React.useMemo(() => getCardBackgroundColor(colorKey, isDark), [colorKey, isDark]);

  const borderColor = React.useMemo(
    () => getBorderColor(isDark, isInteractive, themeColor),
    [isDark, isInteractive, themeColor],
  );

  return {
    isDark,
    bgColor,
    borderColor,
  };
}

/**
 * 导出颜色配置供其他地方使用
 */
export const NoteCardColorConfig = {
  palette: CARD_COLOR_PALETTE,
  borderColor: BORDER_COLOR,
  colorKeys: Object.keys(CARD_COLOR_PALETTE) as NoteCardColor[],
};
