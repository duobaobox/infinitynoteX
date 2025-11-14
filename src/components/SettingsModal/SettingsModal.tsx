import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  Menu,
  Form,
  Input,
  Segmented,
  Divider,
  Button,
  Space,
  Typography,
  message,
  Progress,
  ColorPicker,
} from 'antd';
import { FolderOpenOutlined, CopyOutlined, SyncOutlined } from '@ant-design/icons';
import type { StorageStats } from '../../services/types';
import './SettingsModal.css';
import BackgroundEditor from '../BackgroundEditor';
import {
  getThemeColor,
  setThemeColor,
  getThemeMode,
  setThemeMode,
  getThemeBgLight,
  setThemeBgLight,
  getThemeBgDark,
  setThemeBgDark,
  ThemeMode,
} from '../../theme/theme';
import { useAutoUpdater } from '../../hooks/useAutoUpdater';

const { Text, Paragraph } = Typography;

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ open, onClose }) => {
  const getErrMsg = (e: unknown) =>
    e instanceof Error ? e.message : typeof e === 'string' ? e : '未知错误';
  const [selectedMenu, setSelectedMenu] = useState('general');
  const [currentPath, setCurrentPath] = useState<string>('');
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [migrating, setMigrating] = useState(false);
  const [primaryColor, setPrimaryColor] = useState<string>(getThemeColor());
  const [themeMode, setThemeModeState] = useState<ThemeMode>(getThemeMode());
  const [bgLight, setBgLight] = useState<string>(getThemeBgLight());
  const [bgDark, setBgDark] = useState<string>(getThemeBgDark());
  const [appVersion, setAppVersion] = useState<string>('0.0.0');

  const {
    status: updaterStatus,
    checking: updaterChecking,
    installing: updaterInstalling,
    supportsUpdater,
    checkForUpdates: triggerUpdateCheck,
    installUpdate: triggerInstallUpdate,
  } = useAutoUpdater();

  // 加载存储信息
  useEffect(() => {
    if (open) {
      if (selectedMenu === 'data') {
        loadStorageInfo();
      }
      if (selectedMenu === 'about') {
        loadAppInfo();
      }
    }
  }, [open, selectedMenu]);

  const loadStorageInfo = async () => {
    try {
      const path = await window.storage.getCurrentPath();
      const storageStats = await window.storage.getStats();
      setCurrentPath(path);
      setStats(storageStats);
    } catch (error) {
      console.error('Failed to load storage info:', error);
      message.error('加载存储信息失败');
    }
  };

  const loadAppInfo = async () => {
    try {
      const version = (await window.appInfo?.getVersion?.()) ?? '0.0.0';
      setAppVersion(version);
    } catch (error) {
      console.error('Failed to load app info:', error);
      setAppVersion('0.0.0');
    }
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

  const formatBytes = (value?: number) => {
    if (!value || Number.isNaN(value)) return '0 B';
    if (value < 1024) return `${value.toFixed(0)} B`;
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
    if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
    return `${(value / 1024 / 1024 / 1024).toFixed(1)} GB`;
  };

  const menuItems = [
    { key: 'appearance', label: '外观' },
    { key: 'data', label: '数据管理' },
    { key: 'about', label: '关于' },
  ];

  const renderSettingsPanel = () => {
    switch (selectedMenu) {
      case 'appearance':
        return (
          <div className="settings-panel">
            <h3>外观设置</h3>
            <Form layout="vertical">
              <Form.Item label="主题色">
                <Space align="center" size={16}>
                  <ColorPicker
                    value={primaryColor}
                    // 拖动过程中仅更新本地显示，不提交主题与提示，避免频繁触发
                    onChange={(c) => {
                      const hex = c.toHexString();
                      setPrimaryColor(hex);
                    }}
                    // 操作完成后再统一提交主题色，并用同一个 key 覆盖提示，避免堆叠
                    onChangeComplete={(c) => {
                      const hex = c.toHexString();
                      setPrimaryColor(hex);
                      setThemeColor(hex);
                      message.open({
                        type: 'success',
                        content: '主题色已更新',
                        key: 'theme-color-updated',
                        duration: 1.5,
                      });
                    }}
                    presets={[
                      {
                        label: '主题色',
                        colors: [
                          '#1677ff',
                          '#fa8c16',
                          '#722ed1',
                          '#13c2c2',
                          '#eb2f96',
                          '#52c41a',
                          '#fa541c',
                        ],
                      },
                    ]}
                  />
                  <Input
                    style={{ width: 120 }}
                    value={primaryColor}
                    onChange={(e) => {
                      const v = e.target.value.trim();
                      setPrimaryColor(v);
                    }}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(v)) {
                        setThemeColor(v);
                        message.open({
                          type: 'success',
                          content: '主题色已更新',
                          key: 'theme-color-updated',
                          duration: 1.5,
                        });
                      } else {
                        message.warning('请输入有效的十六进制颜色，如 #1677ff');
                        setPrimaryColor(getThemeColor());
                      }
                    }}
                    placeholder="#1677ff"
                  />
                </Space>
              </Form.Item>
              <Form.Item label="主题">
                <Segmented
                  options={[
                    { label: '亮色', value: 'light' },
                    { label: '暗色', value: 'dark' },
                    { label: '自动（跟随系统）', value: 'auto' },
                  ]}
                  value={themeMode}
                  onChange={(v) => {
                    const next = v as ThemeMode;
                    setThemeModeState(next);
                    setThemeMode(next);
                    message.success('主题模式已更新');
                  }}
                  block
                />
              </Form.Item>
              <Divider />
              <Form.Item label="背景">
                <BackgroundEditor
                  value={themeMode === 'dark' ? bgDark : bgLight}
                  onChange={(newBg: string) => {
                    if (themeMode === 'dark') {
                      setBgDark(newBg);
                      setThemeBgDark(newBg);
                    } else {
                      setBgLight(newBg);
                      setThemeBgLight(newBg);
                    }
                    message.open({
                      type: 'success',
                      content: '背景已更新',
                      key: 'theme-bg-updated',
                      duration: 1.5,
                    });
                  }}
                  mode={themeMode === 'dark' ? 'dark' : 'light'}
                />
              </Form.Item>
            </Form>
          </div>
        );
      case 'about':
        return (
          <div className="settings-panel about-panel">
            <div className="about-content">
              <div className="about-logo">
                <img
                  src={new URL('../../assets/logo.png', import.meta.url).href}
                  alt="InfinityNoteX"
                />
              </div>
              <h2>InfinityNoteX</h2>
              <p className="about-version">版本 {appVersion}</p>
              <p className="about-description">一款无限可能的笔记应用</p>
              <div className="about-update-card">
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  <div className="about-update-header">
                    <Text strong>自动更新</Text>
                    {updaterStatus?.version && updaterStatus.state !== 'downloaded' && (
                      <Text type="secondary">目标版本：{updaterStatus.version}</Text>
                    )}
                  </div>
                  <Text type="secondary" className="about-update-status">
                    {updaterStatusText}
                  </Text>
                  {renderDownloadProgress()}
                  {updaterStatus?.releaseNotes && updaterStatus.state === 'downloaded' && (
                    <Paragraph
                      className="about-update-notes"
                      ellipsis={{ rows: 3, expandable: true }}
                    >
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
                <Paragraph type="secondary" style={{ marginTop: 16 }}>
                  当前处于开发模式或无自动更新配置，如需体验热更新请使用打包版本。
                </Paragraph>
              )}
            </div>
          </div>
        );
      case 'data':
        return (
          <div className="settings-panel">
            <h3>数据管理</h3>
            <Form layout="vertical">
              <Form.Item label="当前存储路径">
                <Space.Compact style={{ width: '100%' }}>
                  <Input value={currentPath} readOnly />
                  <Button
                    icon={<CopyOutlined />}
                    onClick={() => {
                      navigator.clipboard.writeText(currentPath);
                      message.success('路径已复制到剪贴板');
                    }}
                  >
                    复制
                  </Button>
                  <Button
                    icon={<FolderOpenOutlined />}
                    onClick={async () => {
                      try {
                        await window.storage.openInFinder();
                      } catch (error) {
                        console.error('Failed to open folder:', error);
                        message.error('打开文件夹失败');
                      }
                    }}
                  >
                    打开
                  </Button>
                </Space.Compact>
              </Form.Item>

              <Divider />

              <Form.Item label="存储统计">
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  <Text>
                    文件夹数量: <strong>{stats?.folderCount || 0}</strong>
                  </Text>
                  <Text>
                    便签数量: <strong>{stats?.noteCount || 0}</strong>
                  </Text>
                  <Text>
                    数据占用:{' '}
                    <strong>{stats ? (stats.dataSize / 1024 / 1024).toFixed(2) : '0.00'} MB</strong>
                  </Text>
                </div>
              </Form.Item>

              <Divider />

              <Form.Item label="更改存储路径">
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                    选择新的数据存储位置。您可以选择是否迁移现有数据。
                  </Paragraph>
                  <Space>
                    <Button
                      icon={<SyncOutlined />}
                      onClick={async () => {
                        try {
                          if (!window.electronAPI?.showOpenDialog) {
                            message.error('当前环境不支持文件选择');
                            return;
                          }

                          const result = await window.electronAPI.showOpenDialog({
                            properties: ['openDirectory', 'createDirectory'],
                            title: '选择数据存储目录',
                          });

                          if (result.canceled || !result.filePaths.length) {
                            return;
                          }

                          const newPath = result.filePaths[0];
                          const confirmed = window.confirm(
                            `确定要将数据目录更改为:\n${newPath}\n\n是否迁移现有数据?`,
                          );

                          if (!confirmed) return;

                          setMigrating(true);
                          await window.storage.setStoragePath(newPath, {
                            migrate: true,
                          });
                          message.success('数据迁移成功');
                          await loadStorageInfo();
                        } catch (error: unknown) {
                          console.error('Failed to migrate data:', error);
                          message.error(`迁移失败: ${getErrMsg(error)}`);
                        } finally {
                          setMigrating(false);
                        }
                      }}
                      loading={migrating}
                    >
                      选择新路径并迁移
                    </Button>
                  </Space>
                  {migrating && <Progress percent={100} status="active" showInfo={false} />}
                </Space>
              </Form.Item>

              <Divider />

              <Form.Item label="备份与导出">
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                    创建数据备份或导出到指定位置
                  </Paragraph>
                  <Space>
                    <Button
                      onClick={async () => {
                        try {
                          const backupPath = await window.storage.createBackup();
                          message.success(`备份创建成功: ${backupPath}`);
                        } catch (error: unknown) {
                          console.error('Backup failed:', error);
                          message.error(`备份失败: ${getErrMsg(error)}`);
                        }
                      }}
                    >
                      创建备份
                    </Button>
                    <Button
                      onClick={async () => {
                        try {
                          if (!window.electronAPI?.showOpenDialog) {
                            message.error('当前环境不支持文件选择');
                            return;
                          }

                          const result = await window.electronAPI.showOpenDialog({
                            properties: ['openDirectory', 'createDirectory'],
                            title: '选择导出目录',
                          });

                          if (result.canceled || !result.filePaths.length) {
                            return;
                          }

                          const exportPath = result.filePaths[0];
                          await window.storage.exportData(exportPath);
                          message.success(`数据已导出到: ${exportPath}`);
                        } catch (error: unknown) {
                          console.error('Export failed:', error);
                          message.error(`导出失败: ${getErrMsg(error)}`);
                        }
                      }}
                    >
                      导出数据
                    </Button>
                  </Space>
                </Space>
              </Form.Item>

              <Divider />

              <Form.Item label="健康检查">
                <Button
                  onClick={async () => {
                    try {
                      const result = await window.storage.healthCheck();
                      if (result.ok) {
                        message.success('数据完整性检查通过');
                      } else {
                        message.error(`检查失败: ${result.details || '未知错误'}`);
                      }
                    } catch (error) {
                      console.error('Health check failed:', error);
                      message.error('健康检查失败');
                    }
                  }}
                >
                  运行健康检查
                </Button>
              </Form.Item>

              <Divider />

              <Form.Item label="重置数据">
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                    清空所有数据并重新初始化。警告：此操作不可撤销！
                  </Paragraph>
                  <Button
                    danger
                    onClick={async () => {
                      Modal.confirm({
                        title: '确认重置所有数据',
                        content:
                          '此操作将删除所有便签、文件夹等数据，并重新初始化存储。此操作不可撤销，是否继续？',
                        okText: '确认重置',
                        cancelText: '取消',
                        okButtonProps: { danger: true },
                        async onOk() {
                          try {
                            await window.storage.resetAllData();
                            message.success('数据重置成功');
                            await loadStorageInfo();
                          } catch (error: unknown) {
                            console.error('Failed to reset data:', error);
                            message.error(`重置失败: ${getErrMsg(error)}`);
                          }
                        },
                      });
                    }}
                  >
                    重置所有数据
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <Modal
      title="设置"
      open={open}
      onCancel={onClose}
      footer={null}
      centered
      width="80vw"
      className="settings-modal"
    >
      <div className="settings-container">
        <div className="settings-sidebar">
          <div className="flex-vertical-equal">
            <div className="scrollable-list">
              <Menu
                mode="inline"
                items={menuItems}
                selectedKeys={[selectedMenu]}
                onClick={(e) => setSelectedMenu(e.key)}
                className="settings-menu"
              />
            </div>
          </div>
        </div>
        <div className="settings-content">{renderSettingsPanel()}</div>
      </div>
    </Modal>
  );
};

export default SettingsModal;
