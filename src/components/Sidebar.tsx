import React, { useEffect, useRef, useState } from "react";
import { Segmented, Button, Menu, message } from "antd";
import {
  AppstoreOutlined,
  ToolOutlined,
  PlusOutlined,
  SettingOutlined,
  FolderOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import type { Folder } from "../services/types";
import SettingsModal from "./SettingsModal/SettingsModal";

interface SidebarProps {
  selectedFolderId: string | null;
  onSelectFolder: (folderId: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  selectedFolderId,
  onSelectFolder,
}) => {
  const scrollableListRef = useRef<HTMLDivElement>(null);
  const flexVerticalEqualRef = useRef<HTMLDivElement>(null);
  const [isOverflow, setIsOverflow] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [folders, setFolders] = useState<Folder[]>([]);

  // 加载文件夹列表
  useEffect(() => {
    loadFolders();
  }, []);

  const loadFolders = async () => {
    try {
      const folderList = await window.storage.listFolders();
      setFolders(folderList);

      // 默认选中第一个文件夹（默认文件夹）
      if (folderList.length > 0 && !selectedFolderId) {
        onSelectFolder(folderList[0].id);
      }
    } catch (error) {
      console.error("Failed to load folders:", error);
      message.error("加载文件夹失败");
    }
  };

  const handleCreateFolder = async () => {
    const name = prompt("请输入文件夹名称:");
    if (!name || !name.trim()) return;

    try {
      await window.storage.createFolder(name.trim());
      message.success("创建成功");
      await loadFolders();
    } catch (error: any) {
      console.error("Failed to create folder:", error);
      if (error.message?.includes("already exists")) {
        message.error("文件夹名称已存在");
      } else {
        message.error("创建文件夹失败");
      }
    }
  };

  const handleDeleteFolder = async (id: string) => {
    const folder = folders.find((f) => f.id === id);
    if (!folder) return;

    if (folder.system) {
      message.warning("默认文件夹不可删除");
      return;
    }

    const confirmed = window.confirm(
      `确定要删除文件夹"${folder.name}"吗？\n该文件夹下的所有便签将移动到默认文件夹。`
    );
    if (!confirmed) return;

    try {
      await window.storage.deleteFolder(id);
      message.success("删除成功");
      await loadFolders();

      // 如果删除的是当前选中的文件夹，切换到默认文件夹
      if (selectedFolderId === id) {
        onSelectFolder(folders[0]?.id || "default");
      }
    } catch (error: any) {
      console.error("Failed to delete folder:", error);
      message.error("删除文件夹失败");
    }
  };

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
          onClick={handleCreateFolder}
          style={{ justifyContent: "flex-start" }}
        >
          添加文件夹
        </Button>
      </div>
      <div className="flex-vertical-equal" ref={flexVerticalEqualRef}>
        <div className="scrollable-list" ref={scrollableListRef}>
          <Menu
            mode="inline"
            selectedKeys={selectedFolderId ? [selectedFolderId] : []}
            onSelect={({ key }) => onSelectFolder(key)}
            items={folders.map((folder) => ({
              key: folder.id,
              label: folder.name,
              icon: <FolderOutlined />,
              // 系统默认文件夹不显示删除按钮
              ...(!folder.system && {
                children: [
                  {
                    key: `${folder.id}-delete`,
                    label: "删除",
                    icon: <DeleteOutlined />,
                    onClick: () => handleDeleteFolder(folder.id),
                  },
                ],
              }),
            }))}
          />
        </div>
      </div>
      <div className="flex-vertical-auto">
        <Button
          type="text"
          block
          icon={<SettingOutlined />}
          onClick={() => setIsSettingsOpen(true)}
          style={{ justifyContent: "flex-start" }}
        >
          设置
        </Button>
      </div>
      <SettingsModal
        open={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
};

export default Sidebar;
