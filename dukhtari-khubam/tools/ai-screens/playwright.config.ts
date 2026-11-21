import { defineConfig } from '@playwright/test'

import base from '../../playwright.config'

/**
 * Makes the screenshots Mahliyo AI points at (shots.spec.ts), from the app built at the project's root:
 *   npx next build && npx playwright test -c tools/ai-screens && python3 tools/ai-screens/webp.py
 */
const root = new URL('../..', import.meta.url).pathname
export default defineConfig({
  ...base, testDir: '.', timeout: 300_000, retries: 0, outputDir: `${root}test-results/ai-screens-run`,
  use: { ...base.use, viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 },
  webServer: base.webServer && !Array.isArray(base.webServer) ? { ...base.webServer, command: 'npx next start -p 3199', cwd: root } : base.webServer
})
