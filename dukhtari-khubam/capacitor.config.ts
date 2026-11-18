import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Android app: the pages are the static export in out/ (npm run build:app), packed inside the APK,
 * so the app opens and works without a connection. Content and progress sync with the deployed API.
 */
const config: CapacitorConfig = {
  appId: 'tj.dukhtarikhubam.app',
  appName: 'Духтари хубам',
  webDir: 'out',
  server: { androidScheme: 'https' },
  android: { backgroundColor: '#f1eef5' }
}

export default config
