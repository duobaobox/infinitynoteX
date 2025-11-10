import React, { useState, useMemo } from 'react';
import {
  Tabs,
  ColorPicker,
  Space,
  Row,
  Col,
  Typography,
  Segmented,
  Slider,
  Card,
  Form,
  InputNumber,
} from 'antd';
import type { Color } from 'antd/es/color-picker';
import './BackgroundEditor.css';

const { Paragraph } = Typography;

// 预设背景集合
const PRESET_BACKGROUNDS = {
  gradients: [
    { name: '紫蓝→橙粉', value: 'linear-gradient(165deg, #e2e2ff 0%, #ffd2b7 100%)' },
    { name: '蓝→紫', value: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
    { name: '绿→青', value: 'linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%)' },
    { name: '粉→黄', value: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)' },
    { name: '橙→红', value: 'linear-gradient(135deg, #fa8c16 0%, #eb2f96 100%)' },
    { name: '天蓝→绿', value: 'linear-gradient(135deg, #13c2c2 0%, #52c41a 100%)' },
  ],
  solids: [
    { name: '纯白', value: '#ffffff' },
    { name: '浅灰', value: '#f5f5f5' },
    { name: '深灰', value: '#e8e8e8' },
    { name: '浅蓝', value: '#e6f7ff' },
    { name: '浅绿', value: '#f6ffed' },
  ],
  darkGradients: [
    { name: '深灰→深蓝', value: 'linear-gradient(165deg, #111827 0%, #0b1220 100%)' },
    { name: '深蓝→黑', value: 'linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)' },
    { name: '深紫→黑', value: 'linear-gradient(135deg, #1a0033 0%, #330066 100%)' },
    { name: '深绿→黑', value: 'linear-gradient(135deg, #0d3b0d 0%, #1a1a1a 100%)' },
  ],
};

interface BackgroundEditorProps {
  value: string;
  onChange: (value: string) => void;
  mode: 'light' | 'dark';
}

const BackgroundEditor: React.FC<BackgroundEditorProps> = ({ value, onChange, mode }) => {
  const [activeTab, setActiveTab] = useState<'preset' | 'custom'>('preset');
  const [customType, setCustomType] = useState<'solid' | 'gradient'>('solid');
  const [solidColor, setSolidColor] = useState<string>('#ffffff');
  const [gradColor1, setGradColor1] = useState<string>('#667eea');
  const [gradColor2, setGradColor2] = useState<string>('#764ba2');
  const [gradAngle, setGradAngle] = useState<number>(135);

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
                        bodyStyle={{ padding: 0 }}
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
                      onChange={(value) => setCustomType(value as 'solid' | 'gradient')}
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
                          bodyStyle={{
                            background: solidColor,
                            height: 100,
                            padding: 0,
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
                                setGradColor1(color.toHexString());
                                handleGradientChange();
                              }}
                              onChangeComplete={(color) => {
                                setGradColor1(color.toHexString());
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
                                setGradColor2(color.toHexString());
                                handleGradientChange();
                              }}
                              onChangeComplete={(color) => {
                                setGradColor2(color.toHexString());
                                handleGradientChange();
                              }}
                              showText
                            />
                          </Form.Item>
                        </Col>
                      </Row>

                      <Form.Item label="渐变方向">
                        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                          <Slider
                            min={0}
                            max={360}
                            step={1}
                            value={gradAngle}
                            onChange={(angle) => {
                              setGradAngle(angle);
                              handleGradientChange();
                            }}
                            marks={{
                              0: '0°',
                              90: '90°',
                              180: '180°',
                              270: '270°',
                              360: '360°',
                            }}
                            style={{ flex: 1, margin: 0 }}
                          />
                          <InputNumber
                            min={0}
                            max={360}
                            value={gradAngle}
                            onChange={(val) => {
                              if (val !== null) {
                                setGradAngle(val);
                                handleGradientChange();
                              }
                            }}
                            style={{ width: 80, flexShrink: 0 }}
                            addonAfter="°"
                          />
                        </div>
                      </Form.Item>

                      <Form.Item label="预览">
                        <Card
                          className="custom-preview"
                          bodyStyle={{
                            background: `linear-gradient(${gradAngle}deg, ${gradColor1} 0%, ${gradColor2} 100%)`,
                            height: 100,
                            padding: 0,
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
