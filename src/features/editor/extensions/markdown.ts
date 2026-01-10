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

            // 如果有 HTML 内容，清除内联颜色样式后插入
            // 这解决了暗色模式下复制的深色文本不可见的问题
            if (html && html.trim().length > 0) {
              event.preventDefault();

              // 清除 HTML 中的内联 color 样式
              // 保留其他样式（如 background-color 用于高亮）
              const cleanedHtml = html
                // 移除 style 属性中的 color: xxx;
                .replace(/\bcolor\s*:\s*[^;"}]+;?/gi, '')
                // 清理可能残留的空 style 属性
                .replace(/\bstyle\s*=\s*["']\s*["']/gi, '');

              // 使用清理后的 HTML 插入
              editor.commands.insertContent(cleanedHtml, {
                contentType: 'html',
              });
              return true;
            }

            // 检测是否为 Markdown 格式
            if (!text || !isLikelyMarkdown(text)) {
              return false; // 不是 Markdown，让默认处理器处理
            }

            // 阻止默认粘贴行为
            event.preventDefault();

            // 使用 Markdown 扩展解析并插入内容
            try {
              // 关键：使用 contentType: 'markdown' 告诉 TipTap 按 Markdown 格式解析
              editor.commands.insertContent(text, {
                contentType: 'markdown',
              });
              return true;
            } catch (error) {
              console.error('[MarkdownPasteHandler] Failed to parse markdown:', error);
              // 解析失败，回退到普通文本插入
              editor.commands.insertContent(text);
              return true;
            }
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
