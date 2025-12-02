/**
 * ComingSoon - 即将推出的Provider占位组件
 */

import React from 'react';
import { Card, Empty } from 'antd';
import type { SyncProviderConfigProps } from '../providers/types';

const ComingSoon: React.FC<SyncProviderConfigProps> = ({ provider }) => (
  <Card className="coming-soon-card">
    <Empty
      description={
        <div>
          <h4>{provider.name} 同步</h4>
          <p>此功能即将推出，敬请期待</p>
          <p style={{ fontSize: 12, marginTop: 16 }}>
            了解更多：
            <a href="https://github.com" target="_blank" rel="noopener noreferrer">
              查看开发路线图
            </a>
          </p>
        </div>
      }
    />
  </Card>
);

export default ComingSoon;
