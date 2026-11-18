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

const config: NextConfig = forApp
  ? {
      reactStrictMode: true,
      output: 'export',
      pageExtensions: ['tsx'],
      trailingSlash: true,
      images: { unoptimized: true },
      turbopack: { root: import.meta.dirname }
    }
  : {
      reactStrictMode: true,
      poweredByHeader: false,
      outputFileTracingRoot: import.meta.dirname,
      turbopack: { root: import.meta.dirname },
      async headers() {
        return [{ source: '/:path*', headers: securityHeaders }]
      }
    }

export default config
