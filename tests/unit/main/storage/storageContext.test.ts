import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { StorageContext } from '../../../../electron/storage/StorageContext';

const createTempPath = () => fs.mkdtemp(path.join(os.tmpdir(), 'storage-context-'));

const expectDirExists = async (dir: string) => {
  const stat = await fs.stat(dir);
  expect(stat.isDirectory()).toBe(true);
};

describe('StorageContext', () => {
  let tempPath: string;
  let context: StorageContext;

  beforeEach(async () => {
    tempPath = await createTempPath();
    context = new StorageContext({ dataPath: tempPath, appPath: tempPath });
  });

  afterEach(async () => {
    await fs.rm(tempPath, { recursive: true, force: true });
  });

  it('creates all module directories when ensuring base directories', async () => {
    await context.ensureBaseDirectories();

    await expectDirExists(tempPath);
    await expectDirExists(path.join(tempPath, 'temp'));
    await expectDirExists(path.join(tempPath, 'backups'));
    await expectDirExists(path.join(tempPath, 'notes'));
    await expectDirExists(path.join(tempPath, 'ai-conversations'));
    await expectDirExists(path.join(tempPath, 'trash'));
    await expectDirExists(path.join(tempPath, 'attachments'));
    await expectDirExists(path.join(tempPath, 'browser-cards'));
  });

  it('provides correct module and file paths', () => {
    expect(context.getModuleDir('notes')).toBe(path.join(tempPath, 'notes'));
    expect(context.getNotePath('abc')).toBe(path.join(tempPath, 'notes', 'abc.json'));
    expect(context.getAIConversationPath('c1')).toBe(
      path.join(tempPath, 'ai-conversations', 'c1.json'),
    );
  });
});
