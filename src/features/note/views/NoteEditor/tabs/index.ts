/**
 * NoteEditor Tabs 配置和导出
 *
 * 统一管理所有 Tab 组件，方便扩展
 */

import { EditOutlined, ToolOutlined, RobotOutlined, AppstoreOutlined } from '@ant-design/icons';
import type { TabKeyType } from '../types';

// 导出所有 Tab 组件
export { EditTab } from './EditTab';
export { ToolsTab } from './ToolsTab';
export { AITab } from './AITab';
export { OtherTab } from './OtherTab';

/**
 * Tab 配置
 * 新增 Tab 只需在此处添加配置
 */
export const TAB_CONFIG: Array<{
  key: TabKeyType;
  icon: typeof EditOutlined;
  label?: string;
}> = [
  { key: 'edit', icon: EditOutlined },
  { key: 'tools', icon: ToolOutlined },
  { key: 'ai', icon: RobotOutlined },
  { key: 'other', icon: AppstoreOutlined },
];
