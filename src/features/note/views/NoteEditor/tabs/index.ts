/**
 * NoteEditor Tabs 配置和导出
 *
 * 【文件职责】
 * - 统一管理所有 Tab 组件的导出
 * - 定义 Tab 配置 (TAB_CONFIG)，使得添加新 Tab 只需修改此处
 *
 * 【如何添加新 Tab】
 * 1. 在本目录创建 NewTab.tsx 组件
 * 2. 在下方 export 该组件
 * 3. 在 ../types.ts 的 TabKeyType 中添加新 key
 * 4. 在 TAB_CONFIG 数组中添加配置项
 * 5. 在 NoteEditor/index.tsx 的 renderTabContent() 中添加 case
 */

import { EditOutlined, ToolOutlined, RobotOutlined, AppstoreOutlined } from '@ant-design/icons';
import type { TabKeyType } from '../types';

// ============ 组件导出 ============

export { EditTab } from './EditTab';
export { ToolsTab } from './ToolsTab';
export { AITab } from './AITab';
export { CanvasTab } from './CanvasTab';

// ============ Tab 配置 ============

/**
 * Tab 配置数组
 * - key: Tab 标识，与 TabKeyType 对应
 * - icon: Tab 图标组件
 * - label: 可选的文字标签
 *
 * 新增 Tab 只需在此添加配置项
 */
export const TAB_CONFIG: Array<{
  key: TabKeyType;
  icon: typeof EditOutlined;
  label: string;
}> = [
  { key: 'edit', icon: EditOutlined, label: '编辑' },
  { key: 'ai', icon: RobotOutlined, label: 'AI' },
  { key: 'other', icon: AppstoreOutlined, label: '画布' },
  { key: 'tools', icon: ToolOutlined, label: '工具' },
];
