import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ConfigurationTab from './ConfigurationTab';

function mockMatchMedia(): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

describe('KnowledgeBase ConfigurationTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMatchMedia();
    Object.defineProperty(window, 'knowledge', {
      configurable: true,
      value: {
        getConfig: vi.fn().mockResolvedValue({
          embedding: {
            baseURL: 'https://api.example.com/v1',
            apiKey: 'sk-visible-only-after-eye-click',
            model: 'embedding-model',
          },
        }),
      },
    });
  });

  it('默认隐藏 Embedding API Key，并通过 Ant Design 小眼睛控制显示', async () => {
    render(<ConfigurationTab />);

    const apiKeyInput = await screen.findByPlaceholderText('sk-xxx');

    expect(apiKeyInput).toHaveAttribute('type', 'password');
  });
});
