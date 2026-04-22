import type { TodoList } from '../../../services/types';
import {
  DEFAULT_MANUAL_TODO_LIST_DESCRIPTION,
  DEFAULT_MANUAL_TODO_LIST_ID,
  DEFAULT_MANUAL_TODO_LIST_NAME,
  NOTE_TASKS_LIST_COLOR,
  NOTE_TASKS_LIST_DESCRIPTION,
  NOTE_TASKS_LIST_ID,
  NOTE_TASKS_LIST_NAME,
} from '../../../shared/constants/todoConstants';

export type TodoSidebarItemKind = 'note-derived' | 'manual-default' | 'manual-custom';

export interface TodoSidebarItem {
  id: string;
  name: string;
  kind: TodoSidebarItemKind;
  isDefault: boolean;
  color?: string;
  description: string;
  isEditable: boolean;
  isDeletable: boolean;
}

export function buildTodoSidebarItems(todoLists: TodoList[]): TodoSidebarItem[] {
  const storedLists = todoLists.filter((list) => list.id !== NOTE_TASKS_LIST_ID);
  const defaultManualList = storedLists.find((list) => list.id === DEFAULT_MANUAL_TODO_LIST_ID);
  const customLists = storedLists.filter((list) => list.id !== DEFAULT_MANUAL_TODO_LIST_ID);

  const items: TodoSidebarItem[] = [
    {
      id: NOTE_TASKS_LIST_ID,
      name: NOTE_TASKS_LIST_NAME,
      kind: 'note-derived',
      isDefault: true,
      color: NOTE_TASKS_LIST_COLOR,
      description: NOTE_TASKS_LIST_DESCRIPTION,
      isEditable: false,
      isDeletable: false,
    },
  ];

  if (defaultManualList) {
    items.push({
      id: defaultManualList.id,
      name: defaultManualList.name || DEFAULT_MANUAL_TODO_LIST_NAME,
      kind: 'manual-default',
      isDefault: true,
      color: defaultManualList.color,
      description: DEFAULT_MANUAL_TODO_LIST_DESCRIPTION,
      isEditable: false,
      isDeletable: false,
    });
  }

  for (const list of customLists) {
    items.push({
      id: list.id,
      name: list.name,
      kind: 'manual-custom',
      isDefault: list.isDefault,
      color: list.color,
      description: '自定义清单',
      isEditable: true,
      isDeletable: true,
    });
  }

  return items;
}
