import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end checks of the learner's main paths in a real browser (tests/e2e). The server is mocked at the
 * network level (Supabase and the API), so the tests need no accounts and change nothing.
 * Against a local production build:   npm run e2e
 * Against a deployed preview:          E2E_BASE_URL=https://….vercel.app npm run e2e
 */
const base = process.env.E2E_BASE_URL
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { ...devices['Pixel 7'], baseURL: base ?? 'http://localhost:3199', trace: 'off' },
  webServer: base ? undefined : {
    command: 'npx next build && npx next start -p 3199', url: 'http://localhost:3199/start', timeout: 400_000, reuseExistingServer: true,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://dqavtyrdipwwgeckxxhr.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'sb_publishable_FFDrHXKCQncViKg7LyfxGQ_P3546UYZ'
    }
  }
})
