/**
 * ConfigurationTab - 配置与索引 Tab
 * 参考设计图：索引维护 + Embedding 模型配置
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Form,
  Input,
  Button,
  Space,
  Typography,
  message,
  Card,
  Alert,
  Row,
  Col,
  Tag,
  Tooltip,
} from 'antd';
import {
  SyncOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ThunderboltOutlined,
  SettingOutlined,
  SafetyOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons';

const { Text } = Typography;

interface EmbeddingConfig {
  baseURL: string;
  apiKey: string;
  model: string;
}

interface ConfigurationTabProps {
  onStatsChange?: (stats: { indexedNotes: number; totalVectors: number }) => void;
}

const ConfigurationTab: React.FC<ConfigurationTabProps> = ({ onStatsChange }) => {
  const [embeddingConfig, setEmbeddingConfig] = useState<EmbeddingConfig>({
    baseURL: '',
    apiKey: '',
    model: '',
  });

  // UI 状态
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [indexing, setIndexing] = useState(false);
  const [incrementalUpdating, setIncrementalUpdating] = useState(false);

  // 加载配置
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const savedConfig = await window.knowledge?.getConfig();
        if (savedConfig?.embedding) {
          setEmbeddingConfig({
            baseURL: savedConfig.embedding.baseURL || '',
            apiKey: savedConfig.embedding.apiKey || '',
            model: savedConfig.embedding.model || '',
          });
        }
      } catch (error) {
        console.error('Failed to load config:', error);
      }
    };
    loadConfig();
  }, []);

  // 测试连接
  const handleTestConnection = useCallback(async () => {
    if (!embeddingConfig.baseURL || !embeddingConfig.apiKey || !embeddingConfig.model) {
      message.warning('请填写完整配置');
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const result = await window.knowledge?.testEmbedding({
        baseURL: embeddingConfig.baseURL,
        apiKey: embeddingConfig.apiKey,
        model: embeddingConfig.model,
      });
      if (result?.ok) {
        setTestResult({ ok: true, message: result.message });
        message.success('连接成功');
        // 自动保存
        await window.knowledge?.setConfig({
          enabled: true,
          embedding: {
            provider: 'custom',
            baseURL: embeddingConfig.baseURL,
            apiKey: embeddingConfig.apiKey,
            model: embeddingConfig.model,
          },
        });
      } else {
        setTestResult({ ok: false, message: result?.message || '连接失败' });
        message.error(result?.message || '连接失败');
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '连接失败';
      setTestResult({ ok: false, message: errorMsg });
      message.error(errorMsg);
    } finally {
      setTesting(false);
    }
  }, [embeddingConfig]);

  // 增量更新
  const handleIncrementalUpdate = useCallback(async () => {
    setIncrementalUpdating(true);
    try {
      const result = await window.knowledge?.incrementalUpdate();
      if (result?.success) {
        message.success(`+${result.added} 新增，${result.updated} 更新，${result.removed} 删除`);
        onStatsChange?.({ indexedNotes: 0, totalVectors: result.totalVectors });
        // 刷新统计
        const statsData = await window.knowledge?.getStats();
        if (statsData) {
          onStatsChange?.({
            indexedNotes: statsData.indexedNotes,
            totalVectors: statsData.totalVectors,
          });
        }
      } else {
        message.error(result?.error || '失败');
      }
    } catch {
      message.error('更新失败');
    } finally {
      setIncrementalUpdating(false);
    }
  }, [onStatsChange]);

  // 全量重建
  const handleRebuildIndex = useCallback(async () => {
    setIndexing(true);
    try {
      const result = await window.knowledge?.rebuildIndex();
      if (result?.success) {
        message.success(`完成：${result.indexedNotes} 笔记，${result.totalVectors} 向量`);
        onStatsChange?.({ indexedNotes: result.indexedNotes, totalVectors: result.totalVectors });
      } else {
        message.error(result?.error || '失败');
      }
    } catch {
      message.error('索引失败');
    } finally {
      setIndexing(false);
    }
  }, [onStatsChange]);

  return (
    <div className="kb-tab-content">
      {/* 索引维护 */}
      <Card
        size="small"
        style={{ marginBottom: 12, backgroundColor: 'var(--ant-color-fill-quaternary)' }}
      >
        <Row align="middle" justify="space-between">
          <Col>
            <div style={{ fontWeight: 500, marginBottom: 4 }}>索引维护</div>
            <Text type="secondary" style={{ fontSize: 13 }}>
              手动触发笔记的向量化处理。
            </Text>
          </Col>
          <Col>
            <Space>
              <Button
                icon={<ThunderboltOutlined />}
                onClick={handleIncrementalUpdate}
                loading={incrementalUpdating}
              >
                增量更新
              </Button>
              <Button
                icon={<SyncOutlined spin={indexing} />}
                onClick={handleRebuildIndex}
                loading={indexing}
              >
                全量重建
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Embedding 模型配置 */}
      <div style={{ marginBottom: 12 }}>
        <Space style={{ marginBottom: 12 }}>
          <SettingOutlined style={{ color: '#1890ff' }} />
          <Text strong>Embedding 模型配置</Text>
          <Tag color="blue">兼容 OpenAI 格式</Tag>
        </Space>

        <Form layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label={
                  <Space size={6}>
                    <Text>
                      Base URL <Text type="danger">*</Text>
                    </Text>
                    <Tooltip
                      placement="top"
                      title={
                        <div style={{ maxWidth: 420 }}>
                          <div style={{ fontWeight: 600, marginBottom: 6 }}>Base URL 填写说明</div>
                          <div style={{ marginBottom: 6 }}>
                            需填写 OpenAI 兼容 API 的 Base URL（不要填聊天网页地址）。
                          </div>
                          <div
                            style={{
                              fontFamily:
                                'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                              fontSize: 12,
                            }}
                          >
                            https://api.siliconflow.cn/v1
                            <br />
                            https://dashscope.aliyuncs.com/compatible-mode/v1
                            <br />
                            https://open.bigmodel.cn/api/paas/v4
                          </div>
                        </div>
                      }
                    >
                      <QuestionCircleOutlined style={{ color: 'var(--ant-color-text-tertiary)' }} />
                    </Tooltip>
                  </Space>
                }
                style={{ marginBottom: 16 }}
              >
                <Input
                  placeholder="https://api.siliconflow.cn/v1"
                  value={embeddingConfig.baseURL}
                  onChange={(e) =>
                    setEmbeddingConfig({ ...embeddingConfig, baseURL: e.target.value })
                  }
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label={
                  <Text>
                    模型名称 (Model) <Text type="danger">*</Text>
                  </Text>
                }
                style={{ marginBottom: 16 }}
              >
                <Input
                  placeholder="BAAI/bge-m3"
                  value={embeddingConfig.model}
                  onChange={(e) =>
                    setEmbeddingConfig({ ...embeddingConfig, model: e.target.value })
                  }
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            label={
              <Text>
                API Key <Text type="danger">*</Text>
              </Text>
            }
            style={{ marginBottom: 8 }}
          >
            <Space.Compact style={{ width: '100%' }}>
              <Input.Password
                placeholder="sk-xxx"
                value={embeddingConfig.apiKey}
                onChange={(e) => setEmbeddingConfig({ ...embeddingConfig, apiKey: e.target.value })}
                prefix={<SafetyOutlined style={{ color: '#bfbfbf' }} />}
              />
              <Button type="primary" onClick={handleTestConnection} loading={testing}>
                保存并测试
              </Button>
            </Space.Compact>
          </Form.Item>

          <Space style={{ color: '#52c41a', fontSize: 12 }}>
            <SafetyOutlined />
            <span>密钥将以加密方式存储在本地</span>
          </Space>

          {testResult && (
            <Alert
              message={testResult.message}
              type={testResult.ok ? 'success' : 'error'}
              showIcon
              icon={testResult.ok ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
              closable
              onClose={() => setTestResult(null)}
              style={{ marginTop: 12 }}
            />
          )}
        </Form>
      </div>
    </div>
  );
};

export default ConfigurationTab;
