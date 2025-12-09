import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

// Use var to avoid TDZ when vi.mock is hoisted; seed with a fallback path
let tempPath = path.join(os.tmpdir(), 'storage-manager-default');
let storageRoot: string;

vi.mock('electron', () => ({
  shell: {
    openExternal: vi.fn(),
    showItemInFolder: vi.fn(),
    openPath: vi.fn(),
  },
  app: {
    getPath: vi.fn(() => tempPath || path.join(os.tmpdir(), 'storage-manager-default')),
  },
}));

import { StorageManager } from '../../../../electron/storage/StorageManager';

const ensureDir = (p: string) => fs.stat(p).then((s) => s.isDirectory());

describe('StorageManager', () => {
  beforeEach(async () => {
    tempPath = await fs.mkdtemp(path.join(os.tmpdir(), 'storage-manager-'));
    storageRoot = path.join(tempPath, 'data-v1');
  });

  afterEach(async () => {
    await fs.rm(tempPath, { recursive: true, force: true });
  });

  it('returns true for first launch when meta is missing', async () => {
    const manager = new StorageManager();
    const first = await manager.isFirstLaunch();
    expect(first).toBe(true);
  });

  it('marks initialized and flips first-launch flag', async () => {
    const manager = new StorageManager();
    await fs.mkdir(storageRoot, { recursive: true });

    await manager.markInitialized();

    const meta = JSON.parse(await fs.readFile(path.join(storageRoot, 'meta.json'), 'utf-8')) as {
      initialized?: boolean;
    };
    expect(meta.initialized).toBe(true);
    expect(await manager.isFirstLaunch()).toBe(false);
  });

  it('initializes storage structure on first initialize()', async () => {
    const manager = new StorageManager();

    await manager.initialize();

    await expect(ensureDir(path.join(storageRoot, 'notes'))).resolves.toBe(true);
    await expect(ensureDir(path.join(storageRoot, 'ai-conversations'))).resolves.toBe(true);
    await expect(ensureDir(path.join(storageRoot, 'trash'))).resolves.toBe(true);
    await expect(fs.readFile(path.join(storageRoot, 'meta.json'), 'utf-8')).resolves.toBeTruthy();
  });
});
