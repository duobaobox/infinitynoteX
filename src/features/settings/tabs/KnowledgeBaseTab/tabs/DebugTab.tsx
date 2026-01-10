/**
 * DebugTab - 调试与维护 Tab（专家功能）
 * 包含三个子面板：搜索测试、系统诊断、配置调优
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Table,
  Input,
  Button,
  Typography,
  Space,
  Tag,
  message,
  Spin,
  Empty,
  Drawer,
  Tabs,
  Tooltip,
} from 'antd';
import {
  SearchOutlined,
  DatabaseOutlined,
  FileTextOutlined,
  SyncOutlined,
  DeleteOutlined,
  ReloadOutlined,
  ToolOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import SystemDiagnosticsPanel from './components/SystemDiagnosticsPanel';
import IndexingConfigPanel from './components/IndexingConfigPanel';

const { Text, Paragraph } = Typography;

interface ChunkInfo {
  id: string;
  noteId: string;
  noteTitle: string;
  chunkIndex: number;
  content: string;
  dimension: number;
  createdAt: number;
}

interface SearchResult {
  noteId: string;
  noteTitle: string;
  excerpt: string;
  score: number;
}

interface NoteIndexInfo {
  noteId: string;
  noteTitle: string;
  chunkCount: number;
  status: 'indexed' | 'pending' | 'failed';
  lastIndexedAt?: number;
}

/**
 * 搜索测试与数据浏览面板（保持原有功能）
 */
