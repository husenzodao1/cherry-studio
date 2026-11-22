import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Android app: the pages are the static export in out/ (npm run build:app), packed inside the APK,
 * so the app opens and works without a connection. Content and progress sync with the deployed API.
 */
const config: CapacitorConfig = {
  appId: 'tj.dukhtarikhubam.app',
  appName: 'Гулдухтар',
  webDir: 'out',
  server: { androidScheme: 'https' },
  android: { backgroundColor: '#fff1ea' },
  plugins: {
    // daily lesson reminder and inspiration (src/web/offline/notify.ts)
    LocalNotifications: { smallIcon: 'ic_stat_notify', iconColor: '#7A4FD8' },
    // Google sign-in only (src/web/offline/google.ts): other providers' SDKs stay out of the APK
    SocialLogin: { providers: { google: true, facebook: false, apple: false, twitter: false }, logLevel: 1 }
  }
}

export default config
