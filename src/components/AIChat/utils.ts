/**
 * AIChat Utils - AI 对话工具函数
 */

import { Editor } from '@tiptap/core';
import type { TipTapJSONContent } from '../../services/types';
import { getExtensions } from '../TipTapEditor/extensions';

/**
 * 创建临时编辑器用于 Markdown 转换
 * 使用 @tiptap/markdown 扩展的能力
 */
const createTempEditor = () => {
  const extensions = getExtensions();
  return new Editor({
    extensions,
    content: '',
  });
};

/**
 * 导出用：去掉 <think> 思考内容。
 * 用于“复制回答 / 保存到便签”等场景，避免把思考过程写入外部内容。
 */
export const stripThinkBlocks = (markdown: string): string => {
  if (!markdown) return '';

  const removedClosed = markdown.replace(/<think>[\s\S]*?<\/think>\s*/g, '');
  // 容错：未闭合的 <think>，直接从 <think> 起丢弃到结尾
  const removedOpen = removedClosed.replace(/<think>[\s\S]*/g, '');
  return removedOpen.trim();
};

/**
 * 将 Markdown 转换为 HTML
 * 使用 TipTap 的 Markdown 扩展进行转换
 */
export const renderMarkdownToHtml = (markdown: string): string => {
  if (!markdown?.trim()) {
    return '';
  }

  try {
    const editor = createTempEditor();
    // 关键：使用 contentType: 'markdown' 告诉 TipTap 按 Markdown 格式解析
    editor.commands.setContent(markdown, { contentType: 'markdown' });
    const html = editor.getHTML();
    editor.destroy();
    return html;
  } catch (error) {
    console.error('Failed to convert markdown to HTML:', error);
    // 降级处理：简单的正则替换
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
 * 使用 @tiptap/markdown 扩展进行转换
 */
export const convertMarkdownToTipTap = (markdown: string): TipTapJSONContent => {
  if (!markdown?.trim()) {
    return buildPlainTextDoc('');
  }

  try {
    const editor = createTempEditor();
    // 关键：使用 contentType: 'markdown' 告诉 TipTap 按 Markdown 格式解析
    editor.commands.setContent(markdown, { contentType: 'markdown' });
    const json = editor.getJSON();
    editor.destroy();

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
