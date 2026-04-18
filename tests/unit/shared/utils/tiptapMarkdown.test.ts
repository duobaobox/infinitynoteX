import { describe, expect, it } from 'vitest';

import {
  appendMarkdownToTipTapDoc,
  convertMarkdownToTipTap,
  stripThinkBlocks,
} from '../../../../src/shared/utils/tiptapMarkdown';

describe('tiptapMarkdown', () => {
  it('converts markdown into rich TipTap blocks', () => {
    const doc = convertMarkdownToTipTap('# 会议纪要\n\n- 第一项\n- 第二项\n\n**重点**');

    expect(doc.type).toBe('doc');
    expect(doc.content?.[0].type).toBe('heading');
    expect(doc.content?.[0].attrs?.level).toBe(1);
    expect(doc.content?.[1].type).toBe('bulletList');

    const lastParagraph = doc.content?.[2];
    expect(lastParagraph?.type).toBe('paragraph');
    expect(lastParagraph?.content?.[0].marks?.[0].type).toBe('bold');
  });

  it('appends markdown as rich text instead of plain text paragraphs', () => {
    const existing = convertMarkdownToTipTap('已有正文');
    const appended = appendMarkdownToTipTapDoc(existing, '## 新结论\n\n- 行动项');

    expect(appended.content).toHaveLength(3);
    expect(appended.content?.[1].type).toBe('heading');
    expect(appended.content?.[1].attrs?.level).toBe(2);
    expect(appended.content?.[2].type).toBe('bulletList');
  });

  it('strips think blocks before persisting exported content', () => {
    expect(stripThinkBlocks('<think>分析中</think>\n# 结论')).toBe('# 结论');
  });
});
