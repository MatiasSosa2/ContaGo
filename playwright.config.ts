import { defineConfig, devices } from '@playwright/test'

/**
 * Configuración de Playwright para tests E2E de ContaGo.
 * Levanta el dev server automáticamente y corre los tests contra él.
 *
 * Uso:
 *   pnpm test:e2e          -> corre todos los tests (headless)
 *   pnpm test:e2e:ui       -> modo interactivo con UI
 *   pnpm exec playwright show-report
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { open: 'never' }], ['list']],

  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-safari', use: { ...devices['iPhone 13'] } },
  ],

  // Levanta el servidor de Next automáticamente si no está corriendo.
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
