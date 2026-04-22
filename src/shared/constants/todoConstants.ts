/**
 * Todo 模块跨端常量（主进程 + 渲染进程共用单一来源）
 */

/** 便签任务视图 ID（不对应真实持久化 TodoList） */
export const NOTE_TASKS_LIST_ID = 'default-note-tasks' as const;
export const NOTE_TASKS_LIST_NAME = '便签任务' as const;
export const NOTE_TASKS_LIST_DESCRIPTION = '来自便签的任务' as const;
export const NOTE_TASKS_LIST_COLOR = '#1677ff' as const;

/** 真实的手动任务默认清单 ID */
export const DEFAULT_MANUAL_TODO_LIST_ID = 'default-manual-tasks' as const;
export const DEFAULT_MANUAL_TODO_LIST_NAME = '默认任务清单' as const;
export const DEFAULT_MANUAL_TODO_LIST_DESCRIPTION = 'AI 与默认创建任务会保存到这里' as const;

/** 为了向前兼容保留，逐步替换为上面两个 */
export const DEFAULT_TODO_LIST_ID = NOTE_TASKS_LIST_ID;
