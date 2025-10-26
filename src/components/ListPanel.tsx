import React from "react";
import { Input, Badge } from "antd";
import { SearchOutlined } from "@ant-design/icons";

interface ListPanelProps {
  flex: string | number;
}

const NOTE_COUNT = 6;
const NOTE_COLOR = "#fa8c16"; // 便签主题色，与 colorPrimary 保持一致

const ListPanel: React.FC<ListPanelProps> = ({ flex }) => {
  return (
    <div className="layout-panel list-container" style={{ flex }}>
      <div className="flex-vertical-equal">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 500 }}>默认</span>
          <Badge
            count={NOTE_COUNT}
            showZero
            style={{ backgroundColor: NOTE_COLOR }}
          />
        </div>
        <Input
          allowClear
          size="small"
          prefix={
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <SearchOutlined style={{ fontSize: 12 }} />
              <span style={{ fontSize: 12, color: "#999" }}>搜索</span>
            </span>
          }
        />
        <div className="scrollable-list">{/* 列表内容放这里 */}</div>
      </div>
    </div>
  );
};

export default ListPanel;
