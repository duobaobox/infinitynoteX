import React from "react";
import { Segmented, Button, Menu } from "antd";
import {
  AppstoreOutlined,
  ToolOutlined,
  PlusOutlined,
} from "@ant-design/icons";

const Sidebar: React.FC = () => {
  return (
    <div className="layout-panel sidebar">
      <div className="flex-vertical-auto">
        <Segmented
          block
          options={[
            {
              label: (
                <span>
                  <AppstoreOutlined style={{ marginRight: 4 }} />
                  便签
                </span>
              ),
              value: "note",
            },
            {
              label: (
                <span>
                  <ToolOutlined style={{ marginRight: 4 }} />
                  工具
                </span>
              ),
              value: "tool",
            },
          ]}
        />
        <Button
          type="text"
          block
          icon={<PlusOutlined />}
          style={{ justifyContent: "flex-start" }}
        >
          添加
        </Button>
      </div>
      <div className="flex-vertical-equal">
        <div className="scrollable-list">
          <Menu
            mode="inline"
            items={[
              { key: "folder1", label: "默认" },
              { key: "folder2", label: "文件夹2" },
              { key: "folder3", label: "文件夹3" },
            ]}
            defaultSelectedKeys={["folder1"]}
          />
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
