export const DEFAULT_EXTERNAL_AI_URL = 'https://www.doubao.com/chat/';
export const BROWSER_WEBVIEW_PARTITION = 'persist:browser';
export const EXTERNAL_AI_WEBVIEW_PARTITION = 'persist:external-ai';

const SAFE_WEBVIEW_PROTOCOLS = new Set(['http:', 'https:']);
const SAFE_EXTERNAL_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);

function parseUrl(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

export function isAllowedWebviewUrl(url: string): boolean {
  if (!url) {
    return true;
  }

  if (url === 'about:blank') {
    return true;
  }

  const parsed = parseUrl(url);
  if (!parsed) {
    return false;
  }

  return SAFE_WEBVIEW_PROTOCOLS.has(parsed.protocol);
}

export function canOpenExternally(url: string): boolean {
  const parsed = parseUrl(url);
  if (!parsed) {
    return false;
  }

  return SAFE_EXTERNAL_PROTOCOLS.has(parsed.protocol);
}

export function sanitizeExternalAiUrl(url: string): string {
  if (!url) {
    return DEFAULT_EXTERNAL_AI_URL;
  }

  const trimmedUrl = url.trim();
  if (!trimmedUrl) {
    return DEFAULT_EXTERNAL_AI_URL;
  }

  return isAllowedWebviewUrl(trimmedUrl) && trimmedUrl !== 'about:blank'
    ? trimmedUrl
    : DEFAULT_EXTERNAL_AI_URL;
}

export function isAllowedWebviewPartition(partition: string): boolean {
  return partition === BROWSER_WEBVIEW_PARTITION || partition === EXTERNAL_AI_WEBVIEW_PARTITION;
}
