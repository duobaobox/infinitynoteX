import React, { useCallback, useEffect } from 'react';
import { CloseOutlined } from '@ant-design/icons';
import { AIChatPanel } from '../../features/ai-chat/AIChatPanel';
import { useSettingsStore } from '../../store/settingsStore';
import { subscribeToConfigChanges, applyDataTheme, loadThemeFromConfig } from '../../theme/theme';
import './styles.css';

/**
 * AI 对话悬浮窗口页面
 * 复用便签的 AI 对话组件，提供全局 AI 助手功能
 */
export const AIChatWindow: React.FC = React.memo(() => {
  const { loadKnowledgeBaseConfig } = useSettingsStore();

  // 初始化主题同步
  useEffect(() => {
    let cleanupDataTheme: (() => void) | null = null;
    let disposed = false;

    // 从主进程加载主题配置
    loadThemeFromConfig().then(() => {
      if (disposed) return;
      // 应用主题
      cleanupDataTheme = applyDataTheme();
    });

    // 订阅配置变化（跨窗口同步）
    const unsubscribe = subscribeToConfigChanges();

    return () => {
      disposed = true;
      unsubscribe();
      cleanupDataTheme?.();
    };
  }, []);

  // 窗口可见时重新加载配置，确保状态同步
  useEffect(() => {
    // 初始加载
    loadKnowledgeBaseConfig();

    // 监听窗口获得焦点事件
    const handleFocus = () => {
      loadKnowledgeBaseConfig();
    };

    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [loadKnowledgeBaseConfig]);

  const handleClose = useCallback(() => {
    window.electronAPI?.hideAIChatWindow?.();
  }, []);

  return (
    <div className="ai-chat-window">
      {/* 窗口标题栏 - 可拖拽区域 */}
      <div
        className="ai-chat-window-header"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <div className="ai-chat-window-title">
          <span>AI 助手</span>
        </div>
        <div
          className="ai-chat-window-controls"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <button
            className="ai-chat-window-control-btn ai-chat-window-close-btn"
            onClick={handleClose}
            title="关闭"
          >
            <CloseOutlined />
          </button>
        </div>
      </div>

      {/* AI 对话内容区域 */}
      <div className="ai-chat-window-content">
        <AIChatPanel
          conversationId={null}
          conversationBinding={{ source: 'global', entityId: 'default' }}
          title="全局 AI 对话"
          source="global"
        />
      </div>
    </div>
  );
});

AIChatWindow.displayName = 'AIChatWindow';
