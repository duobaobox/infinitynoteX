/**
 * Todo Slice - 管理 Todo 多清单和任务状态
 * 使用 Electron Storage API (window.storage)
 */

import type { StateCreator } from 'zustand';
import type { ParsedTask, TodoList, ManualTaskIndex } from '../../features/todo/types';
import { DEFAULT_TODO_LIST_ID } from '../../features/todo/types';
import {
  parseTasksFromNotes,
  updateTaskCheckedStatus,
} from '../../features/todo/services/taskParser';
import type { UISlice } from './uiSlice';
import type { Note } from '../../services/types';

// 定义依赖的其他 slice 类型
type TodoSliceDeps = UISlice;

export interface TodoSlice {
  // ============ 清单状态 ============
  todoLists: TodoList[];
  selectedTodoListId: string | null;

  // ============ 任务选中状态 ============
  selectedTaskId: string | null;

  // ============ 便签任务（仅用于默认清单） ============
  parsedTasks: ParsedTask[];

  // ============ 手动任务（按清单 ID 索引） ============
  manualTasks: { [listId: string]: ManualTaskIndex[] };

  // ============ 清单管理 Actions ============
  loadTodoLists: () => Promise<void>;
  selectTodoList: (id: string | null) => void;
  createTodoList: (name: string, color?: string) => Promise<void>;
  updateTodoList: (id: string, patch: { name?: string; color?: string }) => Promise<void>;
  deleteTodoList: (id: string) => Promise<void>;

  // ============ 任务选中 Actions ============
  selectTask: (id: string | null) => void;

  // ============ 便签任务 Actions ============
  loadParsedTasks: () => Promise<void>;
  toggleParsedTaskChecked: (taskId: string) => Promise<void>;

  // ============ 手动任务 Actions ============
  loadManualTasks: (listId: string) => Promise<void>;
  createManualTask: (listId: string, text: string, dueDate?: number) => Promise<void>;
  updateManualTask: (
    taskId: string,
    listId: string,
    patch: { text?: string; dueDate?: number },
  ) => Promise<void>;
  toggleManualTask: (taskId: string, listId: string) => Promise<void>;
  deleteManualTask: (taskId: string, listId: string) => Promise<void>;
}

