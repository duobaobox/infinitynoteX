import { useState } from "react";
import "./App.css";

function App() {
  const [showEditor, setShowEditor] = useState(false); /* 编辑容器显示状态 */
  const [showSidebar, setShowSidebar] = useState(true); /* 侧边栏显示状态 */

  return (
    <>
      <div className="layout-panel drag-area">
        <button onClick={() => setShowSidebar(!showSidebar)}>☰</button>
        应用拖拽区域
        <button onClick={() => setShowEditor(!showEditor)}>☰</button>
      </div>
      <div className="layout-panel main-content">
        {showSidebar && <div className="layout-panel sidebar">侧边栏</div>}
        <div
          className="layout-panel list-container"
          style={{
            flex: showEditor
              ? "0 0 250px"
              : 1 /* 显示编辑器时固定250px，否则flex1 */,
          }}
        >
          列表容器
        </div>
        {showEditor && (
          <div className="layout-panel editor-container">编辑容器</div>
        )}
      </div>
    </>
  );
}

export default App;
