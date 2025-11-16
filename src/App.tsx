import { useMemo, useState, useEffect } from 'react';
import './App.css';
import Sidebar from './features/workspace/Sidebar';
import ListPanel from './features/workspace/ListPanel';
import EditorPanel from './features/workspace/EditorPanel';
import { ToolPanel } from './features/workspace/ToolPanel';
import WelcomeScreen from './components/WelcomeScreen/WelcomeScreen';
import FloatingNoteWindow from './components/FloatingNoteWindow/FloatingNoteWindow';
import PillWindow from './components/PillWindow/PillWindow';
import { Button, Spin } from 'antd';
import sidebarLeftSvg from './assets/sidebar-left.svg';
import { DEFAULT_TOOLS, DEFAULT_AI_CONVERSATIONS, type WorkspaceView } from './constants/tools';

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

  // 主窗口模式的 Hooks
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
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>('note');
  const [selectedToolId, setSelectedToolId] = useState<string | null>(DEFAULT_TOOLS[0]?.id || null);
  const [selectedToolItemId, setSelectedToolItemId] = useState<string | null>(
    DEFAULT_AI_CONVERSATIONS[0]?.id || null,
  );

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

  useEffect(() => {
    if (workspaceView === 'tool' && !selectedToolId && DEFAULT_TOOLS.length > 0) {
      setSelectedToolId(DEFAULT_TOOLS[0].id);
    }
  }, [workspaceView, selectedToolId]);

  useEffect(() => {
    if (selectedToolId === 'ai-chat') {
      // 初始化 AI 对话列表
      const initAIConversations = async () => {
        try {
          const conversations = await window.storage.getAIConversations();
          if (conversations.length === 0) {
            // 如果没有对话，创建默认对话（第一个会自动命名为"默认对话"）
            const defaultConv = await window.storage.createAIConversation();
            setSelectedToolItemId(defaultConv.id);
          } else if (!selectedToolItemId) {
            // 如果有对话但没有选中，选中第一个（默认对话）
            setSelectedToolItemId(conversations[0].id);
          }
        } catch (error) {
          console.error('Failed to initialize AI conversations:', error);
        }
      };
      initAIConversations();
    } else if (selectedToolItemId) {
      setSelectedToolItemId(null);
    }
  }, [selectedToolId, selectedToolItemId]);

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

  const handleWorkspaceViewChange = (view: WorkspaceView) => {
    setWorkspaceView(view);
    if (view === 'note') {
      setShowEditor(!!selectedNoteId);
    } else {
      if (!showEditor) {
        setShowEditor(true);
      }
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
              <Sidebar
                selectedFolderId={selectedFolderId}
                onSelectFolder={(folderId) => {
                  setSelectedFolderId(folderId);
                  handleWorkspaceViewChange('note');
                }}
                selectedToolId={selectedToolId}
                onSelectTool={(toolId) => {
                  setSelectedToolId(toolId);
                  handleWorkspaceViewChange('tool');
                }}
                activeView={workspaceView}
                onViewChange={handleWorkspaceViewChange}
              />
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
            selectedToolId={selectedToolId}
            onSelectTool={(toolId) => {
              setSelectedToolId(toolId);
              handleWorkspaceViewChange('tool');
            }}
            selectedToolItemId={selectedToolItemId}
            onSelectToolItem={(itemId) => {
              setSelectedToolItemId(itemId);
              handleWorkspaceViewChange('tool');
            }}
            activeView={workspaceView}
          />
          {showEditor && <div className="gap-panel" />}
          {showEditor &&
            (workspaceView === 'note' ? (
              <EditorPanel
                noteId={selectedNoteId}
                onClose={() => setShowEditor(false)}
                onSave={() => setRefreshListTrigger((prev) => prev + 1)}
              />
            ) : (
              <ToolPanel
                toolId={selectedToolId}
                tools={DEFAULT_TOOLS}
                selectedToolItemId={selectedToolItemId}
              />
            ))}
        </div>
      )}
    </>
  );
}

export default App;
