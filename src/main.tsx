import "antd/dist/reset.css"; // 全局引入 antd 样式
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import AntdConfig from "./theme/AntdConfig";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <AntdConfig>
    <React.StrictMode>
      <App />
    </React.StrictMode>
  </AntdConfig>
);

// Use contextBridge
window.ipcRenderer.on("main-process-message", (_event, message) => {
  console.log(message);
});
