// Theme utilities for managing primary color across the app
// Persist to main process config via window.app API
// Also keep localStorage as fallback for initial render before config loads

export const THEME_COLOR_KEY = 'theme.colorPrimary';
export const THEME_MODE_KEY = 'theme.mode';
export const THEME_BG_LIGHT_KEY = 'theme.bgLight';
export const THEME_BG_DARK_KEY = 'theme.bgDark';
export type ThemeMode = 'light' | 'dark' | 'auto';

export const DEFAULT_PRIMARY_COLOR = '#1677ff';
export const DEFAULT_THEME_MODE: ThemeMode = 'auto';
export const DEFAULT_BG_LIGHT = 'linear-gradient(135deg, #e6f2ff 0%, #f0e6ff 100%)';
export const DEFAULT_BG_DARK = 'linear-gradient(165deg, #111827 0%, #0b1220 100%)';

// 内存缓存（从主进程同步后更新）
let cachedTheme = {
  colorPrimary: DEFAULT_PRIMARY_COLOR,
  mode: DEFAULT_THEME_MODE as ThemeMode,
  bgLight: DEFAULT_BG_LIGHT,
  bgDark: DEFAULT_BG_DARK,
  loaded: false,
};

// data-theme 监听器（单例）状态
let dataThemeRefCount = 0;
let dataThemeMql: MediaQueryList | null = null;
let onSystemThemeChange: ((e: MediaQueryListEvent) => void) | null = null;
let onThemeModeChange: ((e: Event) => void) | null = null;
let onThemeBgChange: (() => void) | null = null;

function resolveDataTheme(mode: ThemeMode, mql: MediaQueryList | null): 'light' | 'dark' {
  if (mode === 'auto') {
    return mql?.matches ? 'dark' : 'light';
  }
  return mode;
}

function applyDataThemeNow(mode: ThemeMode): void {
  const current = resolveDataTheme(mode, dataThemeMql);
  document.documentElement.setAttribute('data-theme', current);
  applyThemeBg();
}

function ensureDataThemeListeners(): void {
  if (onThemeModeChange && onThemeBgChange) return;

  dataThemeMql = window.matchMedia?.('(prefers-color-scheme: dark)') ?? null;

  onSystemThemeChange = () => {
    if (getThemeMode() === 'auto') {
      applyDataThemeNow('auto');
    }
  };
  dataThemeMql?.addEventListener?.('change', onSystemThemeChange as EventListener);

  // 只做“刷新”，不要递归调用 applyDataTheme，避免监听器爆炸
  onThemeModeChange = (e: Event) => {
    const next = (e as unknown as CustomEvent<ThemeMode>).detail;
    const mode = next ?? getThemeMode();
    applyDataThemeNow(mode);
  };
  window.addEventListener('theme-mode-change', onThemeModeChange as EventListener);

  onThemeBgChange = () => {
    applyThemeBg();
  };
  window.addEventListener('theme-bg-change', onThemeBgChange as EventListener);
}

function removeDataThemeListeners(): void {
  if (onSystemThemeChange) {
    dataThemeMql?.removeEventListener?.('change', onSystemThemeChange as EventListener);
    onSystemThemeChange = null;
  }
  if (onThemeModeChange) {
    window.removeEventListener('theme-mode-change', onThemeModeChange as EventListener);
    onThemeModeChange = null;
  }
  if (onThemeBgChange) {
    window.removeEventListener('theme-bg-change', onThemeBgChange as EventListener);
    onThemeBgChange = null;
  }
  dataThemeMql = null;
}

/**
 * 从主进程加载主题配置（异步，启动时调用一次）
 */
export async function loadThemeFromConfig(): Promise<void> {
  try {
    if (window.app) {
      const config = await window.app.getConfig();
      cachedTheme = {
        colorPrimary: config.theme.colorPrimary || DEFAULT_PRIMARY_COLOR,
        mode: config.theme.mode || DEFAULT_THEME_MODE,
        bgLight: config.theme.bgLight || DEFAULT_BG_LIGHT,
        bgDark: config.theme.bgDark || DEFAULT_BG_DARK,
        loaded: true,
      };
      // 同步更新 localStorage 作为下次启动的快速缓存
      localStorage.setItem(THEME_COLOR_KEY, cachedTheme.colorPrimary);
      localStorage.setItem(THEME_MODE_KEY, cachedTheme.mode);
      localStorage.setItem(THEME_BG_LIGHT_KEY, cachedTheme.bgLight);
      localStorage.setItem(THEME_BG_DARK_KEY, cachedTheme.bgDark);

      // 广播加载的主题配置
      window.dispatchEvent(
        new CustomEvent('theme-color-change', { detail: cachedTheme.colorPrimary }),
      );
      window.dispatchEvent(new CustomEvent('theme-mode-change', { detail: cachedTheme.mode }));
      window.dispatchEvent(
        new CustomEvent('theme-bg-change', {
          detail: { light: cachedTheme.bgLight, dark: cachedTheme.bgDark },
        }),
      );
    }
  } catch (e) {
    console.warn('[Theme] Failed to load from config:', e);
  }
}

