/**
 * Note 模块入口
 *
 * 【模块职责】
 * - 提供便签相关功能
 * - 包含便签列表 (NoteListView) 和编辑器 (NoteEditor)
 *
 * 【架构说明】
 * 通过 registerFeature() 向全局 Feature Registry 注册自己，
 * 使得 Layout 组件可以动态加载本模块的视图，无需硬编码引用。
 *
 * 【如何扩展】
 * 1. 添加新的便签 Tab: 在 views/NoteEditor/tabs/ 目录添加组件
 * 2. 添加新的 Hook: 在 views/NoteEditor/hooks/ 目录添加
 */

import { AppstoreOutlined } from '@ant-design/icons';
import { registerFeature } from '../../config/featureRegistry';
import { NoteListView } from './views/NoteList/NoteListView';
import { NoteEditor } from './views/NoteEditor';

// 向 Feature Registry 注册 Note 功能
registerFeature({
  id: 'note', // 唯一标识，用于路由匹配
  workspaceView: 'note', // 归属于"便签"视图
  name: '便签', // 显示名称
  icon: <AppstoreOutlined />, // 侧边栏图标
  ListView: NoteListView, // 左侧列表组件
  EditorView: NoteEditor, // 右侧编辑器组件
});

// 导出组件供外部直接引用（可选，推荐通过 Registry 访问）
export { NoteListView, NoteEditor };
