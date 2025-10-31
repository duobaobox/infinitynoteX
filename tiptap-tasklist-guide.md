# Tiptap 任务列表（TaskList）功能实现整理

## 1. 依赖与扩展

在你的 React 组件中引入 Tiptap 的任务列表扩展：

```tsx
import { TaskList, TaskItem } from "@tiptap/extension-list";
```

在 `useEditor` 的 `extensions` 配置中加入：

```tsx
TaskList.configure({ /* 可选配置 */ }),
TaskItem.configure({ /* 可选配置 */ }),
```

## 2. 工具栏按钮（Toolbar）

在工具栏配置中添加任务列表按钮：

```tsx
{
  id: "taskList",
  icon: <Icon name="checkbox-multiple-line" />, // RemixIcon
  title: "任务列表 (无快捷键)",
  group: "lists",
  isActive: (editor) => editor.isActive("taskList"),
  onClick: (editor) => editor.chain().focus().toggleTaskList().run(),
},
```

## 3. 任务列表 CSS 样式

在 CSS 文件中添加如下样式：

```css
ul[data-type="taskList"] {
  list-style: none;
  margin-left: 0;
  padding: 0;
  margin: 1.25rem 1rem 1.25rem 0.4rem;
}
ul[data-type="taskList"] li {
  align-items: flex-start;
  display: flex;
}
ul[data-type="taskList"] li > label {
  flex: 0 0 auto;
  margin-right: 0.5rem;
  user-select: none;
  padding-top: 0.35em;
}
ul[data-type="taskList"] li > div {
  flex: 1 1 auto;
}
ul[data-type="taskList"] input[type="checkbox"] {
  cursor: pointer;
}
ul[data-type="taskList"] ul[data-type="taskList"] {
  margin: 0;
  padding-left: 0.1rem;
}
ul[data-type="taskList"] li p {
  margin-top: 0.25em;
  margin-bottom: 0.25em;
  line-height: 1.5;
}
ul[data-type="taskList"] li[data-checked="true"] > div {
  text-decoration: line-through;
  opacity: 0.6;
  color: #6a737d;
}
```

## 4. 逻辑说明

- 任务列表的切换通过 `editor.chain().focus().toggleTaskList().run()` 实现。
- 任务项的勾选状态由 Tiptap 的 `TaskItem` 扩展自动管理，渲染为 `<input type="checkbox">`。
- 完成任务的样式通过 `li[data-checked="true"]` 控制。

## 5. 依赖包

确保安装了：
- `@tiptap/extension-list`
- `@tiptap/react`
- RemixIcon 字体（如用 Toolbar 里的图标）

## 6. 参考代码片段

```tsx
import { useEditor, EditorContent } from "@tiptap/react";
import { TaskList, TaskItem } from "@tiptap/extension-list";

const editor = useEditor({
  extensions: [
    TaskList,
    TaskItem,
    // ...其他扩展
  ],
  content: '<ul data-type="taskList"><li data-checked="false"><label><input type="checkbox"></label><div>任务1</div></li></ul>',
});

// 工具栏按钮见上文
```

如需移植到其他项目，按以上结构引入和配置即可。