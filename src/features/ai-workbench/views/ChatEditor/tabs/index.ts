/**
 * ChatEditor Tabs 配置和导出
 *
 * 统一管理所有 Tab 组件，方便扩展
 */

import { RobotOutlined, AppstoreOutlined, SettingOutlined } from '@ant-design/icons';
import type { TabKeyType } from './types';

// 导出所有 Tab 组件
export { AITab } from './AITab';
export { KitTab } from './KitTab';
export { default as SettingsTab } from './SettingsTab';

// 导出类型
export type { TabKeyType };

/**
 * Tab 配置
 * 新增 Tab 只需在此处添加配置
 */
export const TAB_CONFIG: Array<{
  key: TabKeyType;
  icon: typeof RobotOutlined;
  label?: string;
}> = [
  { key: 'ai', icon: RobotOutlined },
  { key: 'kit', icon: AppstoreOutlined },
  { key: 'settings', icon: SettingOutlined },
];
