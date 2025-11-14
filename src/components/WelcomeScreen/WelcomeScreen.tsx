import React, { useState, useEffect } from 'react';
import { Button, message, Spin, Form, Space, Input } from 'antd';
import { FolderOpenOutlined } from '@ant-design/icons';
import './WelcomeScreen.css';

interface WelcomeScreenProps {
  onInitializationComplete: () => void;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onInitializationComplete }) => {
  const [selectedPath, setSelectedPath] = useState<string>('');
  const [defaultPath, setDefaultPath] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 获取默认路径
  useEffect(() => {
    const loadDefaultPath = async () => {
      try {
        const defaultStoragePath = await window.storage.getDefaultPath();
        setDefaultPath(defaultStoragePath);
        setSelectedPath(defaultStoragePath);
      } catch (error) {
        console.error('Failed to get default path:', error);
        message.error('获取默认路径失败');
      } finally {
        setIsLoading(false);
      }
    };

    loadDefaultPath();
  }, []);

  // 选择存储路径
  const handleSelectPath = async () => {
    try {
      const result = await window.electronAPI?.showOpenDialog({
        defaultPath: selectedPath,
        properties: ['openDirectory'],
      });

      if (result && !result.canceled && result.filePaths.length > 0) {
        setSelectedPath(result.filePaths[0]);
      }
    } catch (error) {
      console.error('Failed to select path:', error);
      message.error('选择路径失败');
    }
  };

  // 确认初始化
  const handleConfirm = async () => {
    if (!selectedPath) {
      message.warning('请选择存储路径');
      return;
    }

    try {
      setIsSubmitting(true);

      // 如果选择的路径不是默认路径，需要设置存储路径
      if (selectedPath !== defaultPath) {
        await window.storage.setStoragePath(selectedPath);
      }

      // 标记已初始化
      await window.storage.markInitialized();

      // 完成初始化
      onInitializationComplete();
    } catch (error) {
      console.error('Failed to initialize:', error);
      message.error('初始化失败，请重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="welcome-container">
        <div className="welcome-card">
          <Spin size="large" />
        </div>
      </div>
    );
  }

  return (
    <div className="welcome-container">
      <div className="welcome-card">
        <div className="welcome-header">
          <h1>欢迎使用 InfinityNoteX</h1>
          <div
            style={{
              fontSize: 18,
              lineHeight: 1.7,
              margin: '16px 0 0 0',
              color: '#555',
              textAlign: 'center',
            }}
          >
            <span style={{ fontWeight: 600 }}>让灵感与效率，自由流动</span>
            <br />
            <span style={{ fontWeight: 400 }}>记录、管理、探索。你的多功能便签空间。</span>
          </div>
        </div>

        <Form layout="vertical" style={{ flex: 1, marginBottom: 0 }}>
          <Form.Item label="存储位置" style={{ marginBottom: 12 }}>
            <Space direction="vertical" style={{ width: '100%', gap: 8 }}>
              {/* 精简说明，去掉默认路径提示 */}
              <Space.Compact style={{ width: '100%' }}>
                <Input value={selectedPath} readOnly />
                <Button
                  icon={<FolderOpenOutlined />}
                  onClick={handleSelectPath}
                  disabled={isSubmitting}
                >
                  选择位置
                </Button>
              </Space.Compact>
            </Space>
          </Form.Item>
        </Form>

        <div className="welcome-footer">
          <Button
            type="primary"
            size="large"
            onClick={handleConfirm}
            loading={isSubmitting}
            disabled={isLoading}
          >
            开始使用
          </Button>
        </div>
      </div>
    </div>
  );
};

export default WelcomeScreen;
