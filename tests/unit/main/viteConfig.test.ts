/* @vitest-environment node */

import { describe, expect, it } from 'vitest';

import config from '../../../vite.config';

describe('vite dev server config', () => {
  it('uses a strict port so Electron does not point to a stale dev server URL', () => {
    expect(config.server).toMatchObject({
      port: 1997,
      strictPort: true,
    });
  });
});
