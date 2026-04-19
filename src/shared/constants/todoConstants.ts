/**
 * Todo 模块跨端常量（主进程 + 渲染进程共用单一来源）
 */

/** 便签任务视图 ID（不对应真实持久化 TodoList） */
export const NOTE_TASKS_LIST_ID = 'default-note-tasks' as const;

/** 真实的手动任务默认清单 ID */
export const DEFAULT_MANUAL_TODO_LIST_ID = 'default-manual-tasks' as const;

/** 为了向前兼容保留，逐步替换为上面两个 */
export const DEFAULT_TODO_LIST_ID = NOTE_TASKS_LIST_ID;
