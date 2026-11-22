import { createHash, createSign, timingSafeEqual } from 'node:crypto'

/**
 * Google Play subscriptions, checked with Google itself (never trusting the phone): the Google Play
 * Developer API, signed in as the service account the owner made for it (GOOGLE_PLAY_SERVICE_ACCOUNT, its
 * JSON key, a sensitive environment variable). No library: a signed JWT is exchanged for an access token.
 */

export const PLAY_PACKAGE = () => process.env.GOOGLE_PLAY_PACKAGE?.trim() || 'tj.dukhtarikhubam.app'
/** the subscriptions sold in the app (Play Console → Monetize → Subscriptions) */
export const PLAY_PRODUCTS = () => (process.env.GOOGLE_PLAY_PRODUCTS || 'premium_monthly').split(',').map((p) => p.trim()).filter(Boolean)

interface ServiceAccount { client_email: string; private_key: string; token_uri?: string }
const account = (): ServiceAccount | null => {
  const raw = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT?.trim()
  if (!raw) return null
  try {
    const a = JSON.parse(raw) as ServiceAccount
    return a.client_email && a.private_key ? a : null
  } catch {
    return null
  }
}
export const playReady = () => account() !== null

/** the Google account a purchase is bound to: this hash of the learner's id, never the id itself (≤ 64 characters) */
export const playAccountId = (userId: string) => createHash('sha256').update(`${userId}:guldukhtar-play`).digest('hex')

const b64url = (v: string | Buffer) => Buffer.from(v).toString('base64url')
let cached: { token: string; until: number } | null = null

async function accessToken(): Promise<string> {
  if (cached && Date.now() < cached.until) return cached.token
  const a = account()
  if (!a) throw new Error('GOOGLE_PLAY_SERVICE_ACCOUNT is not set')
  const aud = a.token_uri || 'https://oauth2.googleapis.com/token'
  const now = Math.floor(Date.now() / 1000)
  const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = b64url(JSON.stringify({ iss: a.client_email, scope: 'https://www.googleapis.com/auth/androidpublisher', aud, iat: now, exp: now + 3600 }))
  const signature = createSign('RSA-SHA256').update(`${head}.${claims}`).sign(a.private_key)
  const res = await fetch(aud, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${head}.${claims}.${b64url(signature)}` }),
    signal: AbortSignal.timeout(15_000)
  })
  if (!res.ok) throw new Error(`google token ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const data = (await res.json()) as { access_token: string; expires_in: number }
  cached = { token: data.access_token, until: Date.now() + (data.expires_in - 120) * 1000 }
  return data.access_token
}

const API = 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications'

/** what Google says about a subscription purchase (purchases.subscriptionsv2.get) */
export interface PlaySubscription {
  subscriptionState?: string
  latestOrderId?: string
  startTime?: string
  acknowledgementState?: string
  linkedPurchaseToken?: string
  externalAccountIdentifiers?: { obfuscatedExternalAccountId?: string }
  lineItems?: { productId?: string; expiryTime?: string; autoRenewingPlan?: { autoRenewEnabled?: boolean } }[]
}

export async function playSubscription(purchaseToken: string): Promise<PlaySubscription | null> {
  const res = await fetch(`${API}/${encodeURIComponent(PLAY_PACKAGE())}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`, {
    headers: { authorization: `Bearer ${await accessToken()}` },
    signal: AbortSignal.timeout(15_000)
  })
  if (res.status === 404 || res.status === 410 || res.status === 400) return null
  if (!res.ok) throw new Error(`google play ${res.status}: ${(await res.text()).slice(0, 200)}`)
  return (await res.json()) as PlaySubscription
}

/** A purchase Google is not told about within three days is refunded: the server acknowledges it. */
export async function acknowledgePlay(productId: string, purchaseToken: string): Promise<void> {
  const res = await fetch(`${API}/${encodeURIComponent(PLAY_PACKAGE())}/purchases/subscriptions/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}:acknowledge`, {
    method: 'POST',
    headers: { authorization: `Bearer ${await accessToken()}`, 'content-type': 'application/json' },
    body: '{}',
    signal: AbortSignal.timeout(15_000)
  })
  if (!res.ok && res.status !== 409) throw new Error(`google play acknowledge ${res.status}: ${(await res.text()).slice(0, 200)}`)
}

/** states in which the learner keeps Premium until the paid time ends (cancelled: it just does not renew) */
const PAID = new Set(['SUBSCRIPTION_STATE_ACTIVE', 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD', 'SUBSCRIPTION_STATE_CANCELED'])

export interface PlayGrant { product: string; order: string | null; starts: string | null; ends: string; autoRenew: boolean; paid: boolean }

/**
 * What a subscription gives, from Google's answer: Premium until its paid time ends while it is paid for;
 * expired, on hold, paused, refunded or pending — it ends now.
 */
export function grantOf(sub: PlaySubscription, now = new Date()): PlayGrant | null {
  const item = (sub.lineItems ?? []).filter((l) => l.productId && l.expiryTime).sort((a, b) => Date.parse(b.expiryTime!) - Date.parse(a.expiryTime!))[0]
  if (!item) return null
  const paid = PAID.has(sub.subscriptionState ?? '') && Date.parse(item.expiryTime!) > now.getTime()
  return {
    product: item.productId!,
    order: sub.latestOrderId ?? null,
    starts: sub.startTime ?? null,
    ends: paid ? item.expiryTime! : new Date(now.getTime() + 1000).toISOString(),
    autoRenew: !!item.autoRenewingPlan?.autoRenewEnabled,
    paid
  }
}

/** Google's push notification (RTDN through Pub/Sub): the purchase token it is about, if any */
export function notificationToken(body: unknown): string | null {
  try {
    const data = (body as { message?: { data?: string } })?.message?.data
    if (!data) return null
    const n = JSON.parse(Buffer.from(data, 'base64').toString('utf8')) as {
      subscriptionNotification?: { purchaseToken?: string }; voidedPurchaseNotification?: { purchaseToken?: string }
    }
    return n.subscriptionNotification?.purchaseToken ?? n.voidedPurchaseNotification?.purchaseToken ?? null
  } catch {
    return null
  }
}

/** the secret in the push address (?key=…), compared in constant time */
export function rtdnKeyOk(given: string | null | undefined): boolean {
  const want = process.env.PLAY_RTDN_KEY?.trim()
  if (!want || !given) return false
  const a = Buffer.from(want)
  const b = Buffer.from(given)
  return a.length === b.length && timingSafeEqual(a, b)
}
