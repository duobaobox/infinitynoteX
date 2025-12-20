/**
 * 任务解析服务
 * 从便签内容中解析 TaskList/TaskItem 节点
 */

import type { Note, TipTapJSONContent } from '../../../services/types';
import type { ParsedTask } from '../types';
import { extractTextFromNode } from '../types';

/**
 * 从单个便签解析所有任务项
 */
export function parseTasksFromNote(note: Note): ParsedTask[] {
  const tasks: ParsedTask[] = [];

  function traverse(node: TipTapJSONContent, path: number[]) {
    if (node.type === 'taskItem') {
      const text = extractTextFromNode(node);
      if (text.trim()) {
        tasks.push({
          id: `${note.id}#${path.join('.')}`,
          noteId: note.id,
          noteTitle: note.title,
          folderId: note.folderId,
          path: [...path],
          text: text.trim(),
          checked: Boolean(node.attrs?.checked),
          updatedAt: note.updatedAt,
        });
      }
    }

    // 递归遍历子节点
    if (node.content && Array.isArray(node.content)) {
      node.content.forEach((child, index) => {
        traverse(child, [...path, index]);
      });
    }
  }

  if (note.content) {
    traverse(note.content, []);
  }

  return tasks;
}

/**
 * 从多个便签解析所有任务
 */
export function parseTasksFromNotes(notes: Note[]): ParsedTask[] {
  return notes.flatMap(parseTasksFromNote);
}

/**
 * 更新便签中某个任务的勾选状态
 * @returns 更新后的便签内容
 */
export function updateTaskCheckedStatus(
  content: TipTapJSONContent,
  path: number[],
  checked: boolean,
): TipTapJSONContent {
  // 深拷贝以避免直接修改原对象
  const newContent = JSON.parse(JSON.stringify(content)) as TipTapJSONContent;

  // 根据路径找到目标节点并更新
  let current: TipTapJSONContent | undefined = newContent;
  for (let i = 0; i < path.length; i++) {
    if (current?.content && Array.isArray(current.content)) {
      current = current.content[path[i]];
    } else {
      break;
    }
  }

  if (current && current.type === 'taskItem') {
    current.attrs = { ...current.attrs, checked };
  }

  return newContent;
}
