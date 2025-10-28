import { useState } from "react";
import "./App.css";
import Sidebar from "./components/Sidebar";
import ListPanel from "./components/ListPanel";
import EditorPanel from "./components/EditorPanel";
import { Button } from "antd";
import sidebarLeftSvg from "./assets/sidebar-left.svg";

declare global {
  interface Window {
    electronAPI?: {
      minimize: () => void;
      maximize: () => void;
      unmaximize: () => void;
      close: () => void;
      isMaximized: () => Promise<boolean>;
      onWindowStateChanged: (callback: (isMaximized: boolean) => void) => void;
    };
  }
}

function App() {
  const [showEditor, setShowEditor] = useState(false); /* 编辑容器显示状态 */
  const [showSidebar, setShowSidebar] = useState(true); /* 侧边栏显示状态 */

  // 处理双击标题栏最大化
  const handleDragAreaDoubleClick = () => {
    window.electronAPI?.maximize();
  };

  return (
    <>
      <div
        className="layout-panel app-titlebar"
        onDoubleClick={handleDragAreaDoubleClick}
      >
        <div className="app-titlebar-left" />
        <div className="app-titlebar-center">
          <Button
            type="text"
            icon={
              <img
                src={sidebarLeftSvg}
                alt="sidebar"
                style={{ width: 18, height: 18 }}
              />
            }
            onClick={() => setShowSidebar(!showSidebar)}
            style={{ padding: 0 }}
            title="切换侧边栏"
          />
          <Button
            type="text"
            icon={
              <img
                src={sidebarLeftSvg}
                alt="editor"
                style={{ width: 18, height: 18, transform: "scaleX(-1)" }}
              />
            }
            onClick={() => setShowEditor(!showEditor)}
            style={{ padding: 0 }}
            title="切换编辑器"
          />
        </div>
        <div className="app-titlebar-right">
          <button
            className="window-btn window-btn-min"
            title="最小化"
            onClick={() => window.electronAPI?.minimize?.()}
          >
            <svg width="16" height="16" viewBox="0 0 16 16"><rect x="4" y="8" width="8" height="2" fill="currentColor"/></svg>
          </button>
          <button
            className="window-btn window-btn-max"
            title="最大化/还原"
            onClick={async () => {
              if (window.electronAPI?.isMaximized) {
                const maximized = await window.electronAPI.isMaximized();
                if (maximized) {
                  window.electronAPI.unmaximize?.();
                } else {
                  window.electronAPI.maximize?.();
                }
              }
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16"><rect x="4" y="4" width="8" height="8" fill="none" stroke="currentColor" strokeWidth="1.5"/></svg>
          </button>
          <button
            className="window-btn window-btn-close"
            title="关闭"
            onClick={() => window.electronAPI?.close?.()}
          >
            <svg width="16" height="16" viewBox="0 0 16 16"><line x1="4" y1="4" x2="12" y2="12" stroke="currentColor" strokeWidth="1.5"/><line x1="12" y1="4" x2="4" y2="12" stroke="currentColor" strokeWidth="1.5"/></svg>
          </button>
        </div>
      </div>
      <div className="layout-panel main-content">
        {showSidebar && (
          <>
            <Sidebar />
            <div className="gap-panel" />
          </>
        )}
    <ListPanel flex={showEditor ? "0 0 250px" : 1} />
    {showEditor && <div className="gap-panel" />}
        {showEditor && <EditorPanel />}
      </div>
    </>
  );
}

export default App;
