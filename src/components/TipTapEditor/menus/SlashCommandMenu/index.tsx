/**
 * SlashCommandMenu 斜杠命令菜单组件
 * 输入 "/" 时弹出的命令菜单（类似 Notion）
 */

import { forwardRef, useEffect, useImperativeHandle, useState, useCallback } from 'react';
import type { CommandItem } from '../../extensions/SlashCommands';
import { filterCommands, getSlashCommands } from '../../extensions/SlashCommands';
import './SlashCommandMenu.css';

export interface SlashCommandMenuRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

interface SlashCommandMenuProps {
  items: CommandItem[];
  command: (item: CommandItem) => void;
  query: string;
}

/**
 * 斜杠命令菜单
 * 显示命令列表，支持键盘导航
 */
export const SlashCommandMenu = forwardRef<SlashCommandMenuRef, SlashCommandMenuProps>(
  ({ items, command, query }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    // 过滤后的命令
    const filteredItems = query ? filterCommands(query) : items;
    const groups = query ? null : getSlashCommands();

    // 当查询变化时重置选中索引
    useEffect(() => {
      setSelectedIndex(0);
    }, [query]);

    const selectItem = useCallback(
      (index: number) => {
        const item = filteredItems[index];
        if (item) {
          command(item);
        }
      },
      [filteredItems, command],
    );

    // 键盘导航
    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }) => {
        if (event.key === 'ArrowUp') {
          setSelectedIndex((prev) => (prev + filteredItems.length - 1) % filteredItems.length);
          return true;
        }

        if (event.key === 'ArrowDown') {
          setSelectedIndex((prev) => (prev + 1) % filteredItems.length);
          return true;
        }

        if (event.key === 'Enter') {
          selectItem(selectedIndex);
          return true;
        }

        return false;
      },
    }));

    if (filteredItems.length === 0) {
      return (
        <div className="slash-command-menu">
          <div className="no-results">没有找到匹配的命令</div>
        </div>
      );
    }

    // 扁平列表模式（有搜索时）
    if (query) {
      return (
        <div className="slash-command-menu">
          {filteredItems.map((item, index) => (
            <button
              key={item.title}
              className={`command-item ${index === selectedIndex ? 'is-selected' : ''}`}
              onClick={() => selectItem(index)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <span className="command-icon">{item.icon}</span>
              <div className="command-content">
                <span className="command-title">{item.title}</span>
                <span className="command-description">{item.description}</span>
              </div>
            </button>
          ))}
        </div>
      );
    }

    // 分组模式（无搜索时）
    let globalIndex = 0;
    return (
      <div className="slash-command-menu">
        {groups?.map((group) => (
          <div key={group.title} className="command-group">
            <div className="group-title">{group.title}</div>
            {group.commands.map((item) => {
              const currentIndex = globalIndex++;
              return (
                <button
                  key={item.title}
                  className={`command-item ${currentIndex === selectedIndex ? 'is-selected' : ''}`}
                  onClick={() => selectItem(currentIndex)}
                  onMouseEnter={() => setSelectedIndex(currentIndex)}
                >
                  <span className="command-icon">{item.icon}</span>
                  <div className="command-content">
                    <span className="command-title">{item.title}</span>
                    <span className="command-description">{item.description}</span>
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    );
  },
);

SlashCommandMenu.displayName = 'SlashCommandMenu';

export default SlashCommandMenu;
