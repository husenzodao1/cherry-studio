import { afterEach, describe, expect, it, vi } from 'vitest'

import { mapLink } from '@/server/routes/sos'
import { bridge, bridgeReady, dueText, sendWhatsApp, sosText } from '@/server/whatsapp'

const SECRET = 'x'.repeat(32)

describe('SOS messages and the WhatsApp bridge', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('her people read her name, the live map and what to do, in her language', () => {
    const tg = sosText('sos', 'tg', { name: 'Малика', link: 'https://x/where?t=1' })
    expect(tg).toContain('Малика ёрӣ мехоҳад')
    expect(tg).toContain('https://x/where?t=1')
    expect(tg).toContain('112')
    expect(sosText('walk', 'ru', { name: 'Малика', link: 'L', due: '18:40' })).toContain('должна прийти к 18:40')
    expect(sosText('arrived', 'en', { name: 'Malika' })).toBe('🏠 Malika arrived safely.')
    // Dari reads the Persian words
    expect(sosText('safe', 'prs', { name: 'ملیکا' })).toBe(sosText('safe', 'fa', { name: 'ملیکا' }))
    expect(sosText('late', 'tg', { name: 'М', link: 'L', due: '19:00' })).toContain('то 19:00 нарасид')
  })

  it('the due time on Dushanbe\'s clock; the map on this site, never the request\'s host', () => {
    expect(dueText('2026-11-24T13:40:00Z')).toBe('18:40')
    expect(dueText(null)).toBe('')
    vi.stubEnv('SITE_HOST', 'lifehub.tj')
    expect(mapLink('a'.repeat(24))).toBe(`https://lifehub.tj/where?t=${'a'.repeat(24)}`)
  })

  it('the bridge is called with the shared secret; without its address or a long secret it is off', async () => {
    expect(bridgeReady()).toBe(false)
    vi.stubEnv('WHATSAPP_BRIDGE_URL', 'https://wa.example.com/')
    vi.stubEnv('WHATSAPP_BRIDGE_SECRET', 'short')
    expect(bridgeReady()).toBe(false)
    vi.stubEnv('WHATSAPP_BRIDGE_SECRET', SECRET)
    expect(bridgeReady()).toBe(true)
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ sent: true }), { status: 200 }))
    expect(await sendWhatsApp('992901234567', 'SOS', { lat: 38.5, lng: 68.7 }, fetcher as unknown as typeof fetch)).toBe(true)
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://wa.example.com/send')
    expect((init.headers as Record<string, string>).authorization).toBe(`Bearer ${SECRET}`)
    expect(JSON.parse(String(init.body))).toEqual({ to: '992901234567', text: 'SOS', lat: 38.5, lng: 68.7 })
  })

  it('a refused or unreachable bridge: the message did not go (the phone then sends an SMS)', async () => {
    vi.stubEnv('WHATSAPP_BRIDGE_URL', 'https://wa.example.com')
    vi.stubEnv('WHATSAPP_BRIDGE_SECRET', SECRET)
    const limited = vi.fn(async () => new Response(JSON.stringify({ error: 'rate_limited' }), { status: 429 }))
    expect(await sendWhatsApp('992901234567', 'SOS', null, limited as unknown as typeof fetch)).toBe(false)
    const down = vi.fn(async () => { throw new TypeError('fetch failed') })
    expect(await sendWhatsApp('992901234567', 'SOS', null, down as unknown as typeof fetch)).toBe(false)
    await expect(bridge('GET', '/status', undefined, limited as unknown as typeof fetch)).rejects.toMatchObject({ status: 429, code: 'rate_limited' })
  })
})
