import React from "react";
import { Segmented, Button } from "antd";
import {
  AppstoreOutlined,
  ToolOutlined,
  PlusOutlined,
} from "@ant-design/icons";

const Sidebar: React.FC = () => {
  return (
    <div className="layout-panel sidebar">
      <div className="flex-vertical-equal">
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
        <div className="flex-vertical-equal" />
      </div>
    </div>
  );
};

export default Sidebar;
