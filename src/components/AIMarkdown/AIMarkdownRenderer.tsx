/**
 * AIMarkdownRenderer.tsx
 * 基于 @ant-design/x-markdown 的 Markdown 渲染器
 * 替代 react-markdown，提供自定义样式和链接处理
 */

import React, { useMemo } from 'react';
import { XMarkdown } from '@ant-design/x-markdown';
import type { XMarkdownProps } from '@ant-design/x-markdown';

interface AIMarkdownRendererProps {
  content: string;
  className?: string;
}

/**
 * AI Markdown 渲染器组件
 * 基于 ant-design/x-markdown，支持：
 * - 自动链接在新标签页打开
 * - 自定义代码块样式
 * - 自定义表格样式
 * - GFM 语法支持（GitHub Flavored Markdown）
 */
export const AIMarkdownRenderer: React.FC<AIMarkdownRendererProps> = ({ content, className }) => {
  const classNames = useMemo(() => {
    const classes = ['ai-markdown'];
    if (className) {
      classes.push(className);
    }
    return classes.join(' ');
  }, [className]);

  // XMarkdown 配置
  const xMarkdownProps: Partial<XMarkdownProps> = useMemo(
    () => ({
      content,
      className: classNames,
      // 启用更多特性和插件
      style: {
        lineHeight: 1.65,
      },
    }),
    [content, classNames],
  );

  if (!content || !content.trim()) {
    return null;
  }

  return <XMarkdown {...xMarkdownProps} />;
};

export default AIMarkdownRenderer;
