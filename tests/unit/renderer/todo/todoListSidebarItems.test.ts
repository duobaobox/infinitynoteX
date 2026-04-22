import { describe, expect, it } from 'vitest';

import { buildTodoSidebarItems } from '../../../../src/features/todo/utils/todoListSidebarItems';
import {
  DEFAULT_MANUAL_TODO_LIST_ID,
  NOTE_TASKS_LIST_ID,
} from '../../../../src/shared/constants/todoConstants';

describe('buildTodoSidebarItems', () => {
  it('prepends note tasks and keeps the default manual list ahead of custom lists', () => {
    const items = buildTodoSidebarItems([
      {
        id: 'project-follow-up',
        name: '项目跟进',
        isDefault: false,
        color: '#f59e0b',
        createdAt: 3,
        updatedAt: 3,
        order: 1,
      },
      {
        id: DEFAULT_MANUAL_TODO_LIST_ID,
        name: '默认任务清单',
        isDefault: true,
        createdAt: 2,
        updatedAt: 2,
        order: 0,
      },
      {
        id: NOTE_TASKS_LIST_ID,
        name: '便签任务',
        isDefault: true,
        createdAt: 1,
        updatedAt: 1,
        order: -1,
      },
    ]);

    expect(items.map((item) => item.id)).toEqual([
      NOTE_TASKS_LIST_ID,
      DEFAULT_MANUAL_TODO_LIST_ID,
      'project-follow-up',
    ]);
    expect(items.map((item) => item.kind)).toEqual([
      'note-derived',
      'manual-default',
      'manual-custom',
    ]);
    expect(items[0]).toMatchObject({
      id: NOTE_TASKS_LIST_ID,
      name: '便签任务',
      description: '来自便签的任务',
      isEditable: false,
      isDeletable: false,
    });
    expect(items[1]).toMatchObject({
      id: DEFAULT_MANUAL_TODO_LIST_ID,
      name: '默认任务清单',
      description: 'AI 与默认创建任务会保存到这里',
      isEditable: false,
      isDeletable: false,
    });
    expect(items[2]).toMatchObject({
      id: 'project-follow-up',
      name: '项目跟进',
      description: '自定义清单',
      isEditable: true,
      isDeletable: true,
      color: '#f59e0b',
    });
  });
});
