/**
 * The plans on the server: a learner's plan (by her sign-in), the staff's settings (whether the plans are on,
 * their limits), and what Mahliyo does counted against her plan's limits. A learner without an account is on
 * the free plan, counted by her phone.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

import type { AiBlock as Block } from '@/lib/aiCatalog'
import { ApiError } from '@/lib/http'
import { fileLimitKind, LIFE, limitsFrom, periodOf, TRIAL, type LimitKind, type Limits, type Plan, type TrialKind } from '@/lib/plans'
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

/** a free account on the trial: everything twice in all (while the plans are on) */
export const onTrial = (ctx: PlanCtx) => ctx.live && ctx.plan === 'free'

async function count(ctx: PlanCtx, kind: string, limit: number): Promise<{ ok: boolean; used: number }> {
  if (!serverReady()) return { ok: true, used: 0 }
  try {
    const r = await call<{ ok: boolean; used: number }>(ctx.sb, 'api_plan_use', { p_proof: secret(), p_who: ctx.who, p_kind: kind, p_period: LIFE, p_limit: limit, p_count: true })
    return { ok: r.ok, used: r.used }
  } catch (e) {
    console.warn('[plans] trial count failed', e instanceof Error ? e.message : String(e))
    return { ok: true, used: 0 }
  }
}

/** one use of the trial (true for everyone not on it) */
export async function useTrial(ctx: PlanCtx, kind: TrialKind): Promise<boolean> {
  if (!onTrial(ctx)) return true
  return (await count(ctx, `trial:${kind}`, TRIAL[kind])).ok
}

/**
 * A message in a conversation on the trial: at most ten in one, and a new conversation is one of the two.
 * Returns the limit reached, or null. Without the conversation's id (an older app) each message counts alone.
 */
export async function trialMessage(ctx: PlanCtx, chat: string | undefined): Promise<'chat' | 'chat_messages' | null> {
  if (!onTrial(ctx)) return null
  if (!chat) return (await useTrial(ctx, 'chat')) ? null : 'chat'
  const inChat = await count(ctx, `trial:c:${chat.slice(0, 64)}`, TRIAL.chatMessages)
  if (!inChat.ok) return 'chat_messages'
  // its first message: a new conversation
  if (inChat.used === 1 && !(await useTrial(ctx, 'chat'))) return 'chat'
  return null
}

/**
 * One two-minute part of a live voice conversation, counted against her month's minutes (Standard 30,
 * Premium 90 by default); { ok, left } in minutes. The plans not on yet: no count.
 */
export async function useLiveChunk(ctx: PlanCtx, chunkMinutes = 2): Promise<{ ok: boolean; left: number }> {
  if (!ctx.live) return { ok: true, left: -1 }
  const minutes = ctx.limits[ctx.plan].live
  if (minutes === 0) return { ok: false, left: 0 }
  if (minutes < 0 || !serverReady()) return { ok: true, left: -1 }
  const chunks = Math.floor(minutes / chunkMinutes)
  try {
    const r = await call<{ ok: boolean; used: number }>(ctx.sb, 'api_plan_use', { p_proof: secret(), p_who: ctx.who, p_kind: 'live', p_period: periodOf('live'), p_limit: chunks, p_count: true })
    return { ok: r.ok, left: Math.max(0, (chunks - r.used) * chunkMinutes) }
  } catch (e) {
    console.warn('[plans] live count failed', e instanceof Error ? e.message : String(e))
    return { ok: true, left: -1 }
  }
}

/** the answer when a limit is reached: the app opens the plans' screen */
export const limitReached = (kind: LimitKind | TrialKind | 'chat_messages', plan: Plan) =>
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
  let held: LimitKind | TrialKind | null = null
  for (const b of blocks) {
    // the trial: files are its eight "functional" messages, a song played or a way shown its two things done
    if (onTrial(ctx)) {
      // (a song is counted when it is made: /mahliyo/music)
      if (b.type === 'music') { out.push(b); continue }
      const trial: TrialKind | null = b.type === 'file' ? 'func' : b.type === 'play' || b.type === 'navigate' ? 'action' : null
      if (trial) {
        if (!(await useTrial(ctx, trial))) { held ??= trial; continue }
        out.push(b)
        continue
      }
    }
    const kind: LimitKind | null = b.type === 'file' ? fileLimitKind(b.name) : b.type === 'quiz' ? 'quiz' : b.type === 'music' ? 'music' : null
    if (kind && !(await use(ctx, kind))) { held ??= kind; continue }
    out.push(b)
  }
  if (held && !out.some((b) => b.type === 'premium')) out.push({ type: 'premium', title: 'LifeHub Premium', text: held })
  return out
}
