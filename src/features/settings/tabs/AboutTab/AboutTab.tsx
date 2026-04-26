/**
 * AboutTab - 关于 Tab 组件
 */

import React, { useMemo, useEffect, useState, useRef, useCallback } from 'react';
import { Space, Typography, Button, Progress, Modal, message, Select, Input, Tooltip } from 'antd';
import { ReloadOutlined, CopyOutlined, DeleteOutlined } from '@ant-design/icons';
import { useSettingsStore } from '../../../../store/settingsStore';
import { useAutoUpdater } from '../../../../hooks/useAutoUpdater';
import { PROJECT_LINKS } from '../../../../shared/constants/projectLinks';
import logo from '../../../../assets/logo.svg';
import './AboutTab.css';

const { Text, Paragraph } = Typography;
const { Search } = Input;

type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'all';

const formatBytes = (value?: number) => {
  if (!value || Number.isNaN(value)) return '0 B';
  if (value < 1024) return `${value.toFixed(0)} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  return `${(value / 1024 / 1024 / 1024).toFixed(1)} GB`;
};

const AboutTab: React.FC = () => {
  const { appVersion, loadAppInfo } = useSettingsStore();
  const [logModalVisible, setLogModalVisible] = useState(false);
  const [logContent, setLogContent] = useState('');
  const [logPath, setLogPath] = useState('');
  const [logLevel, setLogLevel] = useState<LogLevel>('all');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [logStats, setLogStats] = useState<{
    totalSize: number;
    fileCount: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const clickCountRef = useRef(0);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // 双击 Logo 打开日志
  const handleLogoClick = () => {
    clickCountRef.current += 1;

    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
    }

    if (clickCountRef.current >= 2) {
      // 双击触发
      clickCountRef.current = 0;
      openLogViewer();
    } else {
      // 单击后 300ms 重置计数
      clickTimerRef.current = setTimeout(() => {
        clickCountRef.current = 0;
      }, 300);
    }
  };

  // 加载日志内容
  const loadLogs = useCallback(
    async (level: LogLevel = logLevel, keyword: string = searchKeyword) => {
      setLoading(true);
      try {
        let content: string | undefined;

        if (keyword.trim()) {
          // 有搜索关键字时使用搜索
          content = await window.log?.search(keyword, 500);
        } else if (level !== 'all') {
          // 有级别筛选时使用级别筛选
          content = await window.log?.readByLevel(level, 500);
        } else {
          // 默认读取最近日志
          content = await window.log?.readRecent(500);
        }

        setLogContent(content || '暂无日志');

        // 获取统计信息
        const stats = await window.log?.getStats();
        if (stats) {
          setLogStats({ totalSize: stats.totalSize, fileCount: stats.fileCount });
        }
      } catch (error) {
        message.error('无法读取日志');
      } finally {
        setLoading(false);
      }
    },
    [logLevel, searchKeyword],
  );

  const openLogViewer = async () => {
    try {
      setLoading(true);
      const path = await window.log?.getPath();
      setLogPath(path || '');
      setLogLevel('all');
      setSearchKeyword('');
      await loadLogs('all', '');
      setLogModalVisible(true);
    } catch (error) {
      message.error('无法读取日志');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenLogDir = async () => {
    try {
      await window.log?.openDir();
    } catch (error) {
      message.error('无法打开日志目录');
    }
  };

  const handleCopyLogs = async () => {
    try {
      await navigator.clipboard.writeText(logContent);
      message.success('日志已复制到剪贴板');
    } catch {
      message.error('复制失败');
    }
  };

  const handleCleanOldLogs = async () => {
    try {
      const count = await window.log?.cleanOld();
      if (count && count > 0) {
        message.success(`已清理 ${count} 个过期日志文件`);
        await loadLogs();
      } else {
        message.info('没有需要清理的过期日志');
      }
    } catch {
      message.error('清理失败');
    }
  };

  const handleLevelChange = (level: LogLevel) => {
    setLogLevel(level);
    loadLogs(level, searchKeyword);
  };

  const handleSearch = (keyword: string) => {
    setSearchKeyword(keyword);
    loadLogs(logLevel, keyword);
  };

  const updaterStatusText = useMemo(() => {
    const state = updaterStatus?.state;
    if (!supportsUpdater) {
      return '当前环境不支持自动更新（可能是开发模式）';
    }
    switch (state) {
      case 'checking':
        return '正在检查更新…';
      case 'available':
        if (updaterStatus?.canInstallAutomatically === false) {
          return updaterStatus.message ?? '发现新版本，请前往发布页手动下载最新版';
        }
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

  const openReleasePage = useCallback(() => {
    window.open(updaterStatus?.manualDownloadUrl ?? PROJECT_LINKS.releases, '_blank');
  }, [updaterStatus?.manualDownloadUrl]);

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
        {/* Logo - 双击打开日志 */}
        <div className="about-logo" onClick={handleLogoClick} style={{ cursor: 'pointer' }}>
          <img src={logo} alt="InfinityNoteX" />
        </div>

        {/* 标题和版本 */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <h2>InfinityNoteX</h2>
          <div
            style={{
              fontSize: '16px',
              color: 'var(--text-secondary)',
              marginTop: '4px',
              marginBottom: '8px',
              fontWeight: 500,
            }}
          >
            无限便签X
          </div>
          <p className="about-version" style={{ margin: '0 !important' }}>
            版本 {appVersion} · 一款无限可能的便签应用
          </p>
        </div>

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
              {updaterStatus?.state === 'error' && (
                <Button size="small" type="link" onClick={openReleasePage}>
                  手动下载最新版
                </Button>
              )}
              {updaterStatus?.state === 'available' &&
                updaterStatus.canInstallAutomatically === false && (
                  <Button size="small" type="link" onClick={openReleasePage}>
                    打开发布页下载
                  </Button>
                )}
              {updaterStatus?.state === 'downloaded' &&
                updaterStatus.canInstallAutomatically !== false && (
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
          {[
            {
              label: '开源仓库',
              url: PROJECT_LINKS.repository,
            },
            { label: '发布下载', url: PROJECT_LINKS.releases },
            { label: '提交问题', url: PROJECT_LINKS.issues },
            { label: '参与讨论', url: PROJECT_LINKS.discussions },
          ].map((item) => (
            <div
              key={item.label}
              className="about-link-item"
              onClick={async () => {
                if (typeof window !== 'undefined') {
                  window.open(item.url, '_blank');
                  try {
                    await navigator.clipboard.writeText(item.url);
                    message.success('链接已复制，可直接在浏览器粘贴');
                  } catch {
                    // 忽略复制失败
                  }
                }
              }}
              role="button"
              tabIndex={0}
            >
              <span>{item.label}</span>
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
          ))}
        </div>

        {/* 底部版权 */}
        <div className="about-footer">
          <p>© 2026 InfinityNoteX Contributors.</p>
        </div>
      </div>

      {/* 日志查看弹窗 */}
      <Modal
        title="应用日志"
        open={logModalVisible}
        onCancel={() => setLogModalVisible(false)}
        width={900}
        footer={[
          <Button key="clean" icon={<DeleteOutlined />} onClick={handleCleanOldLogs}>
            清理过期日志
          </Button>,
          <Button key="open" onClick={handleOpenLogDir}>
            打开日志目录
          </Button>,
          <Button key="close" type="primary" onClick={() => setLogModalVisible(false)}>
            关闭
          </Button>,
        ]}
      >
        {/* 工具栏 */}
        <div style={{ marginBottom: 12, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Select
            value={logLevel}
            onChange={handleLevelChange}
            style={{ width: 120 }}
            options={[
              { value: 'all', label: '全部级别' },
              { value: 'error', label: '❌ Error' },
              { value: 'warn', label: '⚠️ Warn' },
              { value: 'info', label: 'ℹ️ Info' },
              { value: 'debug', label: '🔍 Debug' },
            ]}
          />
          <Search
            placeholder="搜索日志内容..."
            allowClear
            onSearch={handleSearch}
            style={{ width: 250 }}
          />
          <Tooltip title="刷新">
            <Button icon={<ReloadOutlined />} onClick={() => loadLogs()} loading={loading} />
          </Tooltip>
          <Tooltip title="复制全部">
            <Button icon={<CopyOutlined />} onClick={handleCopyLogs} />
          </Tooltip>
          {logStats && (
            <Text type="secondary" style={{ lineHeight: '32px', marginLeft: 'auto' }}>
              {logStats.fileCount} 个文件 · {formatBytes(logStats.totalSize)}
            </Text>
          )}
        </div>

        {/* 日志路径 */}
        <div style={{ marginBottom: 8 }}>
          <Text type="secondary" copyable={{ text: logPath }}>
            日志路径: {logPath}
          </Text>
        </div>

        {/* 日志内容 */}
        <pre
          style={{
            maxHeight: 450,
            overflow: 'auto',
            backgroundColor: '#1a1a1a',
            color: '#e0e0e0',
            padding: 12,
            borderRadius: 6,
            fontSize: 11,
            fontFamily: 'Consolas, Monaco, monospace',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
          }}
        >
          {loading ? '加载中...' : logContent}
        </pre>
      </Modal>
    </div>
  );
};

export default AboutTab;
