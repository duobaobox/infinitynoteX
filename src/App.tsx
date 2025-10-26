import { useState } from "react";
import "./App.css";
import Sidebar from "./components/Sidebar";
import ListPanel from "./components/ListPanel";
import EditorPanel from "./components/EditorPanel";

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
