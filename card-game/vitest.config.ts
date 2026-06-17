import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // 开启详细日志
    verbose: true,
    // 测试超时
    testTimeout: 30000,
  },
});