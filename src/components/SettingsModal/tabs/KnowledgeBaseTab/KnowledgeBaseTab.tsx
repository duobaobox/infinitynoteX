/**
 * KnowledgeBaseTab - 知识库设置 Tab 组件
 * 配置 Embedding 模型和知识库参数
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Form,
  Input,
  Button,
  Space,
  Typography,
  message,
  Card,
  Switch,
  Select,
  Tag,
  Divider,
  Alert,
  Statistic,
} from 'antd';
import { SyncOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import {
  EMBEDDING_PROVIDER_PRESETS,
  findEmbeddingProviderById,
  createDefaultEmbeddingConfig,
} from '../../../../services/embeddingProviders';
import type { EmbeddingConfig, KnowledgeBaseConfig } from '../../../../services/knowledgeTypes';
import { DEFAULT_KNOWLEDGE_BASE_CONFIG } from '../../../../services/knowledgeTypes';
import './KnowledgeBaseTab.css';

const { Text, Paragraph } = Typography;

/** Provider 品牌颜色 */
const PROVIDER_COLORS: Record<string, string> = {
  alibaba: '#FF7A45',
  siliconflow: '#13C2C2',
  zhipu: '#52C41A',
  openai: '#1890FF',
};

const getProviderColor = (providerId?: string) => PROVIDER_COLORS[providerId ?? ''] ?? '#8c8c8c';

