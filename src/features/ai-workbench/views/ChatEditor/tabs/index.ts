/**
 * ChatEditor Tabs 配置和导出
 *
 * 【文件职责】
 * - 统一管理所有 Tab 组件的导出
 * - 定义 Tab 配置 (TAB_CONFIG)，使得添加新 Tab 只需修改此处
 * - 定义 TabKeyType 类型
 *
 * 【如何添加新 Tab】
 * 1. 在本目录创建 NewTab.tsx 组件
 * 2. 在下方 export 该组件
 * 3. 在 TabKeyType 中添加新 key
 * 4. 在 TAB_CONFIG 数组中添加配置项
 */

import { RobotOutlined, AppstoreOutlined, SettingOutlined } from '@ant-design/icons';

// ============ 类型定义 ============

/** Tab 键类型 - 添加新 Tab 时需在此扩展 */
export type TabKeyType = 'ai' | 'kit' | 'settings';

// ============ 组件导出 ============

export { AITab } from './AITab';
export { KitTab } from './KitTab';
export { default as SettingsTab } from './SettingsTab';

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
  icon: typeof RobotOutlined;
  label?: string;
}> = [
  { key: 'ai', icon: RobotOutlined, label: '对话' },
  { key: 'kit', icon: AppstoreOutlined, label: '工坊' },
  { key: 'settings', icon: SettingOutlined, label: '设置' },
];
