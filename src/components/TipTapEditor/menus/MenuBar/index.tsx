/**
 * MenuBar 主组件
 * 整合所有工具栏功能和菜单组件
 */

import React, { useCallback } from 'react';
import type { Editor } from '@tiptap/core';
import { ToolbarButton } from './ToolbarButton';
import { ToolbarDivider } from './ToolbarDivider';
import { GroupDropdown } from './GroupDropdown';
import { useEditorState, useMenuState, useImageUpload } from '../../hooks';
import {
  getHeadingMenuItems,
  getListMenuItems,
  getAlignMenuItems,
  getTableMenuItems,
  getHighlightMenuItems,
  getTextColorMenuItems,
} from '../components';

export interface MenuBarProps {
  editor: Editor | null;
}

/**
 * MenuBar 组件
 * 按照 Tiptap 官方最佳实践重构的工具栏
 */
const MenuBarComponent: React.FC<MenuBarProps> = ({ editor }) => {
  // 使用自定义 Hooks 监听编辑器状态变化
  useEditorState(editor);
  const { headingState, listState, alignState, tableState } = useMenuState(editor);
  const { fileInputRef, handleImageUpload, triggerUpload } = useImageUpload(editor);

  // 关闭所有 Dropdown (用于滚动时)
  const closeAllDropdown = useCallback(() => {
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
  }, []);

  // 编辑器未就绪时不渲染
  if (!editor) {
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
        isActive={editor.isActive('bold')}
        title="粗体 (Ctrl+B)"
        icon="ri-bold"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive('italic')}
        title="斜体 (Ctrl+I)"
        icon="ri-italic"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        isActive={editor.isActive('underline')}
        title="下划线 (Ctrl+U)"
        icon="ri-underline"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        isActive={editor.isActive('strike')}
        title="删除线"
        icon="ri-strikethrough"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCode().run()}
        isActive={editor.isActive('code')}
        title="行内代码"
        icon="ri-code-line"
      />
      {/* 下标按钮 */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleSubscript().run()}
        isActive={editor.isActive('subscript')}
        title="下标"
        icon="ri-subscript-2"
      />
      {/* 上标按钮 */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleSuperscript().run()}
        isActive={editor.isActive('superscript')}
        title="上标"
        icon="ri-superscript-2"
      />
      {/* 高亮下拉菜单 */}
      <GroupDropdown
        label="高亮"
        icon="ri-mark-pen-line"
        active={editor.isActive('highlight')}
        items={getHighlightMenuItems(editor)}
      />
      {/* 文字颜色下拉菜单 */}
      <GroupDropdown
        label="颜色"
        icon="ri-font-color"
        active={!!editor.getAttributes('textStyle')?.color}
        items={getTextColorMenuItems(editor)}
      />

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

      <ToolbarDivider />

      {/* 其他常用功能 */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        isActive={editor.isActive('codeBlock')}
        title="代码块"
        icon="ri-code-s-slash-line"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        isActive={editor.isActive('blockquote')}
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
        title="撤销 (Ctrl+Z)"
        icon="ri-arrow-go-back-line"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().redo().run()}
        title="重做 (Ctrl+Y)"
        icon="ri-arrow-go-forward-line"
      />
    </div>
  );
};

// 使用 React.memo 优化性能，避免编辑器频繁更新时工具栏不必要的重渲染
export const MenuBar = React.memo(MenuBarComponent);

export default MenuBar;
