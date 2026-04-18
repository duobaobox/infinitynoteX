/**
 * AIChat Utils - AI 对话工具函数
 */

/** 便签引用标题在 UI 中显示的最大长度 */
export const MAX_NOTE_TITLE_DISPLAY_LENGTH = 15;

import { Editor } from '@tiptap/core';
import { getExtensions } from '../../features/editor/extensions';
import {
  buildPlainTextDoc,
  convertMarkdownToTipTap,
  stripThinkBlocks,
} from '../../shared/utils/tiptapMarkdown';

export { buildPlainTextDoc, convertMarkdownToTipTap, stripThinkBlocks };

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
 * 从 TipTap JSON 内容中提取纯文本
 * 递归遍历节点，提取所有文本内容
 */
export const extractTipTapText = (content: unknown): string => {
  if (!content || typeof content !== 'object') return '';
  const node = content as { text?: string; content?: unknown[]; type?: string };
  let text = node.text || '';
  if (node.content && Array.isArray(node.content)) {
    for (const child of node.content) {
      text += extractTipTapText(child);
      const childNode = child as { type?: string };
      if (childNode.type === 'paragraph' || childNode.type === 'heading') {
        text += '\n';
      }
    }
  }
  return text;
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

/**
 * 截断标题，赋予其最大长度限制并添加省略号
 */
export const truncateTitle = (title: string, maxLength = MAX_NOTE_TITLE_DISPLAY_LENGTH): string => {
  if (!title) return '';
  if (title.length <= maxLength) return title;
  return title.slice(0, maxLength) + '...';
};
