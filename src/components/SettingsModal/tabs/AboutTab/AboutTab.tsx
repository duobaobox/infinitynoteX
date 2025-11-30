/**
 * AboutTab - 关于 Tab 组件
 */

import React, { useMemo, useEffect } from 'react';
import { Space, Typography, Button, Progress } from 'antd';
import { useSettingsStore } from '../../../../store/settingsStore';
import { useAutoUpdater } from '../../../../hooks/useAutoUpdater';
import './AboutTab.css';

const { Text, Paragraph } = Typography;

const formatBytes = (value?: number) => {
  if (!value || Number.isNaN(value)) return '0 B';
  if (value < 1024) return `${value.toFixed(0)} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  return `${(value / 1024 / 1024 / 1024).toFixed(1)} GB`;
};

const AboutTab: React.FC = () => {
  const { appVersion, loadAppInfo } = useSettingsStore();

  const {
    status: updaterStatus,
    checking: updaterChecking,
    installing: updaterInstalling,
    supportsUpdater,
    checkForUpdates: triggerUpdateCheck,
    installUpdate: triggerInstallUpdate,
  } = useAutoUpdater();

  // 初始加载
  useEffect(() => {
    loadAppInfo();
  }, [loadAppInfo]);

  const updaterStatusText = useMemo(() => {
    const state = updaterStatus?.state;
    if (!supportsUpdater) {
      return '当前环境不支持自动更新（可能是开发模式）';
    }
    switch (state) {
      case 'checking':
        return '正在检查更新…';
      case 'available':
        return `发现新版本${updaterStatus?.version ? ` ${updaterStatus.version}` : ''}，正在准备下载`;
      case 'downloading':
        return `正在下载更新${updaterStatus?.percent ? ` (${updaterStatus.percent.toFixed(1)}%)` : ''}`;
      case 'downloaded':
        return `更新包已就绪${updaterStatus?.version ? ` (${updaterStatus.version})` : ''}`;
      case 'error':
        return `自动更新出现问题：${updaterStatus?.errorMessage ?? '请稍后重试'}`;
      case 'disabled':
        return '自动更新已禁用（开发模式）';
      default:
        return '已是最新版本';
    }
  }, [supportsUpdater, updaterStatus]);

  const renderDownloadProgress = () => {
    if (updaterStatus?.state !== 'downloading') return null;
    return (
      <div className="about-update-progress">
        <Progress
          percent={updaterStatus.percent ?? 0}
          showInfo={false}
          size="small"
          status="active"
        />
        {(updaterStatus.transferredBytes || updaterStatus.totalBytes) && (
          <Text type="secondary">
            {formatBytes(updaterStatus.transferredBytes)} / {formatBytes(updaterStatus.totalBytes)}
          </Text>
        )}
      </div>
    );
  };

  return (
    <div className="settings-panel about-panel">
      <div className="about-content">
        {/* Logo */}
        <div className="about-logo">
          <img
            src={new URL('../../../../assets/logo.png', import.meta.url).href}
            alt="InfinityNoteX"
          />
        </div>

        {/* 标题和版本 */}
        <h2>InfinityNoteX</h2>
        <p className="about-version">版本 {appVersion} · 一款无限可能的笔记应用</p>

        {/* 更新检查卡片 */}
        <div className="about-update-card">
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <div className="about-update-header">
              <Text strong>检查更新</Text>
              {updaterStatus?.version && updaterStatus.state !== 'downloaded' && (
                <Text type="secondary">目标版本：{updaterStatus.version}</Text>
              )}
            </div>
            <Text type="secondary" className="about-update-status">
              {updaterStatusText}
            </Text>
            {renderDownloadProgress()}
            {updaterStatus?.releaseNotes && updaterStatus.state === 'downloaded' && (
              <Paragraph className="about-update-notes" ellipsis={{ rows: 3, expandable: true }}>
                {updaterStatus.releaseNotes}
              </Paragraph>
            )}
            <Space className="about-update-actions" wrap>
              <Button
                size="small"
                onClick={triggerUpdateCheck}
                loading={updaterChecking}
                disabled={!supportsUpdater}
              >
                检查更新
              </Button>
              {updaterStatus?.state === 'downloaded' && (
                <Button
                  type="primary"
                  size="small"
                  loading={updaterInstalling}
                  onClick={triggerInstallUpdate}
                >
                  立即重启更新
                </Button>
              )}
            </Space>
          </Space>
        </div>

        {!supportsUpdater && (
          <Paragraph type="secondary" style={{ marginTop: 12, maxWidth: 500 }}>
            自动更新已禁用（开发模式）
          </Paragraph>
        )}

        {/* 链接列表 */}
        <div className="about-link-list">
          <div
            className="about-link-item"
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.open('https://infinitynotex.com', '_blank');
              }
            }}
            role="button"
            tabIndex={0}
          >
            <span>官方网站</span>
            <svg
              className="anticon"
              viewBox="64 64 896 896"
              width="1em"
              height="1em"
              fill="currentColor"
            >
              <path d="M765.7 486.8L314.9 134.7A7.97 7.97 0 00302 141v77.3c0 4.9 2.3 9.6 6.1 12.6l360 281.1-360 281.1c-3.9 3-6.1 7.7-6.1 12.6V883c0 6.7 7.7 10.8 12.3 6.4l450.8-352.1a31.96 31.96 0 000-50.4z" />
            </svg>
          </div>
          <div
            className="about-link-item"
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.open('https://infinitynotex.com/support', '_blank');
              }
            }}
            role="button"
            tabIndex={0}
          >
            <span>帮助与支持</span>
            <svg
              className="anticon"
              viewBox="64 64 896 896"
              width="1em"
              height="1em"
              fill="currentColor"
            >
              <path d="M765.7 486.8L314.9 134.7A7.97 7.97 0 00302 141v77.3c0 4.9 2.3 9.6 6.1 12.6l360 281.1-360 281.1c-3.9 3-6.1 7.7-6.1 12.6V883c0 6.7 7.7 10.8 12.3 6.4l450.8-352.1a31.96 31.96 0 000-50.4z" />
            </svg>
          </div>
          <div
            className="about-link-item"
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.open('https://infinitynotex.com/privacy', '_blank');
              }
            }}
            role="button"
            tabIndex={0}
          >
            <span>隐私政策</span>
            <svg
              className="anticon"
              viewBox="64 64 896 896"
              width="1em"
              height="1em"
              fill="currentColor"
            >
              <path d="M765.7 486.8L314.9 134.7A7.97 7.97 0 00302 141v77.3c0 4.9 2.3 9.6 6.1 12.6l360 281.1-360 281.1c-3.9 3-6.1 7.7-6.1 12.6V883c0 6.7 7.7 10.8 12.3 6.4l450.8-352.1a31.96 31.96 0 000-50.4z" />
            </svg>
          </div>
        </div>

        {/* 底部版权 */}
        <div className="about-footer">
          <p>© 2025 InfinityNoteX. 保留所有权利。</p>
        </div>
      </div>
    </div>
  );
};

export default AboutTab;
