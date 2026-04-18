import { describe, expect, it } from 'vitest';

import { buildModelMessages, mergeReasoningAndText } from '../../../../electron/ai/contextBuilder';

function flattenMessageContent(content: unknown): string {
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) =>
        typeof part === 'object' && part !== null && 'text' in part ? String(part.text) : '',
      )
      .join('\n');
  }

  return '';
}

describe('contextBuilder', () => {
  it('injects system prompt, RAG context, history references, and current user message in order', () => {
    const messages = buildModelMessages(
      {
        providerId: 'openai',
        provider: 'OpenAI',
        baseURL: 'https://api.openai.com/v1',
        apiKey: 'test',
        model: 'gpt-4o',
        systemPrompt: '你是一个助手',
      },
      {
        message: '请总结一下',
        messages: [
          {
            role: 'user',
            content: '看一下这段内容',
            references: [
              {
                id: 'note-1',
                title: '项目记录',
                byteLength: 120,
                content: '这是引用内容',
              },
            ],
          },
          {
            role: 'assistant',
            content: '好的，我先看一下。',
          },
        ],
        references: [
          {
            id: 'note-2',
            title: '当前便签',
            byteLength: 80,
            content: '当前消息引用',
          },
        ],
        ragContext: {
          results: [
            {
              noteId: 'note-3',
              noteTitle: '知识库命中',
              excerpt: '相关知识库片段',
              score: 0.88,
            },
          ],
        },
      },
    );

    expect(messages[0]).toMatchObject({ role: 'system', content: '你是一个助手' });
    expect(messages[1]).toMatchObject({ role: 'system' });
    expect(String(messages[1].content)).toContain('工具执行规则');
    expect(messages[2]).toMatchObject({ role: 'system' });
    expect(messages[3]).toMatchObject({ role: 'user', content: '看一下这段内容' });
    expect(messages[4]).toMatchObject({ role: 'assistant', content: '好的，我先看一下。' });
    expect(messages[5]).toMatchObject({ role: 'system' });
    expect(messages[6]).toMatchObject({ role: 'system' });
    expect(messages[7]).toMatchObject({ role: 'user', content: '请总结一下' });
  });

  it('merges reasoning into think blocks for compatibility with existing UI', () => {
    expect(mergeReasoningAndText('先分析问题', '这是结论')).toBe(
      '<think>先分析问题</think>\n这是结论',
    );
    expect(mergeReasoningAndText(undefined, '这是结论')).toBe('这是结论');
  });

  it('trims oversized history by token budget instead of only fixed message count', () => {
    const longHistory = Array.from({ length: 10 }, (_, index) => ({
      role: index % 2 === 0 ? ('user' as const) : ('assistant' as const),
      content: `历史消息-${index}-` + 'A'.repeat(9000),
    }));

    const messages = buildModelMessages(
      {
        providerId: 'custom',
        provider: 'Custom',
        baseURL: 'https://example.com/v1',
        apiKey: 'test',
        model: 'unknown-model',
        max_tokens: 2048,
      },
      {
        message: '当前问题',
        messages: longHistory,
      },
    );

    const joined = messages.map((message) => flattenMessageContent(message.content)).join('\n');

    expect(joined).not.toContain('历史消息-0-');
    expect(joined).toContain('历史消息-9-');
  });
});
