/**
 * AI 配置读写（主进程）
 * 注意：渲染进程绝不应拿到明文 API Key。
 */

import { app } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { AIConfig } from '../../src/services/aiConfig';
import { API_KEY_PLACEHOLDER } from '../../src/services/aiConfig';

function getConfigPath(): string {
  return path.join(app.getPath('userData'), 'ai-config.json');
}

export async function readAIConfig(): Promise<AIConfig | null> {
  try {
    const configPath = getConfigPath();
    const data = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(data) as AIConfig;
  } catch (error) {
    console.warn('[AI] Config file not found or invalid:', error);
    return null;
  }
}

export async function writeAIConfig(config: AIConfig): Promise<void> {
  try {
    const configPath = getConfigPath();

    const previous = await readAIConfig();
    const nextApiKey =
      config.apiKey === API_KEY_PLACEHOLDER ? (previous?.apiKey ?? '') : (config.apiKey ?? '');

    const nextConfig: AIConfig = {
      ...config,
      apiKey: nextApiKey,
    };

    await fs.writeFile(configPath, JSON.stringify(nextConfig, null, 2), 'utf-8');
    console.log('[AI] Config saved:', { provider: nextConfig.provider, model: nextConfig.model });
  } catch (error) {
    console.error('[AI] Failed to save config:', error);
    throw new Error('Failed to save AI config');
  }
}
