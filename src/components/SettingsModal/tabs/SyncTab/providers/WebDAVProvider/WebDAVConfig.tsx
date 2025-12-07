/**
 * WebDAV Provider配置UI组件
 */

import React, { useEffect } from 'react';
import {
  Form,
  Input,
  Button,
  Card,
  Select,
  Switch,
  Space,
  message,
  Progress,
  Typography,
  Alert,
} from 'antd';
import { SyncOutlined, CloudUploadOutlined, CloudDownloadOutlined } from '@ant-design/icons';
import type { SyncProviderConfigProps } from '../types';
import type { WebDAVConfig } from './schema';

const { Text } = Typography;

// 同步进度类型
interface SyncProgress {
  stage: string;
  percent: number;
  currentFile?: string;
  processed: number;
  total: number;
  message: string;
}

const WebDAVConfigComponent: React.FC<SyncProviderConfigProps<WebDAVConfig>> = ({
  config,
  onConfigChange,
  onTest,
  onSync,
}) => {
  const [testing, setTesting] = React.useState(false);
  const [syncing, setSyncing] = React.useState(false);
  const [progress, setProgress] = React.useState<SyncProgress | null>(null);
  const [preview, setPreview] = React.useState<{
    toUpload: string[];
    toDownload: string[];
    unchanged: number;
  } | null>(null);
  const [loadingPreview, setLoadingPreview] = React.useState(false);

  // 监听同步进度
  useEffect(() => {
    const unsubProgress = window.sync.onProgress((p: SyncProgress) => {
      setProgress(p);
    });

    const unsubCompleted = window.sync.onCompleted(() => {
      setSyncing(false);
      setProgress(null);
      setPreview(null);
    });

    return () => {
      unsubProgress();
      unsubCompleted();
    };
  }, []);

  const handleTest = async () => {
    setTesting(true);
    try {
      const result = await onTest();
      if (result.ok) {
        message.success(result.message);
      } else {
        message.error(result.message);
      }
    } finally {
      setTesting(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setProgress({
      stage: 'connecting',
      percent: 0,
      processed: 0,
      total: 0,
      message: '正在连接...',
    });
    try {
      await onSync();
      message.success('同步完成');
    } catch (error) {
      message.error(`同步失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setSyncing(false);
      setProgress(null);
    }
  };

  const handlePreview = async () => {
    if (!config?.url || !config?.username || !config?.password) {
      message.warning('请先填写完整的连接信息');
      return;
    }

    setLoadingPreview(true);
    try {
      const result = await window.sync.preview('webdav', config);
      setPreview({
        toUpload: result.toUpload,
        toDownload: result.toDownload,
        unchanged: result.unchanged,
      });
    } catch (error) {
      message.error(`预览失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setLoadingPreview(false);
    }
  };

  const updateConfig = (partial: Partial<WebDAVConfig>) => {
    // 默认配置
    const defaultConfig: WebDAVConfig = {
      enabled: false,
      url: '',
      username: '',
      password: '',
      remotePath: '/InfinityNoteX',
      conflictStrategy: 'newest',
    };

    onConfigChange({
      ...defaultConfig,
      ...(config || {}),
      ...partial,
    });
  };

  const getStageText = (stage: string) => {
    const stageMap: Record<string, string> = {
      connecting: '连接中',
      scanning: '扫描文件',
      comparing: '比较差异',
      uploading: '上传中',
      downloading: '下载中',
      finalizing: '完成中',
      done: '已完成',
      error: '发生错误',
    };
    return stageMap[stage] || stage;
  };

  return (
    <>
      <Card className="sync-card" size="small" title="WebDAV 配置">
        <Form layout="vertical">
          <Form.Item label="服务器地址" required tooltip="例如: https://dav.jianguoyun.com/dav">
            <Input
              placeholder="https://dav.example.com"
              value={config?.url || ''}
              onChange={(e) => updateConfig({ url: e.target.value })}
            />
          </Form.Item>

          <Form.Item label="用户名" required>
            <Input
              value={config?.username || ''}
              onChange={(e) => updateConfig({ username: e.target.value })}
            />
          </Form.Item>

          <Form.Item label="密码" required tooltip="坚果云需要使用应用密码">
            <Input.Password
              value={config?.password || ''}
              onChange={(e) => updateConfig({ password: e.target.value })}
            />
          </Form.Item>

          <Form.Item label="远程路径" tooltip="数据存储在服务器上的目录">
            <Input
              placeholder="/InfinityNoteX"
              value={config?.remotePath || '/InfinityNoteX'}
              onChange={(e) => updateConfig({ remotePath: e.target.value })}
            />
          </Form.Item>

          <Form.Item label="冲突策略" tooltip="当同一文件在多设备上被修改时的处理方式">
            <Select
              value={config?.conflictStrategy || 'newest'}
              onChange={(val) =>
                updateConfig({ conflictStrategy: val as WebDAVConfig['conflictStrategy'] })
              }
              options={[
                { label: '保留最新修改（推荐）', value: 'newest' },
                { label: '始终保留本地版本', value: 'local' },
                { label: '始终使用远程版本', value: 'remote' },
              ]}
            />
          </Form.Item>

          <Form.Item label="启用同步">
            <Switch
              checked={config?.enabled ?? false}
              onChange={(val) => updateConfig({ enabled: val })}
            />
          </Form.Item>
        </Form>

        <Space direction="vertical" style={{ width: '100%' }}>
          <Space>
            <Button onClick={handleTest} loading={testing}>
              测试连接
            </Button>
            <Button onClick={handlePreview} loading={loadingPreview} disabled={!config?.enabled}>
              预览差异
            </Button>
            <Button
              type="primary"
              icon={<SyncOutlined spin={syncing} />}
              onClick={handleSync}
              loading={syncing}
              disabled={!config?.enabled}
            >
              立即同步
            </Button>
          </Space>

          {/* 同步进度 */}
          {syncing && progress && (
            <Card size="small" style={{ marginTop: 12 }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Text>
                  {getStageText(progress.stage)}: {progress.message}
                </Text>
                <Progress
                  percent={progress.percent}
                  status={progress.stage === 'error' ? 'exception' : 'active'}
                  size="small"
                />
                {progress.currentFile && (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    当前: {progress.currentFile}
                  </Text>
                )}
                {progress.total > 0 && (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    进度: {progress.processed}/{progress.total}
                  </Text>
                )}
              </Space>
            </Card>
          )}

          {/* 预览结果 */}
          {preview && !syncing && (
            <Card size="small" style={{ marginTop: 12 }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Text strong>同步预览</Text>
                <Space>
                  <CloudUploadOutlined style={{ color: '#1890ff' }} />
                  <Text>待上传: {preview.toUpload.length} 个文件</Text>
                </Space>
                <Space>
                  <CloudDownloadOutlined style={{ color: '#52c41a' }} />
                  <Text>待下载: {preview.toDownload.length} 个文件</Text>
                </Space>
                <Text type="secondary">无变化: {preview.unchanged} 个文件</Text>

                {preview.toUpload.length === 0 && preview.toDownload.length === 0 && (
                  <Alert title="所有文件已同步，无需操作" type="success" showIcon />
                )}
              </Space>
            </Card>
          )}
        </Space>
      </Card>

      <Alert
        style={{ marginTop: 12 }}
        title="同步范围"
        description="当前仅同步便签数据（文件夹和笔记），AI 对话暂不同步。"
        type="info"
        showIcon
      />
    </>
  );
};

export default WebDAVConfigComponent;
