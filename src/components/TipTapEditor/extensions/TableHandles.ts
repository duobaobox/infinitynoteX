/**
 * TableHandles 扩展 - Notion 风格的表格行/列手柄
 *
 * 功能：
 * - 悬浮在表格区域时显示所有行/列手柄
 * - 点击手柄显示操作菜单（添加/删除行列等）
 * - 延迟隐藏机制（防止鼠标移动到手柄时手柄消失）
 */

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

// 菜单项
interface MenuItem {
  label: string;
  icon: string;
  action: () => void;
  danger?: boolean;
}

/**
 * 创建手柄元素
 */
function createHandleElement(type: 'row' | 'column', index: number): HTMLDivElement {
  const handle = document.createElement('div');
  handle.className = `table-handle table-handle-${type}`;
  handle.setAttribute('data-handle-type', type);
  handle.setAttribute('data-handle-index', String(index));
  return handle;
}

/**
 * 创建操作菜单
 */
function createMenu(items: MenuItem[]): HTMLDivElement {
  const menu = document.createElement('div');
  menu.className = 'table-handle-menu';

  items.forEach((item) => {
    const button = document.createElement('button');
    button.className = `table-handle-menu-item${item.danger ? ' danger' : ''}`;
    // 使用 Remix Icon 风格
    button.innerHTML = `<i class="${item.icon}"></i><span class="menu-label">${item.label}</span>`;
    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      item.action();
      menu.remove();
    });
    menu.appendChild(button);
  });

  return menu;
}

/**
 * TableHandles 扩展
 */
