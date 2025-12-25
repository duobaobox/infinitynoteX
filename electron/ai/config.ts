/**
 * AI 配置读写（主进程）
 * 离线客户端版本 - 直接保存 API Key 到配置文件
 */

import { app } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { AIConfig } from '../../src/services/aiConfig';

function getConfigPath(): string {
  return path.join(app.getPath('userData'), 'ai-config.json');
}

export async function readAIConfig(): Promise<AIConfig | null> {
  try {
    const configPath = getConfigPath();
    const data = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(data) as AIConfig;
  } catch (error) {
    // 首次启动可能文件不存在
    return null;
  }
}

export async function writeAIConfig(config: AIConfig): Promise<void> {
  try {
    const configPath = getConfigPath();
    // 直接保存完整配置（包括 API Key）
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
    console.log(`[AI] Config saved for provider: ${config.providerId || 'default'}`);
  } catch (error) {
    console.error('[AI] Failed to save config:', error);
    throw new Error('Failed to save AI config');
  }
}
