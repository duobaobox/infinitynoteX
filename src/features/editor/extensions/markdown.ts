/**
 * Markdown 扩展配置
 *
 * 提供 Markdown 粘贴转富文本功能
 * 预留导入/导出能力供后续开发
 *
 * @see https://tiptap.dev/docs/extensions/functionality/markdown
 */

import { Extension } from '@tiptap/core';
import { Markdown } from '@tiptap/markdown';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { createMermaidCodeBlock, isLikelyMermaid } from './mermaid';

/**
 * 检测文本是否可能是 Markdown 格式
 */
const isLikelyMarkdown = (text: string): boolean => {
  if (!text || text.trim().length === 0) return false;

  // Markdown 特征检测
  const markdownPatterns = [
    /^#{1,6}\s+.+/m, // 标题 # ## ###
    /\*\*[^*]+\*\*/, // 粗体 **text**
    /\*[^*]+\*/, // 斜体 *text*
    /__[^_]+__/, // 粗体 __text__
    /_[^_]+_/, // 斜体 _text_
    /^\s*[-*+]\s+.+/m, // 无序列表
    /^\s*\d+\.\s+.+/m, // 有序列表
    /^\s*>\s+.+/m, // 引用
    /`[^`]+`/, // 行内代码
    /```[\s\S]*```/, // 代码块
    /\[.+\]\(.+\)/, // 链接 [text](url)
    /^\|.+\|$/m, // 表格
    /^---+$/m, // 分隔线
  ];

  return markdownPatterns.some((pattern) => pattern.test(text));
};

/**
 * 检测 HTML 是否包含实际的富文本格式标签
 * 用于区分"真正的富文本"和"代码编辑器的简单包装"
 */
const isRichTextHtml = (html: string): boolean => {
  if (!html || html.trim().length === 0) return false;

  // 富文本标签 - 表示内容有实际格式
  const richTextTags = [
    /<(strong|b|em|i|u|s|strike|del|ins|mark|sub|sup|h[1-6]|blockquote|ul|ol|li|table|thead|tbody|tr|td|th|a|img|hr|br)\b/i,
  ];

  // 检查是否包含富文本标签
  const hasRichTags = richTextTags.some((pattern) => pattern.test(html));

  // 如果只有 pre/code/span/div/p 包装，不算富文本
  // 常见于代码编辑器复制的内容
  if (!hasRichTags) {
    // 移除所有标签后检查是否只剩纯文本
    const stripped = html.replace(/<[^>]*>/g, '').trim();
    const originalText = html.replace(/<[^>]*>/g, '').trim();
    // 如果去除标签后内容相同，说明标签没有实际格式意义
    return stripped !== originalText;
  }

  return hasRichTags;
};

/**
 * Markdown 粘贴处理扩展
 *
 * 功能：
 * - 拦截粘贴事件，检测是否为 Markdown 格式
 * - 如果是 Markdown，使用 TipTap Markdown 扩展解析并插入
 * - 如果不是，让默认处理器处理
 */
export const MarkdownPasteHandler = Extension.create({
  name: 'markdownPasteHandler',

  // 确保在 Markdown 扩展之后加载
  priority: 50,

  addProseMirrorPlugins() {
    const editor = this.editor;

    return [
      new Plugin({
        key: new PluginKey('markdownPasteHandler'),

        props: {
          /**
           * 处理粘贴事件
           */
          handlePaste(_view, event) {
            const clipboardData = event.clipboardData;
            if (!clipboardData) return false;

            // 获取纯文本内容
            const text = clipboardData.getData('text/plain');
            // 获取 HTML 内容（如果有）
            const html = clipboardData.getData('text/html');

            // 检测纯文本是否为 Markdown 格式
            const textIsMarkdown = text && isLikelyMarkdown(text);
            // 检测纯文本是否为 Mermaid 图表源码
            const textIsMermaid = text && isLikelyMermaid(text);
            // 检测 HTML 是否包含实际的富文本格式
            const htmlIsRichText = html && isRichTextHtml(html);

            // 策略：
            // 1. 如果纯文本是 Markdown，且 HTML 没有实际富文本格式 → 按 Markdown 解析
            // 2. 如果 HTML 有实际富文本格式 → 使用 HTML 保持格式
            // 3. 其他情况 → 默认处理

            if (textIsMarkdown && !htmlIsRichText) {
              // 纯文本是 Markdown，且 HTML 只是简单包装 → 按 Markdown 解析
              event.preventDefault();

              try {
                editor.commands.insertContent(text, {
                  contentType: 'markdown',
                });
                return true;
              } catch (error) {
                console.error('[MarkdownPasteHandler] Failed to parse markdown:', error);
                editor.commands.insertContent(text);
                return true;
              }
            }

            if (textIsMermaid) {
              event.preventDefault();

              try {
                editor.commands.insertContent(createMermaidCodeBlock(text));
                return true;
              } catch (error) {
                console.error('[MarkdownPasteHandler] Failed to insert mermaid block:', error);
                editor.commands.insertContent(text);
                return true;
              }
            }

            if (html && html.trim().length > 0) {
              // 有 HTML 内容（且不是纯 Markdown 场景） → 清除颜色后使用 HTML
              event.preventDefault();

              const cleanedHtml = html
                .replace(/\bcolor\s*:\s*[^;"}]+;?/gi, '')
                .replace(/\bstyle\s*=\s*["']\s*["']/gi, '');

              editor.commands.insertContent(cleanedHtml, {
                contentType: 'html',
              });
              return true;
            }

            // 其他情况，让默认处理器处理
            return false;
          },
        },
      }),
    ];
  },
});

/**
 * 获取 Markdown 相关扩展
 *
 * 功能：
 * - 粘贴 Markdown 文本自动转换为富文本
 * - 提供 editor.getMarkdown() 方法（预留）
 * - 提供 editor.commands.setContent(markdown) 能力（预留）
 */
export const getMarkdownExtensions = () => {
  return [
    // Markdown 核心扩展 - 提供解析和序列化能力
    Markdown.configure({
      // 配置选项
    }),
    // Markdown 粘贴处理扩展
    MarkdownPasteHandler,
  ];
};

// 导出单个扩展获取函数（兼容旧调用）
export const getMarkdownExtension = () => Markdown.configure({});

export default Markdown;
