/**
 * Paddle (Billing): its webhook is checked by its signature (Paddle-Signature: "ts=…;h1=…", an HMAC-SHA256 of
 * "ts:raw body" with PADDLE_WEBHOOK_SECRET); a subscription's event says whose it is (custom_data.user_id,
 * set by the app at checkout), which plan (its price), and until when it is paid.
 */
import { createHmac, timingSafeEqual } from 'node:crypto'

export const paddleReady = () => !!process.env.PADDLE_WEBHOOK_SECRET?.trim()

/** whether the webhook really comes from Paddle (and is fresh: within 10 minutes) */
export function paddleSigned(header: string | null, raw: string, secret = process.env.PADDLE_WEBHOOK_SECRET ?? '', now = Date.now()): boolean {
  if (!header || !secret) return false
  const parts = Object.fromEntries(header.split(';').map((p) => p.split('=') as [string, string]).filter((p) => p.length === 2))
  const ts = Number(parts.ts)
  if (!Number.isFinite(ts) || Math.abs(now / 1000 - ts) > 600 || !parts.h1) return false
  const mine = createHmac('sha256', secret).update(`${parts.ts}:${raw}`).digest('hex')
  const a = Buffer.from(mine, 'hex')
  const b = Buffer.from(parts.h1, 'hex')
  return a.length === b.length && timingSafeEqual(a, b)
}

export interface PaddlePrices { standard?: string; premium?: string; standard_discount?: string }

export interface Grant { user: string; subscription: string; tier: 'standard' | 'premium'; starts: string | null; ends: string; autoRenew: boolean; created: boolean }

/** what a subscription event grants (null: not a subscription event, or not ours) */
export function grantFromEvent(event: unknown, prices: PaddlePrices, now = new Date()): Grant | null {
  const e = (event ?? {}) as Record<string, any>
  const type = String(e.event_type ?? '')
  if (!type.startsWith('subscription.')) return null
  const d = (e.data ?? {}) as Record<string, any>
  const user = d.custom_data?.user_id
  if (typeof user !== 'string' || !/^[0-9a-f-]{36}$/i.test(user) || typeof d.id !== 'string') return null
  const priceIds: string[] = (Array.isArray(d.items) ? d.items : []).map((i: any) => i?.price?.id).filter(Boolean)
  const planOfPrice = (Array.isArray(d.items) ? d.items : []).map((i: any) => i?.price?.custom_data?.plan).find((p: unknown) => p === 'standard' || p === 'premium')
  const tier = priceIds.includes(prices.premium ?? '\u0000') || planOfPrice === 'premium' ? 'premium'
    : priceIds.includes(prices.standard ?? '\u0000') || planOfPrice === 'standard' ? 'standard' : null
  if (!tier) return null
  const status = String(d.status ?? '')
  const period = d.current_billing_period ?? {}
  // ended (cancelled or paused): its time ends now; otherwise the paid period's end
  const over = status === 'canceled' || status === 'paused'
  const ends = over ? (d.canceled_at ?? d.paused_at ?? now.toISOString()) : (period.ends_at ?? d.next_billed_at)
  if (typeof ends !== 'string') return null
  return {
    user, subscription: d.id, tier, starts: period.starts_at ?? d.started_at ?? null, ends,
    autoRenew: !over && !d.scheduled_change, created: type === 'subscription.created'
  }
}
