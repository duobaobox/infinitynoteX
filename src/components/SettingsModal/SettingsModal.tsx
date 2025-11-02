import React, { useState } from "react";
import { Modal, Menu, Form, Input, Switch, Select, Divider } from "antd";
import "./SettingsModal.css";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ open, onClose }) => {
  const [selectedMenu, setSelectedMenu] = useState("general");

  const menuItems = [
    { key: "general", label: "常规" },
    { key: "appearance", label: "外观" },
    { key: "editor", label: "编辑器" },
    { key: "shortcuts", label: "快捷键" },
    { key: "about", label: "关于" },
  ];

  const renderSettingsPanel = () => {
    switch (selectedMenu) {
      case "general":
        return (
          <div className="settings-panel">
            <h3>常规设置</h3>
            <Form layout="vertical">
              <Form.Item label="应用标题">
                <Input placeholder="输入应用标题" />
              </Form.Item>
              <Form.Item label="自动保存">
                <Switch />
              </Form.Item>
              <Form.Item label="自动保存间隔（秒）">
                <Input type="number" defaultValue={30} />
              </Form.Item>
              <Form.Item label="启动时恢复最后打开的文件">
                <Switch defaultChecked />
              </Form.Item>
            </Form>
          </div>
        );
      case "appearance":
        return (
          <div className="settings-panel">
            <h3>外观设置</h3>
            <Form layout="vertical">
              <Form.Item label="主题">
                <Select
                  options={[
                    { label: "亮色", value: "light" },
                    { label: "暗色", value: "dark" },
                    { label: "自动", value: "auto" },
                  ]}
                  defaultValue="light"
                />
              </Form.Item>
              <Form.Item label="字体大小">
                <Select
                  options={[
                    { label: "小", value: "small" },
                    { label: "中", value: "medium" },
                    { label: "大", value: "large" },
                  ]}
                  defaultValue="medium"
                />
              </Form.Item>
              <Form.Item label="字体族">
                <Input placeholder="输入字体名称" defaultValue="Segoe UI" />
              </Form.Item>
            </Form>
          </div>
        );
      case "editor":
        return (
          <div className="settings-panel">
            <h3>编辑器设置</h3>
            <Form layout="vertical">
              <Form.Item label="制表符大小">
                <Input type="number" defaultValue={2} />
              </Form.Item>
              <Form.Item label="使用空格代替制表符">
                <Switch defaultChecked />
              </Form.Item>
              <Form.Item label="自动换行">
                <Switch defaultChecked />
              </Form.Item>
              <Form.Item label="显示行号">
                <Switch defaultChecked />
              </Form.Item>
              <Form.Item label="显示缩进线">
                <Switch defaultChecked />
              </Form.Item>
            </Form>
          </div>
        );
      case "shortcuts":
        return (
          <div className="settings-panel">
            <h3>快捷键设置</h3>
            <Form layout="vertical">
              <Form.Item label="新建笔记">
                <Input placeholder="输入快捷键组合" defaultValue="Ctrl+N" />
              </Form.Item>
              <Form.Item label="保存">
                <Input placeholder="输入快捷键组合" defaultValue="Ctrl+S" />
              </Form.Item>
              <Form.Item label="搜索">
                <Input placeholder="输入快捷键组合" defaultValue="Ctrl+F" />
              </Form.Item>
            </Form>
          </div>
        );
      case "about":
        return (
          <div className="settings-panel">
            <h3>关于</h3>
            <div className="about-content">
              <p>
                <strong>应用名称：</strong> InfinityNoteX
              </p>
              <p>
                <strong>版本：</strong> 0.0.0
              </p>
              <Divider />
              <p>
                <strong>构建信息：</strong>
              </p>
              <p>一款无限可能的笔记应用</p>
              <Divider />
              <p>
                <strong>许可证：</strong> MIT
              </p>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <Modal
      title="设置"
      open={open}
      onCancel={onClose}
      footer={null}
      centered
      width="80vw"
      className="settings-modal"
    >
      <div className="settings-container">
        <div className="settings-sidebar">
          <div className="flex-vertical-equal">
            <div className="scrollable-list">
              <Menu
                mode="inline"
                items={menuItems}
                selectedKeys={[selectedMenu]}
                onClick={(e) => setSelectedMenu(e.key)}
                className="settings-menu"
              />
            </div>
          </div>
        </div>
        <div className="settings-content">{renderSettingsPanel()}</div>
      </div>
    </Modal>
  );
};

export default SettingsModal;