const KnowledgeBaseTab: React.FC = () => {
  // 知识库配置状态
  const [config, setConfig] = useState<KnowledgeBaseConfig>(DEFAULT_KNOWLEDGE_BASE_CONFIG);
  const [embeddingConfig, setEmbeddingConfig] = useState<EmbeddingConfig>(
    createDefaultEmbeddingConfig(),
  );
  const [selectedProviderId, setSelectedProviderId] = useState<string>('siliconflow');

  // UI 状态
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [indexing, setIndexing] = useState(false);
  const [stats, setStats] = useState({ indexedNotes: 0, totalVectors: 0 });

  // 加载配置
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const savedConfig = await window.knowledge?.getConfig();
        if (savedConfig) {
          setConfig((prev) => ({ ...prev, enabled: savedConfig.enabled }));
          if (savedConfig.embedding) {
            setEmbeddingConfig(savedConfig.embedding);
            if (savedConfig.embedding.providerId) {
              setSelectedProviderId(savedConfig.embedding.providerId);
            }
          }
        }
        // 加载统计
        const statsData = await window.knowledge?.getStats();
        if (statsData) {
          setStats({
            indexedNotes: statsData.indexedNotes,
            totalVectors: statsData.totalVectors,
          });
        }
      } catch (error) {
        console.error('Failed to load knowledge base config:', error);
      }
    };
    loadConfig();
  }, []);

  // Provider 预设
  const currentProviderPreset = useMemo(
    () => findEmbeddingProviderById(selectedProviderId),
    [selectedProviderId],
  );

  // 模型选项
  const modelOptions = useMemo(
    () =>
      (currentProviderPreset?.models ?? []).map((model) => ({
        label: `${model.label}${model.dimensions ? ` (${model.dimensions}维)` : ''}`,
        value: model.id,
      })),
    [currentProviderPreset],
  );

  // 切换 Provider
  const handleProviderChange = useCallback(
    (providerId: string) => {
      setSelectedProviderId(providerId);
      setTestResult(null);

      const preset = findEmbeddingProviderById(providerId);
      if (preset) {
        setEmbeddingConfig({
          providerId,
          provider: preset.name,
          baseURL: preset.baseURL,
          apiKey: embeddingConfig.apiKey, // 保留 API Key
          model: preset.models[0]?.id ?? '',
          dimensions: preset.models[0]?.dimensions,
          timeoutMs: 30000,
        });
      }
    },
    [embeddingConfig.apiKey],
  );

  // 切换模型
  const handleModelChange = useCallback(
    (modelId: string) => {
      const model = currentProviderPreset?.models.find((m) => m.id === modelId);
      setEmbeddingConfig((prev) => ({
        ...prev,
        model: modelId,
        dimensions: model?.dimensions,
      }));
    },
    [currentProviderPreset],
  );

  // 测试连接
  const handleTestConnection = useCallback(async () => {
    if (!embeddingConfig.apiKey) {
      message.warning('请先填写 API Key');
      return;
    }
    if (!embeddingConfig.model) {
      message.warning('请先选择或输入模型名称');
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const result = await window.knowledge?.testEmbedding({
        baseURL: embeddingConfig.baseURL,
        apiKey: embeddingConfig.apiKey || '',
        model: embeddingConfig.model,
        dimensions: embeddingConfig.dimensions,
      });

      if (result?.ok) {
        setTestResult({ ok: true, message: result.message });
        message.success('连接测试成功');
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
        enabled: config.enabled,
        embedding: embeddingConfig,
      });

      message.success('知识库配置已保存');
    } catch (error) {
      console.error('Failed to save config:', error);
      message.error('保存失败');
    }
  }, [config.enabled, embeddingConfig]);

  // 重建索引
  const handleRebuildIndex = useCallback(async () => {
    if (!config.enabled) {
      message.warning('请先启用知识库功能');
      return;
    }

    setIndexing(true);
    try {
      const result = await window.knowledge?.rebuildIndex();

      if (result?.success) {
        setStats({
          indexedNotes: result.indexedNotes,
          totalVectors: result.totalVectors,
        });
        message.success('索引重建完成');
      } else {
        message.error(result?.error || '索引重建失败');
      }
    } catch (error) {
      console.error('Failed to rebuild index:', error);
      message.error('索引重建失败');
    } finally {
      setIndexing(false);
    }
  }, [config.enabled]);

  return (
    <div className="settings-panel knowledge-base-panel">
      <h3>知识库管理</h3>

      {/* 状态卡片 */}
      <div className="kb-header-cards">
        <Card className="kb-status-card" size="small" variant="outlined">
          <div className="kb-status-inner">
            <div className="kb-status-switch">
              <Switch
                checked={config.enabled}
                onChange={(checked) => setConfig({ ...config, enabled: checked })}
              />
              <Text strong style={{ marginLeft: 8 }}>
                {config.enabled ? '已启用' : '未启用'}
              </Text>
            </div>
            <Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
              启用后，便签内容将被向量化存储，AI 对话可基于知识库回答问题。
            </Paragraph>
          </div>
        </Card>

        <Card className="kb-stats-card" size="small" variant="outlined">
          <div className="kb-stats-grid">
            <Statistic
              title="已索引笔记"
              value={stats.indexedNotes}
              suffix="篇"
              styles={{ content: { fontSize: 20 } }}
            />
            <Statistic
              title="向量数量"
              value={stats.totalVectors}
              suffix="条"
              styles={{ content: { fontSize: 20 } }}
            />
          </div>
        </Card>
      </div>

      {/* 配置区域 */}
      <div className="kb-config-grid">
        {/* Embedding Provider 选择 */}
        <Card
          className="kb-provider-card"
          size="small"
          title="Embedding 提供商"
          styles={{ body: { padding: 12 } }}
        >
          <div className="kb-provider-list">
            {EMBEDDING_PROVIDER_PRESETS.map((provider) => {
              const isActive = provider.id === selectedProviderId;
              return (
                <div
                  key={provider.id}
                  className={`kb-provider-item${isActive ? ' active' : ''}`}
                  onClick={() => handleProviderChange(provider.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleProviderChange(provider.id);
                    }
                  }}
                >
                  <div className="kb-provider-item__name">
                    <span
                      className="kb-provider-item__dot"
                      style={{ backgroundColor: getProviderColor(provider.id) }}
                    />
                    <span>{provider.name}</span>
                  </div>
                  {isActive && <Tag color={getProviderColor(provider.id)}>当前</Tag>}
                </div>
              );
            })}
          </div>
        </Card>

        {/* 配置表单 */}
        <div className="kb-config-forms">
          <Card className="kb-card" size="small" title="API 配置">
            <Form layout="vertical">
              {/* Base URL - 支持自定义 */}
              <Form.Item label="Base URL">
                <Input
                  placeholder={currentProviderPreset?.baseURL || 'https://api.example.com/v1'}
                  value={embeddingConfig.baseURL}
                  onChange={(e) =>
                    setEmbeddingConfig({ ...embeddingConfig, baseURL: e.target.value })
                  }
                />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  选择预设后自动填充，也可自定义修改。
                </Text>
              </Form.Item>

              {/* API Key */}
              <Form.Item label="API Key" required>
                <Space.Compact style={{ width: '100%' }}>
                  <Input.Password
                    placeholder="输入 Embedding API Key"
                    value={embeddingConfig.apiKey}
                    onChange={(e) =>
                      setEmbeddingConfig({ ...embeddingConfig, apiKey: e.target.value })
                    }
                  />
                  <Button type="primary" onClick={handleTestConnection} loading={testing}>
                    测试
                  </Button>
                </Space.Compact>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Key 仅存储在本地，不会上传。
                </Text>
              </Form.Item>

              {/* Embedding 模型 - 支持自定义输入 */}
              <Form.Item label="Embedding 模型" required>
                <Select
                  showSearch
                  allowClear
                  placeholder="选择或输入模型名称"
                  options={modelOptions}
                  value={
                    modelOptions.some((opt) => opt.value === embeddingConfig.model)
                      ? embeddingConfig.model
                      : undefined
                  }
                  onChange={handleModelChange}
                  style={{ marginBottom: 8 }}
                />
                <Input
                  placeholder="自定义模型名称（如 text-embedding-3-small）"
                  value={embeddingConfig.model}
                  onChange={(e) =>
                    setEmbeddingConfig({ ...embeddingConfig, model: e.target.value })
                  }
                />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  可从下拉选择预设模型，或直接输入自定义模型名称。
                </Text>
              </Form.Item>

              {testResult && (
                <Alert
                  message={testResult.message}
                  type={testResult.ok ? 'success' : 'error'}
                  showIcon
                  icon={testResult.ok ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
                  closable
                  onClose={() => setTestResult(null)}
                />
              )}
            </Form>
          </Card>

          <Card className="kb-card" size="small" title="索引管理">
            <div className="kb-index-section">
              <div className="kb-source-toggles">
                <div className="kb-source-item">
                  <Switch
                    size="small"
                    checked={config.sources.notes}
                    onChange={(checked) =>
                      setConfig({
                        ...config,
                        sources: { ...config.sources, notes: checked },
                      })
                    }
                  />
                  <Text style={{ marginLeft: 8 }}>便签笔记</Text>
                </div>
                <div className="kb-source-item">
                  <Switch
                    size="small"
                    checked={config.sources.clipboard}
                    onChange={(checked) =>
                      setConfig({
                        ...config,
                        sources: { ...config.sources, clipboard: checked },
                      })
                    }
                    disabled
                  />
                  <Text type="secondary" style={{ marginLeft: 8 }}>
                    剪切板 (即将支持)
                  </Text>
                </div>
              </div>

              <Divider style={{ margin: '12px 0' }} />

              <Button
                block
                icon={<SyncOutlined spin={indexing} />}
                onClick={handleRebuildIndex}
                loading={indexing}
                disabled={!config.enabled}
              >
                {indexing ? '索引中...' : '重建索引'}
              </Button>
            </div>
          </Card>

          {/* 保存按钮 */}
          <Button type="primary" block onClick={handleSaveConfig} style={{ marginTop: 16 }}>
            保存配置
          </Button>
        </div>
      </div>
    </div>
  );
};

export default KnowledgeBaseTab;
