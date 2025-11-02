// Simple theme utilities for managing primary color across the app
// Persist to localStorage and broadcast changes via a window event

export const THEME_COLOR_KEY = 'theme.colorPrimary';
export const DEFAULT_PRIMARY_COLOR = '#fa8c16'; // fallback consistent with previous default

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
