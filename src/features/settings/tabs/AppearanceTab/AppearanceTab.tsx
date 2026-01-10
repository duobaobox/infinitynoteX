/**
 * AppearanceTab - 外观设置 Tab 组件
 */

import React from 'react';
import { Form, Space, ColorPicker, Input, Segmented, Divider, message } from 'antd';
import { useSettingsStore } from '../../../../store/settingsStore';
import { getThemeColor, ThemeMode } from '../../../../theme/theme';
import BackgroundEditor from '../../../../components/BackgroundEditor';
import './AppearanceTab.css';

const AppearanceTab: React.FC = () => {
  const {
    primaryColor,
    themeMode,
    bgLight,
    bgDark,
    setPrimaryColor,
    applyPrimaryColor,
    applyThemeMode,
    applyBackground,
  } = useSettingsStore();

  return (
    <div className="settings-panel appearance-tab">
      <h3>外观设置</h3>
      <Form layout="vertical">
        <Form.Item label="主题色">
          <Space align="center" size={16}>
            <ColorPicker
              value={primaryColor}
              // 拖动过程中仅更新本地显示，不提交主题与提示，避免频繁触发
              onChange={(c) => {
                const hex = c.toHexString();
                setPrimaryColor(hex);
              }}
              // 操作完成后再统一提交主题色，并用同一个 key 覆盖提示，避免堆叠
              onChangeComplete={(c) => {
                const hex = c.toHexString();
                applyPrimaryColor(hex);
              }}
              presets={[
                {
                  label: '主题色',
                  colors: [
                    '#1677ff',
                    '#fa8c16',
                    '#722ed1',
                    '#13c2c2',
                    '#eb2f96',
                    '#52c41a',
                    '#fa541c',
                  ],
                },
              ]}
            />
            <Input
              style={{ width: 120 }}
              value={primaryColor}
              onChange={(e) => {
                const v = e.target.value.trim();
                setPrimaryColor(v);
              }}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(v)) {
                  applyPrimaryColor(v);
                } else {
                  message.warning('请输入有效的十六进制颜色，如 #1677ff');
                  setPrimaryColor(getThemeColor());
                }
              }}
              placeholder="#1677ff"
            />
          </Space>
        </Form.Item>
        <Form.Item label="主题">
          <Segmented
            options={[
              { label: '亮色', value: 'light' },
              { label: '暗色', value: 'dark' },
              { label: '自动', value: 'auto' },
            ]}
            value={themeMode}
            onChange={(v) => {
              const next = v as ThemeMode;
              applyThemeMode(next);
            }}
          />
        </Form.Item>
        <Divider />
        <Form.Item label="背景">
          <BackgroundEditor
            value={themeMode === 'dark' ? bgDark : bgLight}
            onChange={(newBg: string) => {
              applyBackground(newBg, themeMode === 'dark' ? 'dark' : 'light');
            }}
            mode={themeMode === 'dark' ? 'dark' : 'light'}
          />
        </Form.Item>
      </Form>
    </div>
  );
};

export default AppearanceTab;
