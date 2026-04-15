import { app, shell } from 'electron';
import type { WebContents } from 'electron';
import {
  BROWSER_WEBVIEW_PARTITION,
  EXTERNAL_AI_WEBVIEW_PARTITION,
  canOpenExternally,
  isAllowedWebviewPartition,
  isAllowedWebviewUrl,
} from '../../src/shared/utils/webviewSafety';

const ALLOWED_WEBVIEW_PARTITIONS = new Set([
  BROWSER_WEBVIEW_PARTITION,
  EXTERNAL_AI_WEBVIEW_PARTITION,
]);

function denyAndMaybeOpenExternally(url: string): { action: 'deny' } {
  if (canOpenExternally(url)) {
    void shell.openExternal(url);
  }

  return { action: 'deny' };
}

function hardenAttachedWebview(contents: WebContents): void {
  contents.on('will-attach-webview', (event, webPreferences, params) => {
    const src = typeof params.src === 'string' ? params.src : '';
    const partition =
      typeof params.partition === 'string' ? params.partition : BROWSER_WEBVIEW_PARTITION;

    if (!ALLOWED_WEBVIEW_PARTITIONS.has(partition) || !isAllowedWebviewPartition(partition)) {
      event.preventDefault();
      return;
    }

    if (!isAllowedWebviewUrl(src)) {
      event.preventDefault();
      return;
    }

    delete webPreferences.preload;
    // 某些 Electron 版本会同时暴露 preloadURL，这里一并清掉
    if ('preloadURL' in webPreferences) {
      delete (webPreferences as Record<string, unknown>).preloadURL;
    }

    webPreferences.nodeIntegration = false;
    webPreferences.contextIsolation = true;
    webPreferences.sandbox = true;
    webPreferences.webSecurity = true;
    webPreferences.allowRunningInsecureContent = false;

    params.allowpopups = 'false';
  });

  contents.setWindowOpenHandler(({ url }) => denyAndMaybeOpenExternally(url));
}

function hardenWebviewContents(contents: WebContents): void {
  contents.setWindowOpenHandler(({ url }) => denyAndMaybeOpenExternally(url));

  contents.on('will-navigate', (event, url) => {
    if (isAllowedWebviewUrl(url)) {
      return;
    }

    event.preventDefault();
    if (canOpenExternally(url)) {
      void shell.openExternal(url);
    }
  });
}

export function registerWebviewSecurity(): void {
  app.on('web-contents-created', (_event, contents) => {
    if (contents.getType() === 'window') {
      hardenAttachedWebview(contents);
      return;
    }

    if (contents.getType() === 'webview') {
      hardenWebviewContents(contents);
    }
  });
}
