import { after } from 'next/server'
import { z } from 'zod'

import { ApiError } from '@/lib/http'
import { route, type AnyRoute } from '@/lib/router'

import { secret, serverReady } from '../aiModels'
import { acknowledgePlay, grantOf, notificationToken, PLAY_PRODUCTS, playAccountId, playReady, playSubscription, rtdnKeyOk, type PlaySubscription } from '../googlePlay'
import { fillTranslations, MT_LOCALES, translateBundle, type MtLocale } from '../translate'
import { call } from '../util'
import { buildBundle } from './offline'

type Json = Record<string, any>

/** writes what Google said about a purchase (the database lets only the server do it) */
async function keep(sb: ReturnType<Parameters<AnyRoute['handler']>[0]['sb']>, user: string, token: string, sub: PlaySubscription) {
  const g = grantOf(sub)
  if (!g) return null
  await call(sb, 'api_play_entitlement', {
    p_proof: secret(), p_user: user, p_token: token, p_product: g.product, p_order: g.order, p_starts: g.starts, p_ends: g.ends, p_auto_renew: g.autoRenew
  })
  // a purchase Google is not told about within three days is refunded
  if (g.paid && sub.acknowledgementState === 'ACKNOWLEDGEMENT_STATE_PENDING') await acknowledgePlay(g.product, token)
  return g
}

