import { describe, expect, it } from 'vitest';
import {
  createMermaidCodeBlock,
  DEFAULT_MERMAID_TEMPLATE,
  MERMAID_LANGUAGE,
  formatMermaidValidationError,
  isLikelyMermaid,
  validateMermaidSyntax,
} from '../../../../src/features/editor/extensions/mermaid';

describe('isLikelyMermaid', () => {
  it('识别裸 graph 语法的 Mermaid 文本', () => {
    const text = `graph TD
    A[开始] --> B{判断}
    B --> C[结束]`;

    expect(isLikelyMermaid(text)).toBe(true);
  });

  it('支持 Mermaid 注释开头的文本', () => {
    const text = `%% 这是注释
    %% 第二行注释
    flowchart LR
    A --> B`;

    expect(isLikelyMermaid(text)).toBe(true);
  });

  it('不会把普通文本误判为 Mermaid', () => {
    const text = `今天要整理部署流程图，graph TD 这个关键字先记一下。`;

    expect(isLikelyMermaid(text)).toBe(false);
  });

  it('创建 Mermaid 代码块时会带上正确语言与内容', () => {
    const block = createMermaidCodeBlock(DEFAULT_MERMAID_TEMPLATE);

    expect(block.type).toBe('codeBlock');
    expect(block.attrs?.language).toBe(MERMAID_LANGUAGE);
    expect(block.content?.[0]).toMatchObject({
      type: 'text',
      text: DEFAULT_MERMAID_TEMPLATE,
    });
  });

  it('会把 Mermaid 解析错误整理成友好提示', () => {
    const result = formatMermaidValidationError({
      message: 'Parse error on line 3',
      hash: {
        line: 2,
        token: 'EOF',
      },
    });

    expect(result.valid).toBe(false);
    expect(result.line).toBe(2);
    expect(result.message).toContain('第 2 行');
    expect(result.hint).toContain('写完整');
    expect(result.detail).toContain('Parse error');
  });

  it('验证合法 Mermaid 时返回成功状态', async () => {
    const result = await validateMermaidSyntax(`graph TD
    A[开始] --> B[结束]`);

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.diagramType).toBe('flowchart-v2');
    }
  });

  it('验证非法 Mermaid 时返回可展示的错误信息', async () => {
    const result = await validateMermaidSyntax(`graph TD
    A-->`);

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.line).toBe(2);
      expect(result.message).toContain('第 2 行');
      expect(result.hint).toContain('写完整');
      expect(result.detail).toContain('Parse error');
    }
  });
});
