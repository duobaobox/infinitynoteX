/**
 * MarkdownRenderer.tsx
 * AI 对话专用的 Markdown 渲染器
 *
 * 内部组件，仅供 AIChatPanel 使用
 * 基于 @ant-design/x-markdown 2.1
 * 支持：流式渲染、代码高亮、Mermaid 图表、Think 思维链
 */

import React, { useMemo, useEffect, useState } from 'react';
import { XMarkdown, type ComponentProps } from '@ant-design/x-markdown';
import type { XMarkdownProps } from '@ant-design/x-markdown';
import { Mermaid, Think } from '@ant-design/x';
import '@ant-design/x-markdown/themes/light.css';

export interface MarkdownRendererProps {
  content: string;
  className?: string;
  streaming?: XMarkdownProps['streaming'];
}

/**
 * 代码块组件 - 处理 Mermaid 图表
 */
const Code: React.FC<ComponentProps> = (props) => {
  const { className, children } = props;
  const lang = className?.match(/language-(\w+)/)?.[1] || '';

  if (typeof children !== 'string') return null;

  // Mermaid 图表 - 使用官方 Mermaid 组件
  if (lang === 'mermaid') {
    return <Mermaid>{children}</Mermaid>;
  }

  // 普通代码块
  return <code className={className}>{children}</code>;
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
 * Markdown 渲染器组件
 * - 统一 Markdown 渲染策略
 * - 支持 XMarkdown 流式渲染能力
 * - 支持 Mermaid 图表渲染（官方组件）
 * - 支持 Think 思维链渲染（官方组件）
 * - 使用官方 light 主题样式
 */
export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  className,
  streaming,
}) => {
  const classNames = useMemo(() => {
    const classes = ['x-markdown-light'];
    if (className) classes.push(className);
    return classes.join(' ');
  }, [className]);

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
      }}
      paragraphTag="div"
      streaming={streaming}
    />
  );
};

export default MarkdownRenderer;
