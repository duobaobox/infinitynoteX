import 'antd/dist/reset.css'; // 全局引入 antd 样式
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import AntdConfig from './theme/AntdConfig';
import { applyDataTheme, loadThemeFromConfig, subscribeToConfigChanges } from './theme/theme';

// 在 React 渲染前立即应用主题（避免背景闪烁）
applyDataTheme();
// 启动时加载主题配置
loadThemeFromConfig();
// 监听主题配置变化
subscribeToConfigChanges();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <AntdConfig>
    <React.StrictMode>
      <App />
    </React.StrictMode>
  </AntdConfig>,
);

// Use contextBridge
window.ipcRenderer.on('main-process-message', (_event, message) => {
  console.log(message);
});
