import React, { useState, useEffect } from 'react';
import {
  Modal,
  Menu,
  Form,
  Input,
  Switch,
  Segmented,
  Select,
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
import {
  getThemeColor,
  setThemeColor,
  getThemeMode,
  setThemeMode,
  ThemeMode,
} from '../../theme/theme';

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

  // 加载存储信息
  useEffect(() => {
    if (open && selectedMenu === 'data') {
      loadStorageInfo();
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

  const menuItems = [
    { key: 'general', label: '常规' },
    { key: 'appearance', label: '外观' },
    { key: 'shortcuts', label: '快捷键' },
    { key: 'data', label: '数据管理' },
    { key: 'about', label: '关于' },
  ];

  const renderSettingsPanel = () => {
    switch (selectedMenu) {
      case 'general':
        return (
          <div className="settings-panel">
            <h3>常规设置</h3>
            <Form layout="vertical">
              <Form.Item label="应用标题">
                <Input placeholder="输入应用标题" />
              </Form.Item>
              <Form.Item label="自动保存">
                <Switch />
              </Form.Item>
              <Form.Item label="自动保存间隔（秒）">
                <Input type="number" defaultValue={30} />
              </Form.Item>
              <Form.Item label="启动时恢复最后打开的文件">
                <Switch defaultChecked />
              </Form.Item>
            </Form>
          </div>
        );
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
                        label: '品牌色',
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
              <Form.Item label="字体大小">
                <Select
                  options={[
                    { label: '小', value: 'small' },
                    { label: '中', value: 'medium' },
                    { label: '大', value: 'large' },
                  ]}
                  defaultValue="medium"
                />
              </Form.Item>
              <Form.Item label="字体族">
                <Input placeholder="输入字体名称" defaultValue="Segoe UI" />
              </Form.Item>
            </Form>
          </div>
        );

      case 'shortcuts':
        return (
          <div className="settings-panel">
            <h3>快捷键设置</h3>
            <Form layout="vertical">
              <Form.Item label="新建笔记">
                <Input placeholder="输入快捷键组合" defaultValue="Ctrl+N" />
              </Form.Item>
              <Form.Item label="保存">
                <Input placeholder="输入快捷键组合" defaultValue="Ctrl+S" />
              </Form.Item>
              <Form.Item label="搜索">
                <Input placeholder="输入快捷键组合" defaultValue="Ctrl+F" />
              </Form.Item>
            </Form>
          </div>
        );
      case 'about':
        return (
          <div className="settings-panel">
            <h3>关于</h3>
            <div className="about-content">
              <p>
                <strong>应用名称：</strong> InfinityNoteX
              </p>
              <p>
                <strong>版本：</strong> 0.0.0
              </p>
              <Divider />
              <p>
                <strong>构建信息：</strong>
              </p>
              <p>一款无限可能的笔记应用</p>
              <Divider />
              <p>
                <strong>许可证：</strong> MIT
              </p>
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
