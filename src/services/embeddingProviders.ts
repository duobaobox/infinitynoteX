/**
 * Embedding 模型预设
 * 复用现有 Provider 体系，扩展 Embedding 模型支持
 */

export interface EmbeddingModelPreset {
  id: string;
  label: string;
  dimensions?: number;
  description?: string;
}

export interface EmbeddingProviderPreset {
  id: string;
  name: string;
  baseURL: string;
  models: EmbeddingModelPreset[];
}

/**
 * Embedding 模型预设（按 Provider 分组）
 * 兼容 OpenAI 风格 API
 */
export const EMBEDDING_PROVIDER_PRESETS: EmbeddingProviderPreset[] = [
  {
    id: 'alibaba',
    name: '阿里百炼 · DashScope',
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    models: [
      {
        id: 'text-embedding-v3',
        label: '通义 Embedding v3',
        dimensions: 1024,
        description: '阿里云通义千问 Embedding 模型',
      },
      {
        id: 'text-embedding-v2',
        label: '通义 Embedding v2',
        dimensions: 1536,
      },
    ],
  },
  {
    id: 'siliconflow',
    name: '硅基流动 · SiliconFlow',
    baseURL: 'https://api.siliconflow.cn/v1',
    models: [
      {
        id: 'BAAI/bge-m3',
        label: 'BGE-M3',
        dimensions: 1024,
        description: '多语言、多粒度向量模型',
      },
      {
        id: 'BAAI/bge-large-zh-v1.5',
        label: 'BGE Large 中文 v1.5',
        dimensions: 1024,
      },
      {
        id: 'netease-youdao/bce-embedding-base_v1',
        label: 'BCE Embedding Base',
        dimensions: 768,
      },
    ],
  },
  {
    id: 'zhipu',
    name: '智谱 AI · GLM',
    baseURL: 'https://open.bigmodel.cn/api/paas/v4',
    models: [
      {
        id: 'embedding-3',
        label: 'Embedding-3',
        dimensions: 2048,
        description: '智谱最新 Embedding 模型',
      },
      {
        id: 'embedding-2',
        label: 'Embedding-2',
        dimensions: 1024,
      },
    ],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    baseURL: 'https://api.openai.com/v1',
    models: [
      {
        id: 'text-embedding-3-small',
        label: 'Embedding 3 Small',
        dimensions: 1536,
        description: '高性价比 Embedding 模型',
      },
      {
        id: 'text-embedding-3-large',
        label: 'Embedding 3 Large',
        dimensions: 3072,
        description: '高精度 Embedding 模型',
      },
      {
        id: 'text-embedding-ada-002',
        label: 'Ada 002',
        dimensions: 1536,
      },
    ],
  },
];

/**
 * 根据 Provider ID 查找预设
 */
export function findEmbeddingProviderById(id?: string | null): EmbeddingProviderPreset | undefined {
  return EMBEDDING_PROVIDER_PRESETS.find((p) => p.id === id);
}

/**
 * 创建默认 Embedding 配置
 */
export function createDefaultEmbeddingConfig(
  providerId: string = 'siliconflow',
): import('./knowledgeTypes').EmbeddingConfig {
  const preset = findEmbeddingProviderById(providerId);
  return {
    providerId: preset?.id,
    provider: preset?.name ?? '自定义服务',
    baseURL: preset?.baseURL ?? '',
    apiKey: '',
    model: preset?.models[0]?.id ?? '',
    dimensions: preset?.models[0]?.dimensions,
    timeoutMs: 30000,
  };
}
