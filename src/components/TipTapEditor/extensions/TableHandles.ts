/**
 * TableHandles 扩展 - Notion 风格的表格行/列手柄
 *
 * 功能：
 * - 悬浮在表格区域时显示所有行/列手柄
 * - 点击手柄显示操作菜单（添加/删除行列等）
 * - 延迟隐藏机制（防止鼠标移动到手柄时手柄消失）
 * - 实时更新手柄位置（表格尺寸变化时）
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

const HANDLE_OFFSET = 8;

const getTableWrapper = (table: HTMLElement) =>
  table.closest('.tableWrapper') as HTMLElement | null;

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
    let currentWrapper: HTMLElement | null = null;
    let hideTimeout: ReturnType<typeof setTimeout> | null = null;
    let isMouseOverHandles = false;
    let resizeObserver: ResizeObserver | null = null;
    let mutationObserver: MutationObserver | null = null;
    let updateHandlesFrame: number | null = null;
    let wrapperScrollHandler: (() => void) | null = null;

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
      if (updateHandlesFrame !== null) {
        cancelAnimationFrame(updateHandlesFrame);
        updateHandlesFrame = null;
      }

      if (resizeObserver) {
        resizeObserver.disconnect();
        resizeObserver = null;
      }
      if (mutationObserver) {
        mutationObserver.disconnect();
        mutationObserver = null;
      }

      if (currentWrapper && wrapperScrollHandler) {
        currentWrapper.removeEventListener('scroll', wrapperScrollHandler);
        wrapperScrollHandler = null;
      }

      if (handlesContainer) {
        handlesContainer.remove();
        handlesContainer = null;
      }
      currentTable = null;
      currentWrapper = null;
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

      if (currentTable) {
        const row = currentTable.rows[rowIndex];
        if (row && row.cells[0]) {
          const cell = row.cells[0];
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
     * 更新手柄位置
     */
    const updateHandlesPosition = () => {
      if (!currentTable || !handlesContainer || !currentWrapper) return;

      if (updateHandlesFrame !== null) {
        cancelAnimationFrame(updateHandlesFrame);
      }

      updateHandlesFrame = requestAnimationFrame(() => {
        if (!currentTable || !handlesContainer || !currentWrapper) return;

        const wrapper = currentWrapper;
        const table = currentTable;

        const wrapperRect = wrapper.getBoundingClientRect();
        const tableRect = table.getBoundingClientRect();
        const rows = table.rows;

        const rowHandles = handlesContainer.querySelectorAll('.table-handle-row');
        rowHandles.forEach((handle, i) => {
          if (i < rows.length) {
            const row = rows[i];
            const rowRect = row.getBoundingClientRect();
            const element = handle as HTMLElement;
            const top = rowRect.top - wrapperRect.top + wrapper.scrollTop;
            const left = tableRect.left - wrapperRect.left + wrapper.scrollLeft - HANDLE_OFFSET;
            element.style.transform = `translate(${left}px, ${top}px)`;
            element.style.height = `${rowRect.height}px`;
          }
        });

        const colHandles = handlesContainer.querySelectorAll('.table-handle-column');
        const firstRow = rows[0];
        if (firstRow) {
          colHandles.forEach((handle, i) => {
            if (i < firstRow.cells.length) {
              const cell = firstRow.cells[i];
              const cellRect = cell.getBoundingClientRect();
              const element = handle as HTMLElement;
              const left = cellRect.left - wrapperRect.left + wrapper.scrollLeft;
              const top = tableRect.top - wrapperRect.top + wrapper.scrollTop - HANDLE_OFFSET;
              element.style.transform = `translate(${left}px, ${top}px)`;
              element.style.width = `${cellRect.width}px`;
            }
          });
        }

        updateHandlesFrame = null;
      });
    };

    /**
     * 为表格显示所有手柄
     */
    const showHandlesForTable = (table: HTMLTableElement) => {
      const wrapper = getTableWrapper(table);
      if (!wrapper) return;

      if (currentTable === table && handlesContainer) {
        updateHandlesPosition();
        return;
      }

      removeHandles();
      currentTable = table;
      currentWrapper = wrapper;

      const tableRect = table.getBoundingClientRect();
      const wrapperRect = wrapper.getBoundingClientRect();
      const rows = table.rows;

      handlesContainer = document.createElement('div');
      handlesContainer.className = 'table-handles-container';
      handlesContainer.style.position = 'absolute';
      handlesContainer.style.inset = '0';
      handlesContainer.style.pointerEvents = 'none';
      handlesContainer.style.zIndex = '150';

      handlesContainer.addEventListener('mouseenter', () => {
        isMouseOverHandles = true;
        clearHideTimeout();
      });

      handlesContainer.addEventListener('mouseleave', () => {
        isMouseOverHandles = false;
        scheduleHide();
      });

      // 创建行手柄
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowRect = row.getBoundingClientRect();

        const handle = createHandleElement('row', i);
        handle.style.position = 'absolute';
        handle.style.pointerEvents = 'auto';
        const left = tableRect.left - wrapperRect.left + wrapper.scrollLeft - HANDLE_OFFSET;
        const top = rowRect.top - wrapperRect.top + wrapper.scrollTop;
        handle.style.transform = `translate(${left}px, ${top}px)`;
        handle.style.height = `${rowRect.height}px`;

        handle.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          showRowMenu(i, e.clientX, e.clientY);
        });

        handlesContainer.appendChild(handle);
      }

      // 创建列手柄
      const firstRow = rows[0];
      if (firstRow) {
        for (let i = 0; i < firstRow.cells.length; i++) {
          const cell = firstRow.cells[i];
          const cellRect = cell.getBoundingClientRect();

          const handle = createHandleElement('column', i);
          handle.style.position = 'absolute';
          handle.style.pointerEvents = 'auto';
          const left = cellRect.left - wrapperRect.left + wrapper.scrollLeft;
          const top = tableRect.top - wrapperRect.top + wrapper.scrollTop - HANDLE_OFFSET;
          handle.style.transform = `translate(${left}px, ${top}px)`;
          handle.style.width = `${cellRect.width}px`;

          handle.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            showColumnMenu(i, e.clientX, e.clientY);
          });

          handlesContainer.appendChild(handle);
        }
      }

      wrapper.appendChild(handlesContainer);

      // 监听表格尺寸变化
      resizeObserver = new ResizeObserver(() => {
        updateHandlesPosition();
      });
      resizeObserver.observe(table);

      for (let i = 0; i < rows.length; i++) {
        for (let j = 0; j < rows[i].cells.length; j++) {
          resizeObserver.observe(rows[i].cells[j]);
        }
      }

      // 监听 DOM 变化
      mutationObserver = new MutationObserver((mutations) => {
        let needsUpdate = false;

        for (const mutation of mutations) {
          if (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0) {
            needsUpdate = true;
            break;
          }
          if (mutation.type === 'attributes') {
            needsUpdate = true;
            break;
          }
        }

        if (needsUpdate && currentTable) {
          const tableNode = currentTable;
          removeHandles();
          requestAnimationFrame(() => {
            showHandlesForTable(tableNode);
          });
        }
      });

      mutationObserver.observe(table, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['colspan', 'rowspan'],
      });

      wrapperScrollHandler = () => updateHandlesPosition();
      wrapper.addEventListener('scroll', wrapperScrollHandler, { passive: true });
    };

    return [
      new Plugin({
        key: new PluginKey('tableHandles'),
        props: {
          handleDOMEvents: {
            mouseover: (_view, event) => {
              const target = event.target as HTMLElement;
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

              const table = target.closest('table');
              const toTable = relatedTarget?.closest('table');

              if (
                relatedTarget?.closest('.table-handles-container') ||
                relatedTarget?.closest('.table-handle')
              ) {
                return false;
              }

              if (table && table !== toTable) {
                scheduleHide();
              }

              return false;
            },
          },
        },

        view() {
          const handleScroll = () => {
            if (currentTable && handlesContainer) {
              updateHandlesPosition();
            }
          };

          const handleResize = () => {
            if (currentTable && handlesContainer) {
              updateHandlesPosition();
            }
          };

          window.addEventListener('scroll', handleScroll, { passive: true });
          window.addEventListener('resize', handleResize, { passive: true });

          return {
            destroy() {
              window.removeEventListener('scroll', handleScroll);
              window.removeEventListener('resize', handleResize);
            },
          };
        },

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
