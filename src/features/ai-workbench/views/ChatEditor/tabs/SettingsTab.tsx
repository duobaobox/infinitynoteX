/**
 * SettingsTab - AI 参数设置面板
 *
 * 功能概述:
 * - 显示当前 AI 模型配置状态
 * - 调节温度、最大 Token、超时时间等参数
 * - 管理系统提示词（支持预设模板）
 * - 本地即时生效，保存后同步到全局配置
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Select,
  Slider,
  Space,
  Spin,
  Tag,
  Typography,
  message,
} from 'antd';
import { ReloadOutlined, SaveOutlined } from '@ant-design/icons';
import type { AIConfig } from '../../../../../services/aiConfig';
import {
  detectProviderIdFromConfig,
  ensureAIConfigDefaults,
  getProviderBrandColor,
} from '../../../../../services/aiProviders';
import {
  emitAIConfigChanged,
  readStoredProviderConfigs,
  subscribeAIConfigChanged,
  updateProviderConfigsCache,
} from '../../../../../services/aiConfigStore';
import './SettingsTab.css';

const { Paragraph, Text } = Typography;

// ============ 常量配置 ============

/** 系统提示词预设模板 */
const PROMPT_TEMPLATES = [
  {
    key: 'default',
    label: '默认助手',
    description: '使用模型默认行为',
    value: '',
  },
  {
    key: 'dev',
    label: '编程助手',
    description: '偏向代码讲解与示例',
    value:
      '你是一名资深架构师，请用中文回答。优先给出结论，再提供精简示例代码，并指出潜在风险或注意事项。',
  },
  {
    key: 'translator',
    label: '翻译专家',
    description: '保持语气、可解释',
    value:
      '你是一名专业双语翻译，请保留语气与语境。先给出目标语言译文，再用一句话解释关键词或模糊表述。',
  },
  {
    key: 'writer',
    label: '写作助手',
    description: '润色与结构优化',
    value:
      '你是一名写作伙伴，请保持作者意图，对输入内容进行润色、结构优化，并给出提升可读性的建议。',
  },
  {
    key: 'analyst',
    label: '数据分析',
    description: '善于解读图表与结论',
    value: '你是一名数据分析师，请解读指标含义、指出业务影响，并给出可执行的下一步建议。',
  },
  {
    key: 'concise',
    label: '简洁模式',
    description: '聚焦结论，短句输出',
    value: '请以 2-4 条短句要点作答，先给结论再补充背景，单条不超过两句话。',
  },
];

/** 参数边界值 */
const MAX_PROMPT_LENGTH = 2000;
const TEMPERATURE_MIN = 0;
const TEMPERATURE_MAX = 2;
const MAX_TOKEN_MIN = 100;
const MAX_TOKEN_MAX = 128000;
const TIMEOUT_MIN_SECONDS = 5;
const TIMEOUT_MAX_SECONDS = 600;

// ============ 工具函数 ============

/** 提取用于比较的配置字段 */
const pickRelevantConfig = (config: AIConfig | null) => ({
  temperature: Number((config?.temperature ?? 0.7).toFixed(2)),
  max_tokens: config?.max_tokens ?? 3500,
  timeoutMs: config?.timeoutMs ?? 60000,
  systemPrompt: config?.systemPrompt ?? '',
});

/** 比较两个配置是否相等（仅比较可编辑字段） */
const areConfigsEqual = (a: AIConfig | null, b: AIConfig | null) => {
  return JSON.stringify(pickRelevantConfig(a)) === JSON.stringify(pickRelevantConfig(b));
};

/** 检查配置是否已完成基础设置 */
const isConfigReady = (config?: AIConfig | null) => {
  if (!config) {
    return false;
  }
  return !!config.baseURL?.trim() && !!config.model?.trim() && !!config.apiKey?.trim();
};

// ============ 主组件 ============

