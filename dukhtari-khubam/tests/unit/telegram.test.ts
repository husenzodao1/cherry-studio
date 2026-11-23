import type { SupabaseClient } from '@supabase/supabase-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ensureWebhook, forBot, handleMessage, pieces, SAY, webhookSecret, withoutMention, type TgMessage } from '@/server/telegram'

const BOT = 'MahliyoBot'
const msg = (text: string, o: Partial<TgMessage> = {}): TgMessage => ({ message_id: 9, text, chat: { id: 77, type: 'private' }, from: { id: 77, first_name: 'Малика', username: 'malika' }, ...o })

/** the database as the bot sees it: who writes, which chats are on */
function world(who: Record<string, unknown>) {
  const calls: { fn: string; args: Record<string, unknown> }[] = []
  const sb = { rpc: vi.fn(async (fn: string, args: Record<string, unknown>) => {
    calls.push({ fn, args })
    if (fn === 'api_tg_link') return { data: args.p_code === 'GoodCode1234' ? { linked: true, plan: 'premium' } : { linked: false }, error: null }
    if (fn === 'api_tg_who') return { data: { user: null, allowed: false, name: null, chat_owner: null, chat_allowed: false, turns: [], ...who }, error: null }
    return { data: null, error: null }
  }) } as unknown as SupabaseClient
  const sent: { method: string; body: Record<string, unknown> }[] = []
  const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
    sent.push({ method: url.split('/').pop()!, body: JSON.parse(String(init?.body)) })
    return new Response(JSON.stringify({ ok: true, result: {} }))
  }) as unknown as typeof fetch
  const texts = () => sent.filter((s) => s.method === 'sendMessage').map((s) => s.body.text)
  return { sb, calls, sent, fetcher, texts }
}

