import { createHmac } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import { canOpen, DEFAULT_LIMITS, fileLimitKind, limitsFrom, periodOf } from '@/lib/plans'
import { grantFromEvent, paddleSigned } from '@/server/paddle'

describe('plans', () => {
  it('a plan opens its own tier and those below', () => {
    expect(canOpen('free', 'free')).toBe(true)
    expect(canOpen('free', 'standard')).toBe(false)
    expect(canOpen('standard', 'standard')).toBe(true)
    expect(canOpen('standard', 'premium')).toBe(false)
    expect(canOpen('premium', 'premium')).toBe(true)
  })
  it('limits: the staff\'s numbers over the defaults; anything else ignored', () => {
    const l = limitsFrom({ standard: { message: 50, slides: 'x', bogus: 3 }, premium: { music: -1 } })
    expect(l.standard.message).toBe(50)
    expect(l.standard.slides).toBe(DEFAULT_LIMITS.standard.slides)
    expect(l.premium.music).toBe(-1)
    expect(l.free).toEqual(DEFAULT_LIMITS.free)
  })
  it('counted by Tajikistan\'s day or month; files by their kind', () => {
    const late = new Date('2026-11-23T20:30:00Z') // 01:30 on the 24th in Dushanbe
    expect(periodOf('message', late)).toBe('d2026-11-24')
    expect(periodOf('slides', late)).toBe('m2026-11')
    expect(fileLimitKind('Тақдимот.pptx')).toBe('slides')
    expect(fileLimitKind('Иншо.pdf')).toBe('doc')
    expect(fileLimitKind('hisob.py')).toBe('file')
  })
})

describe('Paddle', () => {
  const secret = 'pdl_ntfset_test'
  const sign = (raw: string, ts = Math.floor(Date.now() / 1000)) => `ts=${ts};h1=${createHmac('sha256', secret).update(`${ts}:${raw}`).digest('hex')}`
  it('only a signed, fresh webhook is taken', () => {
    const raw = '{"event_type":"subscription.created"}'
    expect(paddleSigned(sign(raw), raw, secret)).toBe(true)
    expect(paddleSigned(sign(raw), raw + ' ', secret)).toBe(false)
    expect(paddleSigned(sign(raw, Math.floor(Date.now() / 1000) - 3600), raw, secret)).toBe(false)
    expect(paddleSigned(null, raw, secret)).toBe(false)
  })
  it('a subscription event grants its plan until the paid period ends; cancelled: ends now', () => {
    const user = '11111111-2222-3333-4444-555555555555'
    const ev = (status: string, type = 'subscription.updated') => ({
      event_type: type,
      data: { id: 'sub_1', status, custom_data: { user_id: user }, items: [{ price: { id: 'pri_prem' } }], current_billing_period: { starts_at: '2026-11-23T00:00:00Z', ends_at: '2026-12-23T00:00:00Z' } }
    })
    const prices = { standard: 'pri_std', premium: 'pri_prem' }
    expect(grantFromEvent(ev('active', 'subscription.created'), prices)).toMatchObject({ user, tier: 'premium', ends: '2026-12-23T00:00:00Z', autoRenew: true, created: true })
    const now = new Date('2026-11-30T00:00:00Z')
    expect(grantFromEvent(ev('canceled'), prices, now)).toMatchObject({ ends: now.toISOString(), autoRenew: false })
    expect(grantFromEvent({ event_type: 'transaction.completed', data: {} }, prices)).toBeNull()
    expect(grantFromEvent(ev('active'), { standard: 'x', premium: 'y' })).toBeNull()
  })
})
