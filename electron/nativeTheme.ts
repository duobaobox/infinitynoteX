/**
 * Native Theme Management
 * 负责同步应用配置到 Electron nativeTheme
 */

import { nativeTheme } from 'electron';
import { readAppConfig } from './config';
import log from './logger';

/**
 * 同步 Native Theme
 * 将应用配置中的 theme.mode (auto/light/dark) 应用到 nativeTheme.themeSource
 * 这会影响 Electron 的原生 UI 以及 Webview/Chromium 的 prefers-color-scheme
 */
export function syncNativeTheme(): void {
  try {
    const config = readAppConfig();
    const mode = config.theme.mode || 'auto';

    // 映射关系:
    // app: 'auto' | 'light' | 'dark'
    // nativeTheme: 'system' | 'light' | 'dark'

    // 注意：Electron 中 system 对应我们的 auto
    const themeSource = mode === 'auto' ? 'system' : mode;

    if (nativeTheme.themeSource !== themeSource) {
      nativeTheme.themeSource = themeSource;
      log.info(`[NativeTheme] Updated theme source to: ${themeSource}`);
    }
  } catch (error) {
    log.error('[NativeTheme] Failed to sync native theme:', error);
  }
}
