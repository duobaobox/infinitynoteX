import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let userDataDir = '';

vi.mock('electron', () => ({
  app: {
    getPath: () => userDataDir,
  },
}));

describe('AI config visibility', () => {
  beforeEach(() => {
    userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'infinitynotex-ai-config-'));
    vi.resetModules();
  });

  afterEach(() => {
    fs.rmSync(userDataDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('returns active ai config with plain text api key', async () => {
    const { writeAppConfig } = await import('../../../../electron/config');
    const { readAIConfig } = await import('../../../../electron/ai/config');

    writeAppConfig({
      ai: {
        activeProviderId: 'openai',
        providerConfigs: {
          openai: {
            provider: 'openai',
            baseURL: 'https://api.openai.com/v1',
            apiKey: 'sk-plain-visible',
            model: 'gpt-4o',
          },
        },
      },
    });

    const config = await readAIConfig();

    expect(config?.apiKey).toBe('sk-plain-visible');
  });

  it('exposes app config provider keys in plain text for renderer settings', async () => {
    const { writeAppConfig, readAppConfig } = await import('../../../../electron/config');
    const { sanitizeAppConfigForRenderer } = await import('../../../../electron/ai/config');

    writeAppConfig({
      ai: {
        activeProviderId: 'openai',
        providerConfigs: {
          openai: {
            provider: 'openai',
            baseURL: 'https://api.openai.com/v1',
            apiKey: 'sk-visible-in-settings',
            model: 'gpt-4o',
          },
        },
      },
    });

    const appConfig = readAppConfig();
    const rendererConfig = sanitizeAppConfigForRenderer(appConfig);

    expect(rendererConfig.ai.providerConfigs.openai?.apiKey).toBe('sk-visible-in-settings');
  });
});
