import { readFileSync } from 'node:fs'

import type { NextConfig } from 'next'

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }
]

// BUILD_TARGET=app builds the Android app's pages as static files (out/). The API route (route.ts) is
// left out by the page extension list; the app calls the deployed API (NEXT_PUBLIC_API_BASE).
const forApp = process.env.BUILD_TARGET === 'app'
// One version for the app code and the APK: public/app-version.json (Gradle reads it too).
const appVersion = JSON.parse(readFileSync(new URL('./public/app-version.json', import.meta.url), 'utf8')) as { versionCode: number; versionName: string }

const config: NextConfig = forApp
  ? {
      reactStrictMode: true,
      output: 'export',
      pageExtensions: ['tsx'],
      trailingSlash: true,
      images: { unoptimized: true },
      env: { NEXT_PUBLIC_APP_VERSION_CODE: String(appVersion.versionCode), NEXT_PUBLIC_APP_VERSION_NAME: appVersion.versionName },
      turbopack: { root: import.meta.dirname }
    }
  : {
      reactStrictMode: true,
      poweredByHeader: false,
      env: { NEXT_PUBLIC_APP_VERSION_NAME: appVersion.versionName },
      outputFileTracingRoot: import.meta.dirname,
      turbopack: { root: import.meta.dirname },
      async headers() {
        return [{ source: '/:path*', headers: securityHeaders }]
      },
      // short, stable addresses for the Google sign-in screen and the stores
      async redirects() {
        return ['privacy', 'terms', 'about'].map((slug) => ({ source: `/${slug}`, destination: `/page?slug=${slug}`, permanent: false }))
      }
    }

export default config