const AISettingsTab = () => {
  // -------- State --------
  const [config, setConfig] = useState<AIConfig | null>(null);
  const [draftConfig, setDraftConfig] = useState<AIConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [configured, setConfigured] = useState(false);

  // -------- 配置加载与订阅 --------

  /** 强制启用流式响应 */
  const enforceStreamEnabled = useCallback((value: AIConfig | null) => {
    if (!value) return null;
    return { ...value, stream: true };
  }, []);

  /** 加载 AI 配置 */
  const loadConfig = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const current = await window.ai.getConfig();
      const normalized = current ? ensureAIConfigDefaults(current) : null;
      const prepared = enforceStreamEnabled(normalized);
      setConfig(prepared);
      setDraftConfig(prepared ? { ...prepared } : null);
      setConfigured(isConfigReady(prepared));
    } catch (err) {
      console.error('Failed to load AI config:', err);
      setError('加载 AI 配置失败，请稍后重试');
      setConfig(null);
      setDraftConfig(null);
      setConfigured(false);
    } finally {
      setLoading(false);
    }
  }, [enforceStreamEnabled]);

  // 初始化加载
  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  // 订阅配置变更事件
  useEffect(() => {
    const unsubscribe = subscribeAIConfigChanged((nextConfig) => {
      const normalized = ensureAIConfigDefaults(nextConfig);
      updateProviderConfigsCache({
        ...readStoredProviderConfigs(),
        [normalized.providerId ?? detectProviderIdFromConfig(normalized)]: normalized,
      });
      const prepared = enforceStreamEnabled(normalized);
      setConfig(prepared);
      setDraftConfig(prepared ? { ...prepared } : null);
      setConfigured(isConfigReady(prepared));
    });
    return unsubscribe;
  }, [enforceStreamEnabled]);

  // -------- 草稿状态管理 --------

  /** 检测是否有未保存的修改 */
  const hasUnsavedChanges = useMemo(() => {
    if (!config && !draftConfig) {
      return false;
    }
    return !areConfigsEqual(config, draftConfig);
  }, [config, draftConfig]);

  /** 更新草稿配置 */
  const updateDraft = useCallback((patch: Partial<AIConfig>) => {
    setDraftConfig((prev) => {
      if (!prev) {
        return prev;
      }
      return { ...prev, ...patch };
    });
  }, []);

  /** 重置草稿到已保存状态 */
  const handleReset = useCallback(() => {
    setDraftConfig(config ? { ...config } : null);
  }, [config]);

  /** 保存配置 */
  const handleSave = useCallback(async () => {
    if (!draftConfig) {
      return;
    }
    setSaving(true);
    const normalized = enforceStreamEnabled(ensureAIConfigDefaults(draftConfig));
    if (!normalized) {
      setSaving(false);
      return;
    }
    try {
      await window.ai.setConfig(normalized);
      updateProviderConfigsCache({
        ...readStoredProviderConfigs(),
        [normalized.providerId ?? detectProviderIdFromConfig(normalized)]: normalized,
      });
      emitAIConfigChanged(normalized);
      setConfig(normalized);
      setDraftConfig({ ...normalized });
      setConfigured(isConfigReady(normalized));
      message.success('AI 参数已保存');
    } catch (err) {
      console.error('Failed to save AI config:', err);
      const msg = err instanceof Error ? err.message : String(err);
      message.error(`保存失败：${msg}`);
    } finally {
      setSaving(false);
    }
  }, [draftConfig, enforceStreamEnabled]);

  // -------- 提示词模板处理 --------

  /** 应用提示词模板 */
  const applyPromptTemplate = useCallback(
    (value: string) => {
      updateDraft({ systemPrompt: value });
    },
    [updateDraft],
  );

  /** 处理模板选择 */
  const handleTemplateSelect = useCallback(
    (key?: string) => {
      const template = PROMPT_TEMPLATES.find((item) => item.key === key);
      applyPromptTemplate(template?.value ?? '');
    },
    [applyPromptTemplate],
  );

  // -------- 派生状态 (Derived State) --------

  const providerColor = useMemo(() => {
    if (!draftConfig) {
      return '#d9d9d9';
    }
    return getProviderBrandColor(detectProviderIdFromConfig(draftConfig));
  }, [draftConfig]);

  const temperature = draftConfig?.temperature ?? 0.7;
  const maxTokens = draftConfig?.max_tokens ?? 3500;
  const timeoutSeconds = Math.round((draftConfig?.timeoutMs ?? 60000) / 1000);
  const systemPrompt = draftConfig?.systemPrompt ?? '';

  const selectedTemplateKey = useMemo(() => {
    if (!systemPrompt) {
      const defaultTemplate = PROMPT_TEMPLATES.find((template) => template.value === '');
      return defaultTemplate?.key;
    }
    return PROMPT_TEMPLATES.find((template) => template.value === systemPrompt)?.key;
  }, [systemPrompt]);

  const templateSelectOptions = useMemo(
    () =>
      PROMPT_TEMPLATES.map((template) => ({
        value: template.key,
        label: `${template.label} · ${template.description}`,
      })),
    [],
  );

  const temperatureLabel = useMemo(() => {
    if (temperature <= 0.5) return '更精确稳健';
    if (temperature >= 1.2) return '更具创意';
    return '平衡输出';
  }, [temperature]);

  // ============ 渲染函数 ============

  /** 渲染加载状态 */
  const renderLoading = () => (
    <div className="ai-settings-empty">
      <Spin />
      <Text type="secondary" style={{ marginTop: 8 }}>
        正在读取 AI 配置...
      </Text>
    </div>
  );

  /** 渲染未配置状态 */
  const renderUnconfigured = () => (
    <div className="ai-settings-empty">
      <Alert
        message="未检测到已配置的 AI 模型"
        description="请先在左侧侧边栏 > 设置 > AI 管理中完成基础配置后再返回此处调参。"
        type="warning"
        showIcon
      />
      <Button
        type="primary"
        icon={<ReloadOutlined />}
        onClick={loadConfig}
        style={{ marginTop: 12 }}
      >
        已完成配置，重新检测
      </Button>
    </div>
  );

  /** 渲染错误状态 */
  const renderError = () => (
    <Alert
      message="加载失败"
      description={error}
      type="error"
      showIcon
      action={
        <Button size="small" type="primary" onClick={loadConfig}>
          重试
        </Button>
      }
      style={{ marginBottom: 16 }}
    />
  );

  /** 渲染参数配置卡片 */
  const renderParameterCards = () => (
    <>
      {/* 状态卡片 */}
      <Card className="ai-settings-card ai-settings-status-card" size="small" variant="outlined">
        <div className="ai-settings-status">
          <div className="ai-settings-status-main">
            <Text type="secondary" className="ai-settings-label">
              当前模型
            </Text>
            <div className="ai-settings-status-title">
              <span className="ai-settings-provider">
                <span
                  className="ai-settings-provider-dot"
                  style={{ backgroundColor: providerColor }}
                />
                {draftConfig?.provider || '未知提供商'}
              </span>
              <span className="ai-settings-model">{draftConfig?.model || '未配置模型'}</span>
            </div>
            <Paragraph type="secondary" className="ai-settings-base-url" ellipsis>
              {draftConfig?.baseURL || 'Base URL 未配置'}
            </Paragraph>
          </div>
          <Space size="small" wrap className="ai-settings-status-tags">
            <Tag color={hasUnsavedChanges ? 'gold' : 'blue'}>
              {hasUnsavedChanges ? '未保存更改' : '与全局同步'}
            </Tag>
          </Space>
        </div>
      </Card>

      <div className="ai-settings-grid">
        {/* 回答控制卡片 */}
        <Card title="回答控制" size="small" className="ai-settings-card" variant="outlined">
          <Form layout="vertical" colon={false} className="ai-settings-form">
            <Form.Item
              label={
                <div className="ai-settings-field-label">
                  <Text strong>温度</Text>
                  <Text type="secondary">{temperatureLabel}</Text>
                </div>
              }
              extra="低值更稳健，高值更具想象力。"
              className="ai-settings-form-item"
            >
              <Slider
                min={TEMPERATURE_MIN}
                max={TEMPERATURE_MAX}
                step={0.1}
                value={temperature}
                onChange={(value) =>
                  updateDraft({ temperature: Array.isArray(value) ? value[0] : Number(value) })
                }
                marks={{ 0: '精准', 2: '创意' }}
              />
            </Form.Item>

            <Form.Item
              label={
                <div className="ai-settings-field-label">
                  <Text strong>最大输出 Token</Text>
                  <Text type="secondary">限制单次回复长度</Text>
                </div>
              }
              extra="用于预留输出预算；历史、引用和知识库上下文会由系统按窗口大小自动裁剪。"
            >
              <InputNumber
                min={MAX_TOKEN_MIN}
                max={MAX_TOKEN_MAX}
                step={100}
                addonAfter="token"
                value={maxTokens}
                onChange={(value) =>
                  updateDraft({ max_tokens: typeof value === 'number' ? value : MAX_TOKEN_MIN })
                }
                style={{ width: '100%' }}
              />
            </Form.Item>

            <Form.Item
              label={
                <div className="ai-settings-field-label">
                  <Text strong>超时时间</Text>
                  <Text type="secondary">{timeoutSeconds} 秒</Text>
                </div>
              }
              extra="网络波动明显时可以适当延长，最高 10 分钟。"
            >
              <Slider
                min={TIMEOUT_MIN_SECONDS}
                max={TIMEOUT_MAX_SECONDS}
                step={5}
                tooltip={{ formatter: (value) => `${value} 秒` }}
                value={timeoutSeconds}
                onChange={(value) =>
                  updateDraft({
                    timeoutMs: Math.round((Array.isArray(value) ? value[0] : Number(value)) * 1000),
                  })
                }
                marks={{ 10: '稳定', 60: '默认', 300: '长任务' }}
              />
            </Form.Item>
          </Form>
        </Card>

        {/* 系统提示词卡片 */}
        <Card title="系统提示词" size="small" className="ai-settings-card" variant="outlined">
          <Form layout="vertical" colon={false} className="ai-settings-form">
            <Form.Item label="提示词模板" extra="选择预设后可在下方继续微调。">
              <Select
                allowClear
                placeholder="选择模板"
                options={templateSelectOptions}
                value={selectedTemplateKey}
                onChange={(value) => handleTemplateSelect(value)}
              />
            </Form.Item>

            <Form.Item
              label="自定义提示词"
              extra="用中文描述期望角色、语气与输出格式，最多 2000 字符。"
            >
              <Input.TextArea
                value={systemPrompt}
                placeholder="例如：请以产品经理视角回答，先列出结论再说明原因。"
                maxLength={MAX_PROMPT_LENGTH}
                onChange={(event) =>
                  updateDraft({ systemPrompt: event.target.value.slice(0, MAX_PROMPT_LENGTH) })
                }
                rows={6}
                showCount={{ formatter: ({ count, maxLength }) => `${count}/${maxLength}` }}
              />
            </Form.Item>
          </Form>
        </Card>
      </div>
    </>
  );

  // ============ 主渲染 ============

  return (
    <div className="ai-settings-tab">
      <div className="ai-settings-scroll">
        {error && renderError()}
        {loading && renderLoading()}
        {!loading && !configured && renderUnconfigured()}
        {!loading && configured && draftConfig && renderParameterCards()}
      </div>
      {!loading && configured && draftConfig && (
        <div className="ai-settings-footer">
          <div>
            <Text strong>本地即时生效</Text>
            <Paragraph type="secondary" style={{ marginBottom: 0 }}>
              参数用于下一条消息，保存后将同步到全局 AI 配置。
            </Paragraph>
          </div>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={handleReset} disabled={!hasUnsavedChanges}>
              重置
            </Button>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={handleSave}
              loading={saving}
              disabled={!hasUnsavedChanges}
            >
              保存配置
            </Button>
          </Space>
        </div>
      )}
    </div>
  );
};

export default AISettingsTab;
