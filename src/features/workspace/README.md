# Workspace Feature

该目录集中存放主工作区（便签 / 工具 Tab 共用框架）相关的 UI 与业务逻辑，便于新成员快速定位代码。

```
workspace/
├── EditorPanel/        # 右侧编辑容器（便签编辑 / 工具 tabs）
├── ListPanel/          # 中间列表容器（便签列表 / AI 对话 / 工具列表）
├── NoteCard/           # 列表卡片通用渲染及主题 Hook
├── Sidebar/            # 左侧侧边栏，负责便签/工具切换
└── ToolPanel/          # 工具模式下的右侧容器（复用 EditorPanel 框架）
```

- **EditorPanel**：包含 `EditTab`、`ToolsTab`、`AITab` 等子模块，仅处理便签编辑相关逻辑。
- **ToolPanel**：工具模式时复用相同的容器骨架，并在首个分段展示 AI 对话，后续可无缝扩展计时器等功能。
- **ListPanel**：在 note/tool 不同模式下切换数据源，但保持同一布局；AI 对话列表直接复用 `NoteCard` 组件。
- **Sidebar**：统一处理工作区视图切换和文件夹/工具列表展示。
- **NoteCard**：集中卡片 UI 与主题胶水，供便签与 AI 对话列表共享。

若新增工作区子模块（例如新的工具 Tab），请在对应子目录下扩展并在此 README 中补充说明，保持结构清晰。
