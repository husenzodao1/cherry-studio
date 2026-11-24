import { after } from 'next/server'
import { z } from 'zod'

import { ApiError } from '@/lib/http'
import { route, type AnyRoute } from '@/lib/router'

import { secret, serverReady } from '../aiModels'
import { acknowledgePlay, grantOf, notificationToken, PLAY_PRODUCTS, playAccountId, playReady, playSubscription, rtdnKeyOk, type PlaySubscription } from '../googlePlay'
import { fillTranslations, MT_LOCALES, translateBundle, type MtLocale } from '../translate'
import { grantFromEvent, paddleReady, paddleSigned, type PaddlePrices } from '../paddle'
import { forgetPlanSettings, planSettings } from '../plans'
import { somoniRates } from '../rates'
import { call } from '../util'
import { DEFAULT_LIMITS, GIFT_DAYS, planRank, PRICES } from '@/lib/plans'
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
    summary: "The courses, lessons and tests of my plan (Standard, or Standard and Premium) that the public bundle leaves locked",
    query: z.object({ locale: z.enum(['tg', 'ru', 'ar', 'en', 'uz', 'tr', 'fa', 'prs']).default('tg'), audience: z.enum(['girls', 'boys']).default('girls') }),
    handler: async ({ sb, query }) => {
      const client = sb()
      const me = await call<{ plan?: string; premium?: boolean }>(client, 'api_my_plan')
      const rank = planRank(me.plan ?? (me.premium ? 'premium' : 'free'))
      if (!rank) throw new ApiError(403, 'premium_required', 'Барои Standard ё Premium.')
      const source = query.locale === 'ru' || query.locale === 'ar' ? query.locale : 'tg'
      let bundle: Json = await buildBundle(client, source, query.audience)
      if ((MT_LOCALES as readonly string[]).includes(query.locale)) {
        const t = await translateBundle(client, bundle as never, query.locale as MtLocale)
        bundle = t.bundle as Json
        if (t.missing.length) after(() => fillTranslations(client, query.locale as MtLocale, t.missing).catch(() => undefined))
      }
      // only what the public bundle leaves locked, within her plan: the paid courses, their lessons and tests
      const mine = (x: Json) => planRank(x.access_tier) > 0 && planRank(x.access_tier) <= rank
      const courses = Object.fromEntries(Object.entries((bundle.courses ?? {}) as Record<string, Json>).filter(([, c]) => mine(c)))
      const lessons = Object.fromEntries(Object.entries((bundle.lessons ?? {}) as Record<string, Json>).filter(([, l]) => mine(l)))
      const quizzes = Object.fromEntries(Object.entries((bundle.quizzes ?? {}) as Record<string, Json>).filter(([, q]) => mine(q) || mine(q.quiz ?? {})))
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
    method: 'POST', path: '/admin/premium/tier', access: 'staff', tag: 'Admin · Premium', summary: 'A school, course, lesson or test made free, Standard or Premium',
    body: z.strictObject({ kind: z.enum(['school', 'course', 'lesson', 'quiz']), id: z.uuid(), tier: z.enum(['free', 'standard', 'premium']) }),
    handler: async ({ sb, body }) => {
      await call(sb(), 'admin_set_tier', { p_kind: body.kind, p_id: body.id, p_tier: body.tier })
      return { ok: true }
    }
  }),
  route({
    method: 'POST', path: '/admin/premium/grant', access: 'staff', tag: 'Admin · Premium',
    summary: 'Standard or Premium for an account by its e-mail, for some months (0: for ever) — bought through a consultant',
    body: z.strictObject({ email: z.email().max(200), months: z.number().int().min(0).max(60), tier: z.enum(['standard', 'premium']).default('premium'), note: z.string().trim().max(500).optional() }),
    handler: async ({ sb, body }) => call<Json>(sb(), 'admin_grant_plan', { p_email: body.email, p_tier: body.tier, p_months: body.months, p_note: body.note ?? null })
  }),
  route({
    method: 'POST', path: '/admin/premium/setting', access: 'staff', tag: 'Admin · Premium',
    summary: 'A plans setting: plans on or off, the consultant link, the limits of each plan, Paddle\'s price IDs',
    body: z.discriminatedUnion('key', [
      z.strictObject({ key: z.enum(['premium_consultant', 'plans_live']), value: z.boolean() }),
      z.strictObject({ key: z.literal('plan_limits'), value: z.record(z.enum(['free', 'standard', 'premium']), z.record(z.string().max(20), z.number().int().min(-1).max(100_000))) }),
      z.strictObject({ key: z.literal('paddle'), value: z.strictObject({ standard: z.string().max(80).optional(), premium: z.string().max(80).optional(), standard_discount: z.string().max(80).optional() }) })
    ]),
    handler: async ({ sb, body }) => {
      await call(sb(), 'admin_set_setting', { p_key: body.key, p_value: body.value })
      forgetPlanSettings()
      return { ok: true }
    }
  }),
  route({
    method: 'POST', path: '/admin/premium/end', access: 'staff', tag: 'Admin · Premium', summary: 'A plan taken back: it ends now',
    body: z.strictObject({ id: z.uuid() }),
    handler: async ({ sb, body }) => {
      await call(sb(), 'admin_end_entitlement', { p_id: body.id })
      return { ok: true }
    }
  }),
  route({
    method: 'GET', path: '/plans', access: 'public', tag: 'Plans', cache: 60,
    summary: 'The plans: whether they are on, their prices and limits, how to pay (Paddle) and the consultant link',
    handler: async ({ sb }) => {
      const settings = await call<Record<string, unknown>>(sb(), 'api_app_settings').catch(() => ({} as Record<string, unknown>))
      const { live, limits } = await planSettings(sb())
      const prices = (settings.paddle ?? {}) as PaddlePrices
      return {
        live, prices: PRICES, gift_days: GIFT_DAYS, limits: limits ?? DEFAULT_LIMITS,
        // a somoni in other currencies: the prices are shown in hers too
        rates: await somoniRates(),
        consultant: settings.premium_consultant !== false,
        paddle: process.env.PADDLE_CLIENT_TOKEN && prices.standard && prices.premium
          ? { token: process.env.PADDLE_CLIENT_TOKEN, sandbox: process.env.PADDLE_ENV === 'sandbox', standard: prices.standard, premium: prices.premium, standard_discount: prices.standard_discount ?? null }
          : null
      }
    }
  }),
  route({
    method: 'GET', path: '/me/plan', access: 'user', tag: 'Plans', summary: 'My plan: which, until when, Standard\'s free week, my gifts for friends',
    handler: async ({ sb }) => call<Json>(sb(), 'api_my_plan')
  }),
  route({
    method: 'POST', path: '/me/plan/week', access: 'user', tag: 'Plans', summary: 'Standard\'s second month: one free week of Premium (once)',
    handler: async ({ sb }) => call<Json>(sb(), 'api_claim_premium_week')
  }),
  route({
    method: 'POST', path: '/me/gift', access: 'user', tag: 'Plans', summary: 'A friend\'s Premium gift taken (its code): Premium for its days',
    body: z.strictObject({ code: z.string().trim().regex(/^[A-Za-z0-9]{8}$/) }),
    handler: async ({ sb, body }) => call<Json>(sb(), 'api_redeem_gift', { p_code: body.code })
  }),
  route({
    method: 'POST', path: '/billing/paddle/webhook', access: 'public', tag: 'Plans',
    summary: "Paddle's webhook (signed): a subscription bought, renewed, changed, paused or cancelled",
    handler: async ({ sb, req }) => {
      const raw = await req.text()
      if (!paddleReady() || !serverReady()) throw new ApiError(503, 'not_configured', 'Paddle is not set up.')
      if (!paddleSigned(req.headers.get('paddle-signature'), raw)) throw new ApiError(403, 'forbidden', 'Bad signature.')
      let event: unknown
      try { event = JSON.parse(raw) } catch { throw new ApiError(400, 'bad_json', 'Bad JSON.') }
      const settings = await call<Record<string, unknown>>(sb(), 'api_app_settings').catch(() => ({} as Record<string, unknown>))
      const g = grantFromEvent(event, (settings.paddle ?? {}) as PaddlePrices)
      if (!g) return { ok: true }
      await call(sb(), 'api_paddle_entitlement', {
        p_proof: secret(), p_user: g.user, p_subscription: g.subscription, p_tier: g.tier, p_starts: g.starts, p_ends: g.ends, p_auto_renew: g.autoRenew
      })
      // a Premium purchase: three days of Premium for a friend
      if (g.created && g.tier === 'premium') await call(sb(), 'api_make_gift', { p_proof: secret(), p_user: g.user, p_days: GIFT_DAYS }).catch(() => undefined)
      return { ok: true }
    }
  })
]
