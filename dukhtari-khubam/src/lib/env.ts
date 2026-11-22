/** Runtime configuration. Only public (publishable) keys are required; no secrets live in the repo. */
export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
  // The Android app (Capacitor) serves its pages from these origins and calls the API cross-origin.
  corsOrigins: ['https://localhost', 'capacitor://localhost', ...(process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)]
}

export function isConfigured(): boolean {
  return Boolean(env.supabaseUrl && env.supabaseKey)
}

export function publicMediaUrl(bucket: string, path: string): string | null {
  if (!env.supabaseUrl || bucket !== 'media') return null
  return `${env.supabaseUrl}/storage/v1/object/public/media/${path.split('/').map(encodeURIComponent).join('/')}`
}
