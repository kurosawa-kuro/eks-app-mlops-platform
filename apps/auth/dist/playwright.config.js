import { defineConfig } from '@playwright/test';
export default defineConfig({
    testDir: './tests/e2e',
    use: {
        baseURL: 'http://localhost:8001',
    },
    webServer: {
        command: 'npm run dev',
        url: 'http://localhost:8001/health',
        reuseExistingServer: !process.env.CI,
        timeout: 10000,
        env: {
            NODE_ENV: 'test',
        },
    },
});
