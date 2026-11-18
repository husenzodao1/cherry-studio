/**
 * Where the API lives. The website calls its own origin; the Android app (pages served from inside the
 * APK) calls the deployed site, set at build time with NEXT_PUBLIC_API_BASE.
 */
export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? ''

export const apiUrl = (path: string) => `${API_BASE}/api/v1${path}`
