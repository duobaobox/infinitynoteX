/**
 * SettingsModal - 设置弹窗主组件
 * 只负责菜单切换和 Tab 渲染，各 Tab 的状态和逻辑由各自组件管理
 */

import React, { useState } from 'react';
import { Modal, Menu } from 'antd';
import { useSettingsStore } from '../../store/settingsStore';
import AppearanceTab from './tabs/AppearanceTab';
import AITab from './tabs/AITab';
import DataTab from './tabs/DataTab';
import SyncTab from './tabs/SyncTab';
import TrashTab from './tabs/TrashTab';
import AboutTab from './tabs/AboutTab';
import './SettingsModal.css';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

const menuItems = [
  { key: 'appearance', label: '外观' },
  { key: 'ai', label: 'AI 管理' },
  { key: 'data', label: '数据管理' },
  { key: 'sync', label: '数据同步' },
  { key: 'trash', label: '回收站' },
  { key: 'about', label: '关于' },
];

const SettingsModal: React.FC<SettingsModalProps> = ({ open, onClose }) => {
  const [selectedMenu, setSelectedMenu] = useState('appearance');
  const { initAppearance } = useSettingsStore();

  // Modal 打开时初始化外观状态
  React.useEffect(() => {
    if (open) {
      initAppearance();
    }
  }, [open, initAppearance]);

  const renderTabContent = () => {
    switch (selectedMenu) {
      case 'appearance':
        return <AppearanceTab />;
      case 'ai':
        return <AITab />;
      case 'data':
        return <DataTab />;
      case 'sync':
        return <SyncTab />;
      case 'trash':
        return <TrashTab />;
      case 'about':
        return <AboutTab />;
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
      styles={{
        body: { height: '80vh', overflow: 'hidden', padding: 0 },
      }}
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
        <div className="settings-content">{renderTabContent()}</div>
      </div>
    </Modal>
  );
};

export default SettingsModal;
