import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DEFAULT_LIMITS, TRIAL } from '@/lib/plans'
import { trialMessage, useTrial, withinPlan, type PlanCtx } from '@/server/plans'

/** the database's counter, as api_plan_use keeps it */
function fakeDb() {
  const used = new Map<string, number>()
  const rpc = vi.fn(async (fn: string, a: { p_who: string; p_kind: string; p_period: string; p_limit: number; p_count: boolean }) => {
    expect(fn).toBe('api_plan_use')
    const key = `${a.p_who}|${a.p_period}|${a.p_kind}`
    const n = used.get(key) ?? 0
    if (a.p_limit >= 0 && n >= a.p_limit) return { data: { ok: false, used: n, limit: a.p_limit }, error: null }
    used.set(key, n + 1)
    return { data: { ok: true, used: n + 1, limit: a.p_limit }, error: null }
  })
  return { sb: { rpc } as unknown as PlanCtx['sb'], used, rpc }
}
const ctxOf = (sb: PlanCtx['sb'], plan: PlanCtx['plan'] = 'free', live = true): PlanCtx => ({ sb, who: 'u:1', plan, live, limits: DEFAULT_LIMITS })

describe('a free account tries everything twice', () => {
  beforeEach(() => vi.stubEnv('MAHLIYO_SERVER_SECRET', 'x'.repeat(64)))
  afterEach(() => vi.unstubAllEnvs())

  it('two conversations of ten messages each, for the whole life of the account', async () => {
    const { sb, used } = fakeDb()
    const ctx = ctxOf(sb)
    for (let i = 0; i < TRIAL.chatMessages; i++) expect(await trialMessage(ctx, 'chat-a')).toBeNull()
    expect(await trialMessage(ctx, 'chat-a')).toBe('chat_messages')
    expect(await trialMessage(ctx, 'chat-b')).toBeNull()
    // a third conversation: the plans
    expect(await trialMessage(ctx, 'chat-c')).toBe('chat')
    expect([...used.keys()].every((k) => k.includes('|life|'))).toBe(true)
  })

  it('files are its eight messages, a song played or a way shown its two things done; the rest a plan card', async () => {
    const { sb } = fakeDb()
    const ctx = ctxOf(sb)
    const file = { type: 'file' as const, name: 'a.pptx', title: 'a', about: '', content: '' }
    for (let i = 0; i < TRIAL.func; i++) expect(await withinPlan([file], ctx)).toEqual([file])
    expect((await withinPlan([file], ctx)).map((b) => b.type)).toEqual(['premium'])
    const play = { type: 'play' as const, query: 'Ватан', title: 'Ватан' }
    expect(await withinPlan([play], ctx)).toEqual([play])
    expect(await withinPlan([play], ctx)).toEqual([play])
    expect((await withinPlan([play], ctx)).map((b) => b.type)).toEqual(['premium'])
    // two songs made
    expect(await useTrial(ctx, 'gen')).toBe(true)
    expect(await useTrial(ctx, 'gen')).toBe(true)
    expect(await useTrial(ctx, 'gen')).toBe(false)
  })

  it('a plan, or the plans not on yet: no trial', async () => {
    const { sb, rpc } = fakeDb()
    expect(await trialMessage(ctxOf(sb, 'standard'), 'x')).toBeNull()
    expect(await trialMessage(ctxOf(sb, 'free', false), 'x')).toBeNull()
    expect(await useTrial(ctxOf(sb, 'premium'), 'gen')).toBe(true)
    expect(rpc).not.toHaveBeenCalled()
  })
})
