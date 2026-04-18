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
  Tooltip,
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
  getProviderCapabilities,
} from '../../../../services/aiProviders';
import { QuestionCircleOutlined, RobotOutlined } from '@ant-design/icons';
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
        website: 'https://www.kdocs.cn/l/co3mE4HmvfgO',
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

  const capabilities = useMemo(() => getProviderCapabilities(aiConfig), [aiConfig]);

  const handleModelPresetChange = (modelId?: string) => {
    if (!modelId) return;
    syncCurrentConfig((prev) => ({
      ...prev,
      model: modelId,
    }));
  };

  const handleSaveConfig = async () => {
    await saveAIConfig();
    // 从 store 获取最新的测试结果（因为 React 状态更新是异步的）
    const result = useSettingsStore.getState().aiTestResult;
    if (result?.ok) {
      message.success('配置已保存并通过测试');
    } else if (result) {
      message.error(result.message);
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
        <Card className="ai-status-card ai-card-glow" size="small" variant="outlined">
          <div
            className="ai-glow"
            style={{ background: getProviderBrandColor(selectedProviderId) }}
          />
          <div className="ai-card-header">
            <div
              className="ai-card-icon"
              style={{
                background: `linear-gradient(135deg, ${getProviderBrandColor(selectedProviderId)}20 0%, ${getProviderBrandColor(selectedProviderId)}40 100%)`,
                color: getProviderBrandColor(selectedProviderId),
              }}
            >
              <RobotOutlined />
            </div>
          </div>
          <div className="ai-card-title">
            <span className="ai-status-provider">
              <span
                className="ai-status-provider-dot"
                style={{ backgroundColor: getProviderBrandColor(selectedProviderId) }}
              />
              {aiConfig.provider || '未配置提供商'}
            </span>
            <span className="ai-status-model">{aiConfig.model || '未选择模型'}</span>
          </div>
          <Text type="secondary" className="ai-card-desc">
            {aiConfig.baseURL || 'Base URL 未配置'}
          </Text>
          <div className="ai-card-footer">
            <Tag color={selectedProviderId === activeProviderId ? 'blue' : 'default'}>
              {selectedProviderId === activeProviderId ? '⚡ 正在使用' : '未激活'}
            </Tag>
          </div>
          <Space size={[6, 6]} wrap style={{ marginTop: 10 }}>
            <Tag bordered={false}>流式</Tag>
            {capabilities.reasoning && <Tag color="purple">推理</Tag>}
            {capabilities.toolCalling && <Tag color="cyan">工具调用</Tag>}
            {capabilities.structuredOutputs && <Tag color="geekblue">结构化输出</Tag>}
          </Space>
        </Card>

        <Card className="ai-parameters-card" size="small" variant="outlined">
          <div className="ai-parameter-grid">
            <div className="ai-parameter-field">
              <div className="ai-parameter-label">
                <Text strong>☰ 温度 (Temperature)</Text>
                <Text style={{ color: '#1677ff' }}>{(aiConfig.temperature ?? 0.7).toFixed(1)}</Text>
              </div>
              <div className="ai-slider-container">
                <Text type="secondary" className="ai-slider-label">
                  精确
                </Text>
                <Slider
                  className="ai-temperature-slider"
                  min={0}
                  max={2}
                  step={0.1}
                  value={aiConfig.temperature ?? 0.7}
                  onChange={(value) => {
                    const numeric = Array.isArray(value) ? value[0] : value;
                    syncCurrentConfig({ temperature: numeric });
                  }}
                />
                <Text type="secondary" className="ai-slider-label">
                  创意
                </Text>
              </div>
            </div>
            <div className="ai-parameter-field">
              <div className="ai-parameter-label">
                <Space>
                  <Text strong>◎ 最大输出 (Max Tokens)</Text>
                  <Tooltip title="控制单次回答的最大输出长度；上下文预算会由系统按模型窗口和安全余量自动分配。">
                    <QuestionCircleOutlined style={{ color: '#8c8c8c', cursor: 'help' }} />
                  </Tooltip>
                </Space>
              </div>
              <InputNumber
                min={100}
                max={128000}
                value={aiConfig.max_tokens ?? 8192}
                onChange={(val) => syncCurrentConfig({ max_tokens: val ?? 8192 })}
                addonAfter="Tokens"
                style={{ width: '100%' }}
              />
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
                  Key 仅由主进程保存，渲染层读取到的是脱敏占位符。
                </Text>
              </Form.Item>
            </Form>
          </Card>

          <Card className="ai-card" size="small" title="模型选择">
            <Form layout="vertical">
              {recommendedModelOptions.length > 0 && (
                <Form.Item
                  label={
                    <Space>
                      <span>推荐模型</span>
                      <Tooltip title="这些是预置的热门模型，方便快速选择。如果列表中没有您需要的模型，可以直接在下方输入框填写。">
                        <QuestionCircleOutlined style={{ color: '#8c8c8c', cursor: 'help' }} />
                      </Tooltip>
                    </Space>
                  }
                >
                  <Select
                    allowClear
                    showSearch
                    placeholder="快速选择热门模型（可选）"
                    optionFilterProp="label"
                    options={recommendedModelOptions}
                    value={recommendedModelValue}
                    onChange={handleModelPresetChange}
                  />
                </Form.Item>
              )}
              <Form.Item
                label={
                  <Space>
                    <span>模型名称</span>
                    <Tag
                      color="blue"
                      style={{ marginLeft: 4, fontSize: 11, lineHeight: '18px', padding: '0 6px' }}
                    >
                      可自定义
                    </Tag>
                  </Space>
                }
                required
                extra={
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    💡 推荐列表可能未包含最新模型，您可以直接填写 API 文档中的模型标识符
                  </Text>
                }
              >
                <Input
                  placeholder="例如：deepseek-chat、gpt-4o、glm-4-flash"
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
