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
        <div className="app-titlebar-buttons">
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
          {/* 这里放置 Windows/Linux 的窗口控制按钮 */}
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
  <div className="app-titlebar-center" />
        {showEditor && <div className="gap-panel" />}
        {showEditor && <EditorPanel />}
      </div>
    </>
  );
}

export default App;
