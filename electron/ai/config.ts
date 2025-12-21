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
    // 注意：读取配置时返回真实 Key（主进程内部使用），
    // 通过 IPC 发送给渲染进程前会在 preload 或 main.ts 中再次脱敏。
    // 但为了保险，建议 audit main.ts 确保 getConfig 这里不泄露
    return JSON.parse(data) as AIConfig;
  } catch (error) {
    // 首次启动可能文件不存在，尝试读取 keys 作为备份或返回 null
    return null;
  }
}

function getKeysPath(): string {
  return path.join(app.getPath('userData'), 'ai-keys.json');
}

async function readAIKeys(): Promise<Record<string, string>> {
  try {
    const keysPath = getKeysPath();
    const data = await fs.readFile(keysPath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return {};
  }
}

async function writeAIKeys(keys: Record<string, string>): Promise<void> {
  const keysPath = getKeysPath();
  await fs.writeFile(keysPath, JSON.stringify(keys, null, 2), 'utf-8');
}

export async function writeAIConfig(config: AIConfig): Promise<void> {
  try {
    const configPath = getConfigPath();
    const providerId = config.providerId || 'default'; // 必须有 providerId

    // 1. 读取所有保存的 keys
    const allKeys = await readAIKeys();

    // 2. 确定真实的 API Key
    let realApiKey = '';
    if (config.apiKey === API_KEY_PLACEHOLDER) {
      // 如果前端传的是占位符，尝试从 key store 中找
      realApiKey = allKeys[providerId] || '';
      console.log(`[AI] Using stored key for provider: ${providerId}`);
    } else {
      // 如果是新输入的 key（或者空），更新 key store
      realApiKey = config.apiKey || '';
      // 只有非空或者是明确清空时才更新？通常空字符串也视作清空
      allKeys[providerId] = realApiKey;
      await writeAIKeys(allKeys);
      console.log(`[AI] Updated stored key for provider: ${providerId}`);
    }

    // 3. 构造完整配置（包含真实 Key）保存到 ai-config.json
    // ai-config.json 存储的是"当前激活的配置"，包含真实 Key 方便主进程直接使用
    const nextConfig: AIConfig = {
      ...config,
      apiKey: realApiKey,
    };

    await fs.writeFile(configPath, JSON.stringify(nextConfig, null, 2), 'utf-8');
  } catch (error) {
    console.error('[AI] Failed to save config:', error);
    throw new Error('Failed to save AI config');
  }
}
