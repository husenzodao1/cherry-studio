import { z } from 'zod'

import { ApiError } from '@/lib/http'
import { route, type AnyRoute } from '@/lib/router'

import { call } from '../util'
import { bridge, BridgeError, bridgeReady, dueText, sendWhatsApp, sosText, type SosEvent } from '../whatsapp'

/**
 * SOS and "walk me home". The phone opens or closes an alert with her code; this server writes to her people
 * on WhatsApp (the owner's number, through the bridge) with a link to the live map. When WhatsApp cannot be
 * reached, the answer says so and the phone sends a plain SMS itself. Free for everyone: safety is never paid.
 */

const Code = z.string().regex(/^[1-9][0-9]{14}$/)
const Token = z.string().regex(/^[0-9a-f]{24}$/)
const Lang = z.enum(['tg', 'ru', 'en', 'uz', 'tr', 'fa', 'prs']).default('tg')
const Lat = z.number().min(-90).max(90)
const Lng = z.number().min(-180).max(180)

interface Guardian { name: string; phone: string }
interface Started { token: string; kind: 'sos' | 'walk'; new: boolean; name: string; due_at: string | null; guardians: Guardian[] }
interface Stopped { stopped: boolean; kind?: 'sos' | 'walk'; name?: string; lat?: number | null; lng?: number | null; guardians?: Guardian[] }

/** the live map's address: this site's own (never one taken from the request) */
export function mapLink(token: string): string {
  const site = (process.env.SITE_HOST ?? process.env.VERCEL_PROJECT_PRODUCTION_URL ?? 'dukhtari-khubam.vercel.app').replace(/^https?:\/\//, '')
  return `https://${site}/where?t=${token}`
}

/** Writes to all her people at once; how many got it. */
async function tellAll(guardians: Guardian[], text: string, place: { lat: number; lng: number } | null): Promise<number> {
  if (!bridgeReady() || !guardians.length) return 0
  const sent = await Promise.all(guardians.map((g) => sendWhatsApp(g.phone, text, place)))
  return sent.filter(Boolean).length
}

const fail = (e: unknown): never => {
  const m = e instanceof Error ? e.message : ''
  if (/rate_limited/.test(m)) throw new ApiError(429, 'rate_limited', 'Too many alerts today')
  if (/unauthorized|not_found/.test(m)) throw new ApiError(401, 'unauthorized', 'Unknown profile')
  throw new ApiError(400, 'validation_failed', 'The alert could not be opened')
}

export const sosRoutes: AnyRoute[] = [
  route({
    method: 'POST', path: '/sos/start', access: 'public', tag: 'SOS',
    summary: 'Opens an SOS or a walk home and writes to her people on WhatsApp with the live map',
    body: z.strictObject({ code: Code, kind: z.enum(['sos', 'walk', 'late']), lat: Lat.nullable(), lng: Lng.nullable(), accuracy: z.number().min(0).max(100_000).optional(), minutes: z.number().int().min(5).max(180).optional(), lang: Lang }),
    handler: async ({ sb, body }) => {
      // "late": the phone's own alarm when a walk ran over its time — an SOS with its own words
      const kind = body.kind === 'late' ? 'sos' : body.kind
      const a = await call<Started>(sb(), 'api_sos_start', {
        p_code: body.code, p_kind: kind, p_lat: body.lat, p_lng: body.lng, p_accuracy: body.accuracy ?? null, p_minutes: body.minutes ?? null
      }).catch(fail)
      const link = mapLink(a.token)
      const place = body.lat !== null && body.lng !== null ? { lat: body.lat, lng: body.lng } : null
      // pressed again while it is open: written again only for an SOS (a walk was announced once)
      const event: SosEvent = body.kind === 'late' ? 'late' : kind
      const sent = a.new || kind === 'sos' ? await tellAll(a.guardians, sosText(event, body.lang, { name: a.name, link, due: dueText(a.due_at) }), place) : a.guardians.length
      return { token: a.token, link, kind: a.kind, due_at: a.due_at, guardians: a.guardians, sent, whatsapp: bridgeReady() }
    }
  }),
  route({
    method: 'POST', path: '/sos/update', access: 'public', tag: 'SOS', summary: 'Her place while the alert is open',
    body: z.strictObject({ code: Code, token: Token, lat: Lat, lng: Lng, accuracy: z.number().min(0).max(100_000).optional(), battery: z.number().int().min(0).max(100).optional() }),
    handler: async ({ sb, body }) =>
      call<{ open: boolean }>(sb(), 'api_sos_update', { p_code: body.code, p_token: body.token, p_lat: body.lat, p_lng: body.lng, p_accuracy: body.accuracy ?? null, p_battery: body.battery ?? null }).catch(fail)
  }),
  route({
    method: 'POST', path: '/sos/stop', access: 'public', tag: 'SOS', summary: '"I am safe" / "I arrived": the map closes and her people are told',
    body: z.strictObject({ code: Code, token: Token, lang: Lang }),
    handler: async ({ sb, body }) => {
      const s = await call<Stopped>(sb(), 'api_sos_stop', { p_code: body.code, p_token: body.token, p_safe: true }).catch(fail)
      if (!s.stopped) return { stopped: false, sent: 0 }
      const sent = await tellAll(s.guardians ?? [], sosText(s.kind === 'walk' ? 'arrived' : 'safe', body.lang, { name: s.name ?? '' }), null)
      return { stopped: true, sent }
    }
  }),

  // ── the panel: the owner's WhatsApp number ──
  route({
    method: 'GET', path: '/admin/whatsapp', access: 'staff', tag: 'Admin · WhatsApp', summary: 'Whether the owner\'s WhatsApp number is linked',
    handler: async () => {
      if (!bridgeReady()) return { configured: false, state: 'off', number: null }
      try {
        return { configured: true, ...(await bridge<{ state: string; number: string | null }>('GET', '/status')) }
      } catch {
        return { configured: true, state: 'unreachable', number: null }
      }
    }
  }),
  route({
    method: 'POST', path: '/admin/whatsapp/pair', access: 'staff', tag: 'Admin · WhatsApp',
    summary: 'A pairing code to link the owner\'s number (typed on that phone: WhatsApp → Linked devices → Link with phone number)',
    body: z.strictObject({ phone: z.string().min(9).max(20) }),
    handler: async ({ sb, body }) => {
      if (!(await call<boolean>(sb(), 'admin_is_super'))) throw new ApiError(403, 'forbidden', 'Only the owner may link the number')
      try {
        return await bridge<{ code: string }>('POST', '/pair', { phone: body.phone })
      } catch (e) {
        const code = e instanceof BridgeError ? e.code : 'failed'
        throw new ApiError(code === 'bad_phone' ? 400 : code === 'already_linked' ? 409 : 503, code, 'The number could not be linked')
      }
    }
  }),
  route({
    method: 'POST', path: '/admin/whatsapp/logout', access: 'staff', tag: 'Admin · WhatsApp', summary: 'Unlinks the owner\'s number', status: 204,
    handler: async ({ sb }) => {
      if (!(await call<boolean>(sb(), 'admin_is_super'))) throw new ApiError(403, 'forbidden', 'Only the owner may unlink the number')
      await bridge('POST', '/logout').catch(() => undefined)
      return undefined
    }
  })
]
