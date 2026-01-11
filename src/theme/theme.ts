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
