import { describe, expect, it, vi } from 'vitest';
import os from 'node:os';
import path from 'node:path';

vi.mock('better-sqlite3', () => ({
  default: class MockDatabase {
    prepare(sql: string) {
      return {
        get: () => {
          if (sql.includes('COUNT(*)')) {
            return { count: 3 };
          }
          if (sql.includes('COUNT(DISTINCT note_id)')) {
            return { count: 2 };
          }
          return { count: 0 };
        },
        all: () => [],
        run: () => undefined,
      };
    }

    exec(): void {
      /* no-op */
    }

    pragma(): unknown[] {
      return [];
    }

    loadExtension(): void {
      /* no-op */
    }

    transaction<T extends () => unknown>(fn: T): T {
      return fn;
    }

    close(): void {
      /* no-op */
    }
  },
}));

vi.mock('sqlite-vec', () => ({
  getLoadablePath: () => '/tmp/sqlite-vec',
}));

vi.mock('electron', () => ({
  app: {
    getPath: () => path.join(os.tmpdir(), 'vector-store-test'),
    isPackaged: false,
  },
}));

import { SqliteVectorStore } from '../../../../electron/knowledge/vectorStore';

describe('SqliteVectorStore diagnostics', () => {
  it('counts orphaned vectors rather than distinct orphaned notes', () => {
    const store = new SqliteVectorStore('/tmp/vector-store-test.db', 3);

    const count = store.getOrphanedVectorCount(['existing-note']);

    expect(count).toBe(3);
  });
});
