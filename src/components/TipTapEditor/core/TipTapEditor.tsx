/**
 * TipTap Editor 主组件
 * 按照官方规范开发的富文本编辑器
 *
 * @see https://tiptap.dev/docs/editor/getting-started/overview
 */

import React, { useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { Input } from 'antd';
import { MenuBar } from '../menus/MenuBar';
import { BubbleMenus } from '../menus/BubbleMenu';
import { CharacterCount } from '../menus/components/CharacterCount';
import { getExtensions } from '../extensions';
import type { TipTapEditorProps } from '../types';
import { getThemeColor } from '../../../theme/theme';
import { scrollToTask } from '../utils/taskLocator';
import '../styles/editor.css';
import '../styles/table.css';
import '../styles/table-handles.css';
import '../styles/code-highlight.css';

/**
 * TipTap 编辑器组件
 *
 * 特性：
 * - 完整的富文本编辑功能
 * - 支持任务列表、图片、代码块等
 * - 响应式工具栏
 * - Context-Aware BubbleMenus 根据选中内容类型显示不同菜单
 * - TableHandles Notion 风格表格行/列手柄（悬停显示，点击弹出菜单）
 * - SlashCommands 输入 "/" 时弹出命令菜单
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
  showTitleInput = true,
  taskPath = null,
  onTaskLocated,
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
    extensions: getExtensions({ placeholder }),
    content: initialContent,
    editable,
    autofocus,
    /**
     * 性能优化配置 (TipTap 官方推荐)
     * @see https://tiptap.dev/docs/guides/performance
     */
    // 立即渲染编辑器，避免延迟
    immediatelyRender: true,
    // 禁用每次 transaction 时的自动重渲染，由我们手动控制
    shouldRerenderOnTransaction: false,
    // 内容更新回调
    onUpdate: ({ editor }) => {
      const json = editor.getJSON();
      // 记录最新内容，用于和外部传入内容做去抖比对，避免 setContent 导致光标跳动/换行
      lastSyncedContentRef.current = JSON.stringify(json);
      onContentChange?.(json as unknown as import('../../../services/types').TipTapJSONContent);
    },
    // 编辑器属性配置
    editorProps: {
      attributes: {
        class: `tiptap-editor ${className}`,
        spellcheck: 'false', // 禁用浏览器拼写检查
      },
    },
  });

  // 用于避免父组件每次 onUpdate 回传的内容再次触发 setContent，导致光标位置丢失/自动换行
  const lastSyncedContentRef = useRef<string | null>(null);
  // 使用内容引用来快速判断是否需要更新（避免昂贵的 JSON.stringify 比较）
  const lastContentRef = useRef<unknown>(null);

  // 编辑器就绪时初始化同步内容快照
  // 注意：故意不包含 initialContent，只在 editor 初始化时执行一次
  useEffect(() => {
    if (editor) {
      lastSyncedContentRef.current = JSON.stringify(editor.getJSON());
      lastContentRef.current = initialContent;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  // 当外部 initialContent 确实与当前内容不同（例如切换笔记）时，才更新编辑器内容
  useEffect(() => {
    if (!editor) return;

    // 快速引用比较：如果是同一个对象引用，跳过更新
    if (initialContent === lastContentRef.current) {
      return;
    }

    try {
      const incoming = JSON.stringify(initialContent ?? { type: 'doc', content: [] });
      if (incoming !== lastSyncedContentRef.current) {
        // 使用 requestAnimationFrame 确保 DOM 更新在下一帧执行，避免阻塞主线程
        requestAnimationFrame(() => {
          if (!editor.isDestroyed) {
            // 通过选项 emitUpdate: false，避免递归触发 onUpdate
            editor.commands.setContent(
              initialContent as import('@tiptap/pm/model').Node | Record<string, unknown>,
              { emitUpdate: false },
            );
            // 更新快照，保持与编辑器内部一致
            lastSyncedContentRef.current = JSON.stringify(editor.getJSON());
            lastContentRef.current = initialContent;
          }
        });
      } else {
        // 内容相同但引用不同，只更新引用
        lastContentRef.current = initialContent;
      }
    } catch (e) {
      // 如果序列化失败，兜底直接设置一次内容
      requestAnimationFrame(() => {
        if (!editor.isDestroyed) {
          editor.commands.setContent(
            initialContent as import('@tiptap/pm/model').Node | Record<string, unknown>,
            { emitUpdate: false },
          );
          lastSyncedContentRef.current = JSON.stringify(editor.getJSON());
          lastContentRef.current = initialContent;
        }
      });
    }
  }, [editor, initialContent]);

  // 任务定位：当 taskPath 参数变化或内容加载完成时，定位到对应任务
  useEffect(() => {
    if (!editor || !taskPath || taskPath.length === 0) {
      return;
    }

    let retryTimeout: ReturnType<typeof setTimeout> | null = null;

    // 等待编辑器内容完全加载并渲染完成
    // 增加更长的延迟，确保懒加载的组件和编辑器都已就绪
    const timeout = setTimeout(() => {
      if (!editor.isDestroyed) {
        // 检查编辑器是否有内容
        const hasContent = editor.state.doc.content.size > 2; // doc 至少有开始和结束标记

        if (hasContent) {
          scrollToTask(editor, taskPath);
          onTaskLocated?.();
        } else {
          // 如果内容还没加载，再次延迟尝试
          retryTimeout = setTimeout(() => {
            if (!editor.isDestroyed) {
              scrollToTask(editor, taskPath);
              onTaskLocated?.();
            }
          }, 300);
        }
      }
    }, 300); // 增加初始等待时间到 300ms

    return () => {
      clearTimeout(timeout);
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
    };
  }, [editor, taskPath, onTaskLocated, initialContent]); // 添加 initialContent 依赖

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
      {/* 标题输入框 - 可选显示 */}
      {showTitleInput && (
        <div className="editor-title-input">
          <Input
            placeholder="输入笔记标题..."
            value={title}
            onChange={(e) => onTitleChange?.(e.target.value)}
            size="large"
            variant="borderless"
          />
        </div>
      )}

      {/* 可选的菜单栏 */}
      {showMenuBar && <MenuBar editor={editor} />}

      {/* 编辑器内容区域 */}
      <div className="tiptap-editor-wrapper">
        {/* Context-Aware BubbleMenus - 根据选中内容类型显示不同菜单 */}
        {editable && <BubbleMenus editor={editor} />}

        {/* TableHandles - Notion 风格表格手柄，通过扩展实现 */}

        {/* SlashCommands - 输入 "/" 时弹出命令菜单（通过 extensions 集成，无需 JSX） */}

        <EditorContent editor={editor} />

        {/* 字符计数 - 显示在编辑器底部 */}
        <div className="editor-footer">
          <CharacterCount editor={editor} showWords={true} />
        </div>
      </div>
    </div>
  );
};

export default TipTapEditor;
