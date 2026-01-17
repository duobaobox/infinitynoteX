/**
 * BrowserViewer - 浏览器视图组件
 *
 * 【组件职责】
 * - 显示 webview 加载选中的网页
 * - 提供导航控制（后退/前进/刷新/主页）
 * - 使用 persist partition 保持登录状态
 *
 * 【技术要点】
 * - 使用 Electron 的 <webview> 标签
 * - partition="persist:browser" 确保会话持久化
 */

import React, { useRef, useEffect, useState } from 'react';
import { Button, Spin, Empty, Tooltip, message } from 'antd';
import {
  ArrowLeftOutlined,
  ArrowRightOutlined,
  ReloadOutlined,
  HomeOutlined,
  PushpinOutlined,
  PushpinFilled,
} from '@ant-design/icons';
import { useWorkspaceStore } from '../../../../store/workspaceStore';
import { useSettingsStore } from '../../../../store/settingsStore';
import './BrowserViewer.css';

// Electron webview 类型扩展
interface WebviewElement extends HTMLElement {
  src: string;
  canGoBack: () => boolean;
  canGoForward: () => boolean;
  goBack: () => void;
  goForward: () => void;
  reload: () => void;
  loadURL: (url: string) => void;
  getURL: () => string;
  getTitle: () => string;
}

/**
 * BrowserViewer 主组件
 */
export const BrowserViewer: React.FC = () => {
  // ============ Store 状态 ============
  const selectedBrowserCardId = useWorkspaceStore((state) => state.selectedBrowserCardId);
  const browserCards = useWorkspaceStore((state) => state.browserCards);

  // ============ 本地状态 ============
  const webviewRef = useRef<WebviewElement>(null);
  const [loading, setLoading] = useState(false);
  const [currentUrl, setCurrentUrl] = useState('');
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);

  // ============ 派生数据 ============
  const selectedCard = browserCards.find((c) => c.id === selectedBrowserCardId);

  // ============ 副作用 ============

  // 当选中卡片变化时加载对应网页
  useEffect(() => {
    if (selectedCard && webviewRef.current) {
      webviewRef.current.src = selectedCard.url;
      setCurrentUrl(selectedCard.url);
    }
  }, [selectedCard]);

  // 监听 webview 事件
  useEffect(() => {
    const webview = webviewRef.current;
    if (!webview) return;

    const handleStartLoading = () => setLoading(true);
    const handleStopLoading = () => {
      setLoading(false);
      setCanGoBack(webview.canGoBack());
      setCanGoForward(webview.canGoForward());
      setCurrentUrl(webview.getURL());
    };
    const handleNavigate = () => {
      setCurrentUrl(webview.getURL());
      setCanGoBack(webview.canGoBack());
      setCanGoForward(webview.canGoForward());
    };

    webview.addEventListener('did-start-loading', handleStartLoading);
    webview.addEventListener('did-stop-loading', handleStopLoading);
    webview.addEventListener('did-navigate', handleNavigate);
    webview.addEventListener('did-navigate-in-page', handleNavigate);

    return () => {
      webview.removeEventListener('did-start-loading', handleStartLoading);
      webview.removeEventListener('did-stop-loading', handleStopLoading);
      webview.removeEventListener('did-navigate', handleNavigate);
      webview.removeEventListener('did-navigate-in-page', handleNavigate);
    };
  }, []);

  // ============ 事件处理 ============

  const handleGoBack = () => webviewRef.current?.goBack();
  const handleGoForward = () => webviewRef.current?.goForward();
  const handleReload = () => webviewRef.current?.reload();
  const handleGoHome = () => {
    if (selectedCard && webviewRef.current) {
      webviewRef.current.loadURL(selectedCard.url);
    }
  };

  // 设为外部AI入口
  const externalAiUrl = useSettingsStore((state) => state.externalAiUrl);
  const setExternalAiUrl = useSettingsStore((state) => state.setExternalAiUrl);

  // 判断当前页面是否已设为外部AI入口
  const isCurrentAiEntry = currentUrl && externalAiUrl === currentUrl;

  const handleSetAsExternalAI = () => {
    if (currentUrl) {
      setExternalAiUrl(currentUrl);
      message.success('已设为外部 AI 入口');
    }
  };

  // ============ 主渲染 ============

  if (!selectedCard) {
    return (
      <div className="layout-panel editor-container browser-viewer-empty">
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="请从左侧选择一个网页" />
      </div>
    );
  }

  return (
    <div className="layout-panel editor-container browser-viewer">
      {/* 导航工具栏 */}
      <div className="browser-toolbar">
        <div className="browser-toolbar-nav">
          <Tooltip title="后退">
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              disabled={!canGoBack}
              onClick={handleGoBack}
            />
          </Tooltip>
          <Tooltip title="前进">
            <Button
              type="text"
              icon={<ArrowRightOutlined />}
              disabled={!canGoForward}
              onClick={handleGoForward}
            />
          </Tooltip>
          <Tooltip title="刷新">
            <Button type="text" icon={<ReloadOutlined />} onClick={handleReload} />
          </Tooltip>
          <Tooltip title="主页">
            <Button type="text" icon={<HomeOutlined />} onClick={handleGoHome} />
          </Tooltip>
        </div>
        <div className="browser-toolbar-url">
          {loading && <Spin size="small" style={{ marginRight: 8 }} />}
          <span className="browser-url-text">{currentUrl}</span>
        </div>
        <div className="browser-toolbar-actions">
          <Button
            type="text"
            icon={isCurrentAiEntry ? <PushpinFilled /> : <PushpinOutlined />}
            onClick={handleSetAsExternalAI}
            disabled={!currentUrl}
            className={isCurrentAiEntry ? 'browser-ai-btn--active' : ''}
          />
        </div>
      </div>

      {/* Webview 容器 */}
      <div className="browser-webview-container">
        <webview
          ref={webviewRef as React.RefObject<HTMLElement>}
          partition="persist:browser"
          className="browser-webview"
          // @ts-expect-error webview 属性 TypeScript 不识别
          autosize="on"
        />
      </div>
    </div>
  );
};

export default BrowserViewer;
