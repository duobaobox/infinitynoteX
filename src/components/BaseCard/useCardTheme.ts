/**
 * useCardTheme Hook
 * 统一管理卡片的主题色监听和暗色模式检测
 * 解决各卡片组件重复监听的问题
 */

import { useState, useEffect, useMemo } from 'react';
import { getThemeColor } from '../../theme/theme';
import { useNoteCardTheme, type NoteCardColor } from '../../hooks/useNoteCardTheme';

interface UseCardThemeOptions {
  /** 卡片颜色 */
  color?: NoteCardColor;
  /** 是否处于交互状态（选中或hover） */
  isInteractive?: boolean;
  /** 是否使用颜色计算背景（false时使用固定背景） */
  colorable?: boolean;
}

interface UseCardThemeReturn {
  /** 主题色 */
  themeColor: string;
  /** 是否暗色模式 */
  isDarkMode: boolean;
  /** 卡片背景色 */
  bgColor: string;
  /** 卡片边框色 */
  borderColor: string;
}

/**
 * 统一的卡片主题 Hook
 * 合并了主题色监听、暗色模式检测、颜色计算
 */
export function useCardTheme(options: UseCardThemeOptions = {}): UseCardThemeReturn {
  const { color = 'ffffff', isInteractive = false, colorable = true } = options;

  // 主题色状态
  const [themeColor, setThemeColor] = useState(getThemeColor());
  // 暗色模式状态
  const [isDarkMode, setIsDarkMode] = useState(false);

  // 监听主题色变化
  useEffect(() => {
    const handler = (event: Event) => {
      if (event instanceof CustomEvent && typeof event.detail === 'string' && event.detail) {
        setThemeColor(event.detail);
      }
    };
    window.addEventListener('theme-color-change', handler);
    return () => window.removeEventListener('theme-color-change', handler);
  }, []);

  // 检测暗色模式
  useEffect(() => {
    const checkDarkMode = () => {
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      setIsDarkMode(isDark);
    };

    checkDarkMode();

    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    return () => observer.disconnect();
  }, []);

  // 使用现有的 useNoteCardTheme 计算颜色
  const { bgColor: computedBgColor, borderColor } = useNoteCardTheme(
    colorable ? color : 'ffffff',
    themeColor,
    isInteractive,
  );

  // 根据是否支持颜色决定背景色
  const bgColor = useMemo(() => {
    if (colorable) {
      return computedBgColor;
    }
    // 不支持颜色时，使用固定的背景
    return isDarkMode ? '#262626' : '#ffffff';
  }, [colorable, computedBgColor, isDarkMode]);

  return {
    themeColor,
    isDarkMode,
    bgColor,
    borderColor,
  };
}