describe('Mahliyo in Telegram', () => {
  beforeEach(() => { vi.stubEnv('MAHLIYO_SERVER_SECRET', 'x'.repeat(64)); vi.stubEnv('TELEGRAM_BOT_TOKEN', '123:abc') })
  afterEach(() => vi.unstubAllEnvs())

  it('"/start <code>" links her Telegram (a spent or wrong code is told); "/start" alone says how to link', async () => {
    const w = world({})
    await handleMessage(w.sb, msg('/start GoodCode1234'), BOT, vi.fn(), w.fetcher)
    await handleMessage(w.sb, msg('/start BadCode99999'), BOT, vi.fn(), w.fetcher)
    await handleMessage(w.sb, msg('/start'), BOT, vi.fn(), w.fetcher)
    expect(w.texts()).toEqual([SAY.linked, SAY.badCode, SAY.hello])
    expect(w.calls.find((c) => c.fn === 'api_tg_link')!.args).toMatchObject({ p_tg_user: 77, p_tg_name: 'malika' })
  })

  it('a linked Premium learner is answered as in the app, with the chat kept; without Premium or a link, she is told how', async () => {
    const w = world({ user: 'u-1', allowed: true, name: 'Малика', turns: [{ role: 'user', content: 'Салом' }, { role: 'assistant', content: 'Салом, Малика!' }] })
    const ask = vi.fn(async () => ({ blocks: [{ type: 'text' as const, text: 'Фотосинтез — сохтани моддаҳо бо нури офтоб.' }] }))
    await handleMessage(w.sb, msg('Фотосинтез чист?'), BOT, ask, w.fetcher)
    expect(ask).toHaveBeenCalledWith([{ role: 'user', content: 'Салом' }, { role: 'assistant', content: 'Салом, Малика!' }, { role: 'user', content: 'Фотосинтез чист?' }], 'Малика')
    expect(w.sent.map((s) => s.method)).toEqual(['sendChatAction', 'sendMessage'])
    expect(w.texts()).toEqual(['Фотосинтез — сохтани моддаҳо бо нури офтоб.'])
    const kept = w.calls.find((c) => c.fn === 'api_tg_chat')!.args
    expect(kept).toMatchObject({ p_chat: 77, p_owner: 'u-1', p_group: false })
    expect((kept.p_turns as unknown[]).at(-1)).toEqual({ role: 'assistant', content: 'Фотосинтез — сохтани моддаҳо бо нури офтоб.' })

    const free = world({ user: 'u-2', allowed: false })
    await handleMessage(free.sb, msg('Салом'), BOT, ask, free.fetcher)
    expect(free.texts()).toEqual([SAY.premium])
    const stranger = world({})
    await handleMessage(stranger.sb, msg('Салом'), BOT, ask, stranger.fetcher)
    expect(stranger.texts()).toEqual([SAY.hello])
  })

  it('in a group: turned on by a linked Premium learner; answers only when named or answered, as a reply; "/off" by its owner', async () => {
    const group = { chat: { id: -100, type: 'supergroup' as const, title: 'Синфи 11' } }
    const owner = world({ user: 'u-1', allowed: true })
    await handleMessage(owner.sb, msg('/on', group), BOT, vi.fn(), owner.fetcher)
    expect(owner.texts()[0]).toContain('@MahliyoBot')
    expect(owner.calls.find((c) => c.fn === 'api_tg_chat')!.args).toMatchObject({ p_chat: -100, p_owner: 'u-1', p_group: true })

    const someone = world({ user: null, allowed: false })
    await handleMessage(someone.sb, msg('/on', group), BOT, vi.fn(), someone.fetcher)
    expect(someone.texts()).toEqual([SAY.groupNeedsOwner])

    const on = world({ user: null, chat_owner: 'u-1', chat_allowed: true })
    const ask = vi.fn(async () => ({ blocks: [{ type: 'text' as const, text: 'Ҷавоб' }] }))
    await handleMessage(on.sb, msg('Ҳамин тавр', { ...group, from: { id: 5, first_name: 'Зарина' } }), BOT, ask, on.fetcher)
    expect(ask).not.toHaveBeenCalled()
    await handleMessage(on.sb, msg('@MahliyoBot пойтахти Фаронса?', { ...group, from: { id: 5, first_name: 'Зарина' } }), BOT, ask, on.fetcher)
    expect(ask).toHaveBeenCalledWith([{ role: 'user', content: 'пойтахти Фаронса?' }], 'Зарина')
    expect(on.sent.find((s) => s.method === 'sendMessage')!.body).toMatchObject({ chat_id: -100, reply_to_message_id: 9 })
    // a command for another bot: not ours
    await handleMessage(on.sb, msg('/new@OtherBot', group), BOT, ask, on.fetcher)
    expect(on.texts()).toHaveLength(1)
  })

  it('the words: the bot\'s name taken out, a long answer in Telegram-sized pieces', () => {
    expect(withoutMention('@mahliyobot салом', BOT)).toBe('салом')
    expect(forBot(msg('салом', { chat: { id: 1, type: 'group' }, reply_to_message: { from: { id: 2, is_bot: true, username: 'MahliyoBot' } } }), BOT)).toBe(true)
    expect(forBot(msg('салом', { chat: { id: 1, type: 'group' } }), BOT)).toBe(false)
    const long = Array.from({ length: 300 }, (_, i) => `Сатри ${i} бо чанд калимаи дигар.`).join('\n')
    const p = pieces(long)
    expect(p.length).toBeGreaterThan(1)
    expect(p.every((x) => x.length <= 4000)).toBe(true)
    expect(p.join('\n')).toBe(long)
  })

  it("points the bot at the site's own address with its secret and commands, once, and not again when it is already there", async () => {
    const calls: { method: string; body: Record<string, unknown> }[] = []
    let url = ''
    const fetcher = (async (u: string, init?: RequestInit) => {
      const method = u.split('/').pop()!
      const body = JSON.parse(String(init?.body))
      calls.push({ method, body })
      if (method === 'setWebhook') url = body.url
      return new Response(JSON.stringify({ ok: true, result: method === 'getWebhookInfo' ? { url } : true }))
    }) as unknown as typeof fetch
    expect(await ensureWebhook('https://dukhtari-khubam.vercel.app/api/v1/telegram/webhook', fetcher)).toBe('https://dukhtari-khubam.vercel.app/api/v1/telegram/webhook')
    expect(calls.map((c) => c.method)).toEqual(['getWebhookInfo', 'setWebhook', 'setMyCommands'])
    expect(calls[1].body).toMatchObject({ secret_token: webhookSecret(), allowed_updates: ['message'] })
    // once per server instance
    await ensureWebhook('https://dukhtari-khubam.vercel.app/api/v1/telegram/webhook', fetcher)
    expect(calls).toHaveLength(3)
  })
})
