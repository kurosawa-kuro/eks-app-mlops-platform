import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  use: {
    baseURL: 'http://localhost:8000',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:8000',
    reuseExistingServer: !process.env.CI,
  },
})
