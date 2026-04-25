import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

vi.mock('electron', () => {
  const getPath = vi.fn(() => path.join(os.tmpdir(), 'knowledge-config-default'));
  return {
    app: {
      getPath,
    },
  };
});

import { app } from 'electron';
import {
  readKnowledgeConfig,
  writeKnowledgeConfig,
} from '../../../../electron/knowledge/embedding';
import {
  getIndexingConfig,
  setIndexingConfig,
} from '../../../../electron/knowledge/knowledgeIndex';

let userDataPath: string;

describe('knowledge configuration', () => {
  beforeEach(async () => {
    userDataPath = await fs.mkdtemp(path.join(os.tmpdir(), 'knowledge-config-'));
    vi.mocked(app.getPath).mockReturnValue(userDataPath);
  });

  afterEach(async () => {
    await fs.rm(userDataPath, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  it('returns embedding api key in plain text for local settings screens', async () => {
    await writeKnowledgeConfig({
      enabled: true,
      embedding: {
        provider: 'custom',
        baseURL: 'https://example.test/v1',
        apiKey: 'sk-real-key',
        model: 'embed-model',
      },
    });

    const config = await readKnowledgeConfig();

    expect(config?.embedding?.apiKey).toBe('sk-real-key');
  });

  it('writes the latest embedding api key value directly', async () => {
    await writeKnowledgeConfig({
      enabled: true,
      embedding: {
        provider: 'custom',
        baseURL: 'https://example.test/v1',
        apiKey: 'sk-real-key',
        model: 'old-model',
      },
    });

    await writeKnowledgeConfig({
      enabled: true,
      embedding: {
        provider: 'custom',
        baseURL: 'https://example.test/v1',
        apiKey: 'sk-new-key',
        model: 'new-model',
      },
    });

    const config = await readKnowledgeConfig();

    expect(config?.embedding?.apiKey).toBe('sk-new-key');
    expect(config?.embedding?.model).toBe('new-model');
  });

  it('persists indexing config in the knowledge config file', async () => {
    await setIndexingConfig({
      chunkSize: 1200,
      chunkOverlap: 180,
      batchSize: 7,
      batchDelayMs: 1500,
      rateLimitRetryMs: 9000,
    });

    const config = await readKnowledgeConfig();
    const indexingConfig = await getIndexingConfig();

    expect(config?.indexing).toEqual({
      chunkSize: 1200,
      chunkOverlap: 180,
      batchSize: 7,
      batchDelayMs: 1500,
      rateLimitRetryMs: 9000,
    });
    expect(indexingConfig).toEqual(config?.indexing);
  });

  it('writes the config through a temporary file and rename', async () => {
    const renameSpy = vi.spyOn(fs, 'rename');

    await writeKnowledgeConfig({
      enabled: true,
      embedding: {
        provider: 'custom',
        baseURL: 'https://example.test/v1',
        apiKey: 'sk-real-key',
        model: 'embed-model',
      },
    });

    const configPath = path.join(userDataPath, 'knowledge-config.json');

    expect(renameSpy).toHaveBeenCalledWith(`${configPath}.tmp`, configPath);
  });

  it('backs up corrupted knowledge config before continuing', async () => {
    const configPath = path.join(userDataPath, 'knowledge-config.json');
    await fs.writeFile(configPath, '{"enabled":', 'utf-8');

    const config = await readKnowledgeConfig();
    const files = await fs.readdir(userDataPath);

    expect(config).toBeNull();
    expect(files.some((name) => name.startsWith('knowledge-config.json.corrupted-'))).toBe(true);
    expect(files).not.toContain('knowledge-config.json');
  });
});
