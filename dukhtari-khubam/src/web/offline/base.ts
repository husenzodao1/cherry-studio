/**
 * Where the API lives. The website calls its own origin; the Android app (pages served from inside the
 * APK) calls the deployed site, set at build time with NEXT_PUBLIC_API_BASE.
 */
export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? ''

export const apiUrl = (path: string) => `${API_BASE}/api/v1${path}`

/** The public website (for links people open anywhere): the API's site in the app, this site on the web. */
export const SITE = API_BASE || (typeof window !== 'undefined' ? window.location.origin : 'https://dukhtari-khubam.vercel.app')
