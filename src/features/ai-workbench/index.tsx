/**
 * AI Workbench 模块入口
 *
 * 【模块职责】
 * - 提供 AI 对话相关功能
 * - 包含对话列表 (ConversationListView) 和编辑器 (ChatEditor)
 *
 * 【架构说明】
 * 通过 registerFeature() 向全局 Feature Registry 注册自己，
 * 使得 Layout 组件可以动态加载本模块的视图，无需硬编码引用。
 *
 * 【如何扩展】
 * 1. 添加新的 AI 工具 Tab: 在 views/ChatEditor/tabs/ 目录添加组件
 * 2. 添加新的工坊工具: 创建新模块并调用 registerFeature()
 */

import { RobotOutlined } from '@ant-design/icons';
import { registerFeature } from '../../config/featureRegistry';
import { ConversationListView } from './views/ConversationList/ConversationListView';
import { ChatEditor } from './views/ChatEditor';
import './aiWorkbench.css';

// 向 Feature Registry 注册 AI Chat 功能
registerFeature({
  id: 'ai-chat', // 唯一标识，用于路由匹配
  workspaceView: 'tool', // 归属于"工坊"视图
  name: 'AI对话', // 显示名称
  icon: <RobotOutlined />, // 侧边栏图标
  ListView: ConversationListView, // 左侧列表组件
  EditorView: ChatEditor, // 右侧编辑器组件
});

// 导出组件供外部直接引用（可选，推荐通过 Registry 访问）
export { ConversationListView, ChatEditor };
