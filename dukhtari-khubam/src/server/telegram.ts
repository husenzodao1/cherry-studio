import { createHash } from 'node:crypto'
import { setDefaultResultOrder } from 'node:dns'

import type { SupabaseClient } from '@supabase/supabase-js'

import { secret, serverReady } from './aiModels'
import { plainOf, type Turn } from './mahliyo'
import { call } from './util'

/**
 * Mahliyo in Telegram (Premium). The staff make a bot with @BotFather and set TELEGRAM_BOT_TOKEN; the panel
 * points the bot's webhook here. A learner links her Telegram from the app (a one-time code in the bot's
 * link: her account's e-mail is confirmed already). Then:
 * - in a private chat the bot answers her every message as Mahliyo does in the app;
 * - in a group, a linked Premium learner turns it on ("/on"); it answers there when it is named (@bot) or
 *   when its own message is answered, and "/off" turns it off;
 * - "/new" starts the conversation again.
 * A chat keeps its last 16 turns. The answers are plain text (Telegram's own formatting is not used).
 */

// Telegram's servers by their IPv4 address first: a serverless function without IPv6 waits on them otherwise
try { setDefaultResultOrder('ipv4first') } catch { /* an older runtime */ }

export const tgReady = () => !!process.env.TELEGRAM_BOT_TOKEN?.trim() && serverReady()

/** the secret Telegram sends with every update (made from the server's own secret: nothing more to set) */
export const webhookSecret = () => process.env.TELEGRAM_WEBHOOK_SECRET?.trim()
  // or one of the staff's own (TELEGRAM_WEBHOOK_SECRET), when they point the bot themselves
  || createHash('sha256').update(`telegram:${secret()}`).digest('hex').slice(0, 48)

type Fetch = typeof fetch
export async function tg<T = unknown>(method: string, body: unknown, fetcher: Fetch = fetch, again = true): Promise<T> {
  const began = Date.now()
  const res = await fetcher(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(30_000)
  })
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; result?: T; description?: string; parameters?: { retry_after?: number } }
  // "too many requests": once more after the wait Telegram names (when it is short)
  const wait = data.parameters?.retry_after
  if (!data.ok && again && wait !== undefined && wait <= 60) {
    await new Promise((r) => setTimeout(r, (wait + 1) * 1000))
    return tg<T>(method, body, fetcher, false)
  }
  if (!data.ok) throw new Error(`telegram ${method}: ${data.description ?? res.status} (${Date.now() - began} ms)`)
  return data.result as T
}

/** the bot's name (@…), asked of Telegram once per server instance */
let botKnown: string | null = null
export async function botName(fetcher: Fetch = fetch): Promise<string | null> {
  if (!tgReady()) return null
  botKnown ??= (await tg<{ username: string }>('getMe', {}, fetcher)).username
  return botKnown
}

/** where Telegram sends the bot's updates: this site's own address (never one taken from a request) */
export const webhookUrl = () => {
  const site = process.env.SITE_HOST ?? process.env.VERCEL_PROJECT_PRODUCTION_URL
  return site ? `https://${site.replace(/^https?:\/\//, '')}/api/v1/telegram/webhook` : null
}

/**
 * The bot pointed at this site (once per server instance, only when it is not already): its webhook with the
 * secret, and its commands. Returns the webhook's address.
 */
let pointed = false
/** after a failure, Telegram is left alone for ten minutes (asking again and again only makes its limits worse) */
let failedAt = 0
export async function ensureWebhook(url = webhookUrl(), fetcher: Fetch = fetch): Promise<string | null> {
  if (!tgReady() || !url) return null
  if (pointed) return url
  if (Date.now() - failedAt < 600_000) throw new Error('telegram: waiting after the last failure')
  try {
    await pointNow(url, fetcher)
  } catch (e) {
    failedAt = Date.now()
    console.warn('[telegram] the bot could not be pointed at the site:', e instanceof Error ? e.message : String(e))
    throw e
  }
  pointed = true
  return url
}
async function pointNow(url: string, fetcher: Fetch) {
  // setting it again is harmless: no question asked first (one request less for Telegram's limits)
  await tg('setWebhook', { url, secret_token: webhookSecret(), allowed_updates: ['message'] }, fetcher)
  await tg('setMyCommands', { commands: [
    { command: 'new', description: 'Суҳбати нав / Новый разговор' },
    { command: 'on', description: 'Фаъол дар гурӯҳ / Включить в группе' },
    { command: 'off', description: 'Хомӯш дар гурӯҳ / Выключить в группе' }
  ] }, fetcher).catch(() => undefined)
}

