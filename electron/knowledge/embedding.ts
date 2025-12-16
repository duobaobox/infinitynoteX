/**
 * Embedding 服务
 * 支持 OpenAI 兼容的 Embedding API（阿里百炼、硅基流动、智谱、OpenAI 等）
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { app } from 'electron';
import type { EmbeddingConfig, EmbeddingRequest, EmbeddingResponse } from './types';

// 重新导出类型
export type { EmbeddingConfig } from './types';

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
   * 构建 Embedding API URL（容错）
   */
  private buildCandidateEmbeddingUrls(): string[] {
    const raw = (this.config.baseURL || '').trim();
    const base = raw.replace(/\/+$/, '');
    const urls: string[] = [];

    if (!base) return urls;

    const pushUniq = (u: string) => {
      const normalized = u.replace(/\/+$/, '');
      if (!urls.includes(normalized)) urls.push(normalized);
    };

    // 1) 用户直接填写了完整的 embeddings 端点
    if (/\/embeddings$/i.test(base)) {
      pushUniq(base);
    }

    // 2) 标准 OpenAI 兼容：Base URL + /embeddings
    pushUniq(`${base}/embeddings`);

    // 3) 常见误填：只填了 host（没带 /v1），尝试追加 /v1/embeddings
    //    例如: https://api.openai.com  -> https://api.openai.com/v1/embeddings
    const looksLikeVersionedBase = /\/(v\d+|compatible-mode\/v\d+|api\/paas\/v\d+)$/i.test(base);
    if (!looksLikeVersionedBase && !/\/v\d+\//i.test(base)) {
      pushUniq(`${base}/v1/embeddings`);
    }

    return urls;
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

    const requestBody: EmbeddingRequest = {
      input: texts.length === 1 ? texts[0] : texts,
      model: this.config.model,
    };

    // 某些模型支持指定维度
    if (this.config.dimensions) {
      requestBody.dimensions = this.config.dimensions;
    }

    const candidateUrls = this.buildCandidateEmbeddingUrls();
    if (candidateUrls.length === 0) {
      throw new Error('Embedding 配置缺失：Base URL 为空');
    }

    const timeoutMs = this.config.timeoutMs || 30000;

    const baseHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.config.apiKey?.trim()) {
      baseHeaders.Authorization = `Bearer ${this.config.apiKey}`;
    }

    let lastError: Error | null = null;

    for (const url of candidateUrls) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: baseHeaders,
          body: JSON.stringify(requestBody),
          signal: AbortSignal.timeout(timeoutMs),
        });

        if (!response.ok) {
          const contentType = response.headers.get('content-type') || '';
          const errorText = await response.text();

          const isHtml = contentType.includes('text/html') || /<html[\s>]/i.test(errorText);
          const hint =
            isHtml && (response.status === 404 || response.status === 405)
              ? '（服务返回网页 HTML，通常表示 Base URL 填成了网站地址或反代未转发 API；请填写 OpenAI 兼容 API 的 Base URL，例如 https://api.siliconflow.cn/v1 或 https://open.bigmodel.cn/api/paas/v4）'
              : '';

          const preview = errorText.replace(/\s+/g, ' ').trim().slice(0, 200);

          const err = new Error(
            `HTTP ${response.status} @ ${url}: ${preview}${hint ? ' ' + hint : ''}`,
          );

          // 这些错误通常不是 URL 的问题，没必要尝试其他候选
          if ([400, 401, 403, 422].includes(response.status)) {
            throw err;
          }

          // 404/405 等可能是端点不匹配，尝试下一个候选
          lastError = err;
          continue;
        }

        const data = (await response.json()) as EmbeddingResponse;

        if (!data?.data || !Array.isArray(data.data)) {
          throw new Error(`Invalid response format @ ${url}: missing data array`);
        }

        const sorted = [...data.data].sort((a, b) => a.index - b.index);
        return sorted.map((item) => item.embedding);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        lastError = err;
      }
    }

    const msg = lastError?.message || '未知错误';
    console.error('[Embedding] Request failed:', msg);
    throw new Error(`Embedding 请求失败: ${msg}`);
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
