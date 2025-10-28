import React, { useEffect, useRef, useState } from "react";
import { Segmented, Button, Menu } from "antd";
import {
  AppstoreOutlined,
  ToolOutlined,
  PlusOutlined,
} from "@ant-design/icons";

const Sidebar: React.FC = () => {
  const scrollableListRef = useRef<HTMLDivElement>(null);
  const flexVerticalEqualRef = useRef<HTMLDivElement>(null);
  const [isOverflow, setIsOverflow] = useState(false);

  // 检测滚动条是否出现
  useEffect(() => {
    const scrollableElement = scrollableListRef.current;
    if (!scrollableElement) return;

    // 使用 ResizeObserver 监控容器大小变化
    const resizeObserver = new ResizeObserver(() => {
      // 检查是否有垂直滚动条：scrollHeight > clientHeight
      const hasVerticalScroll =
        scrollableElement.scrollHeight > scrollableElement.clientHeight;
      setIsOverflow(hasVerticalScroll);
    });

    resizeObserver.observe(scrollableElement);

    // 同时监控 MutationObserver 捕捉内容变化
    const mutationObserver = new MutationObserver(() => {
      const hasVerticalScroll =
        scrollableElement.scrollHeight > scrollableElement.clientHeight;
      setIsOverflow(hasVerticalScroll);
    });

    mutationObserver.observe(scrollableElement, {
      childList: true,
      subtree: true,
    });

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, []);

  // 根据溢出状态动态更新 padding
  useEffect(() => {
    if (flexVerticalEqualRef.current) {
      if (isOverflow) {
        flexVerticalEqualRef.current.style.paddingRight = "0px";
      } else {
        flexVerticalEqualRef.current.style.paddingRight = "10px";
      }
    }
  }, [isOverflow]);
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
      <div className="flex-vertical-equal" ref={flexVerticalEqualRef}>
        <div className="scrollable-list" ref={scrollableListRef}>
          <Menu
            mode="inline"
            items={[
              { key: "folder1", label: "默认" },
              { key: "folder2", label: "文件夹2" },
              { key: "folder3", label: "文件夹3" },
              { key: "folder4", label: "文件夹4" },
              { key: "folder5", label: "文件夹5" },
              { key: "folder6", label: "文件夹6" },
              { key: "folder7", label: "文件夹7" },
              { key: "folder8", label: "文件夹8" },
              { key: "folder9", label: "文件夹9" },
              { key: "folder10", label: "文件夹10" },
              
              
            ]}
            defaultSelectedKeys={["folder1"]}
          />
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