/** a reply in pieces of at most 4000 characters (Telegram's limit is 4096), cut at a line where it can */
export function pieces(text: string, size = 4000): string[] {
  const out: string[] = []
  let rest = text.trim()
  while (rest.length > size) {
    const cut = Math.max(rest.lastIndexOf('\n', size), rest.lastIndexOf('. ', size))
    const at = cut > size / 2 ? cut + 1 : size
    out.push(rest.slice(0, at).trim())
    rest = rest.slice(at).trim()
  }
  if (rest) out.push(rest)
  return out
}

export interface TgMessage {
  message_id: number
  text?: string
  chat: { id: number; type: 'private' | 'group' | 'supergroup' | 'channel'; title?: string }
  from?: { id: number; is_bot?: boolean; first_name?: string; username?: string }
  reply_to_message?: { from?: { id: number; is_bot?: boolean; username?: string } }
  entities?: { type: string; offset: number; length: number }[]
}
interface Who { user: string | null; allowed: boolean; name: string | null; chat_owner: string | null; chat_allowed: boolean; turns: Turn[] }

/** what the bot says itself, in Tajik and Russian (Telegram users write in either) */
export const SAY = {
  hello: 'Салом! Ман Маҳлиё 🌸 Барои пайваст шудан барномаи LifeHub-ро кушоед → Танзимот → «Маҳлиё дар Telegram» → «Пайваст кардан».\n\nПривет! Я Махлиё 🌸 Чтобы подключиться, откройте LifeHub → Настройки → «Махлиё в Telegram» → «Подключить».',
  linked: 'Тайёр! Telegram ба ҳисоби шумо пайваст шуд ✅ Акнун ҳар саволро ин ҷо нависед.\n\nГотово! Telegram подключён к вашему аккаунту ✅ Пишите любой вопрос здесь.',
  badCode: 'Ин код кӯҳна шудааст ё нодуруст аст. Дар барнома тугмаи «Пайваст кардан»-ро аз нав пахш кунед.\n\nКод устарел или неверен. Нажмите «Подключить» в приложении ещё раз.',
  premium: 'Маҳлиё дар Telegram танҳо бо Premium 👑 кор мекунад. Онро дар барнома фаъол кунед.\n\nМахлиё в Telegram работает только с Premium 👑. Подключите его в приложении.',
  groupOn: 'Маҳлиё дар ин гурӯҳ фаъол шуд 🌸 Маро номбар кунед (@{bot}) ё ба паёмам ҷавоб диҳед.\n\nМахлиё включена в этой группе 🌸 Упомяните меня (@{bot}) или ответьте на моё сообщение.',
  groupOff: 'Маҳлиё дар ин гурӯҳ хомӯш шуд.\n\nМахлиё выключена в этой группе.',
  groupNeedsOwner: 'Маро дар гурӯҳ танҳо корбари пайвастшудаи Premium бо /on фаъол карда метавонад.\n\nВключить меня в группе может только подключённый пользователь Premium командой /on.',
  fresh: 'Суҳбати нав 🌱\n\nНовый разговор 🌱',
  busy: 'Ҳоло ҷавоб дода наметавонам — каме баъд аз нав нависед 🙏\n\nСейчас не могу ответить — напишите чуть позже 🙏'
}

/** her words without the bot's name (in a group she writes "@bot …") */
export function withoutMention(text: string, bot: string): string {
  return text.replace(new RegExp(`@${bot}\\b`, 'ig'), '').trim()
}

