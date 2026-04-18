import { describe, expect, it } from 'vitest';

import { buildOutgoingUserInput } from '../../../../src/features/ai-chat/requestComposer';

describe('buildOutgoingUserInput', () => {
  it('keeps the visible user text clean while moving note content into references', () => {
    const result = buildOutgoingUserInput('请帮我总结', [
      {
        id: 'note-1',
        title: '会议纪要',
        content: '这里是便签正文',
      },
    ]);

    expect(result.text).toBe('请帮我总结');
    expect(result.references).toEqual([
      {
        id: 'note-1',
        title: '会议纪要',
        byteLength: new TextEncoder().encode('这里是便签正文').length,
        content: '这里是便签正文',
      },
    ]);
  });
});
