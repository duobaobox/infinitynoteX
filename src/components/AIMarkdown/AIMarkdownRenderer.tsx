/**
 * AIMarkdownRenderer.tsx
 * 基于 @ant-design/x-markdown 2.0 的 Markdown 渲染器
 * 支持流式渲染、代码高亮等功能
 */

import React, { useMemo } from 'react';
import { XMarkdown } from '@ant-design/x-markdown';
import type { ComponentProps, XMarkdownProps } from '@ant-design/x-markdown';

type CodeComponentProps = ComponentProps<{
  block?: boolean;
  className?: string;
}>;

export interface AIMarkdownRendererProps {
  content: string;
  className?: string;
  streaming?: XMarkdownProps['streaming'];
}

const extractText = (node: React.ReactNode): string => {
  if (node == null) return '';
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(extractText).join('');
  }
  if (React.isValidElement(node)) {
    return extractText(node.props.children);
  }
  return '';
};

/**
 * 代码块渲染组件
 * 支持行内代码和代码块的区分渲染
 */
const CodeRenderer: React.FC<CodeComponentProps> = (props) => {
  const { className = '', children, block } = props;
  const langMatch = className.match(/language-([\w-]+)/i);
  const language = langMatch?.[1]?.toLowerCase() ?? 'plaintext';
  const rawContent = extractText(children);
  const normalizedContent = block ? rawContent.replace(/\s+$/g, '\n') : rawContent;

  // 行内代码
  if (!block) {
    return <code className={className}>{children}</code>;
  }

  // 代码块 - 使用简单样式渲染
  return (
    <pre className={`code-block language-${language}`}>
      <div className="code-header">
        <span className="code-language">{language}</span>
      </div>
      <code className={`language-${language}`}>{normalizedContent}</code>
    </pre>
  );
};

/**
 * AI Markdown 渲染器组件
 * - 统一 Markdown 渲染策略
 * - 支持 XMarkdown 流式渲染能力（用于 AI 流式回答）
 */
export const AIMarkdownRenderer: React.FC<AIMarkdownRendererProps> = ({
  content,
  className,
  streaming,
}) => {
  const classNames = useMemo(() => {
    const classes = ['ai-markdown'];
    if (className) classes.push(className);
    return classes.join(' ');
  }, [className]);

  const components = useMemo<XMarkdownProps['components']>(
    () => ({
      code: CodeRenderer,
    }),
    [],
  );

  if (!content || !content.trim()) {
    return null;
  }

  return (
    <XMarkdown
      content={content}
      className={classNames}
      style={{ lineHeight: 1.65 }}
      openLinksInNewTab
      components={components}
      streaming={streaming}
    />
  );
};

export default AIMarkdownRenderer;
