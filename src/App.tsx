import { useMemo, useState, useEffect, useRef } from 'react';
import './App.css';
import Sidebar from './features/layout/Sidebar';
import ListPanel from './features/layout/ListPanel';
import EditorPanel from './features/layout/EditorPanel';
import { ToolPanel } from './features/layout/ToolPanel';
import WelcomeScreen from './components/WelcomeScreen/WelcomeScreen';
import FloatingNoteWindow from './components/FloatingNoteWindow/FloatingNoteWindow';
import PillWindow from './components/PillWindow/PillWindow';
import { Button, Spin } from 'antd';
import sidebarLeftSvg from './assets/sidebar-left.svg';
import { DEFAULT_TOOLS } from './constants/tools';
import { useWorkspaceStore } from './store/workspaceStore';

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
  // 检测窗口类型（Hooks 必须在顶层调用，在条件之前）
  const windowType = useMemo(() => {
    const hash = window.location.hash;
    if (hash.startsWith('#/floating/')) return 'floating';
    if (hash.startsWith('#/pill/')) return 'pill';
    return 'main';
  }, []);

  // ============ 使用 Zustand Store 管理状态 ============
  const {
    showEditor,
    showSidebar,
    selectedToolId,
    selectedToolItemId,
    workspaceView,
    isFirstLaunch,
    toggleSidebar,
    toggleEditor,
    setSelectedTool,
    setSelectedToolItem,
    setIsFirstLaunch,
  } = useWorkspaceStore();

  // 保留的本地状态（非全局共享）
  const [lastTitlebarClickTime, setLastTitlebarClickTime] = useState(0);
  const isInitializingAIConversationRef = useRef(false);

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
  }, [setIsFirstLaunch]);

  // 平台判断（避免改 preload，直接基于 UA 判断是否为 macOS）
  const isMac = useMemo(() => /Mac|Macintosh|Mac OS X/.test(navigator.userAgent), []);

  useEffect(() => {
    if (workspaceView === 'tool' && !selectedToolId && DEFAULT_TOOLS.length > 0) {
      setSelectedTool(DEFAULT_TOOLS[0].id);
    }
  }, [workspaceView, selectedToolId, setSelectedTool]);

  // 应用启动时初始化默认 AI 对话（如果不存在）
  useEffect(() => {
    const initDefaultAIConversation = async () => {
      if (isInitializingAIConversationRef.current || isFirstLaunch === null) {
        return; // 等待首次启动检测完成
      }

      try {
        isInitializingAIConversationRef.current = true;
        const conversations = await window.storage.getAIConversations();
        if (conversations.length === 0) {
          // 如果没有对话，创建默认对话（第一个会自动命名为"默认对话"）
          await window.storage.createAIConversation();
          console.log('[App] Created default AI conversation on startup');
        }
      } catch (error) {
        console.error('Failed to initialize default AI conversation:', error);
      } finally {
        isInitializingAIConversationRef.current = false;
      }
    };

    initDefaultAIConversation();
  }, [isFirstLaunch]);

  // 切换到 AI 对话视图时，确保选中一个对话
  useEffect(() => {
    if (workspaceView === 'tool' && selectedToolId === 'ai-chat' && !selectedToolItemId) {
      const selectDefaultConversation = async () => {
        try {
          const conversations = await window.storage.getAIConversations();
          if (conversations.length > 0 && !selectedToolItemId) {
            // 选中第一个对话（默认对话）
            setSelectedToolItem(conversations[0].id);
          }
        } catch (error) {
          console.error('Failed to select default conversation:', error);
        }
      };
      selectDefaultConversation();
    } else if (workspaceView !== 'tool' && selectedToolItemId) {
      // 切换回便签视图时清空选中的工具项
      setSelectedToolItem(null);
    }
  }, [workspaceView, selectedToolId, selectedToolItemId, setSelectedToolItem]);

  // 如果是悬浮窗口模式，提取 noteId 并渲染悬浮窗口组件
  if (windowType === 'floating') {
    const noteId = window.location.hash.replace('#/floating/', '');
    return <FloatingNoteWindow noteId={noteId} />;
  }

  // 如果是药丸窗口模式，提取 noteId 并渲染药丸组件
  if (windowType === 'pill') {
    const noteId = window.location.hash.replace('#/pill/', '');
    return <PillWindow noteId={noteId} />;
  }

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
      <div
        className={`layout-panel app-titlebar ${isMac ? 'platform-mac' : 'platform-win'}`}
        onDoubleClick={handleDragAreaDoubleClick}
      >
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
              toggleSidebar();
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
              toggleEditor();
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
        <div className="layout-panel main-content">
          {showSidebar && (
            <>
              <Sidebar />
              <div className="gap-panel" />
            </>
          )}
          <ListPanel flex={showEditor ? '0 0 250px' : 1} />
          {showEditor && <div className="gap-panel" />}
          {showEditor && (workspaceView === 'note' ? <EditorPanel /> : <ToolPanel />)}
        </div>
      )}
    </>
  );
}

export default App;
