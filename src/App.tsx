import { useState } from "react";
import "./App.css";
import Sidebar from "./components/Sidebar";
import ListPanel from "./components/ListPanel";
import EditorPanel from "./components/EditorPanel";
import { Button } from "antd";
import sidebarLeftSvg from "./assets/sidebar-left.svg";

function App() {
  const [showEditor, setShowEditor] = useState(false); /* 编辑容器显示状态 */
  const [showSidebar, setShowSidebar] = useState(true); /* 侧边栏显示状态 */

  return (
    <>
      <div className="layout-panel drag-area">
        <div className="macos-window-buttons">
          <span className="macos-btn macos-close" />
          <span className="macos-btn macos-min" />
          <span className="macos-btn macos-full" />
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
          />
        </div>

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
        />
      </div>
      <div className="layout-panel main-content">
        {showSidebar && (
          <>
            <Sidebar />
            <div className="gap-panel" />
          </>
        )}
        <ListPanel flex={showEditor ? "0 0 250px" : 1} />
        <div className="drag-area-center" />
        {showEditor && <div className="gap-panel" />}
        {showEditor && <EditorPanel />}
      </div>
    </>
  );
}

export default App;
