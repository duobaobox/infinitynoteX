/**
 * TipTap 工具栏组件
 * 按照官方 Demo 规范，将工具栏独立为单独组件
 */

import React, { useEffect, useRef, useState } from 'react';
import { Dropdown } from 'antd';
import type { MenuBarProps } from './types';
import { getThemeColor } from '../../theme/theme';

/**
 * 工具栏按钮组件
 */
const ToolbarButton: React.FC<{
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
      className={isActive ? 'is-active' : ''}
      title={title}
      type="button"
    >
      <i className={icon} />
    </button>
  );
};

/**
 * 工具栏分隔符
 */
const ToolbarDivider: React.FC = () => {
  return <div className="toolbar-divider" />;
};

/**
 * 菜单栏组件
 * 参考 TipTap 官方 MenuBar 示例
 */
export const MenuBar: React.FC<MenuBarProps> = ({ editor }) => {
  const themeColor = getThemeColor();
  // 关闭所有 antd Dropdown 菜单
  const closeAllDropdown = () => {
    // 触发全局 mousedown，关闭所有 Dropdown
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
  };
  const fileInputRef = useRef<HTMLInputElement>(null);
  // 用于强制刷新，以响应选区/内容变化，确保折叠触发器与菜单项实时更新
  const [, forceRefresh] = useState(0);

  // 注意：不要在 hooks 定义前提前 return，以免触发 hooks 条件调用的 ESLint 报错

  /**
   * 处理图片上传
   */
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!editor) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const src = evt.target?.result as string;
      if (src) {
        editor.chain().focus().setImage({ src }).run();
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // 监听编辑器事件以触发重渲染
  useEffect(() => {
    if (!editor) return;
    const update = () => forceRefresh((x) => x + 1);
    editor.on('selectionUpdate', update);
    editor.on('transaction', update);
    editor.on('update', update);
    return () => {
      editor.off('selectionUpdate', update);
      editor.off('transaction', update);
      editor.off('update', update);
    };
  }, [editor]);

  /**
   * 下拉菜单单项行（用于 antd Dropdown 渲染）
   */
  const MenuItemRow: React.FC<{
    icon?: string;
    text: string;
    active?: boolean;
    disabled?: boolean;
    onClick: () => void;
  }> = ({ icon, text, active, disabled, onClick }) => {
    return (
      <div
        onMouseDown={(e) => {
          // 提前触发以避免编辑器失焦
          e.preventDefault();
          if (!disabled) onClick();
        }}
        onClick={(e) => {
          e.stopPropagation();
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          opacity: disabled ? 0.45 : 1,
          color: active ? themeColor : undefined,
        }}
      >
        {icon ? <i className={icon} /> : null}
        <span style={{ flex: 1 }}>{text}</span>
        {active ? <i className="ri-check-line" /> : null}
      </div>
    );
  };

  /**
   * 组合分组下拉触发按钮（沿用工具栏按钮视觉）
   */
  const GroupDropdown: React.FC<{
    label: string;
    icon?: string;
    active?: boolean;
    items: { key: string; node: React.ReactNode; disabled?: boolean }[];
  }> = ({ label, icon, active, items }) => {
    return (
      <Dropdown
        trigger={['click']}
        menu={{
          items: items.map((it) => ({
            key: it.key,
            label: it.node,
            disabled: it.disabled,
          })),
        }}
      >
        <button
          type="button"
          title={label}
          className={active ? 'is-active' : ''}
          onMouseDown={(e) => {
            // 防止按钮点击导致编辑器失焦
            e.preventDefault();
            e.stopPropagation();
          }}
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          {icon ? <i className={icon} /> : null}
          <i className="ri-arrow-down-s-line" style={{ marginLeft: 4 }} />
        </button>
      </Dropdown>
    );
  };

  // 仅保留：标题、列表、对齐 采用下拉；其他按钮常驻

  // ========== 分组菜单：标题 ==========
  const headingItems = !editor
    ? ([] as { key: string; node: React.ReactNode }[])
    : [1, 2, 3].map((lv) => ({
        key: `h${lv}`,
        node: (
          <MenuItemRow
            icon={`ri-h-${lv}`}
            text={`标题 ${lv}`}
            active={editor.isActive('heading', { level: lv })}
            disabled={
              !editor
                .can()
                .chain()
                .focus()
                .toggleHeading({ level: lv as 1 | 2 | 3 })
                .run()
            }
            onClick={() =>
              editor
                .chain()
                .focus()
                .toggleHeading({ level: lv as 1 | 2 | 3 })
                .run()
            }
          />
        ),
      }));

  // ========== 分组菜单：列表 ==========
  const listItems = !editor
    ? ([] as { key: string; node: React.ReactNode }[])
    : [
        {
          key: 'bullet',
          node: (
            <MenuItemRow
              icon="ri-list-unordered"
              text="无序列表"
              active={editor.isActive('bulletList')}
              disabled={!editor.can().chain().focus().toggleBulletList().run()}
              onClick={() => editor.chain().focus().toggleBulletList().run()}
            />
          ),
        },
        {
          key: 'ordered',
          node: (
            <MenuItemRow
              icon="ri-list-ordered"
              text="有序列表"
              active={editor.isActive('orderedList')}
              disabled={!editor.can().chain().focus().toggleOrderedList().run()}
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
            />
          ),
        },
        {
          key: 'task',
          node: (
            <MenuItemRow
              icon="ri-checkbox-line"
              text="任务列表"
              active={editor.isActive('taskList')}
              disabled={!editor.can().chain().focus().toggleTaskList().run()}
              onClick={() => editor.chain().focus().toggleTaskList().run()}
            />
          ),
        },
      ];

  // ========== 分组触发器：标题 / 列表 / 对齐 的动态图标与激活态 ==========
  const headingTrigger = (() => {
    if (!editor) return { icon: 'ri-heading', title: '标题', active: false } as const;
    const states = [1, 2, 3].map((lv) => editor.isActive('heading', { level: lv }));
    if (states[0]) return { icon: 'ri-h-1', title: '标题 1', active: true } as const;
    if (states[1]) return { icon: 'ri-h-2', title: '标题 2', active: true } as const;
    if (states[2]) return { icon: 'ri-h-3', title: '标题 3', active: true } as const;
    return { icon: 'ri-heading', title: '标题', active: false } as const;
  })();

  const listTrigger = (() => {
    if (!editor) return { icon: 'ri-list-check', title: '列表', active: false } as const;
    if (editor.isActive('bulletList'))
      return {
        icon: 'ri-list-unordered',
        title: '无序列表',
        active: true,
      } as const;
    if (editor.isActive('orderedList'))
      return {
        icon: 'ri-list-ordered',
        title: '有序列表',
        active: true,
      } as const;
    if (editor.isActive('taskList'))
      return {
        icon: 'ri-checkbox-line',
        title: '任务列表',
        active: true,
      } as const;
    return { icon: 'ri-list-check', title: '列表', active: false } as const;
  })();

  const alignTrigger = (() => {
    if (!editor)
      return {
        icon: 'ri-align-justify',
        title: '对齐',
        active: false,
      } as const;
    if (editor.isActive({ textAlign: 'left' }))
      return { icon: 'ri-align-left', title: '左对齐', active: true } as const;
    if (editor.isActive({ textAlign: 'center' }))
      return {
        icon: 'ri-align-center',
        title: '居中对齐',
        active: true,
      } as const;
    if (editor.isActive({ textAlign: 'right' }))
      return { icon: 'ri-align-right', title: '右对齐', active: true } as const;
    if (editor.isActive({ textAlign: 'justify' }))
      return {
        icon: 'ri-align-justify',
        title: '两端对齐',
        active: true,
      } as const;
    return { icon: 'ri-align-justify', title: '对齐', active: false } as const;
  })();

  // 表格触发器状态计算
  const tableTrigger = (() => {
    const isInTable = editor?.isActive('table') ?? false;
    return { icon: 'ri-table-2', title: '表格', active: isInTable } as const;
  })();

  // ========== 分组菜单：对齐 ==========
  const alignItems = !editor
    ? ([] as { key: string; node: React.ReactNode }[])
    : (() => {
        const entries: Array<{
          key: string;
          label: string;
          value: 'left' | 'center' | 'right' | 'justify';
          icon: string;
        }> = [
          {
            key: 'left',
            label: '左对齐',
            value: 'left',
            icon: 'ri-align-left',
          },
          {
            key: 'center',
            label: '居中对齐',
            value: 'center',
            icon: 'ri-align-center',
          },
          {
            key: 'right',
            label: '右对齐',
            value: 'right',
            icon: 'ri-align-right',
          },
          {
            key: 'justify',
            label: '两端对齐',
            value: 'justify',
            icon: 'ri-align-justify',
          },
        ];
        return entries.map((it) => ({
          key: it.key,
          node: (
            <MenuItemRow
              icon={it.icon}
              text={it.label}
              active={editor.isActive({ textAlign: it.value })}
              disabled={!editor.can().chain().focus().setTextAlign(it.value).run()}
              onClick={() => editor.chain().focus().setTextAlign(it.value).run()}
            />
          ),
        }));
      })();

  // ========== 分组菜单：表格 ==========
  const tableItems = !editor
    ? ([] as { key: string; node: React.ReactNode }[])
    : [
        // 插入表格
        {
          key: 'insert-table',
          node: (
            <MenuItemRow
              icon="ri-table-2"
              text="插入表格 (3×3)"
              disabled={!editor.can().chain().focus().insertTable().run()}
              onClick={() =>
                editor.commands.insertTable({
                  rows: 3,
                  cols: 3,
                  withHeaderRow: true,
                })
              }
            />
          ),
        },
        // 分隔符（使用antd的menu divider）
        {
          key: 'divider-1',
          node: <div style={{ borderTop: '1px solid #f0f0f0', margin: '4px 0' }} />,
        },
        // 行操作
        {
          key: 'add-row-before',
          node: (
            <MenuItemRow
              icon="ri-insert-row-top"
              text="在上方插入行"
              disabled={!editor.can().chain().focus().addRowBefore().run()}
              onClick={() => editor.commands.addRowBefore()}
            />
          ),
        },
        {
          key: 'add-row-after',
          node: (
            <MenuItemRow
              icon="ri-insert-row-bottom"
              text="在下方插入行"
              disabled={!editor.can().chain().focus().addRowAfter().run()}
              onClick={() => editor.commands.addRowAfter()}
            />
          ),
        },
        {
          key: 'delete-row',
          node: (
            <MenuItemRow
              icon="ri-delete-row"
              text="删除当前行"
              disabled={!editor.can().chain().focus().deleteRow().run()}
              onClick={() => editor.commands.deleteRow()}
            />
          ),
        },
        // 分隔符
        {
          key: 'divider-2',
          node: <div style={{ borderTop: '1px solid #f0f0f0', margin: '4px 0' }} />,
        },
        // 列操作
        {
          key: 'add-column-before',
          node: (
            <MenuItemRow
              icon="ri-insert-column-left"
              text="在左侧插入列"
              disabled={!editor.can().chain().focus().addColumnBefore().run()}
              onClick={() => editor.commands.addColumnBefore()}
            />
          ),
        },
        {
          key: 'add-column-after',
          node: (
            <MenuItemRow
              icon="ri-insert-column-right"
              text="在右侧插入列"
              disabled={!editor.can().chain().focus().addColumnAfter().run()}
              onClick={() => editor.commands.addColumnAfter()}
            />
          ),
        },
        {
          key: 'delete-column',
          node: (
            <MenuItemRow
              icon="ri-delete-column"
              text="删除当前列"
              disabled={!editor.can().chain().focus().deleteColumn().run()}
              onClick={() => editor.commands.deleteColumn()}
            />
          ),
        },
        // 分隔符
        {
          key: 'divider-3',
          node: <div style={{ borderTop: '1px solid #f0f0f0', margin: '4px 0' }} />,
        },
        // 单元格操作
        {
          key: 'merge-cells',
          node: (
            <MenuItemRow
              icon="ri-merge-cells-horizontal"
              text="合并单元格"
              disabled={!editor.can().chain().focus().mergeCells().run()}
              onClick={() => editor.commands.mergeCells()}
            />
          ),
        },
        {
          key: 'split-cell',
          node: (
            <MenuItemRow
              icon="ri-split-cells-horizontal"
              text="拆分单元格"
              disabled={!editor.can().chain().focus().splitCell().run()}
              onClick={() => editor.commands.splitCell()}
            />
          ),
        },
        // 分隔符
        {
          key: 'divider-4',
          node: <div style={{ borderTop: '1px solid #f0f0f0', margin: '4px 0' }} />,
        },
        // （已屏蔽）表头操作相关按钮
        // {
        //   key: "toggle-header-row",
        //   node: (
        //     <MenuItemRow
        //       icon="ri-layout-top-2-line"
        //       text="切换表头行"
        //       active={
        //         editor.isActive("table") &&
        //         editor.can().chain().focus().toggleHeaderRow().run()
        //       }
        //       disabled={!editor.can().chain().focus().toggleHeaderRow().run()}
        //       onClick={() => editor.commands.toggleHeaderRow()}
        //     />
        //   ),
        // },
        // {
        //   key: "toggle-header-column",
        //   node: (
        //     <MenuItemRow
        //       icon="ri-layout-left-2-line"
        //       text="切换表头列"
        //       active={
        //         editor.isActive("table") &&
        //         editor.can().chain().focus().toggleHeaderColumn().run()
        //       }
        //       disabled={!editor.can().chain().focus().toggleHeaderColumn().run()}
        //       onClick={() => editor.commands.toggleHeaderColumn()}
        //     />
        //   ),
        // },
        // {
        //   key: "toggle-header-cell",
        //   node: (
        //     <MenuItemRow
        //       icon="ri-table-alt-line"
        //       text="切换表头单元格"
        //       disabled={!editor.can().chain().focus().toggleHeaderCell().run()}
        //       onClick={() => editor.commands.toggleHeaderCell()}
        //     />
        //   ),
        // },
        // 分隔符
        // {
        //   key: "divider-5",
        //   node: (
        //     <div style={{ borderTop: "1px solid #f0f0f0", margin: "4px 0" }} />
        //   ),
        // },
        // 删除表格
        {
          key: 'delete-table',
          node: (
            <MenuItemRow
              icon="ri-delete-bin-line"
              text="删除整个表格"
              disabled={!editor.can().chain().focus().deleteTable().run()}
              onClick={() => editor.commands.deleteTable()}
            />
          ),
        },
      ];

  // 所有 hooks 定义完毕后，再根据 editor 的可用性决定是否渲染
  if (!editor) {
    return null;
  }

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
      {/* 文本格式 常驻 */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        disabled={!editor.can().chain().focus().toggleBold().run()}
        isActive={editor.isActive('bold')}
        title="粗体 (Ctrl+B)"
        icon="ri-bold"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        disabled={!editor.can().chain().focus().toggleItalic().run()}
        isActive={editor.isActive('italic')}
        title="斜体 (Ctrl+I)"
        icon="ri-italic"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        disabled={!editor.can().chain().focus().toggleUnderline().run()}
        isActive={editor.isActive('underline')}
        title="下划线 (Ctrl+U)"
        icon="ri-underline"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        disabled={!editor.can().chain().focus().toggleStrike().run()}
        isActive={editor.isActive('strike')}
        title="删除线"
        icon="ri-strikethrough"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCode().run()}
        disabled={!editor.can().chain().focus().toggleCode().run()}
        isActive={editor.isActive('code')}
        title="行内代码"
        icon="ri-code-line"
      />

      <ToolbarDivider />

      {/* 分组：标题（动态） */}
      <GroupDropdown
        label={headingTrigger.title}
        icon={headingTrigger.icon}
        active={headingTrigger.active}
        items={headingItems}
      />

      <ToolbarDivider />

      {/* 分组：列表（动态） */}
      <GroupDropdown
        label={listTrigger.title}
        icon={listTrigger.icon}
        active={listTrigger.active}
        items={listItems}
      />

      <ToolbarDivider />

      {/* 分组：对齐（动态） */}
      <GroupDropdown
        label={alignTrigger.title}
        icon={alignTrigger.icon}
        active={alignTrigger.active}
        items={alignItems}
      />

      <ToolbarDivider />

      {/* 分组：表格操作 */}
      <GroupDropdown
        label={tableTrigger.title}
        icon={tableTrigger.icon}
        active={tableTrigger.active}
        items={tableItems}
      />

      <ToolbarDivider />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        isActive={editor.isActive('codeBlock')}
        disabled={!editor.can().chain().focus().toggleCodeBlock().run()}
        title="代码块"
        icon="ri-code-s-slash-line"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        isActive={editor.isActive('blockquote')}
        disabled={!editor.can().chain().focus().toggleBlockquote().run()}
        title="引用"
        icon="ri-double-quotes-l"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        title="分割线"
        icon="ri-separator"
      />
      <ToolbarButton
        onClick={() => fileInputRef.current?.click()}
        title="插入图片"
        icon="ri-image-line"
      />

      {/* 隐藏的文件输入 */}
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
        disabled={!editor.can().chain().focus().undo().run()}
        title="撤销 (Ctrl+Z)"
        icon="ri-arrow-go-back-line"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().chain().focus().redo().run()}
        title="重做 (Ctrl+Y)"
        icon="ri-arrow-go-forward-line"
      />
    </div>
  );
};

export default MenuBar;
