import type { AIConfig } from './aiConfig';

export interface AIModelPreset {
  id: string;
  label: string;
  description?: string;
}

export interface AIProviderPreset {
  id: string;
  name: string;
  website: string;
  baseURL: string;
  description?: string;
  docsURL?: string;
  models: AIModelPreset[];
}

export const CUSTOM_PROVIDER_ID = 'custom';
export const DEFAULT_PROVIDER_ID = 'deepseek';

export const PROVIDER_BRAND_COLORS: Record<string, string> = {
  deepseek: '#7C4DFF',
  alibaba: '#FF7A45',
  siliconflow: '#13C2C2',
  zhipu: '#52C41A',
  openai: '#1890FF',
  [CUSTOM_PROVIDER_ID]: '#8C8C8C',
};

export const getProviderBrandColor = (providerId?: string) =>
  PROVIDER_BRAND_COLORS[providerId ?? ''] ?? '#8c8c8c';

export const AI_PROVIDER_PRESETS: AIProviderPreset[] = [
  {
    id: 'deepseek',
    name: '深度求索 · DeepSeek',
    website: 'https://platform.deepseek.com',
    baseURL: 'https://api.deepseek.com/v1',
    description: 'DeepSeek 官方推理服务，覆盖 Chat 与 Reasoner 系列模型。',
    docsURL: 'https://platform.deepseek.com/api-docs/intro',
    models: [
      {
        id: 'deepseek-chat',
        label: 'DeepSeek Chat',
        description: '通用对话模型，支持 128k tokens',
      },
      {
        id: 'deepseek-reasoner',
        label: 'DeepSeek Reasoner',
        description: '长推理模型，具备链式思维输出能力',
      },
    ],
  },
  {
    id: 'alibaba',
    name: '阿里百炼 · DashScope',
    website: 'https://dashscope.aliyuncs.com',
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    description: '阿里云通义系模型统一入口，提供 Qwen 与合作方大模型。',
    docsURL: 'https://help.aliyun.com/zh/dashscope/developer-reference/api-details',
    models: [
      { id: 'qwen3-max', label: 'Qwen3-Max' },
      { id: 'qwen-plus', label: 'Qwen-Plus' },
      { id: 'qwen-turbo', label: 'Qwen-Turbo' },
      { id: 'qwen-max', label: 'Qwen-Max' },
      { id: 'moonshot-v1-8k', label: 'Moonshot Kimi 8K' },
      { id: 'glm-4.5', label: 'GLM-4.5' },
      { id: 'qwen-3-instruct', label: 'Qwen 3 Instruct' },
    ],
  },
  {
    id: 'zhipu',
    name: '智谱 AI · GLM',
    website: 'https://open.bigmodel.cn',
    baseURL: 'https://open.bigmodel.cn/api/paas/v4',
    description: '智谱 AI 官方接口，提供 GLM-4 系列多模态与工具模型。',
    docsURL: 'https://open.bigmodel.cn/dev/api',
    models: [
      { id: 'glm-4.6', label: 'GLM-4.6' },
      { id: 'glm-4.5-flash', label: 'GLM-4.5-Flash' },
      { id: 'glm-4.5-air', label: 'GLM-4.5-Air' },
      { id: 'glm-4.5-x', label: 'GLM-4.5-X' },
      { id: 'glm-4.5v', label: 'GLM-4.5V (Vision)' },
      { id: 'glm-4-plus', label: 'GLM-4-Plus' },
      { id: 'glm-4-alltools', label: 'GLM-4-AllTools' },
    ],
  },
  {
    id: 'siliconflow',
    name: '硅基流动 · SiliconFlow',
    website: 'https://siliconflow.cn',
    baseURL: 'https://api.siliconflow.cn/v1',
    description: '多模型聚合平台，整合 DeepSeek、Qwen、Moonshot 等社区热度模型。',
    docsURL: 'https://docs.siliconflow.cn/api-reference',
    models: [
      { id: 'deepseek-ai/DeepSeek-V3.1', label: 'DeepSeek V3.1' },
      { id: 'moonshotai/Kimi-K2-Instruct-0905', label: 'Kimi K2 Instruct 0905' },
      { id: 'Qwen/Qwen3-Next-80B-A3B-Thinking', label: 'Qwen3 Next 80B Thinking' },
    ],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    website: 'https://platform.openai.com',
    baseURL: 'https://api.openai.com/v1',
    description: 'OpenAI 官方 API，支持 GPT-4.1、GPT-4o、o 系列推理模型。',
    docsURL: 'https://platform.openai.com/docs/api-reference/chat',
    models: [
      { id: 'gpt-4o', label: 'GPT-4o' },
      { id: 'gpt-4o-mini', label: 'GPT-4o Mini' },
      { id: 'o4-mini', label: 'o4-mini (Reasoning)' },
    ],
  },
];

export function findProviderPresetById(id?: string | null): AIProviderPreset | undefined {
  return AI_PROVIDER_PRESETS.find((provider) => provider.id === id);
}

function getHostname(input?: string): string {
  if (!input) return '';
  try {
    const url = new URL(input);
    return url.hostname;
  } catch (error) {
    return input.replace(/^https?:\/\//, '').split('/')[0];
  }
}

export function detectProviderIdFromConfig(config?: Partial<AIConfig> | null): string {
  if (!config) return DEFAULT_PROVIDER_ID;
  if (config.providerId && config.providerId !== CUSTOM_PROVIDER_ID) {
    return config.providerId;
  }

  const baseHost = getHostname(config?.baseURL);
  if (baseHost) {
    const matchedByHost = AI_PROVIDER_PRESETS.find(
      (provider) => getHostname(provider.baseURL) === baseHost,
    );
    if (matchedByHost) {
      return matchedByHost.id;
    }
  }

  const providerName = (config?.provider || '').toLowerCase();
  if (providerName) {
    const matchedByName = AI_PROVIDER_PRESETS.find((provider) => {
      const normalized = provider.name.toLowerCase();
      return providerName.includes(normalized) || providerName.includes(provider.id);
    });
    if (matchedByName) {
      return matchedByName.id;
    }
  }

  return CUSTOM_PROVIDER_ID;
}

export function createDefaultAIConfig(providerId: string = DEFAULT_PROVIDER_ID): AIConfig {
  const preset = findProviderPresetById(providerId);
  return {
    providerId: preset?.id,
    provider: preset?.name ?? '自定义服务',
    baseURL: preset?.baseURL ?? '',
    apiKey: '',
    model: preset?.models[0]?.id ?? '',
    stream: true,
    temperature: 0.7,
    max_tokens: 8192,
    timeoutMs: 300000,
  };
}

export function ensureAIConfigDefaults(config?: AIConfig | null): AIConfig {
  if (!config) {
    return createDefaultAIConfig();
  }

  const providerId = detectProviderIdFromConfig(config);
  const preset = findProviderPresetById(providerId);

  return {
    providerId: providerId === CUSTOM_PROVIDER_ID ? CUSTOM_PROVIDER_ID : providerId,
    provider: config.provider || preset?.name || '自定义服务',
    baseURL: config.baseURL || preset?.baseURL || '',
    apiKey: config.apiKey ?? '',
    model: config.model || preset?.models[0]?.id || '',
    stream: true,
    temperature: config.temperature ?? 0.7,
    max_tokens: config.max_tokens ?? 8192,
    systemPrompt: config.systemPrompt,
    timeoutMs: config.timeoutMs ?? 300000,
    httpProxy: config.httpProxy,
  };
}