/** whether a group message is for the bot: it is named, or its own message is answered */
export function forBot(m: TgMessage, bot: string): boolean {
  if (m.chat.type === 'private') return true
  if (m.reply_to_message?.from?.username?.toLowerCase() === bot.toLowerCase()) return true
  return new RegExp(`@${bot}\\b`, 'i').test(m.text ?? '')
}

export type Answerer = (turns: Turn[], name: string | null) => Promise<{ blocks: Parameters<typeof plainOf>[0] }>

/** One message to the bot: a command, or a question for Mahliyo answered in the same chat. */
export async function handleMessage(sb: SupabaseClient, m: TgMessage, bot: string, ask: Answerer, fetcher: Fetch = fetch): Promise<void> {
  const text = (m.text ?? '').trim()
  if (!text || !m.from || m.from.is_bot) return
  const chat = m.chat.id
  const group = m.chat.type !== 'private'
  const send = async (words: string) => { for (const p of pieces(words)) await tg('sendMessage', { chat_id: chat, text: p, reply_to_message_id: group ? m.message_id : undefined }, fetcher) }
  const command = /^\/(\w+)(?:@(\w+))?(?:\s+(.*))?$/s.exec(text)
  // a command for another bot in a group: not ours
  if (command?.[2] && command[2].toLowerCase() !== bot.toLowerCase()) return

  if (command?.[1] === 'start' && !group) {
    const code = command[3]?.trim()
    if (!code) return send(SAY.hello)
    const r = await call<{ linked: boolean; plan?: string }>(sb, 'api_tg_link', { p_proof: secret(), p_code: code.slice(0, 40), p_tg_user: m.from.id, p_tg_name: m.from.username ?? m.from.first_name ?? '' })
    return send(r.linked ? SAY.linked : SAY.badCode)
  }

  const who = await call<Who>(sb, 'api_tg_who', { p_proof: secret(), p_tg_user: m.from.id, p_chat: chat })
  if (command?.[1] === 'on' && group) {
    if (!who.allowed || !who.user) return send(SAY.groupNeedsOwner)
    await call(sb, 'api_tg_chat', { p_proof: secret(), p_chat: chat, p_owner: who.user, p_group: true, p_turns: [] })
    return send(SAY.groupOn.replaceAll('{bot}', bot))
  }
  if (command?.[1] === 'off' && group) {
    if (!who.user || who.user !== who.chat_owner) return
    await call(sb, 'api_tg_chat_off', { p_proof: secret(), p_chat: chat })
    return send(SAY.groupOff)
  }
  if (command?.[1] === 'new') {
    await call(sb, 'api_tg_chat', { p_proof: secret(), p_chat: chat, p_owner: group ? who.chat_owner : who.user, p_group: group, p_turns: [] })
    return send(SAY.fresh)
  }

  // a question: in a private chat from a linked Premium learner; in a group the bot was turned on in, when it is named
  if (group ? !who.chat_allowed || !forBot(m, bot) : !who.allowed) {
    if (!group) await send(who.user ? SAY.premium : SAY.hello)
    return
  }
  const question = withoutMention(command ? text.replace(/^\/\w+(@\w+)?\s*/, '') : text, bot).slice(0, 4000)
  if (!question) return
  await tg('sendChatAction', { chat_id: chat, action: 'typing' }, fetcher).catch(() => undefined)
  const turns: Turn[] = [...who.turns, { role: 'user', content: question }]
  let reply: string
  try {
    const a = await ask(turns, group ? m.from.first_name ?? null : who.name)
    reply = plainOf(a.blocks).trim() || SAY.busy
  } catch {
    reply = SAY.busy
  }
  await send(reply)
  if (reply !== SAY.busy) {
    await call(sb, 'api_tg_chat', { p_proof: secret(), p_chat: chat, p_owner: group ? who.chat_owner : who.user, p_group: group,
      p_turns: [...turns, { role: 'assistant', content: reply.slice(0, 6000) }] })
  }
}
