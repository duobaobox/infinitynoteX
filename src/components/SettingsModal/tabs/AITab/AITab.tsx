/**
 * AITab - AI 管理 Tab 组件
 */

import React, { useMemo, useEffect } from 'react';
import {
  Form,
  Input,
  Button,
  Space,
  Typography,
  message,
  Card,
  Slider,
  InputNumber,
  Tag,
  Collapse,
  Select,
  Alert,
} from 'antd';
import {
  useSettingsStore,
  PROVIDER_STATUS_META,
  getProviderStatus,
} from '../../../../store/settingsStore';
import {
  AI_PROVIDER_PRESETS,
  CUSTOM_PROVIDER_ID,
  findProviderPresetById,
  getProviderBrandColor,
} from '../../../../services/aiProviders';
import { persistProviderConfigs } from '../../../../services/aiConfigStore';
import './AITab.css';

const { Text, Paragraph } = Typography;

const AITab: React.FC = () => {
  const {
    aiConfig,
    providerConfigs,
    selectedProviderId,
    activeProviderId,
    aiLoading,
    aiTestLoading,
    aiTestResult,
    syncCurrentConfig,
    handleProviderSelect,
    loadAIConfig,
    saveAIConfig,
    testAIConnection,
    setAITestResult,
  } = useSettingsStore();

  // 初始加载
  useEffect(() => {
    loadAIConfig();
  }, [loadAIConfig]);

  // 持久化 providerConfigs
  useEffect(() => {
    if (Object.keys(providerConfigs).length > 0) {
      persistProviderConfigs(providerConfigs);
    }
  }, [providerConfigs]);

  // 切换 provider 时清除测试结果
  useEffect(() => {
    setAITestResult(null);
  }, [selectedProviderId, setAITestResult]);

  const currentProviderPreset = useMemo(
    () => findProviderPresetById(selectedProviderId),
    [selectedProviderId],
  );

  const providerListItems = useMemo(
    () => [
      ...AI_PROVIDER_PRESETS,
      {
        id: CUSTOM_PROVIDER_ID,
        name: '自定义 / 其他服务',
        website: 'https://infinitynotex.com',
        baseURL: '',
        description: '连接任意符合 OpenAI 兼容协议的自建或第三方服务。',
        models: [],
      },
    ],
    [],
  );

  const recommendedModelOptions = useMemo(
    () =>
      (currentProviderPreset?.models ?? []).map((model) => ({
        label: `${model.label}${model.description ? ` · ${model.description}` : ''} (${model.id})`,
        value: model.id,
      })),
    [currentProviderPreset],
  );

  const recommendedModelValue = useMemo(
    () =>
      recommendedModelOptions.some((option) => option.value === aiConfig.model)
        ? aiConfig.model
        : undefined,
    [aiConfig.model, recommendedModelOptions],
  );

  const handleModelPresetChange = (modelId?: string) => {
    if (!modelId) return;
    syncCurrentConfig((prev) => ({
      ...prev,
      model: modelId,
    }));
  };

  const handleSaveConfig = async () => {
    await saveAIConfig();
    if (aiTestResult?.ok) {
      message.success('配置已保存并通过测试');
    } else if (aiTestResult) {
      message.error(aiTestResult.message);
    } else {
      message.warning('请填写完整的配置信息');
    }
  };

  const handleTestConnection = async () => {
    await testAIConnection();
    const result = useSettingsStore.getState().aiTestResult;
    if (result?.ok) {
      message.success(result.message);
    } else if (result) {
      message.error(result.message);
    }
  };

  const isPresetProviderLocked =
    selectedProviderId !== CUSTOM_PROVIDER_ID && !!currentProviderPreset;

  return (
    <div className="settings-panel ai-settings-panel">
      <h3>AI 管理</h3>

      <div className="ai-settings-header">
        <Card className="ai-status-card" size="small" variant="outlined">
          <div className="ai-status-card-inner">
            <div className="ai-status-card-info">
              <Text type="secondary" className="ai-status-label">
                当前模型
              </Text>
              <div className="ai-status-card-title">
                <span className="ai-status-provider">
                  <span
                    className="ai-status-provider-dot"
                    style={{ backgroundColor: getProviderBrandColor(selectedProviderId) }}
                  />
                  {aiConfig.provider || '未配置提供商'}
                </span>
                <span className="ai-status-model">{aiConfig.model || '未选择模型'}</span>
              </div>
              <Paragraph type="secondary" className="ai-status-base" ellipsis>
                {aiConfig.baseURL || 'Base URL 未配置'}
              </Paragraph>
              <div className="ai-status-card-state">
                <Tag color={selectedProviderId === activeProviderId ? 'green' : 'default'}>
                  {selectedProviderId === activeProviderId ? '当前使用' : '未激活'}
                </Tag>
                <Text type="secondary" className="ai-status-hint">
                  保存并测试后自动激活
                </Text>
              </div>
            </div>
          </div>
        </Card>

        <Card className="ai-parameters-card" size="small" variant="outlined">
          <div className="ai-parameter-grid">
            <div className="ai-parameter-field">
              <div className="ai-parameter-label">
                <Text strong>温度</Text>
                <Text type="secondary">{(aiConfig.temperature ?? 0.7).toFixed(1)}</Text>
              </div>
              <Slider
                min={0}
                max={2}
                step={0.1}
                value={aiConfig.temperature ?? 0.7}
                onChange={(value) => {
                  const numeric = Array.isArray(value) ? value[0] : value;
                  syncCurrentConfig({ temperature: numeric });
                }}
                marks={{ 0: '精确', 2: '创意' }}
              />
            </div>
            <div className="ai-parameter-field">
              <div className="ai-parameter-label">
                <Text strong>最大 Token</Text>
              </div>
              <InputNumber
                min={100}
                max={128000}
                value={aiConfig.max_tokens ?? 3500}
                onChange={(val) => syncCurrentConfig({ max_tokens: val ?? 3500 })}
                style={{ width: '100%' }}
              />
              <Text type="secondary" style={{ fontSize: 12 }}>
                建议范围 100 ~ 128000
              </Text>
            </div>
          </div>
        </Card>
      </div>

      <div className="ai-config-grid">
        <Card
          className="ai-provider-card ai-card"
          size="small"
          title="AI 提供商"
          styles={{ body: { padding: 12 } }}
        >
          <div className="ai-provider-list">
            {providerListItems.map((provider) => {
              const isActive = provider.id === selectedProviderId;
              const configForItem =
                providerConfigs[provider.id] ||
                (provider.id === selectedProviderId ? aiConfig : undefined);
              const itemStatus = getProviderStatus(configForItem);
              const itemStatusMeta = PROVIDER_STATUS_META[itemStatus];
              return (
                <div
                  key={provider.id}
                  className={`ai-provider-item${isActive ? ' active' : ''}`}
                  onClick={() => handleProviderSelect(provider.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      handleProviderSelect(provider.id);
                    }
                  }}
                >
                  <div className="ai-provider-item__title">
                    <div className="ai-provider-item__name">
                      <span
                        className="ai-provider-item__dot"
                        style={{ backgroundColor: getProviderBrandColor(provider.id) }}
                      />
                      <span>{provider.name}</span>
                    </div>
                    {provider.id === activeProviderId && (
                      <Tag color={getProviderBrandColor(provider.id)}>当前</Tag>
                    )}
                  </div>
                  <div className="ai-provider-item__status" style={{ color: itemStatusMeta.color }}>
                    {itemStatusMeta.label}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <div className="ai-config-forms">
          <Card className="ai-card" size="small" title="API 接入信息">
            <Form layout="vertical">
              {isPresetProviderLocked ? (
                <Paragraph type="secondary" style={{ marginBottom: 8 }}>
                  {`已接入 ${currentProviderPreset?.name ?? aiConfig.provider}，域名与服务信息由系统管理。如需自定义地址，请切换到"自定义 / 其他服务"。`}
                </Paragraph>
              ) : (
                <>
                  <Form.Item label="供应商 / 服务名称" required>
                    <Input
                      placeholder="例如：深度求索、OpenAI 或自定义服务"
                      value={aiConfig.provider}
                      onChange={(e) => syncCurrentConfig({ provider: e.target.value })}
                    />
                  </Form.Item>
                  <Form.Item label="API Base URL" required>
                    <Input
                      placeholder={currentProviderPreset?.baseURL || 'https://api.example.com/v1'}
                      value={aiConfig.baseURL}
                      onChange={(e) => syncCurrentConfig({ baseURL: e.target.value })}
                    />
                  </Form.Item>
                </>
              )}
              <Form.Item label="API Key" required>
                <Space.Compact style={{ width: '100%' }}>
                  <Input.Password
                    placeholder="输入 API Key（仅本地保存）"
                    value={aiConfig.apiKey}
                    onChange={(e) => syncCurrentConfig({ apiKey: e.target.value })}
                  />
                  <Button type="primary" onClick={handleSaveConfig} loading={aiLoading}>
                    保存并测试
                  </Button>
                </Space.Compact>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Key 加密后存储在本地用户目录，不会上传到服务器。
                </Text>
              </Form.Item>
            </Form>
          </Card>

          <Card className="ai-card" size="small" title="模型选择">
            <Form layout="vertical">
              {recommendedModelOptions.length > 0 && (
                <Form.Item label="推荐模型">
                  <Select
                    allowClear
                    showSearch
                    placeholder="快速选择热门模型"
                    optionFilterProp="label"
                    options={recommendedModelOptions}
                    value={recommendedModelValue}
                    onChange={handleModelPresetChange}
                  />
                </Form.Item>
              )}
              <Form.Item label="模型名称" required>
                <Input
                  placeholder="例如：deepseek-chat、qwen3-max"
                  value={aiConfig.model}
                  onChange={(e) => syncCurrentConfig({ model: e.target.value })}
                />
              </Form.Item>
              <Collapse
                ghost
                size="small"
                className="ai-advanced-collapse"
                items={[
                  {
                    key: 'advanced',
                    label: '高级参数（可选）',
                    children: (
                      <>
                        <Form.Item label="系统提示词">
                          <Input.TextArea
                            rows={3}
                            placeholder="设定模型角色与默认行为"
                            value={aiConfig.systemPrompt || ''}
                            onChange={(e) => syncCurrentConfig({ systemPrompt: e.target.value })}
                          />
                        </Form.Item>
                        <Form.Item label="超时时间（毫秒）">
                          <InputNumber
                            min={5000}
                            max={600000}
                            step={5000}
                            value={aiConfig.timeoutMs ?? 60000}
                            onChange={(val) => syncCurrentConfig({ timeoutMs: val ?? 60000 })}
                            style={{ width: '100%' }}
                          />
                        </Form.Item>
                      </>
                    ),
                  },
                ]}
              />
            </Form>
            <Button
              block
              loading={aiTestLoading}
              onClick={handleTestConnection}
              disabled={selectedProviderId !== activeProviderId}
              style={{ marginTop: 12 }}
            >
              重新连接测试
            </Button>
          </Card>

          {aiTestResult && (
            <Alert
              title={aiTestResult.message}
              type={aiTestResult.ok ? 'success' : 'error'}
              showIcon
              closable
              onClose={() => setAITestResult(null)}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default AITab;
