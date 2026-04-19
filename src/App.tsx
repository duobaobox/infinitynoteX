import { useMemo, useState, useEffect } from 'react';
import './App.css';
import { XProvider } from '@ant-design/x';
import Sidebar from './features/layout/Sidebar';
import ListPanel from './features/layout/ListPanel';
import EditorPanel from './features/layout/EditorPanel';

import WelcomeScreen from './components/WelcomeScreen/WelcomeScreen';
import FloatingNoteWindow from './components/FloatingNoteWindow/FloatingNoteWindow';
import FloatingTodoWindow from './components/FloatingTodoWindow/FloatingTodoWindow';
import FloatingNoteTodoWindow from './components/FloatingNoteTodoWindow/FloatingNoteTodoWindow';
import { NOTE_TASKS_LIST_ID } from './shared/constants/todoConstants';
import PillWindow from './components/PillWindow/PillWindow';
import TodoPillWindow from './components/TodoPillWindow/TodoPillWindow';
import { AIChatWindow } from './pages/AIChatWindow';
import { Button, Spin } from 'antd';
import sidebarLeftSvg from './assets/sidebar-left.svg';
import { getFeaturesByWorkspaceView } from './config/featureRegistry';
import { IPC_CHANNELS } from './shared/types/ipc';
import type { NavigateNotePayload } from './shared/types/ipc';
import { onRendererIpc } from './shared/utils/ipcEvents';
import {
  buildAIWorkbenchItems,
  getDefaultAIWorkbenchSelectionId,
  resolveAIWorkbenchSelection,
} from './features/ai-workbench/model/workbenchConversationItems';

// 确保 Feature 模块被加载并完成注册（单点初始化）
import './features/registerAllFeatures';

import { useWorkspaceStore, setupFolderNotesSync } from './store/workspaceStore';
import { useStorageEvents } from './hooks/useStorageEvents';

