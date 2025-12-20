/**
 * 任务定位辅助函数
 * 根据任务在 JSON 中的路径，找到对应节点在 ProseMirror 文档中的位置
 */

import type { Editor } from '@tiptap/react';

/**
 * 根据任务路径找到对应 taskItem 节点在编辑器中的位置
 * @param editor TipTap 编辑器实例
 * @param taskPath 任务在 JSON 中的路径索引数组，如 [0, 1] 表示第1个节点的第2个子节点
 * @returns 节点的位置（pos）或 null
 */
export function findTaskItemPosition(editor: Editor, taskPath: number[]): number | null {
  if (!editor || !taskPath || taskPath.length === 0) {
    return null;
  }

  try {
    const { doc } = editor.state;
    let currentNode = doc;
    let position = 0;

    // 遍历路径，定位到目标节点
    for (let i = 0; i < taskPath.length; i++) {
      const index = taskPath[i];

      if (!currentNode.content || index >= currentNode.content.childCount) {
        console.warn('[findTaskItemPosition] Invalid path at index', i, 'path:', taskPath);
        return null;
      }

      // 累加位置：前面所有节点的大小
      for (let j = 0; j < index; j++) {
        const child = currentNode.content.child(j);
        position += child.nodeSize;
      }

      // 进入当前节点（+1 是为了进入节点内部）
      position += 1;
      currentNode = currentNode.content.child(index);
    }

    // 检查是否真的是 taskItem 节点
    if (currentNode.type.name !== 'taskItem') {
      console.warn('[findTaskItemPosition] Target node is not taskItem:', currentNode.type.name);
      return null;
    }

    return position;
  } catch (error) {
    console.error('[findTaskItemPosition] Error:', error);
    return null;
  }
}

/**
 * 定位到指定任务并滚动到视口中央
 * @param editor TipTap 编辑器实例
 * @param taskPath 任务路径
 */
export function scrollToTask(editor: Editor, taskPath: number[]): void {
  const position = findTaskItemPosition(editor, taskPath);

  if (position === null) {
    console.warn('[scrollToTask] Cannot find task position for path:', taskPath);
    return;
  }

  try {
    // 1. 先设置光标位置和聚焦
    editor.chain().focus().setTextSelection(position).run();

    // 2. 延迟执行滚动，确保 DOM 更新完成
    setTimeout(() => {
      try {
        // 使用 TipTap 的 scrollIntoView
        editor.commands.scrollIntoView();

        // 3. 额外使用原生 DOM 滚动，确保元素在视口中央
        setTimeout(() => {
          const { from } = editor.state.selection;
          const coords = editor.view.coordsAtPos(from);

          // 计算需要滚动的目标元素
          const targetElement = document.elementFromPoint(coords.left, coords.top);

          if (targetElement) {
            // 找到最近的 taskItem 元素
            const taskItemElement =
              targetElement.closest('[data-type="taskItem"]') || targetElement;

            // 使用原生 scrollIntoView，并配置为居中显示
            taskItemElement.scrollIntoView({
              behavior: 'smooth',
              block: 'center',
              inline: 'nearest',
            });

            console.log('[scrollToTask] Scrolled to position:', position, 'for path:', taskPath);
          }
        }, 50);
      } catch (error) {
        console.error('[scrollToTask] Error in DOM scrolling:', error);
      }
    }, 50);
  } catch (error) {
    console.error('[scrollToTask] Error scrolling to task:', error);
  }
}
