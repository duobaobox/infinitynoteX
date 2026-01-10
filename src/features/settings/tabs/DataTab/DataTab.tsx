/**
 * DataTab - 数据管理 Tab 组件
 */

import React, { useEffect } from 'react';
import { Form, Input, Button, Space, Typography, Divider, Progress, message, Modal } from 'antd';
import {
  FolderOpenOutlined,
  CopyOutlined,
  CloudUploadOutlined,
  CloudDownloadOutlined,
} from '@ant-design/icons';
import { useSettingsStore } from '../../../../store/settingsStore';
import './DataTab.css';

const { Text, Paragraph } = Typography;

const getErrMsg = (e: unknown) =>
  e instanceof Error ? e.message : typeof e === 'string' ? e : '未知错误';

interface DataTabProps {
  /** @deprecated 不再使用，保留兼容性 */
  isVisible?: boolean;
}

const DataTab: React.FC<DataTabProps> = () => {
  const { currentPath, stats, migrating, setMigrating, loadStorageInfo } = useSettingsStore();

  // 监听弹窗打开触发器
  const settingsModalOpenTrigger = useSettingsStore((state) => state.settingsModalOpenTrigger);

  // 弹窗打开时刷新数据
  useEffect(() => {
    if (settingsModalOpenTrigger > 0) {
      loadStorageInfo();
    }
  }, [settingsModalOpenTrigger, loadStorageInfo]);

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

        <Form.Item label="备份与还原">
          <Space direction="vertical" style={{ width: '100%' }}>
            <Paragraph type="secondary" style={{ marginBottom: 0 }}>
              创建数据备份或从备份文件还原数据。备份文件保存在数据目录的 backups 文件夹中。
            </Paragraph>
            <Space>
              <Button
                icon={<CloudUploadOutlined />}
                onClick={async () => {
                  try {
                    const backupPath = await window.storage.createBackup();
                    const fileName = backupPath.split('/').pop() || backupPath;
                    message.success({
                      content: `备份创建成功：${fileName}`,
                      duration: 3,
                    });
                  } catch (error: unknown) {
                    console.error('Backup failed:', error);
                    message.error(`备份失败: ${getErrMsg(error)}`);
                  }
                }}
              >
                创建备份
              </Button>
              <Button
                icon={<CloudDownloadOutlined />}
                onClick={async () => {
                  try {
                    if (!window.electronAPI?.showOpenDialog) {
                      message.error('当前环境不支持文件选择');
                      return;
                    }

                    const result = await window.electronAPI.showOpenDialog({
                      properties: ['openFile'],
                      title: '选择备份文件',
                      defaultPath: currentPath,
                      filters: [{ name: '备份文件', extensions: ['zip'] }],
                    });

                    if (result.canceled || !result.filePaths.length) {
                      return;
                    }

                    const backupFile = result.filePaths[0];
                    const fileName = backupFile.split('/').pop() || backupFile;

                    Modal.confirm({
                      title: '确认还原数据',
                      content: (
                        <div>
                          <p>确定要从以下备份文件还原数据吗？</p>
                          <p style={{ fontSize: 12, color: '#666', wordBreak: 'break-all' }}>
                            {fileName}
                          </p>
                          <p style={{ color: '#ff4d4f', marginTop: 12 }}>
                            ⚠️ 这将覆盖现有数据，系统会自动创建还原前的备份。
                          </p>
                        </div>
                      ),
                      okText: '确认还原',
                      okType: 'danger',
                      cancelText: '取消',
                      onOk: async () => {
                        try {
                          setMigrating(true);
                          await window.storage.restoreBackup(backupFile);
                          message.success('数据还原成功，正在刷新应用...', 2);
                          // 通过主进程刷新窗口
                          setTimeout(() => {
                            window.electronAPI?.reload?.();
                          }, 1500);
                        } catch (error: unknown) {
                          console.error('Restore failed:', error);
                          message.error(`还原失败: ${getErrMsg(error)}`);
                          setMigrating(false);
                        }
                      },
                    });
                  } catch (error: unknown) {
                    console.error('File selection failed:', error);
                    message.error(`文件选择失败: ${getErrMsg(error)}`);
                  }
                }}
                loading={migrating}
              >
                从备份还原
              </Button>
            </Space>
            {migrating && <Progress percent={100} status="active" showInfo={false} />}
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
      </Form>
    </div>
  );
};

export default DataTab;
