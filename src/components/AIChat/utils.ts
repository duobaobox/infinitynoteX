/**
 * AIChat Utils - AI 对话工具函数
 */

import { generateJSON } from '@tiptap/html';
import { marked } from 'marked';
import type { TipTapJSONContent } from '../../services/types';
import { getExtensions } from '../TipTapEditor/extensions';

/**
 * 将 markdown 转换为 HTML
 */
export const renderMarkdownToHtml = (markdown: string): string => {
  try {
    const html = marked.parse(markdown) as string;
    return html || '';
  } catch (error) {
    console.error('Failed to convert markdown to HTML:', error);
    // 降级处理
    return markdown
      .replace(/^### (.*?)$/gm, '<h3>$1</h3>')
      .replace(/^## (.*?)$/gm, '<h2>$1</h2>')
      .replace(/^# (.*?)$/gm, '<h1>$1</h1>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>');
  }
};

/**
 * 构建纯文本 TipTap 文档
 */
export const buildPlainTextDoc = (text: string): TipTapJSONContent => {
  const paragraphs = text
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  if (paragraphs.length === 0) {
    return {
      type: 'doc',
      content: [{ type: 'paragraph' }],
    };
  }

  return {
    type: 'doc',
    content: paragraphs.map((paragraph) => ({
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: paragraph,
        },
      ],
    })),
  };
};

/**
 * 将 Markdown 转换为 TipTap JSON
 */
export const convertMarkdownToTipTap = (markdown: string): TipTapJSONContent => {
  if (!markdown?.trim()) {
    return buildPlainTextDoc('');
  }

  try {
    // 使用 marked 将 markdown 转换为 HTML
    const html = marked.parse(markdown) as string;

    if (!html || !html.trim()) {
      return buildPlainTextDoc(markdown);
    }

    // 使用 TipTap 的 generateJSON 从 HTML 生成 JSON
    const extensions = getExtensions();
    const json = generateJSON(html, extensions);

    if (json?.type === 'doc') {
      return json as TipTapJSONContent;
    }

    return {
      type: 'doc',
      content: json ? [json as TipTapJSONContent] : [],
    };
  } catch (error) {
    console.error('Failed to convert markdown to TipTap JSON:', error);
    return buildPlainTextDoc(markdown);
  }
};

/**
 * 分割文本为段落
 */
export const splitParagraphs = (text: string): string[] =>
  text
    .split(/\n{2,}/)
    .map((segment) => segment.trimEnd())
    .filter((segment) => segment.trim().length > 0);

/**
 * 复制文本到剪贴板（支持富文本）
 */
export const copyToClipboard = async (text: string, html?: string): Promise<boolean> => {
  // 尝试使用 ClipboardItem API（支持富文本）
  const copyWithClipboardItem = async () => {
    if (!html) return false;
    if (typeof ClipboardItem === 'undefined' || !navigator?.clipboard?.write) {
      return false;
    }
    try {
      const itemData: Record<string, Blob> = {
        'text/plain': new Blob([text], { type: 'text/plain' }),
        'text/html': new Blob([html], { type: 'text/html' }),
      };
      await navigator.clipboard.write([new ClipboardItem(itemData)]);
      return true;
    } catch (error) {
      console.warn('Clipboard HTML copy failed, fallback to text.', error);
      return false;
    }
  };

  // 尝试使用 writeText API
  const copyWithClipboardText = async () => {
    if (!navigator?.clipboard?.writeText) {
      return false;
    }
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  };

  // DOM 降级方案
  const copyWithDomFallback = () => {
    const tempContainer = document.createElement('div');
    tempContainer.style.position = 'fixed';
    tempContainer.style.opacity = '0';
    tempContainer.style.pointerEvents = 'none';
    tempContainer.innerHTML = html || text;
    document.body.appendChild(tempContainer);
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(tempContainer);
    selection?.removeAllRanges();
    selection?.addRange(range);
    document.execCommand('copy');
    selection?.removeAllRanges();
    document.body.removeChild(tempContainer);
    return true;
  };

  // 依次尝试各种复制方式
  if (await copyWithClipboardItem()) return true;
  if (await copyWithClipboardText()) return true;
  return copyWithDomFallback();
};