export const TableHandles = Extension.create({
  name: 'tableHandles',

  addProseMirrorPlugins() {
    const editor = this.editor;

    // 存储当前显示的手柄和菜单
    let handlesContainer: HTMLDivElement | null = null;
    let currentMenu: HTMLDivElement | null = null;
    let currentTable: HTMLTableElement | null = null;
    let hideTimeout: ReturnType<typeof setTimeout> | null = null;
    let isMouseOverHandles = false;

    /**
     * 清除隐藏定时器
     */
    const clearHideTimeout = () => {
      if (hideTimeout) {
        clearTimeout(hideTimeout);
        hideTimeout = null;
      }
    };

    /**
     * 移除所有手柄
     */
    const removeHandles = () => {
      if (handlesContainer) {
        handlesContainer.remove();
        handlesContainer = null;
      }
      currentTable = null;
    };

    /**
     * 移除菜单
     */
    const removeMenu = () => {
      if (currentMenu) {
        currentMenu.remove();
        currentMenu = null;
      }
    };

    /**
     * 延迟隐藏手柄
     */
    const scheduleHide = () => {
      clearHideTimeout();
      hideTimeout = setTimeout(() => {
        if (!isMouseOverHandles) {
          removeHandles();
        }
      }, 200);
    };

    /**
     * 显示行菜单
     */
    const showRowMenu = (rowIndex: number, x: number, y: number) => {
      removeMenu();

      // 先选中该行的第一个单元格，确保命令作用于正确的行
      if (currentTable) {
        const row = currentTable.rows[rowIndex];
        if (row && row.cells[0]) {
          const cell = row.cells[0];
          // 获取单元格的位置并聚焦
          const pos = editor.view.posAtDOM(cell, 0);
          editor.commands.setTextSelection(pos);
        }
      }

      const items: MenuItem[] = [
        {
          label: '在上方插入行',
          icon: 'ri-insert-row-top',
          action: () => editor.chain().focus().addRowBefore().run(),
        },
        {
          label: '在下方插入行',
          icon: 'ri-insert-row-bottom',
          action: () => editor.chain().focus().addRowAfter().run(),
        },
        {
          label: '删除行',
          icon: 'ri-delete-row',
          action: () => editor.chain().focus().deleteRow().run(),
          danger: true,
        },
        {
          label: '删除表格',
          icon: 'ri-delete-bin-line',
          action: () => editor.chain().focus().deleteTable().run(),
          danger: true,
        },
      ];

      currentMenu = createMenu(items);
      currentMenu.style.position = 'fixed';
      currentMenu.style.left = `${x}px`;
      currentMenu.style.top = `${y}px`;
      document.body.appendChild(currentMenu);

      // 点击外部关闭菜单
      setTimeout(() => {
        const closeHandler = (e: MouseEvent) => {
          if (currentMenu && !currentMenu.contains(e.target as Node)) {
            removeMenu();
            document.removeEventListener('click', closeHandler);
          }
        };
        document.addEventListener('click', closeHandler);
      }, 0);
    };

    /**
     * 显示列菜单
     */
    const showColumnMenu = (colIndex: number, x: number, y: number) => {
      removeMenu();

      // 先选中该列的第一个单元格，确保命令作用于正确的列
      if (currentTable) {
        const firstRow = currentTable.rows[0];
        if (firstRow && firstRow.cells[colIndex]) {
          const cell = firstRow.cells[colIndex];
          const pos = editor.view.posAtDOM(cell, 0);
          editor.commands.setTextSelection(pos);
        }
      }

      const items: MenuItem[] = [
        {
          label: '在左侧插入列',
          icon: 'ri-insert-column-left',
          action: () => editor.chain().focus().addColumnBefore().run(),
        },
        {
          label: '在右侧插入列',
          icon: 'ri-insert-column-right',
          action: () => editor.chain().focus().addColumnAfter().run(),
        },
        {
          label: '删除列',
          icon: 'ri-delete-column',
          action: () => editor.chain().focus().deleteColumn().run(),
          danger: true,
        },
        {
          label: '删除表格',
          icon: 'ri-delete-bin-line',
          action: () => editor.chain().focus().deleteTable().run(),
          danger: true,
        },
      ];

      currentMenu = createMenu(items);
      currentMenu.style.position = 'fixed';
      currentMenu.style.left = `${x}px`;
      currentMenu.style.top = `${y}px`;
      document.body.appendChild(currentMenu);

      // 点击外部关闭菜单
      setTimeout(() => {
        const closeHandler = (e: MouseEvent) => {
          if (currentMenu && !currentMenu.contains(e.target as Node)) {
            removeMenu();
            document.removeEventListener('click', closeHandler);
          }
        };
        document.addEventListener('click', closeHandler);
      }, 0);
    };

    /**
     * 为表格显示所有手柄
     */
    const showHandlesForTable = (table: HTMLTableElement) => {
      // 如果已经显示了同一个表格的手柄，不重复创建
      if (currentTable === table && handlesContainer) {
        return;
      }

      removeHandles();
      currentTable = table;

      const tableRect = table.getBoundingClientRect();

      // 创建手柄容器
      handlesContainer = document.createElement('div');
      handlesContainer.className = 'table-handles-container';
      handlesContainer.style.position = 'fixed';
      handlesContainer.style.pointerEvents = 'auto';
      handlesContainer.style.zIndex = '100';

      // 监听容器的鼠标事件
      handlesContainer.addEventListener('mouseenter', () => {
        isMouseOverHandles = true;
        clearHideTimeout();
      });

      handlesContainer.addEventListener('mouseleave', () => {
        isMouseOverHandles = false;
        scheduleHide();
      });

      // 创建行手柄（左侧）
      const rows = table.rows;
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowRect = row.getBoundingClientRect();

        const handle = createHandleElement('row', i);
        handle.style.position = 'fixed';
        handle.style.left = `${tableRect.left - 10}px`;
        handle.style.top = `${rowRect.top}px`;
        handle.style.height = `${rowRect.height}px`;

        handle.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          showRowMenu(i, e.clientX, e.clientY);
        });

        handlesContainer.appendChild(handle);
      }

      // 创建列手柄（顶部）- 使用第一行的单元格
      const firstRow = rows[0];
      if (firstRow) {
        for (let i = 0; i < firstRow.cells.length; i++) {
          const cell = firstRow.cells[i];
          const cellRect = cell.getBoundingClientRect();

          const handle = createHandleElement('column', i);
          handle.style.position = 'fixed';
          handle.style.left = `${cellRect.left}px`;
          handle.style.top = `${tableRect.top - 10}px`;
          handle.style.width = `${cellRect.width}px`;

          handle.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            showColumnMenu(i, e.clientX, e.clientY);
          });

          handlesContainer.appendChild(handle);
        }
      }

      document.body.appendChild(handlesContainer);
    };

    return [
      new Plugin({
        key: new PluginKey('tableHandles'),
        props: {
          handleDOMEvents: {
            mouseover: (_view, event) => {
              const target = event.target as HTMLElement;

              // 检查鼠标是否在表格区域
              const table = target.closest('table') as HTMLTableElement | null;

              if (table) {
                clearHideTimeout();
                showHandlesForTable(table);
              }

              return false;
            },

            mouseout: (_view, event) => {
              const target = event.target as HTMLElement;
              const relatedTarget = event.relatedTarget as HTMLElement | null;

              // 检查是否真正离开了表格区域
              const table = target.closest('table');
              const toTable = relatedTarget?.closest('table');

              // 如果移动到了手柄上，不隐藏
              if (
                relatedTarget?.closest('.table-handles-container') ||
                relatedTarget?.closest('.table-handle')
              ) {
                return false;
              }

              // 如果离开表格，延迟隐藏
              if (table && table !== toTable) {
                scheduleHide();
              }

              return false;
            },
          },
        },

        // 编辑器销毁时清理
        destroy() {
          clearHideTimeout();
          removeHandles();
          removeMenu();
        },
      }),
    ];
  },
});

export default TableHandles;
