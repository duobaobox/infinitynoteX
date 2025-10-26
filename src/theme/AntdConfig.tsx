import { ConfigProvider, theme } from "antd";
import zhCN from "antd/locale/zh_CN";
import React from "react";
import "./antd-custom.css";

/**
 * Ant Design 全局配置组件
 * 用于统一主题、国际化、全局Token等配置
 */
const AntdConfig: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ConfigProvider
    locale={zhCN}
    theme={{
      token: {
        colorPrimary: "#fa8c16", // 主色
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

export default AntdConfig;
