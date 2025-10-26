import { useState } from "react";
import "./App.css";

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
          <button onClick={() => setShowSidebar(!showSidebar)}>☰</button>
        </div>

        <button onClick={() => setShowEditor(!showEditor)}>☰</button>
      </div>
      <div className="layout-panel main-content">
        {showSidebar && <div className="layout-panel sidebar"></div>}
        <div className="gap-panel" />
        <div
          className="layout-panel list-container"
          style={{
            flex: showEditor
              ? "0 0 250px"
              : 1 /* 显示编辑器时固定250px，否则flex1 */,
          }}
        ></div>
        <div className="drag-area-center" />
        {/* 第二个间隔容器 */}
        {showEditor && <div className="gap-panel" />}
        {showEditor && <div className="layout-panel editor-container"></div>}
      </div>
    </>
  );
}

export default App;
