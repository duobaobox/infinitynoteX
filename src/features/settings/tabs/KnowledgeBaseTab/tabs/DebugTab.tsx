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
  Modal,
  Tabs,
  Tooltip,
} from 'antd';
import {
  SearchOutlined,
  FileTextOutlined,
  SyncOutlined,
  DeleteOutlined,
  ReloadOutlined,
  ToolOutlined,
  SettingOutlined,
  EyeOutlined,
  CopyOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import SystemDiagnosticsPanel from './components/SystemDiagnosticsPanel';
import IndexingConfigPanel from './components/IndexingConfigPanel';

const { Text, Paragraph } = Typography;
import { useSettingsStore } from '../../../../../store/settingsStore';

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

  // 笔记索引列表状态
  const [noteIndexList, setNoteIndexList] = useState<NoteIndexInfo[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(false);

  // 便签 Chunks 查看抽屉状态
  const [noteChunksDrawerOpen, setNoteChunksDrawerOpen] = useState(false);
  const [selectedNoteForChunks, setSelectedNoteForChunks] = useState<NoteIndexInfo | null>(null);
  const [noteChunks, setNoteChunks] = useState<ChunkInfo[]>([]);
  const [loadingNoteChunks, setLoadingNoteChunks] = useState(false);
  const { reindexingNoteId, setReindexingNoteId } = useSettingsStore();

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

  // 加载某便签的所有 Chunks
  const loadNoteChunks = useCallback(async (noteId: string) => {
    setLoadingNoteChunks(true);
    try {
      const result = await window.knowledge?.getChunks({ noteId });
      if (result) {
        setNoteChunks(result.chunks);
      }
    } catch (error) {
      console.error('Failed to load note chunks:', error);
    } finally {
      setLoadingNoteChunks(false);
    }
  }, []);

  // 打开便签 Chunks 抽屉
  const handleViewNoteChunks = useCallback(
    (note: NoteIndexInfo) => {
      setSelectedNoteForChunks(note);
      setNoteChunksDrawerOpen(true);
      loadNoteChunks(note.noteId);
    },
    [loadNoteChunks],
  );

  useEffect(() => {
    loadNoteIndexList();
  }, [loadNoteIndexList]);

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
      setReindexingNoteId(noteId);
      try {
        const result = await window.knowledge?.reindexNote(noteId);
        if (result?.success) {
          message.success('重建完成');
          loadNoteIndexList();
        } else {
          message.error(result?.error || '失败');
        }
      } catch {
        message.error('重建失败');
      } finally {
        setReindexingNoteId(null);
      }
    },
    [loadNoteIndexList, setReindexingNoteId],
  );

  // 删除笔记索引
  const handleDeleteNoteIndex = useCallback(
    async (noteId: string) => {
      try {
        await window.knowledge?.deleteNoteIndex(noteId);
        message.success('已删除');
        loadNoteIndexList();
      } catch {
        message.error('删除失败');
      }
    },
    [loadNoteIndexList],
  );

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
      width: 120,
      render: (_, record) => (
        <Space size={0}>
          <Tooltip title="查看 Chunks">
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handleViewNoteChunks(record)}
            />
          </Tooltip>
          <Tooltip title="重建索引">
            <Button
              type="link"
              size="small"
              icon={<SyncOutlined spin={reindexingNoteId === record.noteId} />}
              onClick={() => handleReindexNote(record.noteId)}
            />
          </Tooltip>
          <Tooltip title="删除索引">
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDeleteNoteIndex(record.noteId)}
            />
          </Tooltip>
        </Space>
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

      {/* 便签索引浏览 */}
      <Card
        size="small"
        title={
          <Space>
            <FileTextOutlined />
            便签索引
            <Tag>{noteIndexList.length}</Tag>
          </Space>
        }
        extra={
          <Button size="small" icon={<ReloadOutlined />} onClick={() => loadNoteIndexList()}>
            刷新
          </Button>
        }
      >
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
      </Card>

      {/* 便签 Chunks 查看弹窗 */}
      <Modal
        title={
          <Space>
            <FileTextOutlined style={{ color: '#1677ff' }} />
            <span>{selectedNoteForChunks?.noteTitle || '便签'}</span>
            <Tag color="blue">{noteChunks.length} Chunks</Tag>
          </Space>
        }
        open={noteChunksDrawerOpen}
        centered
        width={680}
        onCancel={() => {
          setNoteChunksDrawerOpen(false);
          setSelectedNoteForChunks(null);
          setNoteChunks([]);
        }}
        footer={
          <Space>
            <Button
              icon={<CopyOutlined />}
              onClick={() => {
                if (noteChunks.length === 0) return;
                const allContent = noteChunks
                  .map((c) => `--- Chunk ${c.chunkIndex} ---\n${c.content}`)
                  .join('\n\n');
                navigator.clipboard.writeText(allContent);
                message.success('已复制所有 Chunks');
              }}
            >
              复制全部
            </Button>
            <Button
              type="primary"
              onClick={() => {
                setNoteChunksDrawerOpen(false);
                setSelectedNoteForChunks(null);
                setNoteChunks([]);
              }}
            >
              关闭
            </Button>
          </Space>
        }
      >
        {loadingNoteChunks ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin />
          </div>
        ) : noteChunks.length === 0 ? (
          <Empty description="暂无 Chunks" />
        ) : (
          <div
            className="custom-scrollbar"
            style={{
              maxHeight: '60vh',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            {noteChunks.map((chunk, idx) => {
              // 检测是否包含注入的表头
              const hasInjectedHeader =
                idx > 0 &&
                chunk.content.trim().startsWith('|') &&
                chunk.content.includes('| --- |');
              return (
                <div
                  key={chunk.id}
                  style={{
                    background: '#fafafa',
                    borderRadius: 8,
                    padding: 12,
                    border: hasInjectedHeader ? '1px solid #52c41a' : '1px solid #f0f0f0',
                  }}
                >
                  <Space
                    style={{ marginBottom: 8, width: '100%', justifyContent: 'space-between' }}
                  >
                    <Space>
                      <Tag color="blue">#{chunk.chunkIndex}</Tag>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {chunk.content.length} 字符
                      </Text>
                      {hasInjectedHeader && <Tag color="green">注入表头</Tag>}
                    </Space>
                    <Tooltip title="复制内容">
                      <Button
                        type="text"
                        size="small"
                        icon={<CopyOutlined />}
                        onClick={() => {
                          navigator.clipboard.writeText(chunk.content);
                          message.success('已复制');
                        }}
                      />
                    </Tooltip>
                  </Space>
                  <Paragraph
                    style={{
                      marginBottom: 0,
                      whiteSpace: 'pre-wrap',
                      fontSize: 12,
                      maxHeight: 200,
                      overflow: 'auto',
                    }}
                    ellipsis={{ rows: 6, expandable: true, symbol: '展开' }}
                  >
                    {chunk.content}
                  </Paragraph>
                </div>
              );
            })}
          </div>
        )}
      </Modal>
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
