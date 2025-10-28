import React, { useState } from "react";

import { Segmented } from "antd";
import {
  EditOutlined,
  ToolOutlined,
  RobotOutlined,
  AppstoreOutlined,
} from "@ant-design/icons";
import { TipTapEditor } from "./TipTapEditor";

const EditorPanel: React.FC = () => {
  const [editorContent, setEditorContent] = useState<string>("");
  const [activeTab, setActiveTab] = useState<string | number>("edit");

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
        <div style={{ display: "inline-block" }}>
          <Segmented
            options={segmentOptions}
            value={activeTab}
            onChange={setActiveTab}
          />
        </div>
  <div className="editor-inner-tab-container">
          {activeTab === "edit" && (
            <TipTapEditor
              initialContent={editorContent}
              onContentChange={setEditorContent}
            />
          )}
          {activeTab === "tools" && (
            <div style={{ padding: "16px" }}>工具面板</div>
          )}
          {activeTab === "ai" && (
            <div style={{ padding: "16px" }}>AI 工作台</div>
          )}
          {activeTab === "other" && (
            <div style={{ padding: "16px" }}>其他面板</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EditorPanel;
