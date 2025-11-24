/**
 * AIMarkdownRenderer.tsx
 * 基于 @ant-design/x-markdown 2.0 的 Markdown 渲染器
 * 统一接入官方插件（代码高亮、Mermaid、Latex 等），确保流式渲染规范
 */

import React, { useMemo } from 'react';
import { XMarkdown } from '@ant-design/x-markdown';
import type { ComponentProps, XMarkdownProps } from '@ant-design/x-markdown';
import Latex from '@ant-design/x-markdown/plugins/Latex';
import HighlightCode from '@ant-design/x-markdown/plugins/HighlightCode';
import Mermaid from '@ant-design/x-markdown/plugins/Mermaid';

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

const CodeRenderer: React.FC<CodeComponentProps> = (props) => {
  const { className = '', children, block } = props;
  const langMatch = className.match(/language-([\w-]+)/i);
  const language = langMatch?.[1]?.toLowerCase() ?? '';
  const rawContent = extractText(children);
  const normalizedContent = block ? rawContent.replace(/\s+$/g, '\n') : rawContent;

  if (block && language === 'mermaid') {
    return <Mermaid>{normalizedContent}</Mermaid>;
  }

  if (block) {
    return (
      <HighlightCode lang={language || 'plaintext'} header={null}>
        {normalizedContent}
      </HighlightCode>
    );
  }

  return <code className={className}>{children}</code>;
};

/**
 * AI Markdown 渲染器组件
 * - 统一 Markdown 渲染与插件策略
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

  const markedConfig = useMemo<XMarkdownProps['config']>(
    () => ({
      extensions: Latex(),
    }),
    [],
  );

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
      config={markedConfig}
      components={components}
      streaming={streaming}
    />
  );
};

export default AIMarkdownRenderer;
