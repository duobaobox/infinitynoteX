import React, { useEffect, useRef, useState, lazy, Suspense } from 'react';
import { Segmented, Button, message, Modal, Input, Menu, Dropdown } from 'antd';
import {
  AppstoreOutlined,
  ToolOutlined,
  PlusOutlined,
  SettingOutlined,
  FolderOutlined,
  DeleteOutlined,
  EditOutlined,
  MoreOutlined,
} from '@ant-design/icons';
import { getFeaturesByWorkspaceView } from '../../../config/featureRegistry';

// 确保 Feature 模块被加载并完成注册
import '../../note';
import '../../ai-workbench';
import type { Folder } from '../../../services/types';
import { useWorkspaceStore } from '../../../store/workspaceStore';
import { useSettingsStore } from '../../../store/settingsStore';
import './Sidebar.css';

// 懒加载设置面板（优化：减少初始 bundle 体积）
const SettingsModal = lazy(() => import('../../settings/SettingsModal'));

// Sidebar 组件不再需要 props，直接使用 Store
const Sidebar: React.FC = () => {
  // 从 Store 获取状态和操作（优化：使用 selector）
  const selectedFolderId = useWorkspaceStore((state) => state.selectedFolderId);
  const selectedToolId = useWorkspaceStore((state) => state.selectedToolId);
  const workspaceView = useWorkspaceStore((state) => state.workspaceView);
  const folders = useWorkspaceStore((state) => state.folders);
  const loadFolders = useWorkspaceStore((state) => state.loadFolders);
  const createFolder = useWorkspaceStore((state) => state.createFolder);
  const deleteFolder = useWorkspaceStore((state) => state.deleteFolder);
  const renameFolder = useWorkspaceStore((state) => state.renameFolder);
  const setSelectedFolder = useWorkspaceStore((state) => state.setSelectedFolder);
  const setSelectedTool = useWorkspaceStore((state) => state.setSelectedTool);
  const setWorkspaceView = useWorkspaceStore((state) => state.setWorkspaceView);

  // 从 Settings Store 获取状态
  const isSettingsModalOpen = useSettingsStore((state) => state.isSettingsModalOpen);
  const setSettingsModalOpen = useSettingsStore((state) => state.setSettingsModalOpen);

  // 本地状态（仅 UI 状态）
  const scrollableListRef = useRef<HTMLDivElement>(null);
  const flexVerticalEqualRef = useRef<HTMLDivElement>(null);
  const [isOverflow, setIsOverflow] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [renaming, setRenaming] = useState(false);
  const isNoteView = workspaceView === 'note';

  // 加载文件夹列表（初始化时）
  useEffect(() => {
    loadFolders();
  }, [loadFolders]);

  // 自动选中第一个（当有文件夹且未选中时）
  useEffect(() => {
    if (!selectedFolderId && folders.length > 0) {
      setSelectedFolder(folders[0].id);
    }
  }, [selectedFolderId, folders, setSelectedFolder]);

  const openCreateFolderModal = () => {
    setNewFolderName('');
    setIsCreateOpen(true);
  };

  const handleSubmitCreateFolder = async () => {
    const name = newFolderName.trim();
    if (!name) {
      message.warning('请输入文件夹名称');
      return;
    }
    // 前端简单重复校验，减少无效请求
    if (folders.some((f) => f.name === name)) {
      message.error('文件夹名称已存在');
      return;
    }

    try {
      setCreating(true);
      await createFolder(name); // 使用 Store Action
      // 创建成功不再弹窗提醒
      setIsCreateOpen(false);
      setNewFolderName('');
    } catch (error) {
      console.error('Failed to create folder:', error);
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('already exists')) {
        message.error('文件夹名称已存在');
      } else {
        message.error('创建文件夹失败');
      }
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteFolder = async (id: string) => {
    const folder = folders.find((f) => f.id === id);
    if (!folder) return;

    if (folder.system) {
      message.warning('默认文件夹不可删除');
      return;
    }

    Modal.confirm({
      title: '删除文件夹',
      content: `确定要删除文件夹"${folder.name}"吗？该文件夹下的所有便签将移动到默认文件夹。`,
      okText: '删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      async onOk() {
        try {
          await deleteFolder(id); // 使用 Store Action，会自动重新加载 folders
          // 删除成功不再弹窗提醒
        } catch (error) {
          console.error('Failed to delete folder:', error);
          message.error('删除文件夹失败');
          throw error; // 让 Modal 维持 loading 状态直至结束
        }
      },
    });
  };

  // 开始重命名
  const startRename = (folder: Folder) => {
    if (folder.system) {
      message.warning('默认文件夹不可重命名');
      return;
    }
    setEditingId(folder.id);
    setEditName(folder.name);
  };

  const cancelRename = () => {
    setEditingId(null);
    setEditName('');
  };

  const submitRename = async () => {
    const id = editingId;
    const name = editName.trim();
    if (!id) return;
    if (!name) {
      message.warning('请输入文件夹名称');
      return;
    }
    if (folders.some((f) => f.id !== id && f.name === name)) {
      message.error('文件夹名称已存在');
      return;
    }
    try {
      setRenaming(true);
      await renameFolder(id, name); // 使用 Store Action，会自动重新加载 folders
      // 重命名成功不再弹窗提醒
      cancelRename();
    } catch (error) {
      console.error('Failed to rename folder:', error);
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('already exists')) {
        message.error('文件夹名称已存在');
      } else {
        message.error('重命名失败');
      }
    } finally {
      setRenaming(false);
    }
  };

  // 检测滚动条是否出现
  useEffect(() => {
    const scrollableElement = scrollableListRef.current;
    if (!scrollableElement) return;

    // 使用 ResizeObserver 监控容器大小变化
    const resizeObserver = new ResizeObserver(() => {
      // 检查是否有垂直滚动条：scrollHeight > clientHeight
      const hasVerticalScroll = scrollableElement.scrollHeight > scrollableElement.clientHeight;
      setIsOverflow(hasVerticalScroll);
    });

    resizeObserver.observe(scrollableElement);

    // 同时监控 MutationObserver 捕捉内容变化
    const mutationObserver = new MutationObserver(() => {
      const hasVerticalScroll = scrollableElement.scrollHeight > scrollableElement.clientHeight;
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
        flexVerticalEqualRef.current.style.paddingRight = '0px';
      } else {
        flexVerticalEqualRef.current.style.paddingRight = '10px';
      }
    }
  }, [isOverflow]);
  return (
    <div className="layout-panel sidebar">
      <div className="flex-vertical-auto">
        <Segmented
          block
          value={workspaceView}
          onChange={(value) => setWorkspaceView(value as 'note' | 'tool')}
          options={[
            {
              label: (
                <span>
                  <AppstoreOutlined style={{ marginRight: 4 }} />
                  便签
                </span>
              ),
              value: 'note',
            },
            {
              label: (
                <span>
                  <ToolOutlined style={{ marginRight: 4 }} />
                  工坊
                </span>
              ),
              value: 'tool',
            },
          ]}
        />
        {isNoteView && (
          <Button
            type="text"
            block
            icon={<PlusOutlined />}
            onClick={openCreateFolderModal}
            style={{ justifyContent: 'flex-start' }}
          >
            添加文件夹
          </Button>
        )}
      </div>
      <div className="flex-vertical-equal" ref={flexVerticalEqualRef}>
        <div className="scrollable-list" ref={scrollableListRef}>
          <Menu
            mode="inline"
            selectedKeys={
              isNoteView
                ? selectedFolderId
                  ? [selectedFolderId]
                  : []
                : selectedToolId
                  ? [selectedToolId]
                  : []
            }
            onClick={(e) => {
              if (isNoteView) {
                setSelectedFolder(String(e.key));
              } else {
                setSelectedTool(String(e.key));
              }
            }}
            className="sidebar-menu"
            items={
              isNoteView
                ? folders.map((folder) => {
                    const editing = editingId === folder.id;

                    const moreMenuItems =
                      !folder.system && !editing
                        ? [
                            {
                              key: 'rename',
                              icon: <EditOutlined />,
                              label: '编辑',
                              onClick: () => startRename(folder),
                            },
                            {
                              key: 'delete',
                              icon: <DeleteOutlined />,
                              label: '删除',
                              danger: true,
                              onClick: () => handleDeleteFolder(folder.id),
                            },
                          ]
                        : [];

                    return {
                      key: folder.id,
                      icon: <FolderOutlined />,
                      label: (
                        <div className="menu-item-row" title={folder.name}>
                          {!editing ? (
                            <span className="item-name">{folder.name}</span>
                          ) : (
                            <Input
                              size="small"
                              value={editName}
                              autoFocus
                              disabled={renaming}
                              onChange={(e) => setEditName(e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              onPressEnter={submitRename}
                              onBlur={submitRename}
                              maxLength={30}
                            />
                          )}
                          {!folder.system && !editing && (
                            <span className="item-actions" onClick={(e) => e.stopPropagation()}>
                              <Dropdown
                                menu={{ items: moreMenuItems }}
                                placement="bottom"
                                trigger={['click']}
                              >
                                <Button type="text" size="small" icon={<MoreOutlined />} />
                              </Dropdown>
                            </span>
                          )}
                        </div>
                      ),
                    };
                  })
                : getFeaturesByWorkspaceView('tool').map((feature) => ({
                    key: feature.id,
                    icon: feature.icon,
                    label: (
                      <div className="menu-item-row" title={feature.name}>
                        <span className="item-name">{feature.name}</span>
                      </div>
                    ),
                  }))
            }
          />
        </div>
      </div>
      <div className="flex-vertical-auto">
        <Button
          type="text"
          block
          icon={<SettingOutlined />}
          onClick={() => setSettingsModalOpen(true)}
          style={{ justifyContent: 'flex-start' }}
        >
          设置
        </Button>
      </div>
      {/* 懒加载的设置面板 */}
      <Suspense fallback={null}>
        <SettingsModal open={isSettingsModalOpen} onClose={() => setSettingsModalOpen(false)} />
      </Suspense>
      {/* 新建文件夹对话框 */}
      <Modal
        title="新建文件夹"
        open={isCreateOpen}
        okText="创建"
        cancelText="取消"
        confirmLoading={creating}
        onOk={handleSubmitCreateFolder}
        onCancel={() => setIsCreateOpen(false)}
      >
        <Input
          placeholder="请输入文件夹名称"
          value={newFolderName}
          autoFocus
          onChange={(e) => setNewFolderName(e.target.value)}
          onPressEnter={handleSubmitCreateFolder}
          maxLength={30}
        />
      </Modal>
    </div>
  );
};

export default Sidebar;
