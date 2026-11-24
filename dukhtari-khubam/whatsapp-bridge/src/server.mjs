import { createServer } from 'node:http'
import { rm } from 'node:fs/promises'

import makeWASocket, { Browsers, DisconnectReason, fetchLatestBaileysVersion, useMultiFileAuthState } from '@whiskeysockets/baileys'
import pino from 'pino'

import { authorized, cleanText, digitsOf, makeLimits, maySend } from './limits.mjs'

/**
 * LifeHub's WhatsApp bridge: the app's server asks it to send SOS messages, and it sends them from the owner's
 * own WhatsApp number, linked like WhatsApp Web with an 8-character pairing code (WhatsApp → Linked devices →
 * Link with phone number). Only the app's server can call it (BRIDGE_SECRET). The link is kept in AUTH_DIR,
 * which must live on a volume so a restart does not unlink the number.
 *
 *   GET  /status          → { state, number }
 *   POST /pair  {phone}   → { code }   the code to type on the owner's phone
 *   POST /send  {to, text, lat?, lng?} → { sent: true } | 4xx
 *   POST /logout          → unlinks the number
 */

const PORT = Number(process.env.PORT ?? 8080)
const SECRET = process.env.BRIDGE_SECRET ?? ''
const AUTH_DIR = process.env.AUTH_DIR ?? './auth'
const log = pino({ level: process.env.LOG_LEVEL ?? 'info' })

if (SECRET.length < 24) {
  log.fatal('BRIDGE_SECRET must be at least 24 characters')
  process.exit(1)
}

const limits = makeLimits()
/** 'off' (not linked) | 'connecting' | 'pairing' (a code waits to be typed) | 'open' (linked and online) */
let state = 'off'
let sock = null
let starting = null
let retries = 0

async function start() {
  if (starting) return starting
  starting = (async () => {
    const { state: auth, saveCreds } = await useMultiFileAuthState(AUTH_DIR)
    const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: undefined }))
    state = 'connecting'
    const s = makeWASocket({
      auth, version, logger: log.child({ module: 'baileys' }, { level: 'warn' }),
      browser: Browsers.ubuntu('Chrome'), markOnlineOnConnect: false, syncFullHistory: false
    })
    sock = s
    s.ev.on('creds.update', saveCreds)
    s.ev.on('connection.update', ({ connection, lastDisconnect }) => {
      if (connection === 'open') {
        state = 'open'
        retries = 0
        log.info({ number: s.user?.id?.split(':')[0] }, 'linked')
      }
      if (connection === 'close') {
        const code = lastDisconnect?.error?.output?.statusCode
        sock = null
        if (code === DisconnectReason.loggedOut) {
          state = 'off'
          log.warn('the number was unlinked on the phone')
          void rm(AUTH_DIR, { recursive: true, force: true })
          return
        }
        state = 'connecting'
        const wait = Math.min(60_000, 2_000 * 2 ** retries++)
        log.warn({ code, wait }, 'connection closed, linking again')
        setTimeout(() => { void start() }, wait)
      }
    })
    return s
  })().finally(() => { starting = null })
  return starting
}

const linked = () => !!sock?.authState?.creds?.registered

async function pair(phone) {
  const number = digitsOf(phone)
  if (!number) return [400, { error: 'bad_phone' }]
  if (state === 'open' && linked()) return [409, { error: 'already_linked' }]
  // a fresh link: anything half-done before is forgotten
  try { sock?.end(undefined) } catch { /* already closed */ }
  sock = null
  await rm(AUTH_DIR, { recursive: true, force: true })
  const s = await start()
  // the socket must reach WhatsApp before it can ask for a code
  await new Promise((ok) => setTimeout(ok, 2500))
  const code = await s.requestPairingCode(number)
  state = 'pairing'
  log.info('pairing code issued')
  return [200, { code: code.match(/.{1,4}/g).join('-') }]
}

async function send({ to, text, lat, lng }) {
  const number = digitsOf(to)
  const body = cleanText(text)
  if (!number || !body) return [400, { error: 'bad_message' }]
  if (state !== 'open' || !sock) return [503, { error: 'not_linked' }]
  const why = maySend(limits, number)
  if (why) return [429, { error: 'rate_limited', why }]
  const [found] = await sock.onWhatsApp(number)
  if (!found?.exists) return [404, { error: 'no_whatsapp' }]
  await sock.sendMessage(found.jid, { text: body })
  if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
    await sock.sendMessage(found.jid, { location: { degreesLatitude: lat, degreesLongitude: lng } })
  }
  return [200, { sent: true }]
}

async function logout() {
  try { await sock?.logout() } catch { /* not linked */ }
  sock = null
  state = 'off'
  await rm(AUTH_DIR, { recursive: true, force: true })
  return [200, { state }]
}

async function readJson(req) {
  let size = 0
  const parts = []
  for await (const chunk of req) {
    size += chunk.length
    if (size > 16_000) throw Object.assign(new Error('too_big'), { status: 413 })
    parts.push(chunk)
  }
  return parts.length ? JSON.parse(Buffer.concat(parts).toString('utf8')) : {}
}

const server = createServer(async (req, res) => {
  const reply = (status, body) => {
    res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' })
    res.end(JSON.stringify(body))
  }
  if (req.url === '/health') return reply(200, { ok: true })
  if (!authorized(req.headers.authorization, SECRET)) return reply(401, { error: 'unauthorized' })
  try {
    if (req.method === 'GET' && req.url === '/status') return reply(200, { state, number: state === 'open' ? sock?.user?.id?.split(':')[0] ?? null : null })
    if (req.method !== 'POST') return reply(404, { error: 'not_found' })
    const body = await readJson(req)
    const [status, out] = req.url === '/pair' ? await pair(body.phone)
      : req.url === '/send' ? await send(body)
      : req.url === '/logout' ? await logout()
      : [404, { error: 'not_found' }]
    return reply(status, out)
  } catch (e) {
    log.error({ err: e?.message }, 'request failed')
    return reply(e?.status ?? 500, { error: e?.status === 413 ? 'too_big' : 'failed' })
  }
})

server.listen(PORT, () => log.info({ port: PORT }, 'bridge listening'))
// a number linked before: back online at once
void import('node:fs').then(({ existsSync }) => { if (existsSync(`${AUTH_DIR}/creds.json`)) void start() })
