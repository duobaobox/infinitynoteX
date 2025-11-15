import React, { useEffect, useState } from 'react';
import { Sender, Bubble, useXAgent, useXChat } from '@ant-design/x';
import { Alert, Spin, Button, Space } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import type { XRequest } from '@ant-design/x';
import './AIWorkbench.css';

const AIWorkbench: React.FC = () => {
  const [isConfigured, setIsConfigured] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // 检查 AI 配置
  useEffect(() => {
    const checkConfig = async () => {
      try {
        const config = await window.ai.getConfig();
        setIsConfigured(!!config && !!config.apiKey && !!config.model && !!config.baseURL);
      } catch (err) {
        console.error('Failed to check AI config:', err);
        setIsConfigured(false);
      }
    };
    checkConfig();
  }, []);

  // 创建 Agent，处理模型请求
  const [agent] = useXAgent({
    request: async (info, callbacks) => {
      try {
        const { message, messages } = info;
        const { onSuccess } = callbacks;

        setError(null);
        setIsLoading(true);

        // 构建消息列表，发送给主进程
        const payload = {
          message,
          messages: messages.map((msg) => ({
            role: msg.role as 'user' | 'assistant',
            content: msg.content,
          })),
        };

        // 调用主进程的聊天接口（非流式）
        const response = await window.ai.chat(payload);

        if (!response.success || !response.content) {
          throw new Error(response.error || '未知错误');
        }

        // 调用成功回调，渲染最终消息
        onSuccess(response.content);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        setError(errorMsg);
      } finally {
        setIsLoading(false);
      }
    },
  });

  // 使用 useXChat 管理消息队列
  const { messages, onRequest } = useXChat({ agent });

  // 转换消息格式以供 Bubble.List 渲染
  const bubbleItems: XRequest.BubbleProps[] = messages.map(({ message, id }) => ({
    key: id,
    content: message,
  }));

  // 未配置时的提示
  if (!isConfigured) {
    return (
      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <Alert
          message="未配置 AI"
          description="请先在设置页面中配置 AI 模型信息（设置 > AI 管理）"
          type="warning"
          showIcon
        />
        <p style={{ color: '#666', fontSize: '14px' }}>
          支持任何 OpenAI 兼容的模型，包括：
          <br />
          • OpenAI (gpt-4o, gpt-3.5-turbo)
          <br />
          • Ollama (本地模型)
          <br />• 其他兼容服务 (自定义 baseURL)
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: '#fafafa',
      }}
    >
      {/* 顶部状态条 */}
      <div
        style={{
          padding: '12px 16px',
          backgroundColor: '#fff',
          borderBottom: '1px solid #f0f0f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span style={{ fontSize: '12px', color: '#666' }}>AI 工作台 • 支持流式对话</span>
        <Space size="small">
          <Button type="text" size="small" icon={<ReloadOutlined />} onClick={() => setError(null)}>
            清除错误
          </Button>
        </Space>
      </div>

      {/* 错误提示 */}
      {error && (
        <Alert
          message="出错"
          description={error}
          type="error"
          showIcon
          closable
          onClose={() => setError(null)}
          style={{ margin: '12px 16px 0' }}
        />
      )}

      {/* 消息列表 */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
        {isLoading ? (
          <Spin tip="等待回复中..." />
        ) : bubbleItems.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#999', paddingTop: '40px' }}>
            <p>开始对话，与 AI 互动</p>
          </div>
        ) : (
          <Bubble.List items={bubbleItems} />
        )}
      </div>

      {/* 输入框 */}
      <div
        style={{ padding: '12px 16px', backgroundColor: '#fff', borderTop: '1px solid #f0f0f0' }}
      >
        <Sender
          loading={isLoading}
          disabled={isLoading}
          onSubmit={onRequest}
          placeholder="输入问题... (Shift+Enter 换行，Enter 发送)"
        />
      </div>
    </div>
  );
};

export default AIWorkbench;
