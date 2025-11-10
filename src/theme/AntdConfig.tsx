import { ConfigProvider, theme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import React from 'react';
import './antd-custom.css';
import './modes.css';
import { getThemeColor, getThemeMode, applyDataTheme, applyThemeBg, ThemeMode } from './theme';

/**
 * Ant Design 全局配置组件
 * 用于统一主题、国际化、全局Token等配置
 */
const AntdConfig: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [primary, setPrimary] = React.useState<string>(getThemeColor());
  const [mode, setMode] = React.useState<ThemeMode>(getThemeMode());
  const [systemDark, setSystemDark] = React.useState<boolean>(
    window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches,
  );

  // Apply data-theme and listen to system changes when in auto
  React.useEffect(() => {
    const cleanup = applyDataTheme(mode);
    // Also apply theme background colors
    applyThemeBg();
    return cleanup;
  }, [mode]);

  React.useEffect(() => {
    const handler = (e: Event) => {
      const color = (e as unknown as CustomEvent<string>).detail;
      if (typeof color === 'string' && color) setPrimary(color);
    };
    window.addEventListener('theme-color-change', handler as EventListener);
    return () => window.removeEventListener('theme-color-change', handler as EventListener);
  }, []);

  // listen theme mode change
  React.useEffect(() => {
    const onMode = (e: Event) => {
      const next = (e as unknown as CustomEvent<ThemeMode>).detail;
      setMode(next);
    };
    window.addEventListener('theme-mode-change', onMode as EventListener);
    return () => window.removeEventListener('theme-mode-change', onMode as EventListener);
  }, []);

  // listen system preference if in auto mode
  React.useEffect(() => {
    const mql = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
    if (!mql) return;
    const handler = (e: MediaQueryListEvent) => {
      if (getThemeMode() === 'auto') setSystemDark(e.matches);
    };
    mql.addEventListener?.('change', handler);
    return () => mql.removeEventListener?.('change', handler);
  }, []);

  const algorithm = React.useMemo(() => {
    const m = mode;
    if (m === 'dark') return theme.darkAlgorithm;
    if (m === 'light') return theme.defaultAlgorithm;
    // auto -> follow system
    return systemDark ? theme.darkAlgorithm : theme.defaultAlgorithm;
  }, [mode, systemDark]);

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: primary, // 主色（可动态变更）
          borderRadius: 6, // 全局圆角
          // 可继续添加其他全局Token
        },
        algorithm,
      }}
      // 使用 antd 默认尺寸（middle），不指定 componentSize
    >
      {children}
    </ConfigProvider>
  );
};

export default AntdConfig;
