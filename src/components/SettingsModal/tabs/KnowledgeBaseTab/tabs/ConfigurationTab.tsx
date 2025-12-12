/**
 * ConfigurationTab - 配置与索引 Tab
 * 核心功能：API配置、统计概览、索引操作
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
  Switch,
  Alert,
  Statistic,
  Row,
  Col,
} from 'antd';
import {
  SyncOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ThunderboltOutlined,
  DatabaseOutlined,
  FileTextOutlined,
} from '@ant-design/icons';

const { Text, Paragraph } = Typography;

interface EmbeddingConfig {
  baseURL: string;
  apiKey: string;
  model: string;
}

const ConfigurationTab: React.FC = () => {
  // 配置状态
  const [enabled, setEnabled] = useState(false);
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
  const [stats, setStats] = useState({ indexedNotes: 0, totalVectors: 0 });

  // 加载配置
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const savedConfig = await window.knowledge?.getConfig();
        if (savedConfig) {
          setEnabled(savedConfig.enabled);
          if (savedConfig.embedding) {
            setEmbeddingConfig({
              baseURL: savedConfig.embedding.baseURL || '',
              apiKey: savedConfig.embedding.apiKey || '',
              model: savedConfig.embedding.model || '',
            });
          }
        }
        const statsData = await window.knowledge?.getStats();
        if (statsData) {
          setStats({
            indexedNotes: statsData.indexedNotes,
            totalVectors: statsData.totalVectors,
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

  // 保存配置
  const handleSaveConfig = useCallback(async () => {
    try {
      await window.knowledge?.setConfig({
        enabled,
        embedding: {
          provider: 'custom',
          baseURL: embeddingConfig.baseURL,
          apiKey: embeddingConfig.apiKey,
          model: embeddingConfig.model,
        },
      });
      message.success('配置已保存');
    } catch (error) {
      message.error('保存失败');
    }
  }, [enabled, embeddingConfig]);

  // 重建全部索引
  const handleRebuildIndex = useCallback(async () => {
    if (!enabled) {
      message.warning('请先启用知识库');
      return;
    }
    setIndexing(true);
    try {
      const result = await window.knowledge?.rebuildIndex();
      if (result?.success) {
        setStats({ indexedNotes: result.indexedNotes, totalVectors: result.totalVectors });
        message.success(`完成：${result.indexedNotes} 笔记，${result.totalVectors} 向量`);
      } else {
        message.error(result?.error || '失败');
      }
    } catch {
      message.error('索引失败');
    } finally {
      setIndexing(false);
    }
  }, [enabled]);

  // 增量更新
  const handleIncrementalUpdate = useCallback(async () => {
    if (!enabled) {
      message.warning('请先启用知识库');
      return;
    }
    setIncrementalUpdating(true);
    try {
      const result = await window.knowledge?.incrementalUpdate();
      if (result?.success) {
        setStats((prev) => ({ ...prev, totalVectors: result.totalVectors }));
        message.success(`+${result.added} 新增，${result.updated} 更新，${result.removed} 删除`);
      } else {
        message.error(result?.error || '失败');
      }
    } catch {
      message.error('更新失败');
    } finally {
      setIncrementalUpdating(false);
    }
  }, [enabled]);

  return (
    <div className="kb-tab-content">
      {/* 状态与统计 */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={16} align="middle">
          <Col>
            <Space>
              <Switch checked={enabled} onChange={setEnabled} />
              <Text strong>{enabled ? '已启用' : '未启用'}</Text>
            </Space>
          </Col>
          <Col flex="1">
            <Row gutter={24} justify="end">
              <Col>
                <Statistic
                  title="笔记"
                  value={stats.indexedNotes}
                  suffix="篇"
                  prefix={<FileTextOutlined />}
                  valueStyle={{ fontSize: 18 }}
                />
              </Col>
              <Col>
                <Statistic
                  title="向量"
                  value={stats.totalVectors}
                  suffix="条"
                  prefix={<DatabaseOutlined />}
                  valueStyle={{ fontSize: 18 }}
                />
              </Col>
            </Row>
          </Col>
        </Row>
      </Card>

      {/* API 配置 */}
      <Card title="Embedding API" size="small" style={{ marginBottom: 16 }}>
        <Form layout="vertical" size="small">
          <Form.Item label="Base URL" required>
            <Input
              placeholder="https://api.siliconflow.cn/v1"
              value={embeddingConfig.baseURL}
              onChange={(e) => setEmbeddingConfig({ ...embeddingConfig, baseURL: e.target.value })}
            />
          </Form.Item>

          <Form.Item label="API Key" required>
            <Input.Password
              placeholder="sk-xxx"
              value={embeddingConfig.apiKey}
              onChange={(e) => setEmbeddingConfig({ ...embeddingConfig, apiKey: e.target.value })}
            />
          </Form.Item>

          <Form.Item label="模型" required>
            <Space.Compact style={{ width: '100%' }}>
              <Input
                placeholder="BAAI/bge-m3"
                value={embeddingConfig.model}
                onChange={(e) => setEmbeddingConfig({ ...embeddingConfig, model: e.target.value })}
              />
              <Button onClick={handleTestConnection} loading={testing}>
                测试
              </Button>
            </Space.Compact>
          </Form.Item>

          {testResult && (
            <Alert
              message={testResult.message}
              type={testResult.ok ? 'success' : 'error'}
              showIcon
              icon={testResult.ok ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
              closable
              onClose={() => setTestResult(null)}
              style={{ marginBottom: 16 }}
            />
          )}

          <Paragraph type="secondary" style={{ marginBottom: 0, fontSize: 12 }}>
            支持所有兼容 OpenAI Embeddings API 格式的服务。
          </Paragraph>
        </Form>
      </Card>

      {/* 索引操作 */}
      <Card title="索引操作" size="small" style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Button
            block
            icon={<ThunderboltOutlined />}
            onClick={handleIncrementalUpdate}
            loading={incrementalUpdating}
            disabled={!enabled}
          >
            增量更新（推荐）
          </Button>
          <Button
            block
            icon={<SyncOutlined spin={indexing} />}
            onClick={handleRebuildIndex}
            loading={indexing}
            disabled={!enabled}
          >
            重建全部索引
          </Button>
          <Paragraph type="secondary" style={{ marginBottom: 0, fontSize: 12 }}>
            增量更新仅处理变更笔记；重建会清空后重新索引。
          </Paragraph>
        </Space>
      </Card>

      {/* 保存按钮 */}
      <Button type="primary" block onClick={handleSaveConfig}>
        保存配置
      </Button>
    </div>
  );
};

export default ConfigurationTab;
