/**
 * useThemeColor - 主题色监听 Hook
 *
 * 监听全局主题色变化事件
 */

import { useState, useEffect } from 'react';
import { getThemeColor } from '../theme/theme';

/**
 * 监听主题色变化的 Hook
 * @returns 当前主题色
 */
export const useThemeColor = (): string => {
  const [themeColor, setThemeColor] = useState(getThemeColor());

  useEffect(() => {
    const handler = (e: Event) => {
      const color = (e as unknown as CustomEvent<string>).detail;
      if (typeof color === 'string' && color) {
        setThemeColor(color);
      }
    };

    window.addEventListener('theme-color-change', handler as EventListener);
    return () => {
      window.removeEventListener('theme-color-change', handler as EventListener);
    };
  }, []);

  return themeColor;
};

export default useThemeColor;
