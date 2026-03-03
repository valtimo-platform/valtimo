import {defineConfig, devices} from '@playwright/test';
import {config} from 'dotenv';
// @ts-ignore
import moment from 'moment';
import momentDurationFormatSetup from 'moment-duration-format';

momentDurationFormatSetup(moment);

// Load env files
config({path: '.env.properties'});

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  // forbidOnly: true,
  retries: process.env.CI ? 3 : 0,
  workers: process.env.CI ? 1 : 1,
  reporter: [['line'], ['html', {open: 'on-failure'}]],
  globalSetup: './utils/globalSetup.ts',
  globalTeardown: './utils/teardown.ts',
  timeout: process.env.qa_timeout
    ? moment.duration(process.env.qa_timeout).asMilliseconds()
    : 90_000,
  globalTimeout: 60 * 60 * 1000,
  webServer: undefined,
  use: {
    launchOptions: {
      // headless: false,
      headless: process.env.CI ? true : process.env.headlessMode === 'true',
      args: ['--start-maximized'],
    },
    baseURL: process.env.qa_url ?? 'http://localhost:4200',
    screenshot: process.env.CI ? 'only-on-failure' : 'on',
    video: 'on',
    trace: {
      mode: process.env.CI ? 'retain-on-failure' : 'on',
      snapshots: true,
      screenshots: true,
    },
    permissions: ['clipboard-read', 'clipboard-write'],
    testIdAttribute: 'data-test-id',
  },

  projects: [
    {
      name: 'setup user',
      testMatch: /.*user\.setup\.ts$/,
    },
    {
      name: 'user tests',
      testMatch: /.*\.user\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: {
          width: 1920,
          height: 1080,
        },
      },
      dependencies: ['setup user'],
    },
    {
      name: 'admin tests',
      testMatch: /.*\/(?!.*\.user\.).*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: {
          width: 1920,
          height: 1080,
        },
        storageState: 'playwright/.auth/uiState.json',
      },
    },
  ],
});
