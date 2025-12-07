# TipTap 编辑器插件完整参考手册

> 📅 更新日期: 2025-12-07\
> 📦 当前项目版本: @tiptap/\* v3.13.0

---

## 目录

1. [TipTap 简介](#一tiptap-简介)
2. [扩展分类说明](#二扩展分类说明)
3. [StarterKit 基础套件详解](#三starterkit-基础套件详解)
4. [Nodes 节点扩展](#四nodes-节点扩展完整列表)
5. [Marks 文本装饰扩展](#五marks-文本装饰扩展完整列表)
6. [Functionality 功能扩展](#六functionality-功能扩展完整列表)
7. [项目使用情况汇总](#七项目使用情况汇总)
8. [扩展规划建议](#八扩展规划建议)

---

## 一、TipTap 简介

### 什么是 TipTap？

TipTap 是一个基于 [ProseMirror](https://prosemirror.net/) 的**无头（Headless）富文本编辑器框架**。

- **无头设计**: 只提供编辑能力，UI 完全自定义
- **模块化架构**: 所有功能通过"扩展"添加，按需引入
- **框架无关**: 支持 React、Vue、Svelte 等
- **TypeScript 原生**: 完整的类型定义

### 核心概念

| 概念          | 说明                                     |
| ------------- | ---------------------------------------- |
| **Editor**    | 编辑器实例，管理状态和命令               |
| **Extension** | 扩展，为编辑器添加功能                   |
| **Node**      | 节点，文档的内容块（段落、标题、图片等） |
| **Mark**      | 标记，文本的装饰（粗体、链接、高亮等）   |
| **Command**   | 命令，修改文档的操作                     |
| **Schema**    | 模式，定义文档结构规则                   |

---

## 二、扩展分类说明

TipTap 的扩展分为三大类：

### 1. Node 节点扩展

定义文档中的**内容块**，如段落、标题、图片、表格等。

特点：

- 在文档中占据独立位置
- 可以包含其他节点或文本
- 在 HTML 中通常对应块级元素

### 2. Mark 标记扩展

定义**文本装饰**，如粗体、斜体、链接、高亮等。

特点：

- 附加在文本上，不占独立位置
- 可以叠加使用（如粗体+斜体）
- 在 HTML 中通常对应行内元素

### 3. Extension 功能扩展

提供**编辑器增强功能**，如撤销重做、快捷键、占位符等。

特点：

- 不直接影响文档结构
- 增强编辑体验
- 可能添加命令或监听事件

---

## 三、StarterKit 基础套件详解

### 什么是 StarterKit？

**StarterKit 就像是一个「新手礼包」或「打包套餐」。**

TipTap 的功能都是通过一个个独立的扩展来添加的。如果你想要粗体、斜体、标题、列表这些基础功能，理论上需要一个个安装：

```bash
# 不用 StarterKit，需要一个个安装 😰
npm install @tiptap/extension-document
npm install @tiptap/extension-paragraph
npm install @tiptap/extension-text
npm install @tiptap/extension-heading
npm install @tiptap/extension-bold
npm install @tiptap/extension-italic
# ... 还有十几个
```

有了 StarterKit，只需要一行：

```bash
# 用 StarterKit，一键全包 ✅
npm install @tiptap/starter-kit
```

**📦 StarterKit = 22 个最常用的扩展打包在一起**

### 表格符号说明

本文档的表格中有两列标记：**StarterKit** 和 **本项目**

| 符号 | 在「StarterKit」列的含义                                   | 在「本项目」列的含义       |
| :--: | ---------------------------------------------------------- | -------------------------- |
|  ✅  | 这功能**包含在 StarterKit 里**<br>装了 StarterKit 就自动有 | 我们项目**已经有**这个功能 |
|  ❌  | 这功能**不在 StarterKit 里**<br>需要单独安装               | 我们项目**还没有**这个功能 |

#### 举例理解

| 扩展            | StarterKit | 本项目 | 解释                                      |
| --------------- | :--------: | :----: | ----------------------------------------- |
| Bold（粗体）    |     ✅     |   ✅   | StarterKit 自带粗体，我们项目有           |
| Image（图片）   |     ❌     |   ✅   | StarterKit 没有图片，但我们**额外安装**了 |
| YouTube（视频） |     ❌     |   ❌   | StarterKit 没有，我们也没装               |

### 安装方法

```bash
npm install @tiptap/starter-kit
```

### 包含的扩展（v3.13.0）

#### Nodes 节点（11个）

| 扩展名             | 功能说明             | HTML 输出       |
| ------------------ | -------------------- | --------------- |
| **Document**       | 文档根节点，必需     | 无              |
| **Paragraph**      | 普通段落             | `<p>`           |
| **Text**           | 纯文本内容，必需     | 文本            |
| **Heading**        | 标题（支持 H1-H6）   | `<h1>` - `<h6>` |
| **Blockquote**     | 引用块               | `<blockquote>`  |
| **BulletList**     | 无序列表             | `<ul>`          |
| **OrderedList**    | 有序列表             | `<ol>`          |
| **ListItem**       | 列表项               | `<li>`          |
| **CodeBlock**      | 代码块               | `<pre><code>`   |
| **HardBreak**      | 硬换行 (Shift+Enter) | `<br>`          |
| **HorizontalRule** | 水平分割线           | `<hr>`          |

#### Marks 标记（6个，v3 新增 Link 和 Underline）

| 扩展名        | 功能说明        | 快捷键         | HTML 输出  |
| ------------- | --------------- | -------------- | ---------- |
| **Bold**      | 粗体            | `Ctrl+B`       | `<strong>` |
| **Italic**    | 斜体            | `Ctrl+I`       | `<em>`     |
| **Strike**    | 删除线          | `Ctrl+Shift+S` | `<s>`      |
| **Code**      | 行内代码        | `Ctrl+E`       | `<code>`   |
| **Link**      | 超链接 (v3新增) | -              | `<a>`      |
| **Underline** | 下划线 (v3新增) | `Ctrl+U`       | `<u>`      |

#### Extensions 功能（5个）

| 扩展名                  | 功能说明                             |
| ----------------------- | ------------------------------------ |
| **Dropcursor**          | 拖拽时显示光标位置指示器             |
| **Gapcursor**           | 在无法点击的位置（如表格外）创建光标 |
| **Undo/Redo (History)** | 撤销 `Ctrl+Z` / 重做 `Ctrl+Y`        |
| **ListKeymap**          | 列表键盘操作优化 (v3新增)            |
| **TrailingNode**        | 文档末尾自动添加空段落 (v3新增)      |

---

## 四、Nodes 节点扩展完整列表

### 免费扩展

| 扩展名                 | 包名                                    | 功能说明                     | StarterKit | 本项目 |
| ---------------------- | --------------------------------------- | :--------------------------- | :--------: | :----: |
| **Document**           | `@tiptap/extension-document`            | 必需的文档根节点             |     ✅     |   ✅   |
| **Paragraph**          | `@tiptap/extension-paragraph`           | 普通段落 `<p>`               |     ✅     |   ✅   |
| **Text**               | `@tiptap/extension-text`                | 纯文本，必需                 |     ✅     |   ✅   |
| **Heading**            | `@tiptap/extension-heading`             | 标题 H1-H6，支持配置级别     |     ✅     |   ✅   |
| **Blockquote**         | `@tiptap/extension-blockquote`          | 引用块，支持嵌套             |     ✅     |   ✅   |
| **BulletList**         | `@tiptap/extension-bullet-list`         | 无序列表 `<ul>`              |     ✅     |   ✅   |
| **OrderedList**        | `@tiptap/extension-ordered-list`        | 有序列表 `<ol>`，支持起始值  |     ✅     |   ✅   |
| **ListItem**           | `@tiptap/extension-list-item`           | 列表项 `<li>`                |     ✅     |   ✅   |
| **CodeBlock**          | `@tiptap/extension-code-block`          | 代码块，无语法高亮           |     ✅     |   ✅   |
| **HardBreak**          | `@tiptap/extension-hard-break`          | 硬换行 `<br>`                |     ✅     |   ✅   |
| **HorizontalRule**     | `@tiptap/extension-horizontal-rule`     | 水平分割线 `<hr>`            |     ✅     |   ✅   |
| **Image**              | `@tiptap/extension-image`               | 图片，支持 Base64、URL       |     ❌     |   ✅   |
| **Table**              | `@tiptap/extension-table`               | 表格容器，支持合并单元格     |     ❌     |   ✅   |
| **TableRow**           | `@tiptap/extension-table-row`           | 表格行 `<tr>`                |     ❌     |   ✅   |
| **TableCell**          | `@tiptap/extension-table-cell`          | 表格单元格 `<td>`            |     ❌     |   ✅   |
| **TableHeader**        | `@tiptap/extension-table-header`        | 表格表头 `<th>`              |     ❌     |   ✅   |
| **TaskList**           | `@tiptap/extension-task-list`           | 任务列表容器                 |     ❌     |   ✅   |
| **TaskItem**           | `@tiptap/extension-task-item`           | 任务项，可勾选               |     ❌     |   ✅   |
| **CodeBlock Lowlight** | `@tiptap/extension-code-block-lowlight` | 代码块 + 语法高亮 (200+语言) |     ❌     |   ❌   |
| **YouTube**            | `@tiptap/extension-youtube`             | 嵌入 YouTube 视频            |     ❌     |   ❌   |
| **Mention**            | `@tiptap/extension-mention`             | @提及功能，需配合建议列表    |     ❌     |   ❌   |
| **Emoji**              | `@tiptap/extension-emoji`               | 表情符号渲染                 |     ❌     |   ❌   |
| **Details**            | `@tiptap/extension-details`             | 折叠内容块（需配合下面两个） |     ❌     |   ❌   |
| **DetailsContent**     | `@tiptap/extension-details-content`     | 折叠内容                     |     ❌     |   ❌   |
| **DetailsSummary**     | `@tiptap/extension-details-summary`     | 折叠标题                     |     ❌     |   ❌   |
| **Mathematics**        | `@tiptap/extension-mathematics`         | LaTeX 数学公式渲染           |     ❌     |   ❌   |

### 各扩展详细说明

#### Image 图片扩展

```typescript
Image.configure({
  inline: true, // 是否行内显示
  allowBase64: true, // 允许 Base64 编码
  // TipTap v3 新增：图片缩放功能
  resize: {
    enabled: true,
    // 可选方向: 'top', 'bottom', 'left', 'right', 'top-left', 'top-right', 'bottom-left', 'bottom-right'
    directions: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
    minWidth: 50,
    minHeight: 50,
    alwaysPreserveAspectRatio: true, // 保持宽高比
  },
  HTMLAttributes: {
    class: 'editor-image',
  },
});
```

**命令**: `setImage({ src, alt, title, width, height })`

> **CSS 要求**: 启用 resize 后需要为 `[data-resize-handle]` 选择器添加样式（手柄定位、光标等）。

#### Table 表格扩展

推荐使用 **TableKit** 套件一次性引入所有表格相关扩展：

```typescript
import { TableKit } from '@tiptap/extension-table';

TableKit.configure({
  table: { resizable: true }, // 可调整列宽
  tableCell: {},
  tableHeader: {},
  tableRow: {},
});
```

**命令**: `insertTable()`, `addColumnBefore()`, `deleteRow()` 等

#### TaskList 任务列表

```typescript
TaskList.configure({
  HTMLAttributes: { class: 'task-list' },
});
TaskItem.configure({
  nested: true, // 支持嵌套
});
```

**命令**: `toggleTaskList()`

#### CodeBlock Lowlight 代码高亮

需要额外安装 lowlight：

```bash
npm install @tiptap/extension-code-block-lowlight lowlight
```

```typescript
import { lowlight } from 'lowlight';
CodeBlockLowlight.configure({
  lowlight,
  defaultLanguage: 'javascript',
});
```

#### YouTube 视频嵌入

```typescript
Youtube.configure({
  width: 640,
  height: 360,
  nocookie: true, // 使用隐私增强模式
});
```

**命令**: `setYoutubeVideo({ src })`

#### Mention 提及

需要配合 `@tiptap/suggestion` 使用：

```typescript
Mention.configure({
  suggestion: {
    items: ({ query }) => users.filter((u) => u.name.includes(query)),
    render: () => ({
      /* 渲染建议列表 */
    }),
  },
});
```

#### Details 折叠内容

```typescript
// 需要同时安装三个扩展
import Details from '@tiptap/extension-details';
import DetailsContent from '@tiptap/extension-details-content';
import DetailsSummary from '@tiptap/extension-details-summary';
```

**命令**: `setDetails()`, `unsetDetails()`

#### Mathematics 数学公式

需要安装 KaTeX：

```bash
npm install @tiptap/extension-mathematics katex
```

支持 LaTeX 语法：`$E = mc^2$`

---

## 五、Marks 文本装饰扩展完整列表

| 扩展名          | 包名                            | 功能说明                   | 快捷键         | StarterKit | 本项目 |
| --------------- | ------------------------------- | -------------------------- | -------------- | :--------: | :----: |
| **Bold**        | `@tiptap/extension-bold`        | 粗体文字                   | `Ctrl+B`       |     ✅     |   ✅   |
| **Italic**      | `@tiptap/extension-italic`      | 斜体文字                   | `Ctrl+I`       |     ✅     |   ✅   |
| **Strike**      | `@tiptap/extension-strike`      | 删除线                     | `Ctrl+Shift+S` |     ✅     |   ✅   |
| **Code**        | `@tiptap/extension-code`        | 行内代码                   | `Ctrl+E`       |     ✅     |   ✅   |
| **Underline**   | `@tiptap/extension-underline`   | 下划线                     | `Ctrl+U`       |   ✅(v3)   |   ✅   |
| **Link**        | `@tiptap/extension-link`        | 超链接                     | -              |   ✅(v3)   |   ✅   |
| **Highlight**   | `@tiptap/extension-highlight`   | 文本高亮（支持多色）       | -              |     ❌     |   ✅   |
| **Subscript**   | `@tiptap/extension-subscript`   | 下标文字 H₂O               | -              |     ❌     |   ❌   |
| **Superscript** | `@tiptap/extension-superscript` | 上标文字 X²                | -              |     ❌     |   ❌   |
| **TextStyle**   | `@tiptap/extension-text-style`  | 文本样式容器（颜色等需要） | -              |     ❌     |   ❌   |

### 各扩展详细说明

#### Link 链接扩展

```typescript
Link.configure({
  openOnClick: false, // 编辑模式不直接打开
  autolink: true, // 自动识别 URL
  defaultProtocol: 'https',
  HTMLAttributes: {
    target: '_blank',
    rel: 'noopener noreferrer',
  },
});
```

**命令**: `setLink({ href })`, `unsetLink()`, `toggleLink({ href })`

#### Highlight 高亮扩展

```typescript
Highlight.configure({
  multicolor: true, // 支持多种颜色
  HTMLAttributes: { class: 'editor-highlight' },
});
```

**命令**: `toggleHighlight()`, `setHighlight({ color: 'yellow' })`, `unsetHighlight()`

#### Subscript / Superscript 上下标

```typescript
Subscript.configure({
  HTMLAttributes: { class: 'subscript' },
});
Superscript.configure({
  HTMLAttributes: { class: 'superscript' },
});
```

**命令**: `toggleSubscript()`, `toggleSuperscript()`

#### TextStyle 文本样式

TextStyle 本身不提供可见功能，但它是 **Color**、**FontFamily** 等扩展的依赖：

```typescript
// 使用颜色必须先安装 TextStyle
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';

extensions: [TextStyle, Color];
```

---

## 六、Functionality 功能扩展完整列表

| 扩展名             | 包名                                | 功能说明                   | StarterKit | 本项目 |
| ------------------ | ----------------------------------- | -------------------------- | :--------: | :----: |
| **History**        | `@tiptap/extension-history`         | 撤销/重做 `Ctrl+Z/Y`       |     ✅     |   ✅   |
| **Dropcursor**     | `@tiptap/extension-dropcursor`      | 拖拽时显示光标位置         |     ✅     |   ✅   |
| **Gapcursor**      | `@tiptap/extension-gapcursor`       | 在间隙位置创建光标         |     ✅     |   ✅   |
| **ListKeymap**     | `@tiptap/extension-list-keymap`     | 列表键盘操作优化           |   ✅(v3)   |   ✅   |
| **TrailingNode**   | `@tiptap/extension-trailing-node`   | 末尾自动添加空段落         |   ✅(v3)   |   ✅   |
| **Placeholder**    | `@tiptap/extension-placeholder`     | 空编辑器占位提示           |     ❌     |   ✅   |
| **TextAlign**      | `@tiptap/extension-text-align`      | 文本对齐（左/中/右/两端）  |     ❌     |   ✅   |
| **BubbleMenu**     | `@tiptap/extension-bubble-menu`     | 选中文字时弹出工具栏       |     ❌     |   ✅   |
| **FloatingMenu**   | `@tiptap/extension-floating-menu`   | 空行时弹出快捷菜单         |     ❌     |   ✅   |
| **CharacterCount** | `@tiptap/extension-character-count` | 字符/单词计数              |     ❌     |   ✅   |
| **Focus**          | `@tiptap/extension-focus`           | 追踪编辑器焦点状态         |     ❌     |   ❌   |
| **Color**          | `@tiptap/extension-color`           | 文字颜色（需 TextStyle）   |     ❌     |   ❌   |
| **FontFamily**     | `@tiptap/extension-font-family`     | 字体选择（需 TextStyle）   |     ❌     |   ❌   |
| **Typography**     | `@tiptap/extension-typography`      | 自动排版优化（智能引号等） |     ❌     |   ✅   |

### 各扩展详细说明

#### Placeholder 占位符

```typescript
Placeholder.configure({
  placeholder: '开始输入...',
  showOnlyWhenEditable: true,
  emptyEditorClass: 'is-editor-empty',
});
```

#### TextAlign 文本对齐

```typescript
TextAlign.configure({
  types: ['heading', 'paragraph'], // 应用于哪些节点
  alignments: ['left', 'center', 'right', 'justify'],
  defaultAlignment: 'left',
});
```

**命令**: `setTextAlign('center')`, `unsetTextAlign()`

#### BubbleMenu 气泡菜单

选中文本时弹出的工具栏：

```tsx
<BubbleMenu editor={editor}>
  <button onClick={() => editor.chain().toggleBold().run()}>粗体</button>
</BubbleMenu>
```

#### FloatingMenu 浮动菜单

光标在空行时弹出：

```tsx
<FloatingMenu editor={editor}>
  <button onClick={() => editor.chain().insertTable().run()}>插入表格</button>
</FloatingMenu>
```

#### CharacterCount 字符计数

```typescript
CharacterCount.configure({
  limit: 10000, // 字符限制
  mode: 'textSize', // 或 'nodeSize'
});
```

**使用**: `editor.storage.characterCount.characters()`

#### Color 文字颜色

```typescript
// 需要先安装 TextStyle
Color.configure({
  types: ['textStyle'],
});
```

**命令**: `setColor('#ff0000')`, `unsetColor()`

#### Typography 排版优化

自动转换：

- `"..."` → `"..."`（智能引号）
- `--` → `—`（破折号）
- `...` → `…`（省略号）
- `(c)` → `©`（版权符号）

---

## 七、项目使用情况汇总

### 当前已使用的扩展

```
📦 @tiptap/starter-kit (v3.13.0)
├── 📄 Nodes: Document, Paragraph, Text, Heading, Blockquote,
│           BulletList, OrderedList, ListItem, CodeBlock,
│           HardBreak, HorizontalRule
├── ✍️ Marks: Bold, Italic, Strike, Code, Link, Underline
└── 🔧 Extensions: History, Dropcursor, Gapcursor, ListKeymap, TrailingNode

📦 额外安装的扩展
├── 📄 @tiptap/extension-image          (图片)
├── 📄 @tiptap/extension-table          (TableKit 表格套件)
├── 📄 @tiptap/extension-task-list      (任务列表)
├── 📄 @tiptap/extension-task-item      (任务项)
├── ✍️ @tiptap/extension-highlight      (文字高亮 - 支持多色)
├── 🔧 @tiptap/extension-placeholder    (占位符)
├── 🔧 @tiptap/extension-text-align     (文本对齐)
├── 🔧 @tiptap/extension-character-count (字符计数)
├── 🔧 @tiptap/extension-typography     (自动排版)
├── 🔧 @tiptap/extension-bubble-menu    (上下文感知气泡菜单)
├── 🔧 @tiptap/extension-floating-menu  (斜杠命令浮动菜单)
└── 🔧 @tiptap/suggestion               (Suggestion 建议列表)
```

### 自定义扩展

```
🛠️ 项目自定义扩展
├── ResizableImage      (可调整大小图片，仿官方 demo 风格)
├── ImagePasteHandler   (图片粘贴/拖放处理，保存到 attachments)
├── TableHandles        (Notion 风格表格行/列手柄)
└── SlashCommands       (Notion 风格 "/" 命令菜单)
```

### 上下文感知菜单系统

```
🎯 BubbleMenu 组件 (shouldShow 逻辑)
├── TextBubbleMenu      (选中文本: 加粗/斜体/下划线/高亮/链接)
├── ImageBubbleMenu     (选中图片: 对齐/查看原图/删除)
├── LinkBubbleMenu      (光标在链接上: 编辑/打开/复制/取消链接)
├── CodeBlockBubbleMenu (光标在代码块: 语言选择/复制/删除)
└── TableBubbleMenu     (光标在表格: 行列操作/合并拆分)
```

### 统计

| 类别       | 已使用 | 可用(免费) | 覆盖率  |
| ---------- | ------ | ---------- | ------- |
| Nodes      | 18     | 25         | 72%     |
| Marks      | 8      | 10         | 80%     |
| Extensions | 15     | 18+        | 83%     |
| **总计**   | **41** | **53+**    | **77%** |

---

## 八、开源与付费说明

### 许可证信息

TipTap 采用**双重许可模式**：

| 类型              | 许可证   | 费用 | 说明                   |
| ----------------- | -------- | ---- | ---------------------- |
| **核心扩展**      | MIT      | 免费 | 开源，可商用           |
| **Platform 功能** | 商业授权 | 付费 | 需订阅 TipTap Platform |

### ✅ 免费开源扩展 (MIT License)

以下扩展**完全免费**，可用于商业项目：

**Nodes（节点）**

- Document, Paragraph, Text, Heading, Blockquote
- BulletList, OrderedList, ListItem, TaskList, TaskItem
- CodeBlock, CodeBlock Lowlight, HardBreak, HorizontalRule
- Image, Table, TableRow, TableCell, TableHeader
- Details, DetailsContent, DetailsSummary
- YouTube, Mention, Emoji, Mathematics

**Marks（标记）**

- Bold, Italic, Strike, Code, Underline, Link
- Highlight, Subscript, Superscript, TextStyle

**Extensions（功能）**

- StarterKit, History, Dropcursor, Gapcursor
- Placeholder, TextAlign, CharacterCount, Typography
- BubbleMenu, FloatingMenu, Focus, Color, FontFamily
- ListKeymap, TrailingNode, Suggestion

### ❌ 付费 Platform 功能

以下功能需要 **TipTap Platform 订阅**（$每月付费）：

| 功能                     | 订阅级别 | 说明                    |
| ------------------------ | -------- | ----------------------- |
| **AI Toolkit**           | Add-on   | AI 驱动的文档编辑和代理 |
| **AI Generation**        | Start+   | 内联 AI 文本生成        |
| **Comments**             | Start+   | 文档批注/评论功能       |
| **Import**               | Start+   | DOCX/ODT/Markdown 导入  |
| **Export**               | Start+   | DOCX/ODT/Markdown 导出  |
| **Collaboration**        | Start+   | 实时多人协作 (CRDT)     |
| **Collaboration Caret**  | Start+   | 协作者光标显示          |
| **Pages**                | Team+    | 分页布局功能            |
| **Snapshot**             | Team+    | 文档版本历史快照        |
| **Compare Snapshots**    | Team+    | 版本对比差异            |
| **Drag Handle**          | Start+   | 节点拖拽排序手柄        |
| **File Handler**         | Start+   | 文件拖放上传处理        |
| **UniqueID**             | Team+    | 节点唯一标识符          |
| **Invisible Characters** | Team+    | 显示隐藏字符            |

> **TipTap Platform 定价**（2025年）
>
> - **Start**: $99/月起
> - **Team**: $299/月起
> - **Business**: 定制价格
> - **Enterprise**: 联系销售

### 开源替代方案

如果需要付费功能但不想订阅，可以考虑开源替代：

| 付费功能       | 开源替代                                                                                  | 说明          |
| -------------- | ----------------------------------------------------------------------------------------- | ------------- |
| Collaboration  | [Yjs](https://github.com/yjs/yjs) + [y-prosemirror](https://github.com/yjs/y-prosemirror) | CRDT 实时协作 |
| AI Integration | 自行集成 OpenAI/Claude API                                                                | 需自己开发    |
| Import/Export  | [prosemirror-docx](https://github.com/benrbray/prosemirror-docx)                          | 社区方案      |

---

## 九、扩展规划建议

### 🔴 强烈推荐添加

| 扩展                        | 理由                       | 安装命令                                                          |
| --------------------------- | -------------------------- | ----------------------------------------------------------------- |
| **CodeBlock Lowlight**      | 代码语法高亮，开发者必备   | `npm i @tiptap/extension-code-block-lowlight lowlight`            |
| **Subscript + Superscript** | 数学/化学公式需要          | `npm i @tiptap/extension-subscript @tiptap/extension-superscript` |
| **Color + TextStyle**       | 文字颜色，已有高亮但缺颜色 | `npm i @tiptap/extension-color @tiptap/extension-text-style`      |

### 🟡 建议考虑添加

| 扩展           | 理由                 | 安装命令                              |
| -------------- | -------------------- | ------------------------------------- |
| **YouTube**    | 嵌入视频，多媒体笔记 | `npm i @tiptap/extension-youtube`     |
| **FontFamily** | 字体选择             | `npm i @tiptap/extension-font-family` |

### 🟢 可选添加

| 扩展            | 理由       | 安装命令                                                                                              |
| --------------- | ---------- | ----------------------------------------------------------------------------------------------------- |
| **Details**     | 折叠内容块 | `npm i @tiptap/extension-details @tiptap/extension-details-content @tiptap/extension-details-summary` |
| **Mention**     | @提及功能  | `npm i @tiptap/extension-mention`                                                                     |
| **Mathematics** | LaTeX 公式 | `npm i @tiptap/extension-mathematics katex`                                                           |
| **Emoji**       | 表情符号   | `npm i @tiptap/extension-emoji`                                                                       |

---

## 附录：官方资源链接

- [TipTap 官方文档](https://tiptap.dev/docs)
- [扩展列表](https://tiptap.dev/docs/editor/extensions)
- [GitHub 仓库](https://github.com/ueberdosis/tiptap) (MIT License)
- [定价页面](https://tiptap.dev/pricing)
- [功能对比](https://tiptap.dev/feature-comparison)
- [API 参考](https://tiptap.dev/docs/editor/api)
- [社区扩展 (Awesome TipTap)](https://github.com/ueberdosis/awesome-tiptap)
