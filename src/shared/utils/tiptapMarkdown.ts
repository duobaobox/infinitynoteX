import Link from '@tiptap/extension-link';
import { TableKit } from '@tiptap/extension-table';
import TaskItem from '@tiptap/extension-task-item';
import TaskList from '@tiptap/extension-task-list';
import Underline from '@tiptap/extension-underline';
import { Markdown, MarkdownManager } from '@tiptap/markdown';
import StarterKit from '@tiptap/starter-kit';

import type { TipTapJSONContent } from '../../services/types';

const markdownManager = new MarkdownManager({
  extensions: [
    StarterKit.configure({
      link: false,
      underline: false,
    }),
    Link.configure({
      openOnClick: false,
      autolink: true,
      defaultProtocol: 'https',
    }),
    Underline,
    TaskList.configure({
      HTMLAttributes: {
        class: 'task-list',
      },
    }),
    TaskItem.configure({
      nested: true,
      HTMLAttributes: {
        class: 'task-item',
      },
    }),
    TableKit.configure({
      table: {
        resizable: false,
      },
    }),
    Markdown.configure({}),
  ],
});

function isDocNode(content: unknown): content is TipTapJSONContent {
  return (
    typeof content === 'object' && content !== null && (content as TipTapJSONContent).type === 'doc'
  );
}

/**
 * 导出用：去掉 <think> 思考内容。
 * 用于“复制回答 / 保存到便签”等场景，避免把思考过程写入外部内容。
 */
export const stripThinkBlocks = (markdown: string): string => {
  if (!markdown) return '';

  const removedClosed = markdown.replace(/<think>[\s\S]*?<\/think>\s*/g, '');
  const removedOpen = removedClosed.replace(/<think>[\s\S]*/g, '');
  return removedOpen.trim();
};

/**
 * 构建纯文本 TipTap 文档
 */
export const buildPlainTextDoc = (text: string): TipTapJSONContent => {
  const paragraphs = text
    .split(/\n\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

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
      content: [{ type: 'text', text: paragraph }],
    })),
  };
};

/**
 * 将 Markdown 转换为 TipTap JSON。
 * 这里使用无界面的 MarkdownManager，保证主进程和渲染层都能得到同一类富文本结构。
 */
export const convertMarkdownToTipTap = (markdown: string): TipTapJSONContent => {
  if (!markdown?.trim()) {
    return buildPlainTextDoc('');
  }

  try {
    const json = markdownManager.parse(markdown);
    if (isDocNode(json)) {
      return json;
    }

    return {
      type: 'doc',
      content: json ? [json] : [],
    };
  } catch (error) {
    console.error('Failed to convert markdown to TipTap JSON:', error);
    return buildPlainTextDoc(markdown);
  }
};

/**
 * 将 Markdown 追加到现有 TipTap 文档末尾，保留新增内容的富文本结构。
 */
export const appendMarkdownToTipTapDoc = (
  existing: unknown,
  markdown: string,
): TipTapJSONContent => {
  const appended = convertMarkdownToTipTap(markdown);
  const appendedContent = appended.content ?? [];

  if (!isDocNode(existing)) {
    return appended;
  }

  const existingContent = existing.content ?? [];
  if (existingContent.length === 0) {
    return appended;
  }
  if (appendedContent.length === 0) {
    return existing;
  }

  return {
    ...existing,
    type: 'doc',
    content: [...existingContent, ...appendedContent],
  };
};
