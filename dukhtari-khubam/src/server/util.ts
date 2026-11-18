import type { SupabaseClient } from '@supabase/supabase-js'

import { publicMediaUrl } from '@/lib/env'
import { unwrap } from '@/lib/supabase'

/** Call a Postgres function as the caller and return its JSON result. */
export function call<T = unknown>(sb: SupabaseClient, fn: string, args: Record<string, unknown> = {}): Promise<T> {
  return unwrap<T>(sb.rpc(fn, args) as unknown as PromiseLike<{ data: T | null; error: any }>)
}

/** Adds a public CDN `url` to every asset-like object ({ bucket, path }) in a response. */
export function withMediaUrls<T>(value: T): T {
  if (Array.isArray(value)) return value.map(withMediaUrls) as T
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) out[k] = withMediaUrls(v)
    if (typeof out.bucket === 'string' && typeof out.path === 'string') {
      out.url = publicMediaUrl(out.bucket, out.path)
      out.protected = out.bucket !== 'media'
    }
    return out as T
  }
  return value
}
