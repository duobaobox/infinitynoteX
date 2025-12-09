/**
 * AIChat Utils 测试
 * 测试 Markdown 转换、文本处理和剪贴板操作
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  renderMarkdownToHtml,
  buildPlainTextDoc,
  convertMarkdownToTipTap,
  splitParagraphs,
  copyToClipboard,
} from '../../../../src/components/AIChat/utils';

// Mock clipboard API
const mockWrite = vi.fn();
const mockWriteText = vi.fn();

Object.assign(navigator, {
  clipboard: {
    write: mockWrite,
    writeText: mockWriteText,
  },
});

// Mock document.execCommand
document.execCommand = vi.fn();

describe('AIChat Utils', () => {
  describe('splitParagraphs', () => {
    it('should split text by double newlines', () => {
      const text = 'Para 1\n\nPara 2\n\nPara 3';
      const result = splitParagraphs(text);
      expect(result).toEqual(['Para 1', 'Para 2', 'Para 3']);
    });

    it('should handle multiple newlines', () => {
      const text = 'Para 1\n\n\nPara 2';
      const result = splitParagraphs(text);
      expect(result).toEqual(['Para 1', 'Para 2']);
    });

    it('should ignore empty segments', () => {
      const text = '\n\nPara 1\n\n';
      const result = splitParagraphs(text);
      expect(result).toEqual(['Para 1']);
    });
  });

  describe('buildPlainTextDoc', () => {
    it('should create a document with single paragraph', () => {
      const text = 'Hello World';
      const doc = buildPlainTextDoc(text);
      expect(doc).toEqual({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Hello World' }],
          },
        ],
      });
    });

    it('should create a document with multiple paragraphs', () => {
      const text = 'Para 1\n\nPara 2';
      const doc = buildPlainTextDoc(text);
      expect(doc.content).toHaveLength(2);
      expect(doc.content![0].content![0].text).toBe('Para 1');
      expect(doc.content![1].content![0].text).toBe('Para 2');
    });

    it('should handle empty text', () => {
      const doc = buildPlainTextDoc('');
      expect(doc).toEqual({
        type: 'doc',
        content: [{ type: 'paragraph' }],
      });
    });
  });

  describe('copyToClipboard', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should use ClipboardItem API if available', async () => {
      // Mock ClipboardItem
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      global.ClipboardItem = vi.fn() as any;
      mockWrite.mockResolvedValueOnce(undefined);

      const result = await copyToClipboard('text', '<p>html</p>');

      expect(result).toBe(true);
      expect(mockWrite).toHaveBeenCalled();
      expect(global.ClipboardItem).toHaveBeenCalled();
    });

    it('should fallback to writeText if ClipboardItem fails', async () => {
      // Mock ClipboardItem fail or undefined
      // Here we assume it's defined but write fails
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      global.ClipboardItem = vi.fn() as any;
      mockWrite.mockRejectedValueOnce(new Error('Failed'));
      mockWriteText.mockResolvedValueOnce(undefined);

      const result = await copyToClipboard('text', '<p>html</p>');

      expect(result).toBe(true);
      expect(mockWriteText).toHaveBeenCalledWith('text');
    });

    it('should use writeText if html is not provided', async () => {
      mockWriteText.mockResolvedValueOnce(undefined);
      const result = await copyToClipboard('text');
      expect(result).toBe(true);
      expect(mockWriteText).toHaveBeenCalledWith('text');
      expect(mockWrite).not.toHaveBeenCalled();
    });

    it('should fallback to execCommand if clipboard API unavailable', async () => {
      // Temporarily remove clipboard API
      const originalClipboard = navigator.clipboard;
      Object.defineProperty(navigator, 'clipboard', {
        value: undefined,
        writable: true,
        configurable: true,
      });
      (document.execCommand as unknown as ReturnType<typeof vi.fn>).mockReturnValue(true);

      const result = await copyToClipboard('text');

      expect(result).toBe(true);
      expect(document.execCommand).toHaveBeenCalledWith('copy');

      // Restore
      Object.defineProperty(navigator, 'clipboard', {
        value: originalClipboard,
        writable: true,
        configurable: true,
      });
    });
  });

  // Note: renderMarkdownToHtml and convertMarkdownToTipTap rely on actual TipTap extensions
  // In JSDOM environment, they should work if dependencies are correct.
  describe('Markdown Conversion', () => {
    it('should convert simple markdown to HTML', () => {
      const markdown = '# Heading\n**Bold**';
      const html = renderMarkdownToHtml(markdown);

      // Checking for critical parts, exact HTML might vary slightly by version
      // Update: TipTap extensions add styles and classes
      expect(html).toContain('Heading</h1>'); // Match end tag to avoid style attributes mismatch
      expect(html).toContain('<strong>Bold</strong>');
    });

    it('should convert markdown to TipTap JSON', () => {
      const markdown = '# Heading';
      const json = convertMarkdownToTipTap(markdown);

      expect(json.type).toBe('doc');
      expect(json.content![0].type).toBe('heading');
      expect(json.content![0].attrs!.level).toBe(1);
      expect(json.content![0].content![0].text).toBe('Heading');
    });

    it('should handle code blocks in markdown', () => {
      const markdown = '```js\nconsole.log(1)\n```';
      const html = renderMarkdownToHtml(markdown);
      // Update: CodeBlockLowlight adds class
      expect(html).toMatch(/<pre class="code-block-lowlight">/);
      expect(html).toMatch(/<code class="language-js">/);
      expect(html).toContain('console.log(1)');
    });
  });
});
