/**
 * BackgroundEditor - 背景编辑器组件
 * 支持预设背景和自定义纯色/渐变背景
 */

import React, { useState, useMemo, useEffect } from 'react';
import { Tabs, ColorPicker, Space, Row, Col, Typography, Segmented, Card, Form, Input } from 'antd';
import type { Color } from 'antd/es/color-picker';
import { getThemeColor } from '../../theme/theme';
import './index.css';

const { Paragraph } = Typography;

// 预设背景集合
const PRESET_BACKGROUNDS = {
  gradients: [
    { name: '清晨蓝', value: 'linear-gradient(135deg, #e6f2ff 0%, #f0e6ff 100%)' },
    { name: '薄荷梦', value: 'linear-gradient(135deg, #e0f7f4 0%, #f0f4ff 100%)' },
    { name: '樱花淡', value: 'linear-gradient(135deg, #ffe6f0 0%, #fff0e6 100%)' },
    { name: '晨曦金', value: 'linear-gradient(135deg, #fff9e6 0%, #ffe6f0 100%)' },
    { name: '蓝山语', value: 'linear-gradient(135deg, #e6f0ff 0%, #f0e6ff 100%)' },
  ],
  solids: [
    { name: '吖灰灰', value: '#e7ecf3ff' },
    { name: '云水蓝', value: '#e6f7ff' },
    { name: '青苔绿', value: '#e8f8f2' },
    { name: '杏仁米', value: '#fdf6ec' },
    { name: '雾霭紫', value: '#f3f0fa' },
  ],
  darkGradients: [
    { name: '深夜蓝', value: 'linear-gradient(165deg, #0a0e27 0%, #1a1a2e 100%)' },
    { name: '暮色紫', value: 'linear-gradient(135deg, #0f051a 0%, #1a0f2e 100%)' },
    { name: '静谧黑', value: 'linear-gradient(135deg, #1a1a1a 0%, #0d0d0d 100%)' },
    { name: '深邃靛', value: 'linear-gradient(135deg, #0a1428 0%, #1a2a4e 100%)' },
  ],
};

interface BackgroundEditorProps {
  value: string;
  onChange: (value: string) => void;
  mode: 'light' | 'dark';
}

