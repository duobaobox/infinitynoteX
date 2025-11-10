// Simple theme utilities for managing primary color across the app
// Persist to localStorage and broadcast changes via a window event

export const THEME_COLOR_KEY = 'theme.colorPrimary';
export const THEME_MODE_KEY = 'theme.mode';
export const THEME_BG_LIGHT_KEY = 'theme.bgLight';
export const THEME_BG_DARK_KEY = 'theme.bgDark';
export type ThemeMode = 'light' | 'dark' | 'auto';

export const DEFAULT_PRIMARY_COLOR = '#fa8c16'; // fallback consistent with previous default
export const DEFAULT_THEME_MODE: ThemeMode = 'auto';
export const DEFAULT_BG_LIGHT = 'linear-gradient(165deg, #e2e2ff 0%, #ffd2b7 100%)';
export const DEFAULT_BG_DARK = 'linear-gradient(165deg, #111827 0%, #0b1220 100%)';

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

export function getThemeBgLight(): string {
  try {
    const saved = localStorage.getItem(THEME_BG_LIGHT_KEY);
    if (saved) return saved;
  } catch (_) {
    // ignore
  }
  return DEFAULT_BG_LIGHT;
}

export function setThemeBgLight(bg: string) {
  try {
    localStorage.setItem(THEME_BG_LIGHT_KEY, bg);
  } catch (_) {
    // ignore
  }
  // Broadcast so UI can update immediately
  try {
    const evt = new CustomEvent('theme-bg-change', { detail: { light: bg } });
    window.dispatchEvent(evt);
  } catch (_) {
    // ignore
  }
}

export function getThemeBgDark(): string {
  try {
    const saved = localStorage.getItem(THEME_BG_DARK_KEY);
    if (saved) return saved;
  } catch (_) {
    // ignore
  }
  return DEFAULT_BG_DARK;
}

export function setThemeBgDark(bg: string) {
  try {
    localStorage.setItem(THEME_BG_DARK_KEY, bg);
  } catch (_) {
    // ignore
  }
  // Broadcast so UI can update immediately
  try {
    const evt = new CustomEvent('theme-bg-change', { detail: { dark: bg } });
    window.dispatchEvent(evt);
  } catch (_) {
    // ignore
  }
}
/**
 * Apply theme background colors via CSS variables
 */
export function applyThemeBg(light?: string, dark?: string) {
  const lightBg = light ?? getThemeBgLight();
  const darkBg = dark ?? getThemeBgDark();
  document.documentElement.style.setProperty('--app-bg-light', lightBg);
  document.documentElement.style.setProperty('--app-bg-dark', darkBg);

  // Also update the main --app-bg variable based on current theme
  const m = getThemeMode();
  const mql = window.matchMedia?.('(prefers-color-scheme: dark)');
  const isDark = m === 'dark' || (m === 'auto' && mql?.matches);
  document.documentElement.style.setProperty('--app-bg', isDark ? darkBg : lightBg);
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
    // Also apply theme backgrounds
    applyThemeBg();
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
  const onBg = () => {
    applyThemeBg();
  };
  window.addEventListener('theme-bg-change', onBg as EventListener);
  return () => {
    mql?.removeEventListener?.('change', onSys as EventListener);
    window.removeEventListener('theme-mode-change', onMode as EventListener);
    window.removeEventListener('theme-bg-change', onBg as EventListener);
  };
}
