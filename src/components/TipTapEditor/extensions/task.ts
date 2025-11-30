/**
 * 任务列表扩展配置
 * 包含任务列表相关的扩展
 */

import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';

/**
 * 获取任务列表扩展
 * - TaskList: 任务列表容器
 * - TaskItem: 任务项 (支持嵌套)
 */
export const getTaskExtensions = () => {
  return [
    // 任务列表扩展
    TaskList.configure({
      HTMLAttributes: {
        class: 'task-list',
      },
    }),

    // 任务项扩展
    TaskItem.configure({
      nested: true,
      HTMLAttributes: {
        class: 'task-item',
      },
    }),
  ];
};
