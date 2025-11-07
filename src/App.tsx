import { useMemo, useState, useEffect } from 'react';
import './App.css';
import Sidebar from './components/Sidebar';
import ListPanel from './components/ListPanel';
import EditorPanel from './components/EditorPanel';
import WelcomeScreen from './components/WelcomeScreen/WelcomeScreen';
import { Button, Spin } from 'antd';
import sidebarLeftSvg from './assets/sidebar-left.svg';

declare global {
  interface Window {
    electronAPI?: {
      minimize: () => void;
      maximize: () => void;
      unmaximize: () => void;
      close: () => void;
      isMaximized: () => Promise<boolean>;
      onWindowStateChanged: (callback: (isMaximized: boolean) => void) => void;
      showOpenDialog: (options: OpenDialogOptions) => Promise<{
        canceled: boolean;
        filePaths: string[];
      }>;
    };
  }
}
import type { OpenDialogOptions } from './services/types';

function App() {
  const [showEditor, setShowEditor] = useState(false); /* 编辑容器显示状态 */
  const [showSidebar, setShowSidebar] = useState(true); /* 侧边栏显示状态 */
  const [lastTitlebarClickTime, setLastTitlebarClickTime] =
    useState(0); /* 用于防止快速点击触发窗口最大化 */
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(
    null,
  ); /* 当前选中的文件夹ID */
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null); /* 当前选中的便签ID */
  const [refreshListTrigger, setRefreshListTrigger] = useState(0); /* 刷新列表的触发器 */
  const [isFirstLaunch, setIsFirstLaunch] = useState<boolean | null>(null); /* 首次启动标志 */

  // 初始化检测
  useEffect(() => {
    const checkFirstLaunch = async () => {
      try {
        const isFirst = await window.storage.isFirstLaunch();
        setIsFirstLaunch(isFirst);
      } catch (error) {
        console.error('Failed to check first launch:', error);
        setIsFirstLaunch(false);
      }
    };

    checkFirstLaunch();
  }, []);

  // 平台判断（避免改 preload，直接基于 UA 判断是否为 macOS）
  const isMac = useMemo(() => /Mac|Macintosh|Mac OS X/.test(navigator.userAgent), []);

  // 处理双击标题栏最大化 - 仅在至少 500ms 后的双击时触发
  const handleDragAreaDoubleClick = (e: React.MouseEvent) => {
    const now = Date.now();
    // 检查是否是真正的用户双击（而不是快速的两次单击）
    if (now - lastTitlebarClickTime < 300) {
      // 这可能是快速点击而非双击，忽略
      return;
    }
    setLastTitlebarClickTime(now);
    // 仅在titlebar空白区域双击时触发最大化
    if (e.target === e.currentTarget) {
      window.electronAPI?.maximize();
    }
  };

  return (
    <>
      <div className="layout-panel app-titlebar" onDoubleClick={handleDragAreaDoubleClick}>
        <div className="app-titlebar-left">
          {isMac && (
            <div className="mac-traffic-lights" role="group" aria-label="窗口控制">
              <button
                className="mac-traffic-light mac-close"
                title="关闭"
                onClick={() => window.electronAPI?.close?.()}
              />
              <button
                className="mac-traffic-light mac-minimize"
                title="最小化"
                onClick={() => window.electronAPI?.minimize?.()}
              />
              <button
                className="mac-traffic-light mac-maximize"
                title="最大化/还原"
                onClick={async () => {
                  if (window.electronAPI?.isMaximized) {
                    const maximized = await window.electronAPI.isMaximized();
                    maximized ? window.electronAPI.unmaximize?.() : window.electronAPI.maximize?.();
                  }
                }}
              />
            </div>
          )}
        </div>
        <div className="app-titlebar-center">
          <Button
            type="text"
            icon={<img src={sidebarLeftSvg} alt="sidebar" style={{ width: 18, height: 18 }} />}
            onClick={(e) => {
              e.stopPropagation();
              setShowSidebar(!showSidebar);
            }}
            style={{ padding: 0 }}
            title="切换侧边栏"
          />
          <Button
            type="text"
            icon={
              <img
                src={sidebarLeftSvg}
                alt="editor"
                style={{ width: 18, height: 18, transform: 'scaleX(-1)' }}
              />
            }
            onClick={(e) => {
              e.stopPropagation();
              setShowEditor(!showEditor);
            }}
            style={{ padding: 0 }}
            title="切换编辑器"
          />
        </div>
        {!isMac && (
          <div className="app-titlebar-right">
            <button
              className="window-btn window-btn-min"
              title="最小化"
              onClick={() => window.electronAPI?.minimize?.()}
            >
              <svg width="16" height="16" viewBox="0 0 16 16">
                <rect x="4" y="8" width="8" height="2" fill="currentColor" />
              </svg>
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
              <svg width="16" height="16" viewBox="0 0 16 16">
                <rect
                  x="4"
                  y="4"
                  width="8"
                  height="8"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
              </svg>
            </button>
            <button
              className="window-btn window-btn-close"
              title="关闭"
              onClick={() => window.electronAPI?.close?.()}
            >
              <svg width="16" height="16" viewBox="0 0 16 16">
                <line x1="4" y1="4" x2="12" y2="12" stroke="currentColor" strokeWidth="1.5" />
                <line x1="12" y1="4" x2="4" y2="12" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {isFirstLaunch === null ? (
        // 加载中
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--app-bg)',
          }}
        >
          <Spin size="large" />
        </div>
      ) : isFirstLaunch ? (
        // 首次启动，显示欢迎屏幕
        <WelcomeScreen
          onInitializationComplete={() => {
            setIsFirstLaunch(false);
          }}
        />
      ) : (
        // 正常应用界面
        <div className="layout-panel main-content">
          {showSidebar && (
            <>
              <Sidebar selectedFolderId={selectedFolderId} onSelectFolder={setSelectedFolderId} />
              <div className="gap-panel" />
            </>
          )}
          <ListPanel
            flex={showEditor ? '0 0 250px' : 1}
            folderId={selectedFolderId}
            selectedNoteId={selectedNoteId}
            onSelectNote={(noteId) => {
              setSelectedNoteId(noteId);
              setShowEditor(!!noteId);
            }}
            refreshTrigger={refreshListTrigger}
          />
          {showEditor && <div className="gap-panel" />}
          {showEditor && (
            <EditorPanel
              noteId={selectedNoteId}
              onClose={() => setShowEditor(false)}
              onSave={() => setRefreshListTrigger((prev) => prev + 1)}
            />
          )}
        </div>
      )}
    </>
  );
}

export default App;
