import React from "react";
import { Input, Badge } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import NoteCard from "./NoteCard/NoteCard";

interface ListPanelProps {
  flex: string | number;
}

const NOTE_COUNT = 6;
const NOTE_COLOR = "#fa8c16"; // 便签主题色，与 colorPrimary 保持一致

const ListPanel: React.FC<ListPanelProps> = ({ flex }) => {
  // 假数据
  const fakeNotes = Array.from({ length: 5 }).map((_, i) => ({
    title: `便签标题 ${i + 1}`,
    content: `这是第${
      i + 1
    }条便签的内容，内容可以很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长。`,
    color: ["bae0ff", "d9f7be", "ffd6e7", "d6e4ff", "ffd666", "ffffff"][
      i % 6
    ] as any,
  }));
  return (
    <div className="layout-panel list-container" style={{ flex }}>
      <div className="flex-vertical-auto">
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
      </div>
      <div className="flex-vertical-equal">
        <div className="scrollable-list">
          {fakeNotes.map((note, idx) => (
            <NoteCard
              key={idx}
              title={note.title}
              content={note.content}
              color={note.color}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default ListPanel;
