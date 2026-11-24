/**
 * The WhatsApp bridge (whatsapp-bridge/, run on its own server): it writes from the owner's own WhatsApp number,
 * linked with a pairing code in the panel. This side only knows its address and the shared secret.
 *   WHATSAPP_BRIDGE_URL     https://wa.example.com
 *   WHATSAPP_BRIDGE_SECRET  the same long secret the bridge was started with (BRIDGE_SECRET)
 */

type Fetch = typeof fetch

export const bridgeReady = () => !!process.env.WHATSAPP_BRIDGE_URL?.trim() && (process.env.WHATSAPP_BRIDGE_SECRET?.trim().length ?? 0) >= 24

export class BridgeError extends Error {
  constructor(readonly status: number, readonly code: string) { super(code) }
}

/** One call to the bridge (8 seconds at most: an SOS must not wait on it). */
export async function bridge<T>(method: 'GET' | 'POST', path: string, body?: unknown, fetcher: Fetch = fetch): Promise<T> {
  if (!bridgeReady()) throw new BridgeError(503, 'not_configured')
  const base = process.env.WHATSAPP_BRIDGE_URL!.trim().replace(/\/+$/, '')
  let res: Response
  try {
    res = await fetcher(`${base}${path}`, {
      method,
      headers: { authorization: `Bearer ${process.env.WHATSAPP_BRIDGE_SECRET!.trim()}`, 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(path === '/pair' ? 20_000 : 8_000)
    })
  } catch {
    throw new BridgeError(503, 'unreachable')
  }
  const out = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) throw new BridgeError(res.status, out.error ?? 'failed')
  return out
}

/** Writes to one person; whether it went. */
export async function sendWhatsApp(to: string, text: string, place?: { lat: number; lng: number } | null, fetcher: Fetch = fetch): Promise<boolean> {
  try {
    await bridge('POST', '/send', { to, text, ...(place ? { lat: place.lat, lng: place.lng } : {}) }, fetcher)
    return true
  } catch {
    return false
  }
}

export type SosLang = 'tg' | 'ru' | 'en' | 'uz' | 'tr' | 'fa' | 'prs'
export type SosEvent = 'sos' | 'walk' | 'safe' | 'arrived' | 'late'

/** The messages her people get, in her language (Tajik when it is not known). */
const TEXTS: Record<'tg' | 'ru' | 'en' | 'uz' | 'tr' | 'fa', Record<SosEvent, string>> = {
  tg: {
    sos: '🆘 {name} ёрӣ мехоҳад! Ҷойи ӯ ҳозир дар харита (зинда навсозӣ мешавад):\n{link}\n\nБа ӯ занг занед. Агар ҷавоб надиҳад — ба 112 занг занед.',
    walk: '🚶‍♀️ {name} ба хона меравад ва бояд то {due} расад. Роҳашро зинда бинед:\n{link}',
    safe: '✅ {name} гуфт, ки ҳоло бехатар аст.',
    arrived: '🏠 {name} бехатар расид.',
    late: '⚠️ {name} то {due} нарасид ва ҷавоб намедиҳад. Ҷойи охиринаш:\n{link}\n\nБа ӯ занг занед.'
  },
  ru: {
    sos: '🆘 {name} просит помощи! Где она сейчас (карта обновляется):\n{link}\n\nПозвоните ей. Если не отвечает — звоните 112.',
    walk: '🚶‍♀️ {name} идёт домой и должна прийти к {due}. Её путь в реальном времени:\n{link}',
    safe: '✅ {name} сообщила, что сейчас в безопасности.',
    arrived: '🏠 {name} благополучно дошла.',
    late: '⚠️ {name} не пришла к {due} и не отвечает. Последнее место:\n{link}\n\nПозвоните ей.'
  },
  en: {
    sos: '🆘 {name} needs help! Where she is now (live map):\n{link}\n\nCall her. If she does not answer, call 112.',
    walk: '🚶‍♀️ {name} is walking home and should arrive by {due}. Follow her live:\n{link}',
    safe: '✅ {name} says she is safe now.',
    arrived: '🏠 {name} arrived safely.',
    late: '⚠️ {name} did not arrive by {due} and does not answer. Her last place:\n{link}\n\nCall her.'
  },
  uz: {
    sos: '🆘 {name} yordam so‘rayapti! Hozir qayerda (jonli xarita):\n{link}\n\nUnga qo‘ng‘iroq qiling. Javob bermasa — 112.',
    walk: '🚶‍♀️ {name} uyga ketyapti, {due} gacha yetishi kerak. Yo‘lini jonli kuzating:\n{link}',
    safe: '✅ {name} hozir xavfsizligini aytdi.',
    arrived: '🏠 {name} eson-omon yetib keldi.',
    late: '⚠️ {name} {due} gacha yetmadi va javob bermayapti. Oxirgi joyi:\n{link}\n\nUnga qo‘ng‘iroq qiling.'
  },
  tr: {
    sos: '🆘 {name} yardım istiyor! Şu an nerede (canlı harita):\n{link}\n\nOnu arayın. Açmazsa 112\'yi arayın.',
    walk: '🚶‍♀️ {name} eve yürüyor, {due} saatine kadar varmalı. Canlı izleyin:\n{link}',
    safe: '✅ {name} şu an güvende olduğunu söyledi.',
    arrived: '🏠 {name} güvenle vardı.',
    late: '⚠️ {name} {due} saatine kadar varmadı ve cevap vermiyor. Son konumu:\n{link}\n\nOnu arayın.'
  },
  fa: {
    sos: '🆘 {name} کمک می‌خواهد! جای او اکنون (نقشهٔ زنده):\n{link}\n\nبه او زنگ بزنید. اگر جواب نداد، با ۱۱۲ تماس بگیرید.',
    walk: '🚶‍♀️ {name} به خانه می‌رود و باید تا {due} برسد. راهش را زنده ببینید:\n{link}',
    safe: '✅ {name} گفت که اکنون در امان است.',
    arrived: '🏠 {name} به سلامت رسید.',
    late: '⚠️ {name} تا {due} نرسید و جواب نمی‌دهد. آخرین جای او:\n{link}\n\nبه او زنگ بزنید.'
  }
}

/** The time a walk is due, as her people read it (Dushanbe's clock by default). */
export function dueText(at: string | null | undefined, timeZone = 'Asia/Dushanbe'): string {
  if (!at) return ''
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone }).format(new Date(at))
}

export function sosText(event: SosEvent, lang: SosLang, v: { name: string; link?: string; due?: string }): string {
  const set = TEXTS[lang === 'prs' ? 'fa' : lang] ?? TEXTS.tg
  return set[event].replace('{name}', v.name || 'LifeHub').replace('{link}', v.link ?? '').replace('{due}', v.due ?? '')
}
