/**
 * Todo 模块入口
 *
 * 【模块职责】
 * - 提供任务清单功能
 * - 从便签中解析 TaskList/TaskItem 并聚合展示
 * - 支持双向同步：在 Todo 中勾选任务会更新原便签
 *
 * 【架构说明】
 * 通过 registerFeature() 向全局 Feature Registry 注册自己，
 * 使得 Layout 组件可以动态加载本模块的视图，无需硬编码引用。
 */

import { CheckSquareOutlined } from '@ant-design/icons';
import { registerFeature } from '../../config/featureRegistry';
import { TodoCardListView } from './views/TodoCardList';
import { TodoViewer } from './views/TodoViewer';

// 向 Feature Registry 注册 Todo 功能
registerFeature({
  id: 'todo', // 唯一标识，用于路由匹配
  workspaceView: 'tool', // 归属于"工坊"视图
  name: '任务清单', // 显示名称
  icon: <CheckSquareOutlined />, // 侧边栏图标
  ListView: TodoCardListView, // 左侧列表组件
  EditorView: TodoViewer, // 右侧编辑器组件
});

// 导出组件供外部直接引用（可选，推荐通过 Registry 访问）
export { TodoCardListView, TodoViewer };
