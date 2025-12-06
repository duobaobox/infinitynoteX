/**
 * ChatEditor Tabs 配置和导出
 *
 * 统一管理所有 Tab 组件，方便扩展
 */

import { RobotOutlined, AppstoreOutlined, SettingOutlined } from '@ant-design/icons';

// ============ 类型定义 ============

/** Tab 键类型 */
export type TabKeyType = 'ai' | 'kit' | 'settings';

// ============ 组件导出 ============

export { AITab } from './AITab';
export { KitTab } from './KitTab';
export { default as SettingsTab } from './SettingsTab';

// ============ Tab 配置 ============

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
