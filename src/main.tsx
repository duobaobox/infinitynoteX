import 'antd/dist/reset.css'; // 全局引入 antd 样式
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import AntdConfig from './theme/AntdConfig';
import { applyDataTheme } from './theme/theme';

// 在 React 渲染前立即应用主题（避免背景闪烁）
applyDataTheme();

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
