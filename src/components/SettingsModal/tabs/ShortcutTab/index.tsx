/**
 * ShortcutTab - 快捷键设置 Tab 组件
 * 允许用户自定义全局快捷键
 */

import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Space, Typography, Divider, message, Tag } from 'antd';
import { ReloadOutlined, KeyOutlined } from '@ant-design/icons';
import { useSettingsStore } from '../../../../store/settingsStore';
import './styles.css';

const { Text, Paragraph } = Typography;

// 默认快捷键
const DEFAULT_SHORTCUT = 'CommandOrControl+Shift+Q';

const ShortcutTab: React.FC = () => {
  const { shortcutKeys, setShortcutKeys, loadShortcutKeys } = useSettingsStore();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  // 加载快捷键配置
  useEffect(() => {
    loadShortcutKeys();
  }, [loadShortcutKeys]);

  // 同步 store 到表单
  useEffect(() => {
    form.setFieldsValue({
      aiChatWindow: shortcutKeys.aiChatWindow || DEFAULT_SHORTCUT,
    });
  }, [shortcutKeys, form]);

  // 保存快捷键
  const handleSave = async () => {
    try {
      setSaving(true);
      const values = await form.validateFields();

      // 验证快捷键格式
      const shortcut = values.aiChatWindow.trim();
      if (!isValidShortcut(shortcut)) {
        message.error('快捷键格式不正确，请参考示例格式');
        return;
      }

      // 保存到 store 和主进程
      await setShortcutKeys({ aiChatWindow: shortcut });

      message.success('快捷键已保存，将在下次启动应用时生效');
    } catch (error) {
      console.error('Failed to save shortcut:', error);
      message.error('保存快捷键失败');
    } finally {
      setSaving(false);
    }
  };

  // 恢复默认
  const handleReset = () => {
    form.setFieldsValue({ aiChatWindow: DEFAULT_SHORTCUT });
  };

  // 简单的快捷键格式验证
  const isValidShortcut = (shortcut: string): boolean => {
    const validPattern =
      /^(CommandOrControl|Ctrl|Command|Alt|Shift|Meta)(\+(CommandOrControl|Ctrl|Command|Alt|Shift|Meta|[A-Z0-9]))+((\+[A-Z0-9])?)?$/i;
    return validPattern.test(shortcut);
  };

  return (
    <div className="settings-panel shortcut-tab">
      <h3>快捷键设置</h3>

      <Paragraph type="secondary">
        自定义全局快捷键，快速访问应用功能。修改后需要重启应用才能生效。
      </Paragraph>

      <Form form={form} layout="vertical" onFinish={handleSave}>
        <Form.Item
          label="AI 助手快捷键"
          name="aiChatWindow"
          rules={[
            { required: true, message: '请输入快捷键' },
            {
              validator: (_, value) => {
                if (value && !isValidShortcut(value)) {
                  return Promise.reject('快捷键格式不正确');
                }
                return Promise.resolve();
              },
            },
          ]}
          extra={<Text type="secondary">用于呼出/隐藏 AI 对话窗口</Text>}
        >
          <Space.Compact style={{ width: '100%', maxWidth: 400 }}>
            <Input prefix={<KeyOutlined />} placeholder="例如: CommandOrControl+Shift+Q" />
          </Space.Compact>
        </Form.Item>

        <Space>
          <Button type="primary" htmlType="submit" loading={saving}>
            保存设置
          </Button>
          <Button icon={<ReloadOutlined />} onClick={handleReset}>
            恢复默认
          </Button>
        </Space>
      </Form>

      <Divider />

      <div className="shortcut-help">
        <h4>快捷键格式说明</h4>
        <Paragraph type="secondary">可用的修饰键：</Paragraph>
        <div className="shortcut-keys">
          <Tag>CommandOrControl</Tag>
          <span>Mac 上为 Command（⌘），Windows/Linux 上为 Ctrl</span>
        </div>
        <div className="shortcut-keys">
          <Tag>Ctrl</Tag>
          <span>Ctrl 键</span>
        </div>
        <div className="shortcut-keys">
          <Tag>Alt</Tag>
          <span>Alt 键（Mac 上为 Option）</span>
        </div>
        <div className="shortcut-keys">
          <Tag>Shift</Tag>
          <span>Shift 键</span>
        </div>

        <Divider style={{ margin: '16px 0' }} />

        <Paragraph type="secondary">示例格式：</Paragraph>
        <div className="shortcut-examples">
          <div className="shortcut-example-item">
            <Tag color="blue">CommandOrControl+Shift+Q</Tag>
            <Text type="secondary">推荐（跨平台）</Text>
          </div>
          <div className="shortcut-example-item">
            <Tag color="blue">Alt+Space</Tag>
            <Text type="secondary">Alt + 空格</Text>
          </div>
          <div className="shortcut-example-item">
            <Tag color="blue">Ctrl+Alt+A</Tag>
            <Text type="secondary">Ctrl + Alt + A</Text>
          </div>
        </div>

        <Divider style={{ margin: '16px 0' }} />

        <Paragraph type="secondary">
          <Text strong>注意事项：</Text>
        </Paragraph>
        <ul className="shortcut-notes">
          <li>避免使用系统保留的快捷键（如 Ctrl+C、Ctrl+V 等）</li>
          <li>Mac 上避免使用 Command+Q（系统退出快捷键）</li>
          <li>建议使用多个修饰键组合，避免冲突</li>
        </ul>
      </div>
    </div>
  );
};

export default ShortcutTab;