const BackgroundEditor: React.FC<BackgroundEditorProps> = ({ value, onChange, mode }) => {
  const [activeTab, setActiveTab] = useState<'preset' | 'custom'>('preset');
  const [customType, setCustomType] = useState<'solid' | 'gradient'>('gradient');
  const [solidColor, setSolidColor] = useState<string>('#ffffff');
  const [gradColor1, setGradColor1] = useState<string>(getThemeColor());
  const [gradColor2, setGradColor2] = useState<string>('#ffffff');
  const [gradAngle, setGradAngle] = useState<number>(135);

  // 初始化渐变为系统主题色（不自动触发 onChange，避免切换tab时重置）
  useEffect(() => {
    const themeColor = getThemeColor();
    setGradColor1(themeColor);
  }, []);

  const presets = useMemo(() => {
    if (mode === 'dark') {
      return PRESET_BACKGROUNDS.darkGradients;
    }
    return [...PRESET_BACKGROUNDS.gradients, ...PRESET_BACKGROUNDS.solids];
  }, [mode]);

  const handlePresetSelect = (bgValue: string) => {
    onChange(bgValue);
  };

  const handleSolidColorChange = (color: Color) => {
    const hex = color.toHexString();
    setSolidColor(hex);
    onChange(hex);
  };

  const handleGradientChange = () => {
    const gradient = `linear-gradient(${gradAngle}deg, ${gradColor1} 0%, ${gradColor2} 100%)`;
    onChange(gradient);
  };

  const handleAngleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let angle = parseInt(e.target.value, 10);
    if (isNaN(angle)) angle = 0;
    if (angle < 0) angle = 0;
    if (angle > 360) angle = 360;
    setGradAngle(angle);
    const gradient = `linear-gradient(${angle}deg, ${gradColor1} 0%, ${gradColor2} 100%)`;
    onChange(gradient);
  };

  return (
    <div className="background-editor">
      <Tabs
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key as 'preset' | 'custom')}
        items={[
          {
            key: 'preset',
            label: '预设背景',
            children: (
              <div className="preset-section">
                <Paragraph type="secondary" style={{ marginBottom: 24 }}>
                  选择一个精美的预设背景
                </Paragraph>
                <Row gutter={[16, 16]}>
                  {presets.map((preset, idx) => (
                    <Col key={idx} xs={12} sm={8} md={6} lg={4} xl={4}>
                      <Card
                        className={`preset-card ${value === preset.value ? 'preset-card-active' : ''}`}
                        hoverable
                        onClick={() => handlePresetSelect(preset.value)}
                        styles={{ body: { padding: 0 } }}
                        style={{ cursor: 'pointer', height: '100%' }}
                      >
                        <div className="preset-preview" style={{ background: preset.value }} />
                        <div className="preset-name">{preset.name}</div>
                      </Card>
                    </Col>
                  ))}
                </Row>
              </div>
            ),
          },
          {
            key: 'custom',
            label: '自定义',
            children: (
              <div className="custom-section">
                <Form layout="vertical">
                  <Form.Item label="背景类型">
                    <Segmented
                      value={customType}
                      onChange={(val) => {
                        setCustomType(val as 'solid' | 'gradient');
                        if (val === 'solid') {
                          onChange(solidColor);
                        } else {
                          handleGradientChange();
                        }
                      }}
                      options={[
                        { label: '纯色', value: 'solid' },
                        { label: '渐变', value: 'gradient' },
                      ]}
                      block
                    />
                  </Form.Item>

                  {customType === 'solid' && (
                    <Form.Item label="选择颜色">
                      <Space direction="vertical" style={{ width: '100%' }}>
                        <ColorPicker
                          value={solidColor}
                          onChange={handleSolidColorChange}
                          onChangeComplete={handleSolidColorChange}
                          showText
                        />
                        <Card
                          className="custom-preview"
                          styles={{
                            body: {
                              background: solidColor,
                              height: 100,
                              padding: 0,
                            },
                          }}
                        />
                      </Space>
                    </Form.Item>
                  )}

                  {customType === 'gradient' && (
                    <>
                      <Row gutter={16}>
                        <Col span={12}>
                          <Form.Item label="起始颜色">
                            <ColorPicker
                              value={gradColor1}
                              onChange={(color) => {
                                const hex = color.toHexString();
                                setGradColor1(hex);
                                handleGradientChange();
                              }}
                              onChangeComplete={(color) => {
                                const hex = color.toHexString();
                                setGradColor1(hex);
                                handleGradientChange();
                              }}
                              showText
                            />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item label="终止颜色">
                            <ColorPicker
                              value={gradColor2}
                              onChange={(color) => {
                                const hex = color.toHexString();
                                setGradColor2(hex);
                                handleGradientChange();
                              }}
                              onChangeComplete={(color) => {
                                const hex = color.toHexString();
                                setGradColor2(hex);
                                handleGradientChange();
                              }}
                              showText
                            />
                          </Form.Item>
                        </Col>
                      </Row>

                      <Form.Item label="渐变方向">
                        <Input
                          type="number"
                          min={0}
                          max={360}
                          value={gradAngle}
                          onChange={handleAngleChange}
                          addonAfter="°"
                          placeholder="0-360"
                        />
                      </Form.Item>

                      <Form.Item label="预览">
                        <Card
                          className="custom-preview"
                          styles={{
                            body: {
                              background: `linear-gradient(${gradAngle}deg, ${gradColor1} 0%, ${gradColor2} 100%)`,
                              height: 100,
                              padding: 0,
                            },
                          }}
                        />
                      </Form.Item>
                    </>
                  )}
                </Form>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
};

export default BackgroundEditor;
