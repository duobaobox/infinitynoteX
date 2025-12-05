/**
 * TrashTab - 回收站 Tab 组件
 * 显示已删除的便签，支持恢复和永久删除
 */

import React, { useEffect, useState, useCallback } from 'react';
import { Button, Space, Typography, Divider, Modal, message, Spin, Tooltip } from 'antd';
import {
  DeleteOutlined,
  RedoOutlined,
  ExclamationCircleOutlined,
  RestOutlined,
} from '@ant-design/icons';
import type { TrashIndex } from '../../../../services/types';
import { useWorkspaceStore } from '../../../../store/workspaceStore';
import { useSettingsStore } from '../../../../store/settingsStore';
import './TrashTab.css';

const { Text, Paragraph } = Typography;
const { confirm } = Modal;

// 计算剩余天数
const getDaysRemaining = (expiresAt: number): number => {
  const now = Date.now();
  const remaining = Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24));
  return Math.max(0, remaining);
};

// 格式化删除时间
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

interface TrashTabProps {
  /** @deprecated 不再使用，保留兼容性 */
  isVisible?: boolean;
}

const TrashTab: React.FC<TrashTabProps> = () => {
  const [trashItems, setTrashItems] = useState<TrashIndex[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // 从 settingsStore 获取弹窗打开触发器
  const settingsModalOpenTrigger = useSettingsStore((state) => state.settingsModalOpenTrigger);

  // 从 workspaceStore 获取便签列表刷新触发器
  const refreshListTrigger = useWorkspaceStore((state) => state.refreshListTrigger);
  const selectedFolderId = useWorkspaceStore((state) => state.selectedFolderId);
  const loadNotes = useWorkspaceStore((state) => state.loadNotes);

  // 加载回收站列表
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

  // 弹窗打开时刷新数据（监听 settingsStore 的触发器）
  useEffect(() => {
    if (settingsModalOpenTrigger > 0) {
      loadTrashItems();
    }
  }, [settingsModalOpenTrigger, loadTrashItems]);

  // 监听便签列表刷新（删除便签时会触发）
  useEffect(() => {
    if (refreshListTrigger > 0) {
      loadTrashItems();
    }
  }, [refreshListTrigger, loadTrashItems]);

  // 恢复便签
  const handleRestore = async (item: TrashIndex) => {
    try {
      setActionLoading(item.id);
      await window.storage.restoreNote(item.id);
      message.success(`"${item.title || '无标题'}" 已恢复`);
      await loadTrashItems();
      // 刷新便签列表（恢复的便签会出现在列表中）
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

  // 永久删除
  const handlePermanentDelete = (item: TrashIndex) => {
    confirm({
      title: '永久删除',
      icon: <ExclamationCircleOutlined />,
      content: (
        <div>
          <p>
            确定要永久删除 "<strong>{item.title || '无标题'}</strong>" 吗？
          </p>
          <p style={{ color: '#ff4d4f' }}>此操作不可撤销！</p>
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

  // 清空回收站
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
          <p style={{ color: '#ff4d4f' }}>此操作不可撤销！</p>
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

  return (
    <div className="settings-panel trash-tab">
      <div className="trash-header">
        <h3>回收站</h3>
        <Button danger icon={<DeleteOutlined />} onClick={handleEmptyTrash} disabled={loading}>
          清空回收站
        </Button>
      </div>

      <div className="trash-stats">
        <div className="trash-stat-item">
          <span className="stat-label">已删除便签</span>
          <span className="stat-value">{trashItems.length}</span>
        </div>
        <div className="trash-stat-item">
          <span className="stat-label">自动清理</span>
          <span className="stat-value">30 天</span>
        </div>
      </div>

      <Paragraph type="secondary" style={{ marginBottom: 16 }}>
        删除的便签会在回收站保留 30 天，之后将自动永久删除。您可以随时恢复或永久删除它们。
      </Paragraph>

      <Divider />

      <Spin spinning={loading}>
        {trashItems.length === 0 ? (
          <div className="empty-state">
            <RestOutlined />
            <Text type="secondary">回收站是空的</Text>
          </div>
        ) : (
          <div className="trash-list">
            {trashItems.map((item) => (
              <div key={item.id} className="trash-item">
                <div className="trash-item-info">
                  <div className="trash-item-title">{item.title || '无标题'}</div>
                  <div className="trash-item-meta">
                    <span>删除于 {formatDeletedAt(item.deletedAt)}</span>
                    <Tooltip title={`${new Date(item.expiresAt).toLocaleDateString()} 自动删除`}>
                      <span
                        style={{
                          color: getDaysRemaining(item.expiresAt) <= 7 ? '#ff4d4f' : undefined,
                        }}
                      >
                        {getDaysRemaining(item.expiresAt)} 天后过期
                      </span>
                    </Tooltip>
                  </div>
                  {item.excerpt && <div className="trash-item-excerpt">{item.excerpt}</div>}
                </div>
                <div className="trash-item-actions">
                  <Space>
                    <Button
                      type="primary"
                      size="small"
                      icon={<RedoOutlined />}
                      onClick={() => handleRestore(item)}
                      loading={actionLoading === item.id}
                    >
                      恢复
                    </Button>
                    <Button
                      danger
                      size="small"
                      icon={<DeleteOutlined />}
                      onClick={() => handlePermanentDelete(item)}
                      loading={actionLoading === item.id}
                    >
                      删除
                    </Button>
                  </Space>
                </div>
              </div>
            ))}
          </div>
        )}
      </Spin>
    </div>
  );
};

export default TrashTab;
