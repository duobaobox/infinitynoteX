import { describe, expect, it } from 'vitest';
import {
  DEFAULT_EXTERNAL_AI_URL,
  canOpenExternally,
  isAllowedWebviewPartition,
  isAllowedWebviewUrl,
  sanitizeExternalAiUrl,
} from '../../../../src/shared/utils/webviewSafety';

describe('webviewSafety', () => {
  it('allows only safe remote webview urls', () => {
    expect(isAllowedWebviewUrl('https://www.doubao.com/chat/')).toBe(true);
    expect(isAllowedWebviewUrl('http://localhost:3000')).toBe(true);
    expect(isAllowedWebviewUrl('about:blank')).toBe(true);
    expect(isAllowedWebviewUrl('file:///tmp/test.html')).toBe(false);
    expect(isAllowedWebviewUrl('javascript:alert(1)')).toBe(false);
  });

  it('sanitizes invalid external ai urls back to the default value', () => {
    expect(sanitizeExternalAiUrl('javascript:alert(1)')).toBe(DEFAULT_EXTERNAL_AI_URL);
    expect(sanitizeExternalAiUrl('')).toBe(DEFAULT_EXTERNAL_AI_URL);
    expect(sanitizeExternalAiUrl('https://chat.openai.com/')).toBe('https://chat.openai.com/');
  });

  it('keeps only approved webview partitions and external protocols', () => {
    expect(isAllowedWebviewPartition('persist:browser')).toBe(true);
    expect(isAllowedWebviewPartition('persist:external-ai')).toBe(true);
    expect(isAllowedWebviewPartition('persist:unknown')).toBe(false);

    expect(canOpenExternally('https://example.com')).toBe(true);
    expect(canOpenExternally('mailto:test@example.com')).toBe(true);
    expect(canOpenExternally('javascript:alert(1)')).toBe(false);
  });
});
