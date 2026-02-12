import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['base/**/*.ts'],
      exclude: ['base/env/secret.ts'],
    },
    testTimeout: 10000,
  },
});
