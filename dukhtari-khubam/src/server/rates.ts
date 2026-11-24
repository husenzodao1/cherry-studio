/**
 * What a somoni is worth in the currencies the app's learners live with, so the plans show their price in
 * hers (the price itself is in somoni). From a free daily rates service (open.er-api.com), kept for twelve
 * hours; when it does not answer, the last rates known here (or these, set by hand) are used.
 */

export const CURRENCIES = ['RUB', 'UZS', 'TRY', 'AFN', 'IRR', 'KZT', 'KGS', 'USD', 'EUR'] as const
export type Rates = Partial<Record<(typeof CURRENCIES)[number], number>>

/** somoni's worth in November 2026, the fallback */
export const FALLBACK_RATES: Rates = { RUB: 8.89, UZS: 1302.9, TRY: 5.49, AFN: 7.2, IRR: 209133, KZT: 49.19, KGS: 9.48, USD: 0.1084, EUR: 0.0989 }
const KEEP_MS = 12 * 3600_000

let kept: { at: number; rates: Rates } | null = null

export async function somoniRates(fetcher: typeof fetch = fetch, now = Date.now()): Promise<Rates> {
  if (kept && now - kept.at < KEEP_MS) return kept.rates
  try {
    const r = await fetcher('https://open.er-api.com/v6/latest/TJS', { signal: AbortSignal.timeout(4000) })
    const d = (await r.json()) as { result?: string; rates?: Record<string, number> }
    if (d.result !== 'success' || !d.rates) throw new Error('no rates')
    const rates: Rates = {}
    for (const c of CURRENCIES) if (Number.isFinite(d.rates[c]) && d.rates[c] > 0) rates[c] = d.rates[c]
    kept = { at: now, rates: { ...FALLBACK_RATES, ...rates } }
    return kept.rates
  } catch {
    return kept?.rates ?? FALLBACK_RATES
  }
}
export const forgetRates = () => { kept = null }
