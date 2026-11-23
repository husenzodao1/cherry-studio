/**
 * The plans on the server: a learner's plan (by her sign-in), the staff's settings (whether the plans are on,
 * their limits), and what Mahliyo does counted against her plan's limits. A learner without an account is on
 * the free plan, counted by her phone.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

import type { AiBlock as Block } from '@/lib/aiCatalog'
import { ApiError } from '@/lib/http'
import { fileLimitKind, limitsFrom, periodOf, type LimitKind, type Limits, type Plan } from '@/lib/plans'
import { supabaseFor, tokenSubject } from '@/lib/supabase'

import { secret, serverReady } from './aiModels'
import { call } from './util'

/** her plan by her sign-in; no sign-in, or it cannot be read: free */
export async function planOf(session: string | undefined): Promise<Plan> {
  if (!session) return 'free'
  try {
    const r = await call<{ plan?: Plan; premium?: boolean }>(supabaseFor(session), 'api_my_plan')
    return r.plan ?? (r.premium ? 'premium' : 'free')
  } catch {
    return 'free'
  }
}

/** the staff's plan settings, read again at most every minute */
let kept: { at: number; live: boolean; limits: Record<Plan, Limits> } | null = null
export async function planSettings(sb: SupabaseClient): Promise<{ live: boolean; limits: Record<Plan, Limits> }> {
  if (kept && Date.now() - kept.at < 60_000) return kept
  const s = await call<Record<string, unknown>>(sb, 'api_app_settings').catch(() => ({} as Record<string, unknown>))
  kept = { at: Date.now(), live: s.plans_live === true || process.env.PREMIUM_LIVE === '1', limits: limitsFrom(s.plan_limits) }
  return kept
}
export const forgetPlanSettings = () => { kept = null }

/** who is counted: her account, else her phone */
export const whoOf = (session: string | undefined, tokenHash: string) => {
  const user = session ? tokenSubject(session) : null
  return user ? `u:${user}` : `t:${tokenHash.slice(0, 40)}`
}

export interface PlanCtx { sb: SupabaseClient; who: string; plan: Plan; live: boolean; limits: Record<Plan, Limits> }

/** one use counted against her plan; false when the plan's limit is reached (or the plan has none of it) */
export async function use(ctx: PlanCtx, kind: LimitKind): Promise<boolean> {
  if (!ctx.live) return true
  const limit = ctx.limits[ctx.plan][kind]
  if (limit === 0) return false
  // without the server's secret nothing can be counted: nothing is held back
  if (!serverReady()) return true
  try {
    const r = await call<{ ok: boolean }>(ctx.sb, 'api_plan_use', { p_proof: secret(), p_who: ctx.who, p_kind: kind, p_period: periodOf(kind), p_limit: limit, p_count: true })
    return r.ok
  } catch (e) {
    console.warn('[plans] count failed', e instanceof Error ? e.message : String(e))
    return true
  }
}

/** the answer when a limit is reached: the app opens the plans' screen */
export const limitReached = (kind: LimitKind, plan: Plan) =>
  new ApiError(402, 'plan_limit', 'Маҳдудияти нақшаи шумо ба охир расид.', { kind, plan })

/** the skills counted by their own limit */
export const MODE_LIMIT: Partial<Record<string, LimitKind>> = { lawyer: 'lawyer', mmt: 'mmt', exam: 'exam', music: 'music' }

/**
 * Her answer within the plan: each file, test and song she made is counted; one over the limit is taken out
 * and the plan card says what more a plan gives.
 */
export async function withinPlan(blocks: Block[], ctx: PlanCtx): Promise<Block[]> {
  if (!ctx.live) return blocks
  const out: Block[] = []
  let held: LimitKind | null = null
  for (const b of blocks) {
    const kind: LimitKind | null = b.type === 'file' ? fileLimitKind(b.name) : b.type === 'quiz' ? 'quiz' : b.type === 'music' ? 'music' : null
    if (kind && !(await use(ctx, kind))) { held ??= kind; continue }
    out.push(b)
  }
  if (held && !out.some((b) => b.type === 'premium')) out.push({ type: 'premium', title: 'LifeHub Premium', text: held })
  return out
}
