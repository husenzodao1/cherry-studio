'use client'

import dynamic from 'next/dynamic'
import { usePathname } from 'next/navigation'
import { createPortal } from 'react-dom'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

import { canOpen, DEFAULT_LIMITS, GIFT_DAYS, planRank, PRICES, type Limits, type Plan } from '@/lib/plans'

import { api } from './api'
import { useAuth } from './auth'
import { onBack } from './components/BackButton'
import { apiUrl } from './offline/base'

/**
 * The learner's plan in the app: which plan (her account's; a learner without an account is free), the plans'
 * prices and limits, how to pay, and the way to the plans' screen. Kept on the phone, so it is known at once
 * and without the internet.
 */

export interface PlansInfo {
  live: boolean
  prices: typeof PRICES
  gift_days: number
  limits: Record<Plan, Limits>
  consultant: boolean
  paddle: { token: string; sandbox: boolean; standard: string; premium: string; standard_discount: string | null } | null
}
export interface MyPlan {
  plan: Plan; staff?: boolean; ends_at?: string | null; forever?: boolean; source?: string | null; auto_renew?: boolean | null
  standard_since?: string | null; week_taken?: boolean; gifts?: { code: string; days: number; redeemed: boolean }[]
}
interface PlanApi {
  plan: Plan
  me: MyPlan | null
  info: PlansInfo
  /** whether the plans hold anything back now (the panel's switch) */
  live: boolean
  /** her account (a learner with only a code cannot buy) */
  signedIn: boolean
  canOpen: (tier: string | null | undefined) => boolean
  reload: () => Promise<void>
  /** the plans' screen, saying why it opened */
  open: (from?: string) => void
}

const FALLBACK: PlansInfo = { live: false, prices: PRICES, gift_days: GIFT_DAYS, limits: DEFAULT_LIMITS, consultant: true, paddle: null }
const KEY = 'dk.plan'
const read = <T,>(k: string): T | null => { try { return JSON.parse(localStorage.getItem(k) ?? 'null') as T } catch { return null } }
const write = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* not kept */ } }

/** the plans' screen over the screen she is on (loaded only when it opens) */
const PlansScreen = dynamic(() => import('./components/PlansScreen').then((m) => m.PlansScreen), { ssr: false })

const PlanContext = createContext<PlanApi>({
  plan: 'free', me: null, info: FALLBACK, live: false, signedIn: false, canOpen: () => true, reload: async () => undefined, open: () => undefined
})

export function PlanProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const [over, setOver] = useState<string | null>(null)
  const path = usePathname()
  // another screen: it closes; the phone's back button closes it too
  useEffect(() => setOver(null), [path])
  useEffect(() => (over ? onBack(() => setOver(null)) : undefined), [over])
  const [info, setInfo] = useState<PlansInfo>(FALLBACK)
  const [me, setMe] = useState<MyPlan | null>(null)

  useEffect(() => {
    const kept = read<{ info: PlansInfo; me: MyPlan | null }>(KEY)
    if (kept?.info) setInfo({ ...FALLBACK, ...kept.info })
    if (kept?.me) setMe(kept.me)
  }, [])
  const reload = useCallback(async () => {
    const plans = await fetch(apiUrl('/plans')).then((r) => (r.ok ? r.json() as Promise<PlansInfo> : null)).catch(() => null)
    const mine = session ? await api<MyPlan>('/me/plan').catch(() => null) : null
    const kept = read<{ info: PlansInfo; me: MyPlan | null }>(KEY)
    const nextInfo = plans ? { ...FALLBACK, ...plans } : kept?.info ?? FALLBACK
    const nextMe = session ? mine ?? kept?.me ?? null : null
    setInfo(nextInfo)
    setMe(nextMe)
    write(KEY, { info: nextInfo, me: nextMe })
  }, [session])
  useEffect(() => {
    void reload()
    const back = () => { if (!document.hidden) void reload() }
    document.addEventListener('visibilitychange', back)
    return () => document.removeEventListener('visibilitychange', back)
  }, [reload])

  const plan: Plan = me?.plan ?? 'free'
  const value = useMemo<PlanApi>(() => ({
    plan, me, info, live: info.live, signedIn: !!session,
    // before the plans are on, nothing is locked
    canOpen: (tier) => !info.live || canOpen(plan, tier),
    reload,
    open: (from) => setOver(from ?? 'app')
  }), [plan, me, info, session, reload])
  return (
    <PlanContext.Provider value={value}>
      {children}
      {over && typeof document !== 'undefined' ? createPortal(
        <div className="pw-over" role="dialog" aria-modal="true"><PlansScreen onClose={() => setOver(null)} /></div>, document.body) : null}
    </PlanContext.Provider>
  )
}

export const usePlan = () => useContext(PlanContext)

/** shown once each time the app is opened */
let nudged = false
/**
 * On a free plan, while the plans are on: the plans' screen once each time the app is opened (on the home
 * screen, a moment after it shows, never over the permissions' question, the sign-in or Mahliyo's call), and
 * after each test.
 */
export function PlanNudge() {
  const { live, plan, me, open } = usePlan()
  const path = usePathname() ?? '/'
  useEffect(() => {
    if (nudged || !live || plan !== 'free' || me?.staff || path !== '/') return
    const timer = setTimeout(function tryNow() {
      if (document.querySelector('.perm, .night, .lock-screen, .call, #splash:not([hidden])') || document.documentElement.classList.contains('locked')) return void setTimeout(tryNow, 4000)
      nudged = true
      open('open')
    }, 3500)
    return () => clearTimeout(timer)
  }, [live, plan, me, path, open])
  return null
}
export { planRank }
