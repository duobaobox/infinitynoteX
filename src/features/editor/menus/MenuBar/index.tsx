/**
 * MenuBar 主组件
 * 整合所有工具栏功能和菜单组件
 *
 * 性能优化：使用 useMenuBarState 替代 useForceUpdateOnEditor
 * @see https://tiptap.dev/docs/guides/performance
 */

import React, { useCallback } from 'react';
import type { Editor } from '@tiptap/core';
import { ToolbarButton } from './ToolbarButton';
import { ToolbarDivider } from './ToolbarDivider';
import { GroupDropdown } from './GroupDropdown';
import { useMenuState, useImageUpload, useMenuBarState } from '../../hooks';
import {
  getHeadingMenuItems,
  getListMenuItems,
  getAlignMenuItems,
  getTableMenuItems,
  getMoreFormattingMenuItems,
} from '../components';
import { ToolbarColorPicker } from './ToolbarColorPicker';
import { ToolbarHighlightPicker } from './ToolbarHighlightPicker';

export interface MenuBarProps {
  editor: Editor | null;
}

/**
 * MenuBar 组件
 * 按照 Tiptap 官方最佳实践重构的工具栏
 *
 * 性能优化说明：
 * - 使用 useMenuBarState 的 selector 模式，只在工具栏需要的状态变化时重渲染
 * - 使用 React.memo 避免父组件更新导致的不必要重渲染
 */
const MenuBarComponent: React.FC<MenuBarProps> = ({ editor }) => {
  // 使用优化的 selector 模式 - 只在工具栏相关状态变化时重渲染
  const menuBarState = useMenuBarState(editor);
  const { headingState, listState, alignState, tableState } = useMenuState(editor);
  const { fileInputRef, handleImageUpload, triggerUpload } = useImageUpload(editor);

  // 关闭所有 Dropdown (用于滚动时)
  const closeAllDropdown = useCallback(() => {
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
  }, []);

  // 编辑器未就绪时不渲染
  if (!editor || !menuBarState) {
    return null;
  }

  // 获取菜单项
  const headingItems = getHeadingMenuItems(editor);
  const listItems = getListMenuItems(editor);
  const alignItems = getAlignMenuItems(editor);
  const tableItems = getTableMenuItems(editor);

  return (
    <div
      className="tiptap-toolbar"
      onWheel={(e) => {
        // 工具栏滚动时自动关闭所有 Dropdown
        closeAllDropdown();
        // 将垂直滚动转换为水平滚动
        const target = e.currentTarget;
        const delta = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
        if (delta !== 0) {
          e.preventDefault();
          target.scrollLeft += delta;
        }
      }}
    >
      {/* 文本格式 - 常驻按钮 */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={menuBarState.isBold}
        title="粗体 (Ctrl+B)"
        icon="ri-bold"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={menuBarState.isItalic}
        title="斜体 (Ctrl+I)"
        icon="ri-italic"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        isActive={menuBarState.isUnderline}
        title="下划线 (Ctrl+U)"
        icon="ri-underline"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        isActive={menuBarState.isStrike}
        title="删除线"
        icon="ri-strikethrough"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCode().run()}
        isActive={menuBarState.isCode}
        title="行内代码"
        icon="ri-code-line"
      />

      {/* 高亮下拉菜单 */}
      <ToolbarHighlightPicker editor={editor} />
      {/* 文字颜色下拉菜单 */}
      <ToolbarColorPicker editor={editor} />

      <ToolbarDivider />

      {/* 标题下拉菜单 */}
      <GroupDropdown
        label={headingState.title}
        icon={headingState.icon}
        active={headingState.active}
        items={headingItems}
      />

      <ToolbarDivider />

      {/* 列表下拉菜单 */}
      <GroupDropdown
        label={listState.title}
        icon={listState.icon}
        active={listState.active}
        items={listItems}
      />

      <ToolbarDivider />

      {/* 对齐下拉菜单 */}
      <GroupDropdown
        label={alignState.title}
        icon={alignState.icon}
        active={alignState.active}
        items={alignItems}
      />

      <ToolbarDivider />

      {/* 表格下拉菜单 */}
      <GroupDropdown
        label={tableState.title}
        icon={tableState.icon}
        active={tableState.active}
        items={tableItems}
      />

      {/* 更多格式下拉菜单 - 用户指定放在表格菜单旁 */}
      <GroupDropdown
        label="更多"
        icon="ri-more-line"
        active={menuBarState.isSubscript || menuBarState.isSuperscript}
        items={getMoreFormattingMenuItems(editor)}
      />

      <ToolbarDivider />

      {/* 其他常用功能 */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        isActive={menuBarState.isCodeBlock}
        title="代码块"
        icon="ri-code-s-slash-line"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        isActive={menuBarState.isBlockquote}
        title="引用"
        icon="ri-double-quotes-l"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        title="分割线"
        icon="ri-separator"
      />
      <ToolbarButton onClick={triggerUpload} title="插入图片" icon="ri-image-line" />

      {/* 隐藏的图片上传 input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleImageUpload}
      />

      <ToolbarDivider />

      {/* 撤销/重做 */}
      <ToolbarButton
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!menuBarState.canUndo}
        title="撤销 (Ctrl+Z)"
        icon="ri-arrow-go-back-line"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!menuBarState.canRedo}
        title="重做 (Ctrl+Y)"
        icon="ri-arrow-go-forward-line"
      />
    </div>
  );
};

// 使用 React.memo 优化性能，避免编辑器频繁更新时工具栏不必要的重渲染
export const MenuBar = React.memo(MenuBarComponent);

export default MenuBar;
