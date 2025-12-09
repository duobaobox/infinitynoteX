import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

let storageRoot: string;
let mockUserDataPath: string;

// Mock electron with a factory that creates the mock inline
vi.mock('electron', () => {
  const getPath = vi.fn(() => path.join(os.tmpdir(), 'storage-manager-default'));
  return {
    shell: {
      openExternal: vi.fn(),
      showItemInFolder: vi.fn(),
      openPath: vi.fn(),
    },
    app: {
      getPath,
    },
  };
});

import { StorageManager } from '../../../../electron/storage/StorageManager';
import { app } from 'electron';

const ensureDir = (p: string) => fs.stat(p).then((s) => s.isDirectory());

describe('StorageManager', () => {
  beforeEach(async () => {
    mockUserDataPath = await fs.mkdtemp(path.join(os.tmpdir(), 'storage-manager-'));
    vi.mocked(app.getPath).mockReturnValue(mockUserDataPath);
    storageRoot = path.join(mockUserDataPath, 'data-v1');
  });

  afterEach(async () => {
    await fs.rm(mockUserDataPath, { recursive: true, force: true });
    vi.clearAllMocks();
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
