import React, { useEffect, useState, useCallback } from 'react';
import { Sender, Bubble, useXAgent, useXChat } from '@ant-design/x';
import { Alert, Button, Space, Spin, Tooltip, Divider } from 'antd';
import { ReloadOutlined, DeleteOutlined, SettingOutlined } from '@ant-design/icons';
import './AIWorkbench.css';

interface AIConfig {
  provider?: string;
  model?: string;
  baseURL?: string;
}

const AIWorkbench: React.FC = () => {
  const [isConfigured, setIsConfigured] = useState<boolean>(false);
  const [config, setConfig] = useState<AIConfig | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  // 检查 AI 配置
  useEffect(() => {
    const checkConfig = async () => {
      try {
        const aiConfig = await window.ai.getConfig();
        setConfig(aiConfig);
        setIsConfigured(!!aiConfig && !!aiConfig.apiKey && !!aiConfig.model && !!aiConfig.baseURL);
      } catch (err) {
        console.error('Failed to check AI config:', err);
        setIsConfigured(false);
      } finally {
        setIsInitializing(false);
      }
    };
    checkConfig();
  }, []);

  // 创建 Agent
  const [agent] = useXAgent({
    request: useCallback(async (info: any, callbacks: any) => {
      try {
        const { message, messages } = info as {
          message: string;
          messages: Array<{ role: string; content: string }>;
        };
        const { onSuccess } = callbacks as { onSuccess: (content: string) => void };

        setError(null);
        setIsLoading(true);

        // 构建消息列表
        const payload = {
          message,
          messages: messages.map((msg) => ({
            role: msg.role as 'user' | 'assistant',
            content: msg.content,
          })),
        };

        // 调用主进程的聊天接口
        const response = await window.ai.chat(payload);

        if (!response.success || !response.content) {
          throw new Error(response.error || '未知错误');
        }

        onSuccess(response.content);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        setError(errorMsg);
      } finally {
        setIsLoading(false);
      }
    }, []),
  });

  // 使用 useXChat 管理消息
  const { messages, onRequest, setMessages } = useXChat({ agent });

  // 转换消息格式供 Bubble.List 渲染
  const bubbleItems = messages.map(({ message, id }) => ({
    key: id,
    content: message,
  }));

  if (isInitializing) {
    return (
      <div
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}
      >
        <Spin tip="初始化中..." />
      </div>
    );
  }

  // 未配置时的提示
  if (!isConfigured) {
    return (
      <div
        style={{
          padding: '32px 20px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          gap: '16px',
        }}
      >
        <Alert
          message="未配置 AI 模型"
          description="请先在设置页面中配置 AI 模型信息（设置 > AI 管理）以开始对话"
          type="warning"
          showIcon
          style={{ maxWidth: '500px' }}
        />
        <div style={{ color: '#666', fontSize: '13px', maxWidth: '500px', textAlign: 'center' }}>
          <p style={{ marginBottom: '8px' }}>支持以下模型：</p>
          <ul style={{ textAlign: 'left', display: 'inline-block' }}>
            <li>OpenAI: gpt-4o, gpt-3.5-turbo</li>
            <li>本地 Ollama: mistral, llama2 等</li>
            <li>其他 OpenAI 兼容服务</li>
          </ul>
        </div>
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
      {/* 顶部状态栏 */}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '13px', fontWeight: 500 }}>AI 助手</span>
          <span style={{ fontSize: '12px', color: '#999' }}>
            {config?.provider && config?.model ? `${config.provider} • ${config.model}` : '未配置'}
          </span>
        </div>

        <Space size="small">
          <Tooltip title="清除错误">
            <Button
              type="text"
              size="small"
              icon={<ReloadOutlined />}
              onClick={() => setError(null)}
              disabled={!error}
            />
          </Tooltip>
          <Tooltip title="清空对话">
            <Button
              type="text"
              size="small"
              icon={<DeleteOutlined />}
              onClick={() => {
                setMessages([]);
                setError(null);
              }}
              disabled={messages.length === 0}
            />
          </Tooltip>
          <Divider type="vertical" style={{ margin: '0' }} />
          <Tooltip title="打开设置">
            <Button
              type="text"
              size="small"
              icon={<SettingOutlined />}
              onClick={() => {
                // TODO: 触发打开设置页面的事件
              }}
            />
          </Tooltip>
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
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: bubbleItems.length === 0 ? 'center' : 'flex-start',
        }}
      >
        {isLoading && messages.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#999' }}>
            <Spin tip="等待回复中..." />
          </div>
        ) : bubbleItems.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#bbb' }}>
            <p style={{ fontSize: '14px' }}>开始对话，与 AI 互动</p>
            <p style={{ fontSize: '12px', color: '#999' }}>输入你的问题，AI 将为你答疑解惑</p>
          </div>
        ) : (
          <Bubble.List
            items={bubbleItems}
            style={{
              flex: 1,
            }}
          />
        )}
      </div>

      {/* 输入框 */}
      <div
        style={{
          padding: '12px 16px',
          backgroundColor: '#fff',
          borderTop: '1px solid #f0f0f0',
        }}
      >
        <Sender
          loading={isLoading}
          disabled={isLoading || !isConfigured}
          onSubmit={onRequest}
          placeholder="输入问题...（Shift+Enter 换行，Enter 发送）"
          style={{
            borderRadius: '6px',
          }}
        />
      </div>
    </div>
  );
};

export default AIWorkbench;
