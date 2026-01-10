import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// 每次测试后自动清理 React 组件挂载
afterEach(() => {
  cleanup();
});
