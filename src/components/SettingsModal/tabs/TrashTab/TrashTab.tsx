/**
 * TrashTab - 回收站 Tab 组件
 *
 * 【组件职责】
 * - 显示已删除的便签列表
 * - 支持恢复和永久删除操作
 * - 支持清空回收站
 *
 * 【数据流】
 * 1. 从 storage API 加载回收站列表
 * 2. 恢复/删除操作后刷新列表
 * 3. 恢复便签时同步刷新便签列表
 */

import React, { useEffect, useState, useCallback } from 'react';
import { Button, Modal, message, Spin, Tooltip, Empty } from 'antd';
import {
  DeleteOutlined,
  UndoOutlined,
  ExclamationCircleOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import type { TrashIndex } from '../../../../services/types';
import { useWorkspaceStore } from '../../../../store/workspaceStore';
import { useSettingsStore } from '../../../../store/settingsStore';
import './TrashTab.css';

const { confirm } = Modal;

// ============ 工具函数 ============

/** 计算剩余天数 */
const getDaysRemaining = (expiresAt: number): number => {
  const now = Date.now();
  const remaining = Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24));
  return Math.max(0, remaining);
};

/** 格式化删除时间 */
const formatDeletedAt = (deletedAt: number): string => {
  const date = new Date(deletedAt);
  const now = new Date();
  const diffMs = now.getTime() - deletedAt;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return `今天 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  } else if (diffDays === 1) {
    return '昨天';
  } else if (diffDays < 7) {
    return `${diffDays} 天前`;
  } else {
    return `${date.getMonth() + 1}/${date.getDate()}`;
  }
};

// ============ 组件 ============

interface TrashTabProps {
  /** @deprecated 不再使用，保留兼容性 */
  isVisible?: boolean;
}

const TrashTab: React.FC<TrashTabProps> = () => {
  const [trashItems, setTrashItems] = useState<TrashIndex[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Store 状态
  const settingsModalOpenTrigger = useSettingsStore((state) => state.settingsModalOpenTrigger);
  const refreshListTrigger = useWorkspaceStore((state) => state.refreshListTrigger);
  const selectedFolderId = useWorkspaceStore((state) => state.selectedFolderId);
  const loadNotes = useWorkspaceStore((state) => state.loadNotes);

  // ============ 数据加载 ============

  const loadTrashItems = useCallback(async () => {
    try {
      setLoading(true);
      const items = await window.storage.listTrash();
      setTrashItems(items);
    } catch (error) {
      console.error('Failed to load trash items:', error);
      message.error('加载回收站失败');
    } finally {
      setLoading(false);
    }
  }, []);

  // 弹窗打开时刷新
  useEffect(() => {
    if (settingsModalOpenTrigger > 0) {
      loadTrashItems();
    }
  }, [settingsModalOpenTrigger, loadTrashItems]);

  // 监听便签列表刷新（删除便签时触发）
  useEffect(() => {
    if (refreshListTrigger > 0) {
      loadTrashItems();
    }
  }, [refreshListTrigger, loadTrashItems]);

  // ============ 操作处理 ============

  /** 恢复便签 */
  const handleRestore = async (item: TrashIndex) => {
    try {
      setActionLoading(item.id);
      await window.storage.restoreNote(item.id);
      message.success(`"${item.title || '无标题'}" 已恢复`);
      await loadTrashItems();
      if (selectedFolderId) {
        await loadNotes(selectedFolderId);
      }
    } catch (error) {
      console.error('Failed to restore note:', error);
      message.error('恢复失败');
    } finally {
      setActionLoading(null);
    }
  };

  /** 永久删除 */
  const handlePermanentDelete = (item: TrashIndex) => {
    confirm({
      title: '永久删除',
      icon: <ExclamationCircleOutlined />,
      content: (
        <div>
          <p>
            确定要永久删除 "<strong>{item.title || '无标题'}</strong>" 吗？
          </p>
          <p style={{ color: '#ff4d4f', marginBottom: 0 }}>此操作不可撤销！</p>
        </div>
      ),
      okText: '永久删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          setActionLoading(item.id);
          await window.storage.deleteTrashItemPermanently(item.id);
          message.success('已永久删除');
          await loadTrashItems();
        } catch (error) {
          console.error('Failed to delete permanently:', error);
          message.error('删除失败');
        } finally {
          setActionLoading(null);
        }
      },
    });
  };

  /** 清空回收站 */
  const handleEmptyTrash = () => {
    if (trashItems.length === 0) {
      message.info('回收站已经是空的');
      return;
    }

    confirm({
      title: '清空回收站',
      icon: <ExclamationCircleOutlined />,
      content: (
        <div>
          <p>
            确定要永久删除回收站中的 <strong>{trashItems.length}</strong> 个便签吗？
          </p>
          <p style={{ color: '#ff4d4f', marginBottom: 0 }}>此操作不可撤销！</p>
        </div>
      ),
      okText: '清空回收站',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          setLoading(true);
          const count = await window.storage.emptyTrash();
          message.success(`已永久删除 ${count} 个便签`);
          await loadTrashItems();
        } catch (error) {
          console.error('Failed to empty trash:', error);
          message.error('清空失败');
        } finally {
          setLoading(false);
        }
      },
    });
  };

  // ============ 渲染 ============

  return (
    <div className="settings-panel trash-tab">
      {/* 头部 */}
      <div className="trash-header">
        <div className="trash-header-left">
          <h3>回收站</h3>
          <span className="trash-count">{trashItems.length} 项</span>
        </div>
      </div>

      {/* 提示信息 + 清空按钮 */}
      <div className="trash-hint">
        <div className="trash-hint-left">
          <ClockCircleOutlined />
          <span>便签将在删除 30 天后自动永久清理</span>
        </div>
        {trashItems.length > 0 && (
          <Button
            danger
            ghost
            size="small"
            icon={<DeleteOutlined />}
            onClick={handleEmptyTrash}
            disabled={loading}
          >
            清空
          </Button>
        )}
      </div>

      {/* 列表区 */}
      <Spin spinning={loading}>
        {trashItems.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="回收站是空的"
            className="trash-empty"
          />
        ) : (
          <div className="trash-list">
            {trashItems.map((item) => {
              const daysRemaining = getDaysRemaining(item.expiresAt);
              const isExpiringSoon = daysRemaining <= 7;

              return (
                <div key={item.id} className="trash-item">
                  {/* 左侧图标 */}
                  <div className="trash-item-icon">
                    <FileTextOutlined />
                  </div>

                  {/* 中间内容 */}
                  <div className="trash-item-content">
                    <div className="trash-item-title">{item.title || '无标题'}</div>
                    <div className="trash-item-meta">
                      <span>{formatDeletedAt(item.deletedAt)}</span>
                      <span className="meta-separator">·</span>
                      <Tooltip title={`${new Date(item.expiresAt).toLocaleDateString()} 自动删除`}>
                        <span className={isExpiringSoon ? 'expiring-soon' : ''}>
                          {daysRemaining} 天后过期
                        </span>
                      </Tooltip>
                    </div>
                    {item.excerpt && <div className="trash-item-excerpt">{item.excerpt}</div>}
                  </div>

                  {/* 右侧操作 */}
                  <div className="trash-item-actions">
                    <Tooltip title="恢复">
                      <Button
                        type="text"
                        size="small"
                        icon={<UndoOutlined />}
                        onClick={() => handleRestore(item)}
                        loading={actionLoading === item.id}
                      />
                    </Tooltip>
                    <Tooltip title="永久删除">
                      <Button
                        type="text"
                        danger
                        size="small"
                        icon={<DeleteOutlined />}
                        onClick={() => handlePermanentDelete(item)}
                        loading={actionLoading === item.id}
                      />
                    </Tooltip>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Spin>
    </div>
  );
};

export default TrashTab;
