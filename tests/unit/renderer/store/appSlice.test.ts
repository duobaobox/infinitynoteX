import { beforeEach, describe, expect, it } from 'vitest';
import { create } from 'zustand';

import type { AppSlice } from '../../../../src/store/slices/appSlice';
import { createAppSlice } from '../../../../src/store/slices/appSlice';

function createTestStore() {
  return create<AppSlice>()((set, get) => createAppSlice(set, get));
}

describe('appSlice', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults AI mode to built-in chat when no preference is stored', () => {
    const store = createTestStore();

    expect(store.getState().aiMode).toBe('default');
  });

  it('keeps an explicit external AI mode preference', () => {
    localStorage.setItem('note_ai_mode', 'external');

    const store = createTestStore();

    expect(store.getState().aiMode).toBe('external');
  });
});
