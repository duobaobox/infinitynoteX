import { ConfigProvider, theme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import React from 'react';
import './antd-custom.css';
import { getThemeColor } from './theme';

/**
 * Ant Design 全局配置组件
 * 用于统一主题、国际化、全局Token等配置
 */
const AntdConfig: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [primary, setPrimary] = React.useState<string>(getThemeColor());

  React.useEffect(() => {
    const handler = (e: Event) => {
      const color = (e as unknown as CustomEvent<string>).detail;
      if (typeof color === 'string' && color) setPrimary(color);
    };
    window.addEventListener('theme-color-change', handler as EventListener);
    return () => window.removeEventListener('theme-color-change', handler as EventListener);
  }, []);

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: primary, // 主色（可动态变更）
          borderRadius: 6, // 全局圆角
          // 可继续添加其他全局Token
        },
        algorithm: theme.defaultAlgorithm,
      }}
      componentSize="small"
    >
      {children}
    </ConfigProvider>
  );
};

export default AntdConfig;