function App() {
  // 检测窗口类型（Hooks 必须在顶层调用，在条件之前）
  const windowType = useMemo(() => {
    const hash = window.location.hash;
    if (hash.startsWith('#/floating/')) return 'floating';
    if (hash.startsWith('#/pill/')) return 'pill';
    if (hash.startsWith('#/floating-todo/')) return 'floating-todo';
    if (hash.startsWith('#/todo-pill/')) return 'todo-pill';
    if (hash.startsWith('#/ai-chat-window')) return 'ai-chat-window';
    return 'main';
  }, []);

  // ============ 使用 Zustand Store 管理状态（优化：使用 selector 减少重渲染） ============
  const showEditor = useWorkspaceStore((state) => state.showEditor);
  const showSidebar = useWorkspaceStore((state) => state.showSidebar);
  const selectedToolId = useWorkspaceStore((state) => state.selectedToolId);
  const aiConversations = useWorkspaceStore((state) => state.aiConversations);
  const selectedAIWorkbenchItem = useWorkspaceStore((state) => state.selectedAIWorkbenchItem);
  const workspaceView = useWorkspaceStore((state) => state.workspaceView);
  const isFirstLaunch = useWorkspaceStore((state) => state.isFirstLaunch);
  const loadFolders = useWorkspaceStore((state) => state.loadFolders);
  const loadAIConversations = useWorkspaceStore((state) => state.loadAIConversations);
  const toggleSidebar = useWorkspaceStore((state) => state.toggleSidebar);
  const toggleEditor = useWorkspaceStore((state) => state.toggleEditor);
  const setSelectedTool = useWorkspaceStore((state) => state.setSelectedTool);
  const setSelectedAIWorkbenchItem = useWorkspaceStore((state) => state.setSelectedAIWorkbenchItem);
  const setIsFirstLaunch = useWorkspaceStore((state) => state.setIsFirstLaunch);
  const triggerListRefresh = useWorkspaceStore((state) => state.triggerListRefresh);
  const setWorkspaceView = useWorkspaceStore((state) => state.setWorkspaceView);
  const setSelectedFolder = useWorkspaceStore((state) => state.setSelectedFolder);
  const setSelectedNote = useWorkspaceStore((state) => state.setSelectedNote);

  // 保留的本地状态（非全局共享）
  const [lastTitlebarClickTime, setLastTitlebarClickTime] = useState(0);

  // 全局监听存储事件（删除、创建等），自动清理失效引用
  useStorageEvents();

  // 应用启动时加载数据
  useEffect(() => {
    loadFolders(); // 加载文件夹列表
    loadAIConversations(); // 加载 AI 对话列表
  }, [loadFolders, loadAIConversations]);

  // 监听同步数据变化事件，同步完成后刷新数据
  useEffect(() => {
    if (!window.sync?.onDataChanged) return;

    const unsubscribe = window.sync.onDataChanged(() => {
      console.log('[App] Sync data changed, reloading data...');
      loadFolders(); // 重新加载文件夹列表
      loadAIConversations(); // 重新加载 AI 对话列表
      triggerListRefresh(); // 触发便签列表刷新
    });

    return unsubscribe;
  }, [loadFolders, loadAIConversations, triggerListRefresh]);

  // 初始化数据同步机制：监听 selectedFolderId 变化，自动加载 notes
  useEffect(() => {
    const unsubscribe = setupFolderNotesSync();
    return unsubscribe; // 组件卸载时取消订阅
  }, []);

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
    if (workspaceView === 'tool' && !selectedToolId) {
      const toolFeatures = getFeaturesByWorkspaceView('tool');
      if (toolFeatures.length > 0) {
        setSelectedTool(toolFeatures[0].id);
      }
    }
  }, [workspaceView, selectedToolId, setSelectedTool]);

  // 响应悬浮窗口发起的便签跳转请求
  useEffect(() => {
    if (windowType !== 'main') return;

    const handleNavigateNote = (_event: unknown, payload?: NavigateNotePayload) => {
      if (!payload?.folderId || !payload?.noteId) return;

      setWorkspaceView('note');
      setSelectedFolder(payload.folderId);
      setSelectedNote(payload.noteId, payload.taskPath ?? null);
    };

    return onRendererIpc(IPC_CHANNELS.navigateNote, handleNavigateNote);
  }, [windowType, setWorkspaceView, setSelectedFolder, setSelectedNote]);

  // 切换到 AI 对话视图时，确保选中一个对话（如果有）
  useEffect(() => {
    if (workspaceView === 'tool' && selectedToolId === 'ai-chat') {
      const availableItems = buildAIWorkbenchItems(aiConversations);

      if (!selectedAIWorkbenchItem) {
        const defaultSelection =
          resolveAIWorkbenchSelection(getDefaultAIWorkbenchSelectionId(), aiConversations) ??
          availableItems[0] ??
          null;
        if (defaultSelection) {
          setSelectedAIWorkbenchItem(defaultSelection);
        }
      } else if (!availableItems.some((item) => item.id === selectedAIWorkbenchItem.id)) {
        const fallbackSelection =
          resolveAIWorkbenchSelection(getDefaultAIWorkbenchSelectionId(), aiConversations) ??
          availableItems[0] ??
          null;
        setSelectedAIWorkbenchItem(fallbackSelection);
      }
    } else if (workspaceView !== 'tool' && selectedAIWorkbenchItem) {
      // 切换回便签视图时清空选中的工具项
      setSelectedAIWorkbenchItem(null);
    }
  }, [
    aiConversations,
    selectedAIWorkbenchItem,
    selectedToolId,
    setSelectedAIWorkbenchItem,
    workspaceView,
  ]);

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

  // Todo 悬浮窗口 - 根据 listId 区分组件
  if (windowType === 'floating-todo') {
    const listId = window.location.hash.replace('#/floating-todo/', '');
    // 便签任务使用专用组件（无添加功能，从便签解析任务）
    if (listId === NOTE_TASKS_LIST_ID) {
      return <FloatingNoteTodoWindow />;
    }
    // 自定义任务或默认手动任务使用原有组件
    return <FloatingTodoWindow listId={listId} />;
  }

  // Todo 药丸窗口
  if (windowType === 'todo-pill') {
    const listId = window.location.hash.replace('#/todo-pill/', '');
    return <TodoPillWindow listId={listId} />;
  }

  // AI 对话悬浮窗口
  if (windowType === 'ai-chat-window') {
    return <AIChatWindow />;
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

      <XProvider>
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
            {showEditor && <EditorPanel />}
          </div>
        )}
      </XProvider>
    </>
  );
}

export default App;
