/**
 * MarkdownRenderer.tsx
 * AI 对话专用的 Markdown 渲染器
 *
 * 内部组件，仅供 AIChatPanel 使用
 * 基于 @ant-design/x-markdown 2.1
 * 支持：流式渲染、代码高亮、Mermaid 图表、Think 思维链、Sources 引用
 */

import React, { useMemo, useEffect, useState } from 'react';
import { XMarkdown, type ComponentProps } from '@ant-design/x-markdown';
import type { XMarkdownProps } from '@ant-design/x-markdown';
import { CodeHighlighter, Mermaid, Think, Sources } from '@ant-design/x';
import '@ant-design/x-markdown/themes/light.css';

/**
 * 引用来源项
 */
export interface SourceItem {
  key: number;
  title: string;
  description?: string;
  noteId?: string; // 用于后续扩展点击跳转
}

export interface MarkdownRendererProps {
  content: string;
  className?: string;
  streaming?: XMarkdownProps['streaming'];
  /** 引用来源列表（用于展示 [来源 X] 标签） */
  sources?: SourceItem[];
}

/**
 * 代码块组件 - 处理 Mermaid 图表
 */
const Code: React.FC<ComponentProps> = (props) => {
  const { className, children } = props;
  const lang = className?.match(/language-(\w+)/)?.[1] || '';
  const inline = Boolean((props as { inline?: boolean } | undefined)?.inline);

  const codeText = Array.isArray(children)
    ? children.join('')
    : typeof children === 'string'
      ? children
      : children == null
        ? ''
        : String(children);

  if (!codeText) return null;

  // Mermaid 图表 - 使用官方 Mermaid 组件
  if (lang === 'mermaid') {
    return <Mermaid>{codeText}</Mermaid>;
  }

  // 行内代码保持原样
  if (inline) {
    return <code className={className}>{codeText}</code>;
  }

  // 代码块使用官方 CodeHighlighter（带语言头部 + 复制）
  return <CodeHighlighter lang={lang || undefined}>{codeText}</CodeHighlighter>;
};

/**
 * Think 组件 - 处理思维链
 * 根据 streamStatus 初始值设置状态，避免历史对话加载时的闪烁
 *
 * 参考 Ant Design X 官方实现：
 * - 使用 React.memo 优化渲染性能
 * - 流式状态 'done' 时自动折叠并显示"思考完成"
 * - 支持点击切换展开/折叠状态
 */
const ThinkComponent = React.memo<ComponentProps>((props) => {
  // 根据初始流状态决定初始显示状态
  // done = 历史对话，直接折叠；loading = 正在流式输出，展开
  const isDone = props.streamStatus === 'done';

  const [title, setTitle] = useState(isDone ? '思考完成' : '深度思考中...');
  const [loading, setLoading] = useState(!isDone);
  const [expand, setExpand] = useState(!isDone);

  useEffect(() => {
    if (props.streamStatus === 'done') {
      setTitle('思考完成');
      setLoading(false);
      setExpand(false);
    }
  }, [props.streamStatus]);

  return (
    <Think title={title} loading={loading} expanded={expand} onClick={() => setExpand(!expand)}>
      {props.children}
    </Think>
  );
});

/**
 * 创建 Sup 组件的工厂函数
 * 需要传入 sources 数据以便渲染引用来源
 */
const createSupComponent = (sources: SourceItem[]) => {
  return React.memo<ComponentProps>((props) => {
    const childText = String(props.children || '');
    const refIndex = parseInt(childText, 10);

    // 如果不是数字或没有匹配的 source，显示原始上标
    if (isNaN(refIndex) || sources.length === 0) {
      return <sup>{props.children}</sup>;
    }

    // 转换为 Sources 组件需要的 items 格式
    const items = sources.map((s) => ({
      key: s.key,
      title: `${s.key}. ${s.title}`,
      description: s.description,
    }));

    return <Sources activeKey={refIndex} title={props.children} items={items} inline={true} />;
  });
};

/**
 * Markdown 渲染器组件
 * - 统一 Markdown 渲染策略
 * - 支持 XMarkdown 流式渲染能力
 * - 支持 Mermaid 图表渲染（官方组件）
 * - 支持 Think 思维链渲染（官方组件）
 * - 支持 Sources 引用来源展示（官方组件）
 * - 使用官方 light 主题样式
 */
export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  className,
  streaming,
  sources = [],
}) => {
  const classNames = useMemo(() => {
    const classes = ['x-markdown-light'];
    if (className) classes.push(className);
    return classes.join(' ');
  }, [className]);

  // 动态创建 Sup 组件（依赖 sources）
  const SupComponent = useMemo(() => createSupComponent(sources), [sources]);

  if (!content || !content.trim()) {
    return null;
  }

  return (
    <XMarkdown
      content={content}
      className={classNames}
      style={{ lineHeight: 1.65 }}
      components={{
        code: Code,
        think: ThinkComponent,
        sup: SupComponent,
      }}
      paragraphTag="div"
      streaming={streaming}
    />
  );
};

export default MarkdownRenderer;
