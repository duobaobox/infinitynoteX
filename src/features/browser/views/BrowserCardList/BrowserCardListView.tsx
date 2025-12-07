/**
 * BrowserCardListView - 浏览器卡片列表视图组件
 *
 * 【组件职责】
 * - 展示浏览器卡片列表
 * - 支持新建、删除、搜索卡片
 * - 作为 Browser 功能的左侧列表区
 *
 * 【数据流】
 * 1. 从 workspaceStore 获取卡片列表 (browserCards)
 * 2. 用户点击卡片 → 设置 selectedBrowserCardId → 右侧浏览器加载对应网页
 * 3. 新建/删除卡片 → 调用 store action → 刷新列表
 */

import React, { useEffect, useState } from 'react';
import { Input, Badge, Button, message, Modal, Empty, Form } from 'antd';
import { PlusOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons';
import BrowserCard, { CardListContext } from '../../../../components/BaseCard/cards/BrowserCard';
import { useWorkspaceStore } from '../../../../store/workspaceStore';
import { useScrollOverflow } from '../../../../hooks/useScrollOverflow';
import { useThemeColor } from '../../../../hooks/useThemeColor';

interface BrowserCardListViewProps {
  /** 列表容器的 flex 值，由父组件传入 */
  flex: string | number;
}

/**
 * BrowserCardListView 主组件
 */
export const BrowserCardListView: React.FC<BrowserCardListViewProps> = ({ flex }) => {
  // ============ Store 状态 ============
  const selectedBrowserCardId = useWorkspaceStore((state) => state.selectedBrowserCardId);
  const browserCards = useWorkspaceStore((state) => state.browserCards);
  const loadBrowserCards = useWorkspaceStore((state) => state.loadBrowserCards);
  const createBrowserCard = useWorkspaceStore((state) => state.createBrowserCard);
  const deleteBrowserCard = useWorkspaceStore((state) => state.deleteBrowserCard);
  const selectBrowserCard = useWorkspaceStore((state) => state.selectBrowserCard);

  // ============ Hooks ============
  const themeColor = useThemeColor();
  const { scrollableRef, containerRef } = useScrollOverflow();
  const [searchQuery, setSearchQuery] = useState('');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [form] = Form.useForm();

  // ============ 副作用 ============

  // 初始化加载浏览器卡片列表
  useEffect(() => {
    loadBrowserCards();
  }, [loadBrowserCards]);

  // ============ 事件处理 ============

  /** 创建新卡片 */
  const handleCreateCard = async () => {
    try {
      const values = await form.validateFields();
      await createBrowserCard({
        name: values.name,
        url: values.url.startsWith('http') ? values.url : `https://${values.url}`,
      });
      message.success('添加成功');
      setAddModalOpen(false);
      form.resetFields();
    } catch (error) {
      console.error('Failed to create browser card:', error);
    }
  };

  /** 删除卡片 */
  const handleDeleteCard = async (id: string, name: string) => {
    Modal.confirm({
      title: '删除网页',
      content: `确定删除"${name}"吗？`,
      okText: '删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      async onOk() {
        try {
          await deleteBrowserCard(id);
          message.success('删除成功');
        } catch (error) {
          console.error('Failed to delete browser card:', error);
          message.error('删除失败');
          throw error;
        }
      },
    });
  };

  // ============ 派生数据 ============

  // 根据搜索关键词过滤卡片列表
  const filteredCards = browserCards.filter(
    (item) =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.url.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // ============ 主渲染 ============

  return (
    <div className="layout-panel list-container" style={{ flex }}>
      {/* 头部区域：标题 + 操作按钮 */}
      <div className="flex-vertical-auto">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span className="folder-name" title="浏览器">
            浏览器
          </span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Badge count={filteredCards.length} showZero style={{ backgroundColor: themeColor }} />
            <Button
              type="text"
              size="small"
              icon={<PlusOutlined />}
              onClick={() => setAddModalOpen(true)}
              title="添加网页"
            />
          </div>
        </div>
        {/* 搜索框 */}
        <Input
          allowClear
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="搜索网页"
          prefix={<SearchOutlined style={{ color: '#bfbfbf', fontSize: 16 }} />}
          style={{ width: '100%' }}
        />
      </div>

      {/* 列表区域 */}
      <div className="flex-vertical-equal" ref={containerRef}>
        <CardListContext.Provider value={{ selectedId: selectedBrowserCardId ?? undefined }}>
          <div className="scrollable-list" ref={scrollableRef}>
            {filteredCards.length === 0 ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={searchQuery ? '没有找到匹配的网页' : '点击 + 添加网页'}
                style={{ marginTop: 40 }}
              />
            ) : (
              filteredCards.map((card) => (
                <BrowserCard
                  key={card.id}
                  id={card.id}
                  title={card.name}
                  content={card.url}
                  onClick={() => selectBrowserCard(card.id)}
                  actions={
                    !card.isBuiltIn && (
                      <Button
                        type="text"
                        size="small"
                        icon={<DeleteOutlined />}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteCard(card.id, card.name);
                        }}
                      />
                    )
                  }
                />
              ))
            )}
          </div>
        </CardListContext.Provider>
      </div>

      {/* 添加卡片弹窗 */}
      <Modal
        title="添加网页"
        open={addModalOpen}
        onOk={handleCreateCard}
        onCancel={() => {
          setAddModalOpen(false);
          form.resetFields();
        }}
        okText="添加"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="名称"
            rules={[{ required: true, message: '请输入网页名称' }]}
          >
            <Input placeholder="例如：我的网站" />
          </Form.Item>
          <Form.Item name="url" label="网址" rules={[{ required: true, message: '请输入网址' }]}>
            <Input placeholder="例如：https://example.com" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
