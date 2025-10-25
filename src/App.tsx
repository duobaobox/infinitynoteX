import "./App.css";

function App() {
  return (
    <>
      <div className="layout-panel drag-area">应用拖拽区域</div>
      <div className="layout-panel main-content">
        <div className="layout-panel sidebar">侧边栏</div>
        <div className="layout-panel list-container">列表容器</div>
        <div className="layout-panel editor-container">编辑容器</div>
      </div>
    </>
  );
}

export default App;
