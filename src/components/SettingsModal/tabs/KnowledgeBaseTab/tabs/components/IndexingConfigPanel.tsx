/**
 * IndexingConfigPanel - 索引配置面板
 * 允许用户调整分块参数、批处理参数和速率限制配置
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Form,
  InputNumber,
  Button,
  Typography,
  Space,
  message,
  Spin,
  Tooltip,
  Divider,
  Row,
  Col,
} from 'antd';
import {
  SettingOutlined,
  QuestionCircleOutlined,
  UndoOutlined,
  SaveOutlined,
  ThunderboltOutlined,
  ClockCircleOutlined,
  ApiOutlined,
} from '@ant-design/icons';

const { Text, Title } = Typography;

interface IndexingConfig {
  chunkSize: number;
  chunkOverlap: number;
  batchSize: number;
  batchDelayMs: number;
  rateLimitRetryMs: number;
}

const IndexingConfigPanel: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [defaultConfig, setDefaultConfig] = useState<IndexingConfig | null>(null);
  const [form] = Form.useForm();

  // 加载配置
  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const [current, defaults] = await Promise.all([
        window.knowledge?.getIndexingConfig(),
        window.knowledge?.getDefaultIndexingConfig(),
      ]);
      if (current) {
        form.setFieldsValue(current);
      }
      if (defaults) {
        setDefaultConfig(defaults);
      }
    } catch (error) {
      console.error('Failed to load config:', error);
      message.error('加载配置失败');
    } finally {
      setLoading(false);
    }
  }, [form]);

  // 初次加载
  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // 保存配置
  const handleSave = useCallback(async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const result = await window.knowledge?.setIndexingConfig(values);
      if (result?.success) {
        message.success('配置已保存，下次索引时生效');
      } else {
        message.error('保存失败');
      }
    } catch {
      message.error('请检查输入');
    } finally {
      setSaving(false);
    }
  }, [form]);

  // 恢复默认
  const handleReset = useCallback(async () => {
    try {
      const result = await window.knowledge?.resetIndexingConfig();
      if (result?.success) {
        const defaults = await window.knowledge?.getIndexingConfig();
        if (defaults) {
          form.setFieldsValue(defaults);
        }
        message.success('已恢复默认配置');
      }
    } catch {
      message.error('恢复失败');
    }
  }, [form]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 40 }}>
        <Spin tip="加载配置..." />
      </div>
    );
  }

  return (
    <div className="indexing-config-panel">
      <div style={{ marginBottom: 16 }}>
        <Title level={5} style={{ margin: 0 }}>
          <SettingOutlined style={{ marginRight: 8 }} />
          索引配置调优
        </Title>
        <Text type="secondary" style={{ fontSize: 12 }}>
          调整以下参数以优化索引性能和搜索精度。修改后需重新建立索引才能生效。
        </Text>
      </div>

      <Form form={form} layout="vertical">
        {/* 分块参数 */}
        <Card size="small" style={{ marginBottom: 12 }}>
          <div className="config-section-header">
            <Space>
              <ThunderboltOutlined style={{ color: '#1890ff' }} />
              <Text strong>分块参数</Text>
            </Space>
            <Tooltip title="分块策略决定如何将笔记内容切分为多个片段进行向量化。较小的块可提高搜索精度，但会增加向量数量。">
              <QuestionCircleOutlined style={{ color: '#bfbfbf' }} />
            </Tooltip>
          </div>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="chunkSize"
                label={
                  <Space>
                    分块大小（字符）
                    <Tooltip title="每个文本块的最大字符数。推荐 300-800。值越小搜索越精确，但向量数量会增加。">
                      <QuestionCircleOutlined style={{ color: '#bfbfbf', fontSize: 12 }} />
                    </Tooltip>
                  </Space>
                }
                rules={[{ required: true }]}
              >
                <InputNumber min={100} max={2000} step={50} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="chunkOverlap"
                label={
                  <Space>
                    重叠大小（字符）
                    <Tooltip title="相邻块之间的重叠字符数。有助于保持上下文连贯性。通常为分块大小的 10%-20%。">
                      <QuestionCircleOutlined style={{ color: '#bfbfbf', fontSize: 12 }} />
                    </Tooltip>
                  </Space>
                }
                rules={[{ required: true }]}
              >
                <InputNumber min={0} max={500} step={10} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* 批处理参数 */}
        <Card size="small" style={{ marginBottom: 12 }}>
          <div className="config-section-header">
            <Space>
              <ClockCircleOutlined style={{ color: '#52c41a' }} />
              <Text strong>批处理参数</Text>
            </Space>
            <Tooltip title="批处理策略控制如何调用 Embedding API。较大的批次可提高效率，但可能触发速率限制。">
              <QuestionCircleOutlined style={{ color: '#bfbfbf' }} />
            </Tooltip>
          </div>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="batchSize"
                label={
                  <Space>
                    批次大小
                    <Tooltip title="每次 API 调用处理的文本块数量。较大值可减少 API 调用次数。">
                      <QuestionCircleOutlined style={{ color: '#bfbfbf', fontSize: 12 }} />
                    </Tooltip>
                  </Space>
                }
                rules={[{ required: true }]}
              >
                <InputNumber min={1} max={20} step={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="batchDelayMs"
                label={
                  <Space>
                    批次延迟（ms）
                    <Tooltip title="每批处理之间的等待时间。用于避免触发 API 速率限制。">
                      <QuestionCircleOutlined style={{ color: '#bfbfbf', fontSize: 12 }} />
                    </Tooltip>
                  </Space>
                }
                rules={[{ required: true }]}
              >
                <InputNumber min={100} max={10000} step={100} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* 速率限制 */}
        <Card size="small" style={{ marginBottom: 16 }}>
          <div className="config-section-header">
            <Space>
              <ApiOutlined style={{ color: '#722ed1' }} />
              <Text strong>速率限制</Text>
            </Space>
            <Tooltip title="当遇到 API 速率限制（429 错误）时的处理策略。">
              <QuestionCircleOutlined style={{ color: '#bfbfbf' }} />
            </Tooltip>
          </div>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="rateLimitRetryMs"
                label={
                  <Space>
                    重试延迟（ms）
                    <Tooltip title="遇到速率限制时的等待时间。如果经常触发限制，可以增加此值。">
                      <QuestionCircleOutlined style={{ color: '#bfbfbf', fontSize: 12 }} />
                    </Tooltip>
                  </Space>
                }
                rules={[{ required: true }]}
              >
                <InputNumber min={1000} max={60000} step={1000} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <div style={{ paddingTop: 28 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {defaultConfig && <>默认值: {defaultConfig.rateLimitRetryMs}ms</>}
                </Text>
              </div>
            </Col>
          </Row>
        </Card>

        <Divider style={{ margin: '12px 0' }} />

        {/* 操作按钮 */}
        <Space>
          <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} loading={saving}>
            保存配置
          </Button>
          <Button icon={<UndoOutlined />} onClick={handleReset}>
            恢复默认
          </Button>
        </Space>
      </Form>
    </div>
  );
};

export default IndexingConfigPanel;
