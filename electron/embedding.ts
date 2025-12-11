/**
 * Embedding 服务
 * 支持 OpenAI 兼容的 Embedding API（阿里百炼、硅基流动、智谱、OpenAI 等）
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { app } from 'electron';
import type {
  EmbeddingConfig,
  EmbeddingRequest,
  EmbeddingResponse,
} from '../src/services/knowledgeTypes';

/**
 * 知识库配置文件路径
 */
function getKnowledgeConfigPath(): string {
  return path.join(app.getPath('userData'), 'knowledge-config.json');
}

/**
 * 读取知识库配置
 */
export async function readKnowledgeConfig(): Promise<{
  enabled: boolean;
  embedding?: EmbeddingConfig;
} | null> {
  try {
    const configPath = getKnowledgeConfigPath();
    const data = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

/**
 * 写入知识库配置
 */
export async function writeKnowledgeConfig(config: {
  enabled: boolean;
  embedding?: EmbeddingConfig;
}): Promise<void> {
  try {
    const configPath = getKnowledgeConfigPath();
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
    console.log('[Embedding] Config saved');
  } catch (error) {
    console.error('[Embedding] Failed to save config:', error);
    throw error;
  }
}

/**
 * Embedding 服务适配器
 * 支持 OpenAI /v1/embeddings 兼容接口
 */
export class EmbeddingService {
  private config: EmbeddingConfig;

  constructor(config: EmbeddingConfig) {
    this.config = config;
  }

  /**
   * 构建 API URL
   */
  private buildAPIURL(endpoint: string): string {
    const baseURL = this.config.baseURL.replace(/\/+$/, '');
    const cleanEndpoint = endpoint.replace(/^\/+/, '');
    return `${baseURL}/${cleanEndpoint}`;
  }

  /**
   * 测试 Embedding 连接
   */
  async testConnection(): Promise<{ ok: boolean; message: string }> {
    try {
      // 使用简短文本测试
      const result = await this.embed('测试连接');

      if (result && result.length > 0) {
        return {
          ok: true,
          message: `连接成功！向量维度：${result.length}`,
        };
      }

      return {
        ok: false,
        message: '返回的向量为空',
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return {
        ok: false,
        message: `连接失败：${msg}`,
      };
    }
  }

  /**
   * 获取单个文本的 Embedding
   */
  async embed(text: string): Promise<number[]> {
    const result = await this.embedBatch([text]);
    return result[0] || [];
  }

  /**
   * 批量获取 Embedding
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    const url = this.buildAPIURL('embeddings');

    const requestBody: EmbeddingRequest = {
      input: texts.length === 1 ? texts[0] : texts,
      model: this.config.model,
    };

    // 某些模型支持指定维度
    if (this.config.dimensions) {
      requestBody.dimensions = this.config.dimensions;
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(this.config.timeoutMs || 30000),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = (await response.json()) as EmbeddingResponse;

      // 验证响应格式
      if (!data?.data || !Array.isArray(data.data)) {
        throw new Error('Invalid response format: missing data array');
      }

      // 按 index 排序确保顺序正确
      const sorted = [...data.data].sort((a, b) => a.index - b.index);
      return sorted.map((item) => item.embedding);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('[Embedding] Request failed:', msg);
      throw new Error(`Embedding 请求失败: ${msg}`);
    }
  }
}

/**
 * 创建 Embedding 服务实例
 */
export function createEmbeddingService(config: EmbeddingConfig): EmbeddingService {
  return new EmbeddingService(config);
}

/**
 * 使用当前配置创建 Embedding 服务
 */
export async function getEmbeddingService(): Promise<EmbeddingService | null> {
  const config = await readKnowledgeConfig();
  if (!config?.enabled || !config.embedding) {
    return null;
  }
  return createEmbeddingService(config.embedding);
}