export const billingRoutes: AnyRoute[] = [
  route({
    method: 'GET', path: '/billing/play/account', access: 'user', tag: 'Premium',
    summary: 'What the app needs before a Google Play purchase: the account the purchase is bound to, and the products sold',
    handler: async ({ userId }) => ({ account_id: playAccountId(userId!), products: PLAY_PRODUCTS(), ready: playReady() && serverReady() })
  }),
  route({
    method: 'POST', path: '/billing/play/verify', access: 'user', tag: 'Premium',
    summary: 'A Google Play purchase made in the app: checked with Google, then Premium is given until its paid time ends',
    body: z.strictObject({ purchase_token: z.string().min(10).max(2000) }),
    handler: async ({ sb, userId, body }) => {
      if (!playReady() || !serverReady()) throw new ApiError(503, 'not_configured', 'Пардохт ҳоло танзим нашудааст.')
      const sub = await playSubscription(body.purchase_token)
      if (!sub) throw new ApiError(404, 'not_found', 'Ин харид дар Google Play ёфт нашуд.')
      const product = sub.lineItems?.[0]?.productId ?? ''
      if (!PLAY_PRODUCTS().includes(product)) throw new ApiError(422, 'validation_failed', 'Ин маҳсулот шинохта нашуд.')
      // a purchase is bound to the account it was made on: another account cannot take it over
      const bound = sub.externalAccountIdentifiers?.obfuscatedExternalAccountId
      if (bound && bound !== playAccountId(userId!)) throw new ApiError(403, 'forbidden', 'Ин харид ба ҳисоби дигар тааллуқ дорад.')
      const owner = await call<string | null>(sb(), 'api_play_owner', { p_proof: secret(), p_token: body.purchase_token })
      if (owner && owner !== userId) throw new ApiError(403, 'forbidden', 'Ин харид ба ҳисоби дигар тааллуқ дорад.')
      await keep(sb(), userId!, body.purchase_token, sub)
      return call<Json>(sb(), 'api_my_premium')
    }
  }),
  route({
    method: 'POST', path: '/billing/play/rtdn', access: 'public', tag: 'Premium',
    summary: "Google Play's push notification (Pub/Sub, ?key=…): a subscription renewed, was cancelled, refunded or expired",
    query: z.object({ key: z.string().max(200).optional() }),
    body: z.object({ message: z.object({ data: z.string().max(20_000).optional() }).passthrough().optional() }).passthrough(),
    handler: async ({ sb, query, body }) => {
      if (!rtdnKeyOk(query.key)) throw new ApiError(403, 'forbidden', 'Not allowed.')
      const token = notificationToken(body)
      if (!token || !playReady() || !serverReady()) return { ok: true }
      // what the notification says is not trusted: the purchase is read again from Google
      const client = sb()
      after(async () => {
        try {
          const owner = await call<string | null>(client, 'api_play_owner', { p_proof: secret(), p_token: token })
          // a purchase the app has not shown yet: it is written when the app sends it (verify)
          if (!owner) return
          const sub = await playSubscription(token)
          if (sub) await keep(client, owner, token, sub)
        } catch (e) {
          console.error('[play] notification failed', e instanceof Error ? e.message : String(e))
        }
      })
      return { ok: true }
    }
  }),
  route({
    method: 'GET', path: '/me/premium', access: 'user', tag: 'Premium', summary: 'My Premium: whether, until when, and how it was given',
    handler: async ({ sb }) => call<Json>(sb(), 'api_my_premium')
  }),
  route({
    method: 'POST', path: '/me/delete', access: 'user', tag: 'Me',
    summary: 'Deletes my account and what is kept about it (a Google Play subscription is cancelled in Google Play itself)',
    handler: async ({ sb }) => {
      await call(sb(), 'api_delete_me')
      return { ok: true }
    }
  }),
  route({
    method: 'GET', path: '/bundle/premium', access: 'user', tag: 'Premium',
    summary: "Premium courses, lessons and their tests for a Premium learner (the public bundle leaves them out)",
    query: z.object({ locale: z.enum(['tg', 'ru', 'ar', 'en', 'uz', 'tr', 'fa', 'prs']).default('tg') }),
    handler: async ({ sb, query }) => {
      const client = sb()
      const me = await call<{ premium: boolean }>(client, 'api_my_premium')
      if (!me.premium) throw new ApiError(403, 'premium_required', 'Барои Premium.')
      const source = query.locale === 'ru' || query.locale === 'ar' ? query.locale : 'tg'
      let bundle: Json = await buildBundle(client, source)
      if ((MT_LOCALES as readonly string[]).includes(query.locale)) {
        const t = await translateBundle(client, bundle as never, query.locale as MtLocale)
        bundle = t.bundle as Json
        if (t.missing.length) after(() => fillTranslations(client, query.locale as MtLocale, t.missing).catch(() => undefined))
      }
      // only what the public bundle leaves out: Premium courses, their lessons and tests
      const courses = Object.fromEntries(Object.entries((bundle.courses ?? {}) as Record<string, Json>).filter(([, c]) => c.access_tier === 'premium'))
      const lessons = Object.fromEntries(Object.entries((bundle.lessons ?? {}) as Record<string, Json>).filter(([, l]) => l.access_tier === 'premium'))
      const quizzes = Object.fromEntries(Object.entries((bundle.quizzes ?? {}) as Record<string, Json>).filter(([, q]) => q.access_tier === 'premium'))
      return new Response(JSON.stringify({ version: bundle.version, courses, lessons, quizzes }), {
        headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'private, no-store' }
      })
    }
  }),
  route({
    method: 'GET', path: '/admin/premium', access: 'staff', tag: 'Admin · Premium',
    summary: 'Schools and courses with their tiers, who has Premium now, and the Premium settings',
    handler: async ({ sb }) => call<Json>(sb(), 'admin_premium_overview')
  }),
  route({
    method: 'POST', path: '/admin/premium/tier', access: 'staff', tag: 'Admin · Premium', summary: 'A school or course made free or Premium',
    body: z.strictObject({ kind: z.enum(['school', 'course']), id: z.uuid(), tier: z.enum(['free', 'premium']) }),
    handler: async ({ sb, body }) => {
      await call(sb(), 'admin_set_tier', { p_kind: body.kind, p_id: body.id, p_tier: body.tier })
      return { ok: true }
    }
  }),
  route({
    method: 'POST', path: '/admin/premium/grant', access: 'staff', tag: 'Admin · Premium',
    summary: 'Premium for an account by its e-mail, for some months (0: for ever) — bought through a consultant',
    body: z.strictObject({ email: z.email().max(200), months: z.number().int().min(0).max(60), note: z.string().trim().max(500).optional() }),
    handler: async ({ sb, body }) => call<Json>(sb(), 'admin_grant_by_email', { p_email: body.email, p_months: body.months, p_note: body.note ?? null })
  }),
  route({
    method: 'POST', path: '/admin/premium/setting', access: 'staff', tag: 'Admin · Premium', summary: 'A Premium setting (the consultant link on the Premium screen)',
    body: z.strictObject({ key: z.enum(['premium_consultant']), value: z.boolean() }),
    handler: async ({ sb, body }) => {
      await call(sb(), 'admin_set_setting', { p_key: body.key, p_value: body.value })
      return { ok: true }
    }
  })
]
