import { beforeEach, describe, expect, it, vi } from 'vitest'

import { FALLBACK_RATES, forgetRates, somoniRates } from '@/server/rates'

describe("a somoni in her currency", () => {
  beforeEach(() => forgetRates())

  it('takes the day\'s rates and keeps them for twelve hours', async () => {
    const get = vi.fn(async () => new Response(JSON.stringify({ result: 'success', rates: { RUB: 9.1, UZS: 1300, XXX: 5 } })))
    const r = await somoniRates(get as unknown as typeof fetch, 1_000)
    expect(r.RUB).toBe(9.1)
    expect(r.USD).toBe(FALLBACK_RATES.USD)
    expect(r).not.toHaveProperty('XXX')
    await somoniRates(get as unknown as typeof fetch, 2_000)
    expect(get).toHaveBeenCalledTimes(1)
  })

  it('the service silent: the rates set by hand', async () => {
    const get = vi.fn(async () => { throw new Error('offline') })
    expect(await somoniRates(get as unknown as typeof fetch)).toEqual(FALLBACK_RATES)
  })
})