/**
 * 监听配置变化（从其他窗口或设置页面更新）
 */
export function subscribeToConfigChanges(): () => void {
  if (!window.app) return () => {};

  return window.app.onConfigChanged((config) => {
    cachedTheme = {
      colorPrimary: config.theme.colorPrimary || DEFAULT_PRIMARY_COLOR,
      mode: config.theme.mode || DEFAULT_THEME_MODE,
      bgLight: config.theme.bgLight || DEFAULT_BG_LIGHT,
      bgDark: config.theme.bgDark || DEFAULT_BG_DARK,
      loaded: true,
    };
    // 广播事件更新 UI
    window.dispatchEvent(
      new CustomEvent('theme-color-change', { detail: cachedTheme.colorPrimary }),
    );
    window.dispatchEvent(new CustomEvent('theme-mode-change', { detail: cachedTheme.mode }));
    window.dispatchEvent(
      new CustomEvent('theme-bg-change', {
        detail: { light: cachedTheme.bgLight, dark: cachedTheme.bgDark },
      }),
    );
  });
}

export function getThemeColor(): string {
  if (cachedTheme.loaded) {
    return cachedTheme.colorPrimary;
  }
  // Fallback to localStorage for initial render
  try {
    const saved = localStorage.getItem(THEME_COLOR_KEY);
    if (saved && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(saved)) {
      return saved;
    }
  } catch (_) {
    // ignore
  }
  return DEFAULT_PRIMARY_COLOR;
}

export function setThemeColor(color: string) {
  cachedTheme.colorPrimary = color;
  // 更新 localStorage 作为快速缓存
  try {
    localStorage.setItem(THEME_COLOR_KEY, color);
  } catch (_) {}

  // 更新主进程配置
  if (window.app) {
    window.app.setConfig({ theme: { colorPrimary: color } }).catch(console.error);
  }

  // 广播事件
  try {
    window.dispatchEvent(new CustomEvent('theme-color-change', { detail: color }));
  } catch (_) {}
}

export function getThemeMode(): ThemeMode {
  if (cachedTheme.loaded) {
    return cachedTheme.mode;
  }
  try {
    const saved = localStorage.getItem(THEME_MODE_KEY) as ThemeMode | null;
    if (saved === 'light' || saved === 'dark' || saved === 'auto') return saved;
  } catch (_) {}
  return DEFAULT_THEME_MODE;
}

export function setThemeMode(mode: ThemeMode) {
  cachedTheme.mode = mode;
  try {
    localStorage.setItem(THEME_MODE_KEY, mode);
  } catch (_) {}

  if (window.app) {
    window.app.setConfig({ theme: { mode } }).catch(console.error);
  }

  try {
    window.dispatchEvent(new CustomEvent('theme-mode-change', { detail: mode }));
  } catch (_) {}
}

export function getThemeBgLight(): string {
  if (cachedTheme.loaded) {
    return cachedTheme.bgLight;
  }
  try {
    const saved = localStorage.getItem(THEME_BG_LIGHT_KEY);
    if (saved) return saved;
  } catch (_) {}
  return DEFAULT_BG_LIGHT;
}

export function setThemeBgLight(bg: string) {
  cachedTheme.bgLight = bg;
  try {
    localStorage.setItem(THEME_BG_LIGHT_KEY, bg);
  } catch (_) {}

  if (window.app) {
    window.app.setConfig({ theme: { bgLight: bg } }).catch(console.error);
  }

  try {
    window.dispatchEvent(new CustomEvent('theme-bg-change', { detail: { light: bg } }));
  } catch (_) {}
}

export function getThemeBgDark(): string {
  if (cachedTheme.loaded) {
    return cachedTheme.bgDark;
  }
  try {
    const saved = localStorage.getItem(THEME_BG_DARK_KEY);
    if (saved) return saved;
  } catch (_) {}
  return DEFAULT_BG_DARK;
}

export function setThemeBgDark(bg: string) {
  cachedTheme.bgDark = bg;
  try {
    localStorage.setItem(THEME_BG_DARK_KEY, bg);
  } catch (_) {}

  if (window.app) {
    window.app.setConfig({ theme: { bgDark: bg } }).catch(console.error);
  }

  try {
    window.dispatchEvent(new CustomEvent('theme-bg-change', { detail: { dark: bg } }));
  } catch (_) {}
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
  ensureDataThemeListeners();
  dataThemeRefCount += 1;

  applyDataThemeNow(mode ?? getThemeMode());

  return () => {
    dataThemeRefCount = Math.max(0, dataThemeRefCount - 1);
    if (dataThemeRefCount === 0) {
      removeDataThemeListeners();
    }
  };
}
