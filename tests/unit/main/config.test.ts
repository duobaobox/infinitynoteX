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

describe('config self-healing and atomic writes', () => {
  beforeEach(() => {
    userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'infinitynotex-config-'));
    vi.resetModules();
  });

  afterEach(() => {
    fs.rmSync(userDataDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('backs up corrupted app-config.json and rewrites a valid default config', async () => {
    const configPath = path.join(userDataDir, 'app-config.json');
    fs.writeFileSync(configPath, '{"window":', 'utf-8');

    const { readAppConfig } = await import('../../../electron/config');
    const config = readAppConfig();

    expect(config.window.width).toBe(1200);

    const rewritten = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as {
      window?: { width?: number };
    };
    expect(rewritten.window?.width).toBe(1200);

    const backups = fs
      .readdirSync(userDataDir)
      .filter((name) => name.startsWith('app-config.json.corrupted-'));
    expect(backups).toHaveLength(1);
  });

  it('writes config changes through a temporary file and rename', async () => {
    const { writeAppConfig, getConfigPath } = await import('../../../electron/config');
    const renameSpy = vi.spyOn(fs, 'renameSync');

    writeAppConfig({
      window: { width: 1440 },
    });

    const configPath = getConfigPath();
    const saved = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as {
      window?: { width?: number };
    };

    expect(saved.window?.width).toBe(1440);
    expect(renameSpy).toHaveBeenCalledTimes(1);
    expect(renameSpy.mock.calls[0]?.[0]).toBe(`${configPath}.tmp`);
    expect(renameSpy.mock.calls[0]?.[1]).toBe(configPath);
  });
});