const SearchTestPanel: React.FC = () => {
  // 搜索测试状态
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);

  // 数据块列表状态
  const [chunks, setChunks] = useState<ChunkInfo[]>([]);
  const [totalChunks, setTotalChunks] = useState(0);
  const [loadingChunks, setLoadingChunks] = useState(false);
  const [page, setPage] = useState(1);
  const [selectedChunk, setSelectedChunk] = useState<ChunkInfo | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // 笔记索引列表状态
  const [noteIndexList, setNoteIndexList] = useState<NoteIndexInfo[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(false);

  // 加载数据块
  const loadChunks = useCallback(async () => {
    setLoadingChunks(true);
    try {
      const result = await window.knowledge?.getChunks({ offset: (page - 1) * 10, limit: 10 });
      if (result) {
        setChunks(result.chunks);
        setTotalChunks(result.total);
      }
    } catch (error) {
      console.error('Failed to load chunks:', error);
    } finally {
      setLoadingChunks(false);
    }
  }, [page]);

  // 加载笔记索引列表
  const loadNoteIndexList = useCallback(async () => {
    setLoadingNotes(true);
    try {
      const list = await window.knowledge?.getNoteIndexList();
      if (list) setNoteIndexList(list);
    } catch (error) {
      console.error('Failed to load note index list:', error);
    } finally {
      setLoadingNotes(false);
    }
  }, []);

  useEffect(() => {
    loadChunks();
    loadNoteIndexList();
  }, [loadChunks, loadNoteIndexList]);

  // 语义搜索
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      message.warning('请输入搜索内容');
      return;
    }
    setSearching(true);
    setSearchResults([]);
    try {
      const results = await window.knowledge?.testSearch(searchQuery, { topK: 5 });
      if (results) {
        setSearchResults(results);
        if (results.length === 0) message.info('未找到结果');
      }
    } catch {
      message.error('搜索失败');
    } finally {
      setSearching(false);
    }
  }, [searchQuery]);

  // 重建单笔记索引
  const handleReindexNote = useCallback(
    async (noteId: string) => {
      try {
        const result = await window.knowledge?.reindexNote(noteId);
        if (result?.success) {
          message.success('重建完成');
          loadNoteIndexList();
          loadChunks();
        } else {
          message.error(result?.error || '失败');
        }
      } catch {
        message.error('重建失败');
      }
    },
    [loadNoteIndexList, loadChunks],
  );

  // 删除笔记索引
  const handleDeleteNoteIndex = useCallback(
    async (noteId: string) => {
      try {
        await window.knowledge?.deleteNoteIndex(noteId);
        message.success('已删除');
        loadNoteIndexList();
        loadChunks();
      } catch {
        message.error('删除失败');
      }
    },
    [loadNoteIndexList, loadChunks],
  );

  // 数据块表格列
  const chunkColumns: ColumnsType<ChunkInfo> = [
    {
      title: '便签',
      dataIndex: 'noteTitle',
      key: 'noteTitle',
      width: 120,
      ellipsis: true,
      render: (title: string) => <Text ellipsis={{ tooltip: title }}>{title || '无标题'}</Text>,
    },
    {
      title: '#',
      dataIndex: 'chunkIndex',
      key: 'chunkIndex',
      width: 45,
      align: 'center',
    },
    {
      title: '内容预览',
      dataIndex: 'content',
      key: 'content',
      ellipsis: true,
      render: (content: string) => (
        <Tooltip title={content.slice(0, 200)} placement="topLeft">
          <Text ellipsis>{content}</Text>
        </Tooltip>
      ),
    },
    {
      title: '',
      key: 'action',
      width: 50,
      render: (_, record) => (
        <Button
          type="link"
          size="small"
          onClick={() => {
            setSelectedChunk(record);
            setDrawerOpen(true);
          }}
        >
          详情
        </Button>
      ),
    },
  ];

  // 便签索引表格列
  const noteColumns: ColumnsType<NoteIndexInfo> = [
    {
      title: '便签',
      dataIndex: 'noteTitle',
      key: 'noteTitle',
      ellipsis: true,
      render: (title: string) => <Text ellipsis={{ tooltip: title }}>{title || '无标题'}</Text>,
    },
    {
      title: '分块',
      dataIndex: 'chunkCount',
      key: 'chunkCount',
      width: 60,
      align: 'center',
      render: (count: number) => <Tag color="blue">{count}</Tag>,
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_, record) => (
        <Space size={0}>
          <Button
            type="link"
            size="small"
            icon={<SyncOutlined />}
            onClick={() => handleReindexNote(record.noteId)}
          />
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDeleteNoteIndex(record.noteId)}
          />
        </Space>
      ),
    },
  ];

  // 内部Tab项（数据浏览）
  const dataTabItems = [
    {
      key: 'chunks',
      label: (
        <Space>
          <DatabaseOutlined />
          数据块
          <Tag>{totalChunks}</Tag>
        </Space>
      ),
      children: (
        <div>
          {loadingChunks ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <Spin />
            </div>
          ) : chunks.length === 0 ? (
            <Empty description="暂无数据" />
          ) : (
            <Table
              columns={chunkColumns}
              dataSource={chunks}
              rowKey="id"
              size="small"
              pagination={{
                current: page,
                pageSize: 10,
                total: totalChunks,
                onChange: setPage,
                size: 'small',
                showSizeChanger: false,
              }}
            />
          )}
        </div>
      ),
    },
    {
      key: 'notes',
      label: (
        <Space>
          <FileTextOutlined />
          便签索引
          <Tag>{noteIndexList.length}</Tag>
        </Space>
      ),
      children: (
        <div>
          {loadingNotes ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <Spin />
            </div>
          ) : noteIndexList.length === 0 ? (
            <Empty description="暂无索引" />
          ) : (
            <Table
              columns={noteColumns}
              dataSource={noteIndexList}
              rowKey="noteId"
              size="small"
              pagination={{ pageSize: 10, size: 'small', showSizeChanger: false }}
            />
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      {/* 语义搜索测试 */}
      <Card title="语义搜索测试" size="small" style={{ marginBottom: 16 }}>
        <Space.Compact style={{ width: '100%', marginBottom: searchResults.length > 0 ? 12 : 0 }}>
          <Input
            placeholder="输入查询内容测试..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onPressEnter={handleSearch}
            prefix={<SearchOutlined />}
          />
          <Button type="primary" onClick={handleSearch} loading={searching}>
            搜索
          </Button>
        </Space.Compact>

        {searchResults.length > 0 && (
          <div style={{ maxHeight: 200, overflow: 'auto' }}>
            {searchResults.map((r, i) => (
              <div
                key={`${r.noteId}-${i}`}
                style={{
                  padding: '8px 12px',
                  background: '#fafafa',
                  borderRadius: 6,
                  marginBottom: 8,
                }}
              >
                <Space style={{ marginBottom: 4 }}>
                  <Text strong>{r.noteTitle || '无标题'}</Text>
                  <Tag color={r.score > 0.8 ? 'green' : r.score > 0.6 ? 'orange' : 'default'}>
                    {(r.score * 100).toFixed(0)}%
                  </Tag>
                </Space>
                <Paragraph
                  type="secondary"
                  ellipsis={{ rows: 2 }}
                  style={{ marginBottom: 0, fontSize: 12 }}
                >
                  {r.excerpt}
                </Paragraph>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* 数据浏览 */}
      <Card
        size="small"
        title="数据浏览"
        extra={
          <Button
            size="small"
            icon={<ReloadOutlined />}
            onClick={() => {
              loadChunks();
              loadNoteIndexList();
            }}
          >
            刷新
          </Button>
        }
      >
        <Tabs items={dataTabItems} size="small" />
      </Card>

      {/* 数据块详情抽屉 */}
      <Drawer title="数据块详情" open={drawerOpen} onClose={() => setDrawerOpen(false)} width={420}>
        {selectedChunk && (
          <Space direction="vertical" style={{ width: '100%' }}>
            <div>
              <Text type="secondary">ID</Text>
              <br />
              <Text code copyable style={{ fontSize: 12 }}>
                {selectedChunk.id}
              </Text>
            </div>
            <div>
              <Text type="secondary">便签</Text>
              <br />
              <Text strong>{selectedChunk.noteTitle || '无标题'}</Text>
            </div>
            <div>
              <Space>
                <Tag color="blue">第 {selectedChunk.chunkIndex} 块</Tag>
                <Tag>{selectedChunk.dimension} 维</Tag>
              </Space>
            </div>
            <div>
              <Text type="secondary">内容</Text>
              <Paragraph
                style={{
                  background: '#f5f5f5',
                  padding: 12,
                  borderRadius: 6,
                  marginTop: 8,
                  whiteSpace: 'pre-wrap',
                  fontSize: 13,
                }}
              >
                {selectedChunk.content}
              </Paragraph>
            </div>
          </Space>
        )}
      </Drawer>
    </>
  );
};

/**
 * DebugTab 主组件 - 包含三个子 Tab
 */
const DebugTab: React.FC = () => {
  const mainTabItems = [
    {
      key: 'search',
      label: (
        <Space>
          <SearchOutlined />
          搜索测试
        </Space>
      ),
      children: <SearchTestPanel />,
    },
    {
      key: 'diagnostics',
      label: (
        <Space>
          <ToolOutlined />
          系统诊断
        </Space>
      ),
      children: <SystemDiagnosticsPanel />,
    },
    {
      key: 'config',
      label: (
        <Space>
          <SettingOutlined />
          配置调优
        </Space>
      ),
      children: <IndexingConfigPanel />,
    },
  ];

  return (
    <div className="kb-tab-content">
      <Tabs items={mainTabItems} size="small" />
    </div>
  );
};

export default DebugTab;
