import React from "react";

import { Segmented } from "antd";
import {
  EditOutlined,
  ToolOutlined,
  RobotOutlined,
  AppstoreOutlined,
} from "@ant-design/icons";

const EditorPanel: React.FC = () => {
  const segmentOptions = [
    {
      label: (
        <span>
          <EditOutlined style={{ marginRight: 4 }} />
        </span>
      ),
      value: "edit",
    },
    {
      label: (
        <span>
          <ToolOutlined style={{ marginRight: 4 }} />
        </span>
      ),
      value: "tools",
    },
    {
      label: (
        <span>
          <RobotOutlined style={{ marginRight: 4 }} />
        </span>
      ),
      value: "ai",
    },
    {
      label: (
        <span>
          <AppstoreOutlined style={{ marginRight: 4 }} />
        </span>
      ),
      value: "other",
    },
  ];
  return (
    <div className="layout-panel editor-container">
      <div className="flex-vertical-equal">
        <div style={{ display: "inline-block", marginBottom: 16 }}>
          <Segmented options={segmentOptions} defaultValue="edit" />
        </div>
        {/* 编辑内容放这里 */}
      </div>
    </div>
  );
};

export default EditorPanel;
