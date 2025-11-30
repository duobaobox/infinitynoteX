/**
 * DataTab - 数据管理 Tab 组件
 */

import React, { useEffect } from 'react';
import { Form, Input, Button, Space, Typography, Divider, Progress, Modal, message } from 'antd';
import { FolderOpenOutlined, CopyOutlined, SyncOutlined } from '@ant-design/icons';
import { useSettingsStore } from '../../../../store/settingsStore';
import './DataTab.css';

const { Text, Paragraph } = Typography;

const getErrMsg = (e: unknown) =>
  e instanceof Error ? e.message : typeof e === 'string' ? e : '未知错误';

const DataTab: React.FC = () => {
  const { currentPath, stats, migrating, setMigrating, loadStorageInfo } = useSettingsStore();

  // 初始加载
  useEffect(() => {
    loadStorageInfo();
  }, [loadStorageInfo]);

  return (
    <div className="settings-panel data-tab">
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
};

export default DataTab;
