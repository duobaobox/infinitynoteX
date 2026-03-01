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
  Divider,
  Collapse,
} from 'antd';
import {
  SyncOutlined,
  CloudUploadOutlined,
  CloudDownloadOutlined,
  DeleteOutlined,
  WarningOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import type { SyncProviderConfigProps } from '../types';
import type { WebDAVConfig } from './schema';
import type { SyncProgress, SyncResult, SyncPreview } from '../../../../../../shared/types/sync';

const { Text } = Typography;

const formatDuration = (ms?: number) => {
  if (!ms || ms < 0) return '';
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
};

const renderPathList = (title: string, paths: string[], max = 10) => {
  if (!paths || paths.length === 0) return null;
  const shown = paths.slice(0, max);
  const remaining = paths.length - shown.length;
  return (
    <div style={{ width: '100%' }}>
      <Text strong>{title}</Text>
      <div style={{ marginTop: 6 }}>
        {shown.map((p) => (
          <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Text type="secondary" style={{ fontSize: 12 }} ellipsis={{ tooltip: p }}>
              {p}
            </Text>
          </div>
        ))}
        {remaining > 0 && (
          <Text type="secondary" style={{ fontSize: 12 }}>
            还有 {remaining} 个未展开
          </Text>
        )}
      </div>
    </div>
  );
};

const WebDAVConfigComponent: React.FC<SyncProviderConfigProps<WebDAVConfig>> = ({
  config,
  onConfigChange,
  onTest,
  onSync,
}) => {
  const [testing, setTesting] = React.useState(false);
  const [syncing, setSyncing] = React.useState(false);
  const [progress, setProgress] = React.useState<SyncProgress | null>(null);
  const [preview, setPreview] = React.useState<SyncPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = React.useState(false);
  const [lastResult, setLastResult] = React.useState<SyncResult | null>(null);
  const [openingLogs, setOpeningLogs] = React.useState(false);
  const [connectionState, setConnectionState] = React.useState<'unknown' | 'ok' | 'failed'>(
    'unknown',
  );
  const lastVerifiedSignatureRef = React.useRef('');

  const normalizedUrl = (config?.url || '').trim();
  const normalizedUsername = (config?.username || '').trim();
  const normalizedPassword = (config?.password || '').trim();
  const normalizedRemotePath = (config?.remotePath || '/InfinityNoteX').trim() || '/InfinityNoteX';
  const isConfigComplete = Boolean(normalizedUrl && normalizedUsername && normalizedPassword);
  const isEnabled = Boolean(config?.enabled);
  const connectionSignature = `${normalizedUrl}|${normalizedUsername}|${normalizedPassword}|${normalizedRemotePath}`;

  // 监听同步进度
  useEffect(() => {
    const unsubProgress = window.sync.onProgress((p: SyncProgress) => {
      setProgress(p);
    });

    const unsubCompleted = window.sync.onCompleted((result: SyncResult) => {
      setSyncing(false);
      setProgress(null);
      setPreview(null);
      if (result) {
        setLastResult(result);
      }
    });

    return () => {
      unsubProgress();
      unsubCompleted();
    };
  }, []);

  // 打开设置页时加载最近一次同步结果（用于闭环展示）
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const getter = (window.sync as { getLastResult?: () => Promise<SyncResult | null> })
          ?.getLastResult;
        if (typeof getter !== 'function') return;
        const result = await getter();
        if (!cancelled && result) {
          setLastResult(result as SyncResult);
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 连接信息发生变化后，提示用户重新测试连接
  useEffect(() => {
    if (!lastVerifiedSignatureRef.current) {
      return;
    }
    if (lastVerifiedSignatureRef.current !== connectionSignature && connectionState !== 'unknown') {
      setConnectionState('unknown');
    }
  }, [connectionSignature, connectionState]);

  const handleTest = async () => {
    if (!isConfigComplete) {
      message.warning('请先填写完整的连接信息');
      return;
    }

    setTesting(true);
    try {
      const result = await onTest();
      if (result.ok) {
        setConnectionState('ok');
        lastVerifiedSignatureRef.current = connectionSignature;
        message.success(result.message);
      } else {
        setConnectionState('failed');
        message.error(result.message);
      }
    } finally {
      setTesting(false);
    }
  };

  const handleSync = async () => {
    if (!isConfigComplete) {
      message.warning('请先填写完整的连接信息');
      return;
    }
    if (!isEnabled) {
      message.warning('请先开启“启用同步”');
      return;
    }
    if (connectionState !== 'ok') {
      message.warning('建议先测试连接，确认配置可用后再同步');
    }

    setSyncing(true);
    setLastResult(null);
    setProgress({
      stage: 'connecting',
      percent: 0,
      processed: 0,
      total: 0,
      message: '正在连接...',
    });
    try {
      const result = await onSync();
      if (result) {
        setLastResult(result);
        if (result.success) {
          message.success('同步完成');
        } else {
          message.error(result.message || '同步未成功，请查看详情');
        }
      } else {
        message.success('已触发同步');
      }
    } catch (error) {
      message.error(`同步失败: ${error instanceof Error ? error.message : '未知错误'}`);
      setSyncing(false);
      setProgress(null);
    }
  };

  const shouldShowRetry = (result: SyncResult | null) => {
    if (!result) return false;
    if (result.success === false) return true;
    return Array.isArray(result.errors) && result.errors.length > 0;
  };

  const handlePreview = async () => {
    if (!isConfigComplete) {
      message.warning('请先填写完整的连接信息');
      return;
    }

    setLoadingPreview(true);
    try {
      const result = await window.sync.preview('webdav', config);
      setPreview(result);
    } catch (error) {
      message.error(`预览失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleOpenSyncLogs = async () => {
    try {
      setOpeningLogs(true);
      if (typeof (window.sync as { openLogDir?: () => Promise<void> })?.openLogDir === 'function') {
        await (window.sync as { openLogDir: () => Promise<void> }).openLogDir();
        return;
      }
      // 降级：打开数据目录（用户可手动进入 .sync-logs）
      if (typeof window.storage?.openInFinder === 'function') {
        await window.storage.openInFinder();
        return;
      }
      message.warning('当前版本不支持打开同步日志目录');
    } catch (error) {
      message.error(`打开日志目录失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setOpeningLogs(false);
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

    const nextConfig: WebDAVConfig = {
      ...defaultConfig,
      ...(config || {}),
      ...partial,
    };

    const remotePathInput = (nextConfig.remotePath || '').trim();
    const safeRemotePath = remotePathInput || '/InfinityNoteX';
    nextConfig.remotePath = safeRemotePath.startsWith('/') ? safeRemotePath : `/${safeRemotePath}`;

    onConfigChange(nextConfig);
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

  const conciseHint = !isConfigComplete
    ? '先填写地址、用户名、密码，再测试连接。'
    : connectionState === 'failed'
      ? '连接测试失败，请检查地址、账号和密码。'
      : connectionState !== 'ok'
        ? '建议先测试连接，确认可用后再同步。'
        : !isEnabled
          ? '已通过连接测试，开启同步后即可执行。'
          : '';

  return (
    <>
      <Card className="sync-card" size="small" title="WebDAV 配置">
        {conciseHint ? (
          <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
            {conciseHint}
          </Text>
        ) : null}

        <Form layout="vertical">
          <Form.Item label="服务器地址" required tooltip="例如: https://dav.jianguoyun.com/dav">
            <Input
              placeholder="https://dav.example.com"
              value={normalizedUrl}
              onChange={(e) => updateConfig({ url: e.target.value })}
            />
          </Form.Item>

          <Form.Item label="用户名" required>
            <Input
              value={normalizedUsername}
              onChange={(e) => updateConfig({ username: e.target.value })}
            />
          </Form.Item>

          <Form.Item label="密码" required tooltip="坚果云需要使用应用密码">
            <Input.Password
              value={normalizedPassword}
              onChange={(e) => updateConfig({ password: e.target.value })}
            />
          </Form.Item>

          <Form.Item label="启用同步">
            <Switch checked={isEnabled} onChange={(val) => updateConfig({ enabled: val })} />
          </Form.Item>

          <Collapse
            ghost
            size="small"
            items={[
              {
                key: 'advanced',
                label: '高级设置（可选）',
                children: (
                  <>
                    <Form.Item label="远程路径" tooltip="数据存储在服务器上的目录">
                      <Input
                        placeholder="/InfinityNoteX"
                        value={normalizedRemotePath}
                        onChange={(e) => updateConfig({ remotePath: e.target.value })}
                      />
                    </Form.Item>

                    <Form.Item label="冲突策略" tooltip="当同一文件在多设备上被修改时的处理方式">
                      <Select
                        value={config?.conflictStrategy || 'newest'}
                        onChange={(val) =>
                          updateConfig({
                            conflictStrategy: val as WebDAVConfig['conflictStrategy'],
                          })
                        }
                        options={[
                          { label: '保留最新修改（推荐）', value: 'newest' },
                          { label: '始终保留本地版本', value: 'local' },
                          { label: '始终使用远程版本', value: 'remote' },
                        ]}
                      />
                    </Form.Item>
                  </>
                ),
              },
            ]}
          />
        </Form>

        <Space direction="vertical" style={{ width: '100%' }}>
          <Space wrap>
            <Button onClick={handleTest} loading={testing} disabled={!isConfigComplete || syncing}>
              {connectionState === 'ok' ? '重新测试连接' : '测试连接'}
            </Button>
            <Button
              onClick={handlePreview}
              loading={loadingPreview}
              disabled={!isEnabled || syncing || !isConfigComplete}
            >
              预览变更
            </Button>
            <Button
              type="primary"
              icon={<SyncOutlined spin={syncing} />}
              onClick={handleSync}
              loading={syncing}
              disabled={!isEnabled || syncing || !isConfigComplete}
            >
              {syncing ? '同步中...' : '立即同步'}
            </Button>
            <Button onClick={handleOpenSyncLogs} loading={openingLogs} disabled={syncing}>
              打开同步日志
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
                <Space>
                  <DeleteOutlined style={{ color: '#faad14' }} />
                  <Text>待删除远端: {preview.toDeleteRemote.length} 个</Text>
                </Space>
                <Space>
                  <DeleteOutlined style={{ color: '#faad14' }} />
                  <Text>待删除本地: {preview.toDeleteLocal.length} 个</Text>
                </Space>
                <Space>
                  <WarningOutlined style={{ color: '#ff4d4f' }} />
                  <Text>冲突: {preview.conflicts.length} 个</Text>
                </Space>
                <Text type="secondary">无变化: {preview.unchanged} 个文件</Text>

                {preview.toUpload.length === 0 &&
                  preview.toDownload.length === 0 &&
                  preview.toDeleteRemote.length === 0 &&
                  preview.toDeleteLocal.length === 0 &&
                  preview.conflicts.length === 0 && (
                    <Alert title="所有文件已同步，无需操作" type="success" showIcon />
                  )}

                <Divider style={{ margin: '8px 0' }} />

                {renderPathList('将上传', preview.toUpload)}
                {renderPathList('将下载', preview.toDownload)}
                {renderPathList('将删除远端', preview.toDeleteRemote)}
                {renderPathList('将删除本地', preview.toDeleteLocal)}
                {renderPathList('冲突文件', preview.conflicts)}
              </Space>
            </Card>
          )}

          {/* 同步结果 */}
          {lastResult && !syncing && (
            <Card size="small" style={{ marginTop: 12 }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Space align="center">
                  <FileTextOutlined />
                  <Text strong>同步结果</Text>
                </Space>

                {shouldShowRetry(lastResult) && (
                  <Space>
                    <Button type="primary" onClick={handleSync}>
                      重试同步
                    </Button>
                    <Button onClick={handleOpenSyncLogs}>查看日志</Button>
                  </Space>
                )}

                <Alert
                  type={lastResult.success ? 'success' : 'warning'}
                  showIcon
                  message={lastResult.success ? '同步成功' : '同步完成（存在问题）'}
                  description={lastResult.message}
                />

                <Text type="secondary" style={{ fontSize: 12 }}>
                  耗时: {formatDuration(lastResult.endTime - lastResult.startTime)}
                </Text>

                <Space wrap>
                  <Text>上传 {lastResult.uploaded}</Text>
                  <Text>下载 {lastResult.downloaded}</Text>
                  <Text>删除 {lastResult.deleted}</Text>
                  <Text>跳过 {lastResult.skipped}</Text>
                  <Text>冲突处理 {lastResult.conflictsResolved}</Text>
                </Space>

                {lastResult.conflictBackups?.length ? (
                  <>
                    <Alert
                      type="info"
                      showIcon
                      message={`已保留 ${lastResult.conflictBackups.length} 个冲突备份文件`}
                    />
                    {renderPathList('冲突备份文件', lastResult.conflictBackups)}
                  </>
                ) : null}

                {lastResult.errors?.length ? (
                  <div style={{ width: '100%' }}>
                    <Text strong>错误列表（{lastResult.errors.length}）</Text>
                    <div style={{ marginTop: 6 }}>
                      {lastResult.errors.slice(0, 10).map((e, idx) => (
                        <div key={`${e.code}-${idx}`} style={{ marginBottom: 6 }}>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            [{e.code}]{e.path ? ` ${e.path}` : ''}：{e.message}
                            {e.retryable ? '（可重试）' : ''}
                          </Text>
                        </div>
                      ))}
                      {lastResult.errors.length > 10 && (
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          还有 {lastResult.errors.length - 10} 条未展开
                        </Text>
                      )}
                    </div>
                  </div>
                ) : null}
              </Space>
            </Card>
          )}
        </Space>
      </Card>

      <Alert
        style={{ marginTop: 12 }}
        title="同步范围"
        description="当前同步：文件夹、便签、附件。AI 对话/回收站/网页看板卡片默认不同步。"
        type="info"
        showIcon
      />
    </>
  );
};

export default WebDAVConfigComponent;
