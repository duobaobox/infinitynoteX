/**
 * TipTap Editor 主组件
 * 按照官方规范开发的富文本编辑器
 *
 * @see https://tiptap.dev/docs/editor/getting-started/overview
 */

import React, { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { Input } from 'antd';
import { MenuBar } from './MenuBar';
import { BubbleMenu } from './BubbleMenu';
import { getExtensions } from './extensions';
import type { TipTapEditorProps } from './types';
import { getThemeColor } from '../../theme/theme';
import './TipTapEditor.css';
import './table.css';

/**
 * TipTap 编辑器组件
 *
 * 特性：
 * - 完整的富文本编辑功能
 * - 支持任务列表、图片、代码块等
 * - 响应式工具栏
 * - TypeScript 类型安全
 */
const TipTapEditor: React.FC<TipTapEditorProps> = ({
  initialContent = { type: 'doc', content: [] },
  onContentChange,
  placeholder = '开始输入...',
  editable = true,
  autofocus = false,
  className = '',
  showMenuBar = true,
  title = '',
  onTitleChange,
}) => {
  const [themeColor, setThemeColor] = React.useState(getThemeColor());

  React.useEffect(() => {
    const handler = (e: Event) => {
      const color = (e as unknown as CustomEvent<string>).detail;
      if (typeof color === 'string' && color) setThemeColor(color);
    };
    window.addEventListener('theme-color-change', handler as EventListener);
    return () => window.removeEventListener('theme-color-change', handler as EventListener);
  }, []);

  // 将十六进制颜色转为 RGB 格式
  function hexToRgb(hex: string): string {
    if (/^#([0-9a-fA-F]{6})$/.test(hex)) {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `${r}, ${g}, ${b}`;
    }
    if (/^#([0-9a-fA-F]{3})$/.test(hex)) {
      const r = parseInt(hex[1] + hex[1], 16);
      const g = parseInt(hex[2] + hex[2], 16);
      const b = parseInt(hex[3] + hex[3], 16);
      return `${r}, ${g}, ${b}`;
    }
    return '24, 144, 255'; // 默认蓝色
  }
  // 使用 useEditor Hook 创建编辑器实例
  const editor = useEditor({
    extensions: getExtensions(placeholder),
    content: initialContent,
    editable,
    autofocus,
    // 内容更新回调
    onUpdate: ({ editor }) => {
      const json = editor.getJSON();
      onContentChange?.(json as unknown as import('../../services/types').TipTapJSONContent);
    },
    // 编辑器属性配置
    editorProps: {
      attributes: {
        class: `tiptap-editor ${className}`,
      },
    },
  });

  // 当 initialContent 变化时更新编辑器内容
  useEffect(() => {
    if (editor) {
      editor.commands.setContent(initialContent);
    }
  }, [editor, initialContent]);

  // 组件卸载时销毁编辑器实例（官方推荐）
  useEffect(() => {
    return () => {
      editor?.destroy();
    };
  }, [editor]);

  if (!editor) {
    return null;
  }

  return (
    <div
      className="tiptap-container"
      style={
        {
          '--theme-color': themeColor,
          '--theme-color-rgb': hexToRgb(themeColor),
        } as React.CSSProperties
      }
    >
      {/* 标题输入框 - 放在最上面 */}
      <div className="editor-title-input">
        <Input
          placeholder="输入笔记标题..."
          value={title}
          onChange={(e) => onTitleChange?.(e.target.value)}
          size="large"
          bordered={false}
        />
      </div>

      {/* 可选的菜单栏 */}
      {showMenuBar && <MenuBar editor={editor} />}

      {/* 气泡菜单 - 选中文本时浮动显示 */}
      <BubbleMenu editor={editor} />

      {/* 编辑器内容区域 */}
      <div className="tiptap-editor-wrapper">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
};

export default TipTapEditor;
