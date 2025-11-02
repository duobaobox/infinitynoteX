/**
 * TipTap 气泡菜单组件
 * 选中文本时浮动显示，提供快捷格式化操作
 * 在表格中时显示表格相关功能
 *
 * 官方最佳实践：
 * - shouldShow: 精确控制显示条件，避免不必要的渲染
 * - updateDelay: 防止频繁更新
 * - Floating UI 配置：自动躲避屏幕边界
 */

import React, { useCallback, useMemo } from 'react';
import { BubbleMenu as TipTapBubbleMenu } from '@tiptap/react/menus';
import type { Editor } from '@tiptap/core';
import './BubbleMenu.css';

interface BubbleMenuProps {
  editor: Editor | null;
}

/**
 * 气泡菜单按钮
 */
const BubbleMenuButton: React.FC<{
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  title?: string;
  icon: string;
}> = ({ onClick, isActive = false, disabled = false, title, icon }) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`bubble-menu-button ${isActive ? 'is-active' : ''}`}
      title={title}
      type="button"
    >
      <i className={icon} />
    </button>
  );
};

/**
 * 气泡菜单分隔符
 */
const BubbleMenuDivider: React.FC = () => {
  return <div className="bubble-menu-divider" />;
};

/**
 * 文本格式菜单内容
 */
const TextFormatMenu: React.FC<{ editor: Editor; handleCopy: () => void }> = ({
  editor,
  handleCopy,
}) => (
  <>
    {/* 文本格式 */}
    <BubbleMenuButton
      onClick={() => editor.chain().focus().toggleBold().run()}
      isActive={editor.isActive('bold')}
      title="粗体 (Ctrl+B)"
      icon="ri-bold"
    />

    <BubbleMenuButton
      onClick={() => editor.chain().focus().toggleItalic().run()}
      isActive={editor.isActive('italic')}
      title="斜体 (Ctrl+I)"
      icon="ri-italic"
    />

    <BubbleMenuButton
      onClick={() => editor.chain().focus().toggleUnderline().run()}
      isActive={editor.isActive('underline')}
      title="下划线 (Ctrl+U)"
      icon="ri-underline"
    />

    <BubbleMenuButton
      onClick={() => editor.chain().focus().toggleStrike().run()}
      isActive={editor.isActive('strike')}
      title="删除线"
      icon="ri-strikethrough"
    />

    <BubbleMenuButton
      onClick={() => editor.chain().focus().toggleCode().run()}
      isActive={editor.isActive('code')}
      title="行内代码"
      icon="ri-code-line"
    />

    <BubbleMenuDivider />

    {/* 快捷操作 */}
    <BubbleMenuButton onClick={handleCopy} title="复制" icon="ri-file-copy-line" />

    <BubbleMenuButton
      onClick={() => {
        editor.chain().focus().deleteSelection().run();
      }}
      title="删除"
      icon="ri-delete-bin-line"
    />
  </>
);

/**
 * 表格菜单内容
 */
const TableMenu: React.FC<{ editor: Editor }> = ({ editor }) => (
  <>
    {/* 行操作 */}
    <BubbleMenuButton
      onClick={() => editor.chain().focus().addRowBefore().run()}
      title="上方插入行"
      icon="ri-insert-row-top"
    />

    <BubbleMenuButton
      onClick={() => editor.chain().focus().addRowAfter().run()}
      title="下方插入行"
      icon="ri-insert-row-bottom"
    />

    <BubbleMenuButton
      onClick={() => editor.chain().focus().deleteRow().run()}
      title="删除行"
      icon="ri-delete-row"
    />

    <BubbleMenuDivider />

    {/* 列操作 */}
    <BubbleMenuButton
      onClick={() => editor.chain().focus().addColumnBefore().run()}
      title="左侧插入列"
      icon="ri-insert-col-left"
    />

    <BubbleMenuButton
      onClick={() => editor.chain().focus().addColumnAfter().run()}
      title="右侧插入列"
      icon="ri-insert-col-right"
    />

    <BubbleMenuButton
      onClick={() => editor.chain().focus().deleteColumn().run()}
      title="删除列"
      icon="ri-delete-column"
    />

    <BubbleMenuDivider />

    {/* 表格操作 */}
    <BubbleMenuButton
      onClick={() => editor.chain().focus().deleteTable().run()}
      title="删除表格"
      icon="ri-table-alert-line"
    />
  </>
);

export const BubbleMenu: React.FC<BubbleMenuProps> = ({ editor }) => {
  // 检测是否在表格中（允许 editor 为空，避免条件调用 hooks）
  const isInTable = useMemo(() => {
    return editor?.isActive('table') ?? false;
  }, [editor]);

  /**
   * 复制选中文本到剪贴板
   */
  const handleCopy = useCallback(() => {
    if (!editor) return;
    const text = editor.state.selection.$from.parent.textContent;
    if (text) {
      navigator.clipboard.writeText(text).catch((err) => {
        console.error('复制失败:', err);
      });
    }
  }, [editor]);

  /**
   * 精确控制菜单显示条件
   * 官方最佳实践：shouldShow 回调
   * - 避免在代码块、视频等特定节点显示
   * - 只在有选中文本或在表格中时显示
   */
  const shouldShow = useCallback(
    ({
      editor: ed,
      from,
      to,
    }: {
      editor: Editor;
      from: number;
      to: number;
      [key: string]: unknown;
    }) => {
      // 如果没有选中文本或选中文本为空，不显示
      const hasSelection = from < to;
      if (!hasSelection && !isInTable) {
        return false;
      }

      // 不在代码块中显示
      if (ed.isActive('codeBlock')) {
        return false;
      }

      return true;
    },
    [isInTable],
  );

  // 在 hooks 定义之后再进行空编辑器的短路返回，避免 hooks 条件调用
  if (!editor) {
    return null;
  }

  return (
    <TipTapBubbleMenu
      editor={editor}
      className={`bubble-menu ${isInTable ? 'table-mode' : ''}`}
      shouldShow={shouldShow}
      updateDelay={250}
      resizeDelay={100}
    >
      {isInTable ? (
        <TableMenu editor={editor} />
      ) : (
        <TextFormatMenu editor={editor} handleCopy={handleCopy} />
      )}
    </TipTapBubbleMenu>
  );
};

export default BubbleMenu;
