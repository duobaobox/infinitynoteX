import { describe, expect, it } from 'vitest';

import {
  buildUnsupportedToolActionMessage,
  detectRequiredTools,
} from '../../../../electron/ai/actionIntent';

describe('actionIntent', () => {
  it('detects saving a summary as a note', () => {
    expect(detectRequiredTools('请基于这段文本总结并创建一条便签')).toEqual(['saveToNote']);
  });

  it('detects appending back to the current note', () => {
    expect(detectRequiredTools('把刚才的结论追加到当前便签')).toEqual(['appendToNote']);
  });

  it('detects creating todo tasks', () => {
    expect(detectRequiredTools('把下一步整理成待办任务')).toEqual(['createManualTask']);
  });

  it('builds an explicit fallback message for unsupported action models', () => {
    expect(buildUnsupportedToolActionMessage(['saveToNote'])).toContain(
      '当前所选模型不支持工具调用',
    );
    expect(buildUnsupportedToolActionMessage(['saveToNote'])).toContain('创建便签');
  });
});
