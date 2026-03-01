/**
 * Browser Feature 模块入口
 *
 * 【模块职责】
 * - 提供内置网页看板功能
 * - 包含网页看板卡片列表 (BrowserCardListView) 和视图 (BrowserViewer)
 *
 * 【架构说明】
 * 通过 registerFeature() 向全局 Feature Registry 注册自己，
 * 使得 Layout 组件可以动态加载本模块的视图，无需硬编码引用。
 */

import { GlobalOutlined } from '@ant-design/icons';
import { registerFeature } from '../../config/featureRegistry';
import { BrowserCardListView } from './views/BrowserCardList';
import { BrowserViewer } from './views/BrowserViewer';

// 向 Feature Registry 注册 Browser 功能
registerFeature({
  id: 'browser', // 唯一标识，用于路由匹配
  workspaceView: 'tool', // 归属于"工坊"视图
  name: '网页看板', // 显示名称
  icon: <GlobalOutlined />, // 侧边栏图标
  ListView: BrowserCardListView, // 左侧列表组件
  EditorView: BrowserViewer, // 右侧编辑器组件
});

// 导出组件供外部直接引用（可选，推荐通过 Registry 访问）
export { BrowserCardListView, BrowserViewer };
