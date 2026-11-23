import { after } from 'next/server'

import { ApiError } from '@/lib/http'
import { route, type AnyRoute } from '@/lib/router'

import { botName, ensureWebhook, handleMessage, tgReady, webhookSecret, type TgMessage } from '../telegram'
import { call } from '../util'
import { answerTurns } from './mahliyo'

/** Mahliyo in Telegram (see ../telegram.ts): the bot's webhook, its setup from the panel, a learner's link. */

type Settings = Record<string, unknown>
/** the bot's name: asked of Telegram (kept per server instance) */
const botOf = async () => botName().catch(() => null)

export const telegramRoutes: AnyRoute[] = [
  route({
    method: 'POST', path: '/telegram/webhook', access: 'public', tag: 'Telegram', summary: "Telegram's updates for the bot (with its secret)",
    handler: async ({ sb, req }) => {
      if (!tgReady()) throw new ApiError(503, 'not_configured', 'The Telegram bot is not set up.')
      if (req.headers.get('x-telegram-bot-api-secret-token') !== webhookSecret()) throw new ApiError(403, 'forbidden', 'Bad secret.')
      const update = (await req.json().catch(() => null)) as { message?: TgMessage } | null
      const m = update?.message
      if (!m) return { ok: true }
      const client = sb()
      // Telegram is answered at once; Mahliyo writes in the chat when her answer is ready
      after(async () => {
        const bot = await botOf()
        if (!bot) return
        await handleMessage(client, m, bot, (turns, name) => answerTurns(client, turns, { premium: true, plan: 'premium', me: name ? `Name: ${name}` : undefined }))
          .catch((e: unknown) => console.error('[telegram] a message failed:', e instanceof Error ? e.message : String(e)))
      })
      return { ok: true }
    }
  }),
  route({
    method: 'POST', path: '/admin/telegram/setup', access: 'staff', tag: 'Admin · Telegram', summary: "Points the bot's webhook at this site",
    handler: async () => {
      if (!tgReady()) throw new ApiError(503, 'not_configured', 'Set TELEGRAM_BOT_TOKEN on the server first.')
      return { username: await botName(), webhook: await ensureWebhook() }
    }
  }),
  route({
    method: 'GET', path: '/telegram/status', access: 'public', tag: 'Telegram', summary: 'Whether the bot is set up (and pointed at this site), and its name',
    handler: async () => {
      if (!tgReady()) return { ready: false, bot: null, problem: process.env.TELEGRAM_BOT_TOKEN ? 'server_secret' : 'no_token' }
      let problem: string | null = null
      const webhook = await ensureWebhook().catch((e: unknown) => { problem = e instanceof Error ? e.message.slice(0, 200) : 'failed'; return null })
      return { ready: !!webhook, bot: await botOf(), problem }
    }
  }),
  route({
    method: 'GET', path: '/me/telegram', access: 'user', tag: 'Telegram', summary: 'Whether my Telegram is linked, and the bot',
    handler: async ({ sb }) => {
      await ensureWebhook().catch(() => null)
      return { ...(await call<Settings>(sb(), 'api_tg_status')), bot: await botOf(), ready: tgReady() }
    }
  }),
  route({
    method: 'POST', path: '/me/telegram/code', access: 'user', tag: 'Telegram', summary: "A one-time link to the bot that links my Telegram (15 minutes)",
    handler: async ({ sb }) => {
      const bot = await botOf()
      if (!bot || !tgReady()) throw new ApiError(503, 'not_configured', 'The Telegram bot is not set up yet.')
      const code = await call<string>(sb(), 'api_tg_code')
      return { code, link: `https://t.me/${bot}?start=${code}` }
    }
  }),
  route({
    method: 'POST', path: '/me/telegram/unlink', access: 'user', tag: 'Telegram', summary: 'My Telegram unlinked (the bot no longer answers there)',
    handler: async ({ sb }) => { await call(sb(), 'api_tg_unlink'); return { ok: true } }
  })
]