export const createTodoSlice: StateCreator<TodoSlice & TodoSliceDeps, [], [], TodoSlice> = (
  set,
  get,
) => ({
  // 初始状态
  todoLists: [],
  selectedTodoListId: null,
  selectedTaskId: null,
  parsedTasks: [],
  manualTasks: {},

  // ============ 清单管理 Actions ============

  loadTodoLists: async () => {
    try {
      const lists = await window.storage.listTodoLists();
      set({ todoLists: lists });

      // 默认选中第一个清单（便签任务）
      if (lists.length > 0 && !get().selectedTodoListId) {
        set({ selectedTodoListId: lists[0].id });
      }
    } catch (error) {
      console.error('[TodoSlice] Failed to load todo lists:', error);
    }
  },

  selectTodoList: (id) => {
    // 使用函数式更新，确保即使 ID 相同也能更新 showEditor
    set((state) => ({
      selectedTodoListId: id,
      selectedTaskId: null,
      // 强制设为 true（解决折叠后点击无法展开的问题）
      showEditor: id ? true : state.showEditor,
    }));
  },

  createTodoList: async (name, color) => {
    try {
      const newList = await window.storage.createTodoList(name, color);
      await get().loadTodoLists();
      // 自动选中新创建的清单
      set({ selectedTodoListId: newList.id, selectedTaskId: null });
    } catch (error) {
      console.error('[TodoSlice] Failed to create todo list:', error);
      throw error;
    }
  },

  updateTodoList: async (id, patch) => {
    try {
      await window.storage.updateTodoList(id, patch);
      await get().loadTodoLists();
    } catch (error) {
      console.error('[TodoSlice] Failed to update todo list:', error);
      throw error;
    }
  },

  deleteTodoList: async (id) => {
    try {
      await window.storage.deleteTodoList(id);

      await get().loadTodoLists();

      // 如果删除的是当前选中的清单，选中默认清单
      if (get().selectedTodoListId === id) {
        set({ selectedTodoListId: DEFAULT_TODO_LIST_ID, selectedTaskId: null });
      }

      // 清理已删除清单的手动任务缓存
      const { manualTasks } = get();
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [id]: _removed, ...rest } = manualTasks;
      set({ manualTasks: rest });
    } catch (error) {
      console.error('[TodoSlice] Failed to delete todo list:', error);
      throw error;
    }
  },

  // ============ 任务选中 Actions ============

  selectTask: (id) => {
    set({
      selectedTaskId: id,
      showEditor: !!id,
    });
  },

  // ============ 便签任务 Actions ============

  loadParsedTasks: async () => {
    try {
      // 获取所有文件夹
      const folders = await window.storage.listFolders();
      const allNotes: Note[] = [];

      // 获取每个文件夹的便签
      for (const folder of folders) {
        const noteIndices = await window.storage.listNotes(folder.id);
        // 获取完整便签内容
        for (const noteIndex of noteIndices) {
          const note = await window.storage.getNote(noteIndex.id);
          if (note) {
            allNotes.push(note);
          }
        }
      }

      // 解析所有任务
      const tasks = parseTasksFromNotes(allNotes);
      set({ parsedTasks: tasks });
    } catch (error) {
      console.error('[TodoSlice] Failed to load parsed tasks:', error);
    }
  },

  toggleParsedTaskChecked: async (taskId) => {
    try {
      const tasks = get().parsedTasks;
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;

      // 获取便签
      const note = await window.storage.getNote(task.noteId);
      if (!note) return;

      // 更新任务状态
      const newContent = updateTaskCheckedStatus(note.content, task.path, !task.checked);

      // 保存便签
      await window.storage.updateNote(task.noteId, { content: newContent });

      // 重新加载任务列表
      await get().loadParsedTasks();
      // 通知其他窗口同步（药丸、悬浮窗等）
      window.ipcRenderer?.send('todo:changed', DEFAULT_TODO_LIST_ID);
    } catch (error) {
      console.error('[TodoSlice] Failed to toggle parsed task checked:', error);
      throw error;
    }
  },

  // ============ 手动任务 Actions ============

  loadManualTasks: async (listId) => {
    try {
      const tasks = await window.storage.listManualTasks(listId);
      set((state) => ({
        manualTasks: {
          ...state.manualTasks,
          [listId]: tasks,
        },
      }));
    } catch (error) {
      console.error('[TodoSlice] Failed to load manual tasks:', error);
    }
  },

  createManualTask: async (listId, text, dueDate) => {
    try {
      await window.storage.createManualTask(listId, text, dueDate);
      await get().loadManualTasks(listId);
      // 通知悬浮窗口同步
      window.ipcRenderer?.send('todo:changed', listId);
    } catch (error) {
      console.error('[TodoSlice] Failed to create manual task:', error);
      throw error;
    }
  },

  updateManualTask: async (taskId, listId, patch) => {
    try {
      await window.storage.updateManualTask(taskId, listId, patch);
      await get().loadManualTasks(listId);
      // 通知悬浮窗口同步
      window.ipcRenderer?.send('todo:changed', listId);
    } catch (error) {
      console.error('[TodoSlice] Failed to update manual task:', error);
      throw error;
    }
  },

  toggleManualTask: async (taskId, listId) => {
    try {
      await window.storage.toggleManualTask(taskId, listId);
      await get().loadManualTasks(listId);
      // 通知悬浮窗口同步
      window.ipcRenderer?.send('todo:changed', listId);
    } catch (error) {
      console.error('[TodoSlice] Failed to toggle manual task:', error);
      throw error;
    }
  },

  deleteManualTask: async (taskId, listId) => {
    try {
      await window.storage.deleteManualTask(taskId, listId);
      await get().loadManualTasks(listId);
      // 通知悬浮窗口同步
      window.ipcRenderer?.send('todo:changed', listId);
    } catch (error) {
      console.error('[TodoSlice] Failed to delete manual task:', error);
      throw error;
    }
  },
});
