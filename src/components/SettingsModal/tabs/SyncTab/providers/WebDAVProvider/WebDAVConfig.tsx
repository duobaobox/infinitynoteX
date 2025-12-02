/**
 * WebDAV Provider配置UI组件
 */

import React from 'react';
import { Form, Input, Button, Card, Select, Switch, Space, message } from 'antd';
import type { SyncProviderConfigProps } from '../types';
import type { WebDAVConfig } from './schema';

const WebDAVConfigComponent: React.FC<SyncProviderConfigProps<WebDAVConfig>> = ({
  config,
  onConfigChange,
  onTest,
  onSync,
}) => {
  const [testing, setTesting] = React.useState(false);
  const [syncing, setSyncing] = React.useState(false);

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
    try {
      await onSync();
      message.success('同步完成');
    } catch (error) {
      message.error(`同步失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setSyncing(false);
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
      syncInterval: 0,
      conflictStrategy: 'ask',
    };

    onConfigChange({
      ...defaultConfig, // 先应用默认值
      ...(config || {}), // 再应用当前配置（如果有）
      ...partial, // 最后应用新的变更
    });
  };

  return (
    <>
      <Card className="sync-card" size="small" title="WebDAV 配置">
        <Form layout="vertical">
          <Form.Item label="服务器地址" required>
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

          <Form.Item label="密码" required>
            <Input.Password
              value={config?.password || ''}
              onChange={(e) => updateConfig({ password: e.target.value })}
            />
          </Form.Item>

          <Form.Item label="远程路径">
            <Input
              placeholder="/InfinityNoteX"
              value={config?.remotePath || '/InfinityNoteX'}
              onChange={(e) => updateConfig({ remotePath: e.target.value })}
            />
          </Form.Item>

          <Form.Item label="自动同步间隔">
            <Select
              value={config?.syncInterval ?? 0}
              onChange={(val) => updateConfig({ syncInterval: val })}
              options={[
                { label: '仅手动同步', value: 0 },
                { label: '每15分钟', value: 15 },
                { label: '每30分钟', value: 30 },
                { label: '每60分钟', value: 60 },
              ]}
            />
          </Form.Item>

          <Form.Item label="冲突策略">
            <Select
              value={config?.conflictStrategy || 'ask'}
              onChange={(val) =>
                updateConfig({ conflictStrategy: val as WebDAVConfig['conflictStrategy'] })
              }
              options={[
                { label: '保留本地版本', value: 'local' },
                { label: '使用远程版本', value: 'remote' },
                { label: '每次询问我', value: 'ask' },
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

        <Space>
          <Button onClick={handleTest} loading={testing}>
            测试连接
          </Button>
          <Button type="primary" onClick={handleSync} loading={syncing} disabled={!config?.enabled}>
            立即同步
          </Button>
        </Space>
      </Card>
    </>
  );
};

export default WebDAVConfigComponent;
