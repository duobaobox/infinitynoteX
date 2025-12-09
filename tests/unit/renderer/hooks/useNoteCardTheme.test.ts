/**
 * useNoteCardTheme 测试
 */

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import { useNoteCardTheme, NoteCardColorConfig } from '../../../../src/hooks/useNoteCardTheme';

describe('useNoteCardTheme', () => {
  const OriginalMutationObserver = global.MutationObserver;

  class MockMutationObserver implements MutationObserver {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    constructor(private callback: MutationCallback) {}
    observe(): void {}
    disconnect(): void {}
    takeRecords(): MutationRecord[] {
      return [];
    }
  }

  beforeAll(() => {
    global.MutationObserver = MockMutationObserver as unknown as typeof MutationObserver;
  });

  afterAll(() => {
    global.MutationObserver = OriginalMutationObserver;
  });

  // Helpers to simulate theme change
  const setDarkMode = (isDark: boolean) => {
    if (isDark) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  };

  const triggerThemeChange = () => {
    // The hook listens to 'theme-mode-change' AND MutationObserver
    // We trigger custom event as MutationObserver in JSDOM might be tricky or async
    const event = new Event('theme-mode-change');
    window.dispatchEvent(event);
  };

  beforeEach(() => {
    // Default to light
    setDarkMode(false);
  });

  it('should return light mode colors by default', () => {
    const { result } = renderHook(() => useNoteCardTheme('bae0ff'));

    expect(result.current.isDark).toBe(false);
    expect(result.current.bgColor).toBe(NoteCardColorConfig.palette.bae0ff.light);
    expect(result.current.borderColor).toBe(NoteCardColorConfig.borderColor.light);
  });

  it('should return dark mode colors when theme is dark', () => {
    act(() => {
      setDarkMode(true);
    });
    const { result } = renderHook(() => useNoteCardTheme('bae0ff'));

    expect(result.current.isDark).toBe(true);
    expect(result.current.bgColor).toBe(NoteCardColorConfig.palette.bae0ff.dark);
    expect(result.current.borderColor).toBe(NoteCardColorConfig.borderColor.dark);
  });

  it('should update colors when theme changes', () => {
    const { result } = renderHook(() => useNoteCardTheme('bae0ff'));

    expect(result.current.isDark).toBe(false);

    act(() => {
      setDarkMode(true);
      triggerThemeChange();
    });

    expect(result.current.isDark).toBe(true);
    expect(result.current.bgColor).toBe(NoteCardColorConfig.palette.bae0ff.dark);
  });

  it('should use themeColor for border when interactive', () => {
    const themeColor = '#ff0000';
    const { result } = renderHook(() => useNoteCardTheme('bae0ff', themeColor, true));

    expect(result.current.borderColor).toBe(themeColor);
  });

  it('should NOT use themeColor for border when NOT interactive', () => {
    const themeColor = '#ff0000';
    const { result } = renderHook(() => useNoteCardTheme('bae0ff', themeColor, false));

    expect(result.current.borderColor).not.toBe(themeColor);
    expect(result.current.borderColor).toBe(NoteCardColorConfig.borderColor.light);
  });
});
