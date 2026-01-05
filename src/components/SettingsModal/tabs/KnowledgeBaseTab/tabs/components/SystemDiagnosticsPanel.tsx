/**
 * SystemDiagnosticsPanel - 系统诊断面板
 * 显示数据库状态、向量存储、索引一致性和 Embedding 配置状态
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Row,
  Col,
  Typography,
  Space,
  Tag,
  Button,
  Spin,
  message,
  Tooltip,
  Statistic,
} from 'antd';
import {
  DatabaseOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  WarningOutlined,
  SyncOutlined,
  ToolOutlined,
  ApiOutlined,
  ReloadOutlined,
} from '@ant-design/icons';

const { Text, Title } = Typography;

interface DiagnosticsResult {
  database: {
    path: string;
    sizeBytes: number;
    journalMode: string;
    integrity: 'ok' | 'error';
    integrityMessage?: string;
  };
  vectorStore: {
    dimension: number;
    totalVectors: number;
    uniqueNotes: number;
    tableExists: boolean;
  };
  indexConsistency: {
    orphanedVectors: number;
    missingIndexNotes: number;
    inconsistentNotes: string[];
  };
  embeddingConfig: {
    configured: boolean;
    provider?: string;
    model?: string;
    lastTestResult?: 'success' | 'failed' | 'unknown';
  };
}

const SystemDiagnosticsPanel: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [repairing, setRepairing] = useState(false);
  const [diagnostics, setDiagnostics] = useState<DiagnosticsResult | null>(null);

  // 运行诊断
  const runDiagnostics = useCallback(async () => {
    setLoading(true);
    try {
      const result = await window.knowledge?.runDiagnostics();
      if (result) {
        setDiagnostics(result);
      }
    } catch (error) {
      console.error('Failed to run diagnostics:', error);
      message.error('诊断失败');
    } finally {
      setLoading(false);
    }
  }, []);

  // 初次加载
  useEffect(() => {
    runDiagnostics();
  }, [runDiagnostics]);

  // 一键修复
  const handleRepair = useCallback(async () => {
    setRepairing(true);
    try {
      const result = await window.knowledge?.repairIndex();
      if (result?.success) {
        message.success(
          `修复完成：清理了 ${result.orphanedCleaned} 个孤立向量，索引了 ${result.missingIndexed} 个缺失便签`,
        );
        // 重新运行诊断
        await runDiagnostics();
      } else {
        message.error(result?.error || '修复失败');
      }
    } catch {
      message.error('修复失败');
    } finally {
      setRepairing(false);
    }
  }, [runDiagnostics]);

  // 格式化文件大小
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // 计算是否需要修复
  const needsRepair =
    diagnostics &&
    (diagnostics.indexConsistency.orphanedVectors > 0 ||
      diagnostics.indexConsistency.missingIndexNotes > 0);

  if (loading && !diagnostics) {
    return (
      <div style={{ textAlign: 'center', padding: 40 }}>
        <Spin tip="正在诊断..." />
      </div>
    );
  }

  return (
    <div className="system-diagnostics-panel">
      <div
        style={{
          marginBottom: 16,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Title level={5} style={{ margin: 0 }}>
          <DatabaseOutlined style={{ marginRight: 8 }} />
          系统诊断
        </Title>
        <Button
          icon={<ReloadOutlined spin={loading} />}
          onClick={runDiagnostics}
          loading={loading}
          size="small"
        >
          刷新
        </Button>
      </div>

      {diagnostics && (
        <Row gutter={[12, 12]}>
          {/* 数据库状态 */}
          <Col span={12}>
            <Card size="small" className="diag-card">
              <div className="diag-card-header">
                <Space>
                  <DatabaseOutlined style={{ color: '#1890ff' }} />
                  <Text strong>数据库状态</Text>
                </Space>
                {diagnostics.database.integrity === 'ok' ? (
                  <Tag color="success" icon={<CheckCircleOutlined />}>
                    正常
                  </Tag>
                ) : (
                  <Tag color="error" icon={<CloseCircleOutlined />}>
                    异常
                  </Tag>
                )}
              </div>
              <div className="diag-card-content">
                <div className="diag-item">
                  <Text type="secondary">大小</Text>
                  <Text>{formatBytes(diagnostics.database.sizeBytes)}</Text>
                </div>
                <div className="diag-item">
                  <Text type="secondary">模式</Text>
                  <Tag>{diagnostics.database.journalMode.toUpperCase()}</Tag>
                </div>
                <div className="diag-item">
                  <Tooltip title={diagnostics.database.path}>
                    <Text type="secondary" ellipsis style={{ maxWidth: 200 }}>
                      {diagnostics.database.path.split('/').pop()}
                    </Text>
                  </Tooltip>
                </div>
              </div>
            </Card>
          </Col>

          {/* 向量存储状态 */}
          <Col span={12}>
            <Card size="small" className="diag-card">
              <div className="diag-card-header">
                <Space>
                  <SyncOutlined style={{ color: '#52c41a' }} />
                  <Text strong>向量存储</Text>
                </Space>
                {diagnostics.vectorStore.tableExists ? (
                  <Tag color="success">已初始化</Tag>
                ) : (
                  <Tag color="warning">未初始化</Tag>
                )}
              </div>
              <div className="diag-card-content">
                <Row gutter={16}>
                  <Col span={8}>
                    <Statistic
                      title="向量数"
                      value={diagnostics.vectorStore.totalVectors}
                      valueStyle={{ fontSize: 18 }}
                    />
                  </Col>
                  <Col span={8}>
                    <Statistic
                      title="便签数"
                      value={diagnostics.vectorStore.uniqueNotes}
                      valueStyle={{ fontSize: 18 }}
                    />
                  </Col>
                  <Col span={8}>
                    <Statistic
                      title="维度"
                      value={diagnostics.vectorStore.dimension || '-'}
                      valueStyle={{ fontSize: 18 }}
                    />
                  </Col>
                </Row>
              </div>
            </Card>
          </Col>

          {/* 索引一致性 */}
          <Col span={12}>
            <Card size="small" className={`diag-card ${needsRepair ? 'diag-card-warning' : ''}`}>
              <div className="diag-card-header">
                <Space>
                  <ToolOutlined style={{ color: needsRepair ? '#faad14' : '#52c41a' }} />
                  <Text strong>索引一致性</Text>
                </Space>
                {needsRepair ? (
                  <Tag color="warning" icon={<WarningOutlined />}>
                    需要修复
                  </Tag>
                ) : (
                  <Tag color="success" icon={<CheckCircleOutlined />}>
                    一致
                  </Tag>
                )}
              </div>
              <div className="diag-card-content">
                <div className="diag-item">
                  <Text type="secondary">孤立向量</Text>
                  <Text
                    type={diagnostics.indexConsistency.orphanedVectors > 0 ? 'warning' : undefined}
                  >
                    {diagnostics.indexConsistency.orphanedVectors}
                  </Text>
                </div>
                <div className="diag-item">
                  <Text type="secondary">缺失索引</Text>
                  <Text
                    type={
                      diagnostics.indexConsistency.missingIndexNotes > 0 ? 'warning' : undefined
                    }
                  >
                    {diagnostics.indexConsistency.missingIndexNotes}
                  </Text>
                </div>
                {needsRepair && (
                  <Button
                    type="primary"
                    size="small"
                    icon={<ToolOutlined />}
                    onClick={handleRepair}
                    loading={repairing}
                    style={{ marginTop: 8 }}
                    block
                  >
                    一键修复
                  </Button>
                )}
              </div>
            </Card>
          </Col>

          {/* Embedding 配置 */}
          <Col span={12}>
            <Card size="small" className="diag-card">
              <div className="diag-card-header">
                <Space>
                  <ApiOutlined style={{ color: '#722ed1' }} />
                  <Text strong>Embedding 配置</Text>
                </Space>
                {diagnostics.embeddingConfig.configured ? (
                  <Tag color="success">已配置</Tag>
                ) : (
                  <Tag color="default">未配置</Tag>
                )}
              </div>
              <div className="diag-card-content">
                {diagnostics.embeddingConfig.configured ? (
                  <>
                    <div className="diag-item">
                      <Text type="secondary">提供商</Text>
                      <Text>{diagnostics.embeddingConfig.provider || '-'}</Text>
                    </div>
                    <div className="diag-item">
                      <Text type="secondary">模型</Text>
                      <Tooltip title={diagnostics.embeddingConfig.model}>
                        <Text ellipsis style={{ maxWidth: 150 }}>
                          {diagnostics.embeddingConfig.model || '-'}
                        </Text>
                      </Tooltip>
                    </div>
                  </>
                ) : (
                  <Text type="secondary">请先在"配置与索引"中配置 Embedding 模型</Text>
                )}
              </div>
            </Card>
          </Col>
        </Row>
      )}
    </div>
  );
};

export default SystemDiagnosticsPanel;
