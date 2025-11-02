// Simple theme utilities for managing primary color across the app
// Persist to localStorage and broadcast changes via a window event

export const THEME_COLOR_KEY = 'theme.colorPrimary';
export const THEME_MODE_KEY = 'theme.mode';
export type ThemeMode = 'light' | 'dark' | 'auto';

export const DEFAULT_PRIMARY_COLOR = '#fa8c16'; // fallback consistent with previous default
export const DEFAULT_THEME_MODE: ThemeMode = 'auto';

export function getThemeColor(): string {
  try {
    const saved = localStorage.getItem(THEME_COLOR_KEY);
    if (saved && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(saved)) {
      return saved;
    }
  } catch (_) {
    // ignore storage errors (e.g., unavailable in some environments)
  }
  return DEFAULT_PRIMARY_COLOR;
}

export function setThemeColor(color: string) {
  try {
    localStorage.setItem(THEME_COLOR_KEY, color);
  } catch (_) {
    // ignore
  }
  // Broadcast a custom event so listeners can update immediately
  try {
    const evt = new CustomEvent('theme-color-change', { detail: color });
    window.dispatchEvent(evt);
  } catch (_) {
    // ignore
  }
}

export function getThemeMode(): ThemeMode {
  try {
    const saved = localStorage.getItem(THEME_MODE_KEY) as ThemeMode | null;
    if (saved === 'light' || saved === 'dark' || saved === 'auto') return saved;
  } catch (_) {
    // ignore
  }
  return DEFAULT_THEME_MODE;
}

export function setThemeMode(mode: ThemeMode) {
  try {
    localStorage.setItem(THEME_MODE_KEY, mode);
  } catch (_) {
    // ignore
  }
  // Broadcast so UI can update immediately
  try {
    const evt = new CustomEvent('theme-mode-change', { detail: mode });
    window.dispatchEvent(evt);
  } catch (_) {
    // ignore
  }
}

/**
 * Apply data-theme attribute to documentElement based on current mode + system preference.
 * Returns a cleanup function to unbind listeners.
 */
export function applyDataTheme(mode?: ThemeMode) {
  const m = mode ?? getThemeMode();
  const mql = window.matchMedia?.('(prefers-color-scheme: dark)');
  const resolve = () => (m === 'auto' ? (mql?.matches ? 'dark' : 'light') : m);
  const apply = () => {
    const current = resolve();
    document.documentElement.setAttribute('data-theme', current);
  };
  apply();
  const onSys = () => {
    if (getThemeMode() === 'auto') apply();
  };
  mql?.addEventListener?.('change', onSys as EventListener);
  const onMode = (e: Event) => {
    const next = (e as unknown as CustomEvent<ThemeMode>).detail;
    applyDataTheme(next);
  };
  window.addEventListener('theme-mode-change', onMode as EventListener);
  return () => {
    mql?.removeEventListener?.('change', onSys as EventListener);
    window.removeEventListener('theme-mode-change', onMode as EventListener);
  };
}
