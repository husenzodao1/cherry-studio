/**
 * "Эй Маҳлиё": what she said, turned into what to do. The phone's Tajik speech model writes numbers as words
 * ("бисту панҷ дақиқа"), so they are read here too, in Tajik, Russian and English. What is not one of the
 * phone's own tasks goes to Mahliyo as a question.
 */

export type VoiceCommand =
  | { kind: 'time' }
  | { kind: 'date' }
  | { kind: 'timer'; seconds: number }
  | { kind: 'stopwatch' }
  | { kind: 'weather'; when: 'now' | 'tomorrow' }
  | { kind: 'call'; name: string; number?: string }
  | { kind: 'navigate'; place: string }
  | { kind: 'ask'; text: string }

const UNITS: Record<string, number> = {
  // Tajik
  сифр: 0, як: 1, ду: 2, се: 3, чор: 4, чаҳор: 4, панҷ: 5, шаш: 6, ҳафт: 7, ҳашт: 8, нӯҳ: 9, нух: 9, даҳ: 10, ёздаҳ: 11, дувоздаҳ: 12, сенздаҳ: 13,
  чордаҳ: 14, понздаҳ: 15, шонздаҳ: 16, ҳабдаҳ: 17, ҳаждаҳ: 18, нуздаҳ: 19, бист: 20, сӣ: 30, чил: 40, панҷоҳ: 50, шаст: 60, ҳафтод: 70, ҳаштод: 80, навад: 90, сад: 100,
  // Russian
  ноль: 0, один: 1, одну: 1, одна: 1, два: 2, две: 2, три: 3, четыре: 4, пять: 5, шесть: 6, семь: 7, восемь: 8, девять: 9, десять: 10, одиннадцать: 11,
  двенадцать: 12, тринадцать: 13, четырнадцать: 14, пятнадцать: 15, шестнадцать: 16, семнадцать: 17, восемнадцать: 18, девятнадцать: 19, двадцать: 20,
  тридцать: 30, сорок: 40, пятьдесят: 50, шестьдесят: 60, сто: 100,
  // English
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30,
  forty: 40, fifty: 50, sixty: 60
}
/** hundreds said as one word: "нӯҳсад", "девятьсот" */
const HUNDREDS: Record<string, number> = {
  сто: 100, двести: 200, триста: 300, четыреста: 400, пятьсот: 500, шестьсот: 600, семьсот: 700, восемьсот: 800, девятьсот: 900
}
function wordValue(w: string): number | undefined {
  if (UNITS[w] !== undefined) return UNITS[w]
  if (HUNDREDS[w] !== undefined) return HUNDREDS[w]
  const bare = w.replace(/(у|ю)$/, '')
  if (UNITS[bare] !== undefined) return UNITS[bare]
  // "нӯҳсад", "дусаду": a unit and "сад"
  const h = /^(.+?)сад$/.exec(bare)
  if (h && UNITS[h[1]] !== undefined && UNITS[h[1]] < 10) return UNITS[h[1]] * 100
  return undefined
}

/**
 * A phone number said aloud, as digits: "нӯҳсаду ду бисту се чилу панҷ" → "902 23 45" → "9022345". Each group
 * is read as its own number ("девятьсот два" is 902; a smaller word fills the zeros of the one before it,
 * anything else starts a new group); digits said one by one are kept as they are. Null when it is not a number.
 */
export function phoneOf(text: string): string | null {
  const words = text.toLowerCase().replace(/[+()-]/g, ' ').replace(/[.,!?]/g, ' ').split(/\s+/).filter(Boolean)
  let out = ''
  let group: number | null = null
  // what may still be added to the group: below 100 after "нӯҳсад", below 10 after "бист"
  let room = 0
  let numbers = 0
  const roomAfter = (n: number) => (n >= 100 && n % 100 === 0 ? 100 : n % 10 === 0 ? 10 : 0)
  const close = () => { if (group !== null) out += String(group); group = null; room = 0 }
  for (const w of words) {
    if (/^\d+$/.test(w)) { close(); out += w; numbers++; continue }
    const n = wordValue(w)
    if (n === undefined) continue
    numbers++
    if (n === 0) { close(); out += '0'; continue }
    if (group !== null && n < room) { group += n; room = roomAfter(n); continue }
    close()
    group = n
    room = roomAfter(n)
  }
  close()
  return out.length >= 3 && numbers > 0 && out.length <= 15 ? out : null
}

/** a name as letters only, Tajik and Latin letters brought to Russian ones (contacts are saved either way) */
export function nameKey(s: string): string {
  const lat: [RegExp, string][] = [[/sh/g, 'ш'], [/ch/g, 'ч'], [/zh/g, 'ж'], [/kh/g, 'х'], [/yo/g, 'ё'], [/yu/g, 'ю'], [/ya/g, 'я'], [/j/g, 'дж'], [/o'/g, 'у'], [/g'/g, 'г']]
  let t = s.toLowerCase()
  for (const [a, b] of lat) t = t.replace(a, b)
  const one: Record<string, string> = { a: 'а', b: 'б', c: 'к', d: 'д', e: 'е', f: 'ф', g: 'г', h: 'х', i: 'и', k: 'к', l: 'л', m: 'м', n: 'н', o: 'о', p: 'п', q: 'к', r: 'р', s: 'с', t: 'т', u: 'у', v: 'в', w: 'в', x: 'х', y: 'й', z: 'з',
    ҳ: 'х', қ: 'к', ҷ: 'дж', ғ: 'г', ӣ: 'и', ӯ: 'у', ё: 'е', э: 'е', ы: 'и', ъ: '', ь: '' }
  return [...t].map((c) => one[c] ?? c).join('').replace(/[^а-яё]/g, '')
}

const distance = (a: string, b: string) => {
  const d = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let prev = d[0]
    d[0] = i
    for (let j = 1; j <= b.length; j++) {
      const keep = d[j]
      d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1))
      prev = keep
    }
  }
  return d[b.length]
}

/** the words of a heard name without what is said around it: "Маликаро", "Малика-ҷон", "ба апаи Малика" */
function bareName(heard: string): string[] {
  return heard.toLowerCase().split(/\s+/).map((w) => w.replace(/(ро|ра|ҷон|джон|жон|га|ге|ке|ya|ga|ni|ро\b)$/u, ''))
    .filter((w) => w.length >= 2 && !/^(ба|к|to|апа|ака|апаи|акаи|модар|падар)$/.test(w))
}

/**
 * Her contacts that sound like the name she said, best first: each word of the name against each word of a
 * contact (letters brought together, a typo or two allowed in a long name); "мама", "папа"… match as they are.
 */
export function matchContacts<T extends { name: string }>(heard: string, contacts: T[]): T[] {
  const want = bareName(heard).map(nameKey).filter(Boolean)
  if (!want.length) return []
  const scored = contacts.map((c) => {
    const words = c.name.split(/[\s,.()-]+/).map(nameKey).filter(Boolean)
    let score = 0
    for (const w of want) {
      let best = 0
      for (const x of words) {
        if (x === w) best = Math.max(best, 3)
        else if (x.startsWith(w) || w.startsWith(x)) best = Math.max(best, Math.min(x.length, w.length) >= 3 ? 2 : 0)
        else if (Math.min(x.length, w.length) >= 4 && distance(x, w) <= (w.length >= 7 ? 2 : 1)) best = Math.max(best, 1.5)
      }
      score += best
    }
    return { c, score: score / want.length }
  }).filter((x) => x.score >= 1.5)
  const top = Math.max(0, ...scored.map((x) => x.score))
  return scored.filter((x) => x.score === top).map((x) => x.c)
}

/** "and" joining number words: "бисту панҷ" (бист-у), "сию се" */
const JOINED = /^(.+?)(?:у|ю)$/

/** a number said in words or digits at the start of the words, and how many words it took */
export function numberAt(words: string[], at: number): { value: number; used: number } | null {
  let value = 0
  let used = 0
  let any = false
  for (let i = at; i < words.length; i++) {
    const w = words[i]
    if (/^\d+([.,]\d+)?$/.test(w)) { if (any) break; value = Number(w.replace(',', '.')); used = 1; any = true; continue }
    let n = UNITS[w]
    if (n === undefined) {
      const j = JOINED.exec(w)
      if (j && UNITS[j[1]] !== undefined) n = UNITS[j[1]]
    }
    // "якуним" one and a half, "ним" a half
    if (n === undefined && /^(.+)уним$/.test(w) && UNITS[w.replace(/уним$/, '')] !== undefined) n = UNITS[w.replace(/уним$/, '')] + 0.5
    if (n === undefined && (w === 'ним' || w === 'пол' || w === 'полчаса' || w === 'half')) n = 0.5
    if (n === undefined) break
    value += n
    used++
    any = true
  }
  return any ? { value, used } : null
}

const SECONDS = /^(сония|сонияи|секунд|секунды|секунду|секунда|seconds?|сек)$/
const MINUTES = /^(дақиқа|дакика|дақиқаи|минут|минуты|минуту|минута|minutes?|мин)$/
const HOURS = /^(соат|соати|час|часа|часов|hours?)$/

/** "панҷ дақиқа", "бисту панҷ дақиқаю сӣ сония", "полчаса", "1.5 соат" — seconds in all (0 when none) */
export function durationOf(text: string): number {
  const words = text.toLowerCase().replace(/[.,!?]/g, ' ').split(/\s+/).filter(Boolean)
  let total = 0
  for (let i = 0; i < words.length; i++) {
    if (words[i] === 'полчаса') { total += 1800; continue }
    const n = numberAt(words, i)
    if (!n) continue
    const unit = (words[i + n.used] ?? '').replace(/(у|ю)$/, '')
    const k = SECONDS.test(unit) ? 1 : MINUTES.test(unit) ? 60 : HOURS.test(unit) ? 3600 : 0
    if (k) { total += n.value * k; i += n.used }
  }
  return Math.round(total)
}

/** her name and the call words taken off the front */
export function withoutName(text: string): string {
  const t = text.toLowerCase().replace(/[!?.,]/g, ' ').replace(/\s+/g, ' ').trim()
    .replace(/^((эй|ҳей|хей|ҳой|hey|эй)\s+)?(маҳлиё|махлиё|mahliyo|маҳ лиё)\s*/, '').trim()
  // her name as a small model hears it ("эй моҳи …", "махлие …"): by its consonants
  const m = /^(?:(?:эй|ей|ҳей|хей|ай|hey)\s+)?(\S+)\s*(.*)$/.exec(t)
  if (m) {
    const k = m[1].replace(/ҳ/g, 'х').replace(/[аоуэеиёюяыӣӯьъй]/g, '')
    const afterHey = /^(эй|ей|ҳей|хей|ай|hey)\s/.test(t)
    if (k === 'мхл' || k === 'млх' || (afterHey && k === 'мх')) return m[2].trim()
  }
  return t
}

export function commandOf(said: string): VoiceCommand {
  const t = withoutName(said)
  if (!t) return { kind: 'ask', text: '' }
  if (/(секундомер|стопвотч|stopwatch)/.test(t)) return { kind: 'stopwatch' }
  if (/(таймер|timer|засеки|ёдрас кун)/.test(t) || (/^(баъди|после|через|in)\s/.test(t) && durationOf(t) > 0)) {
    const seconds = durationOf(t)
    if (seconds > 0) return { kind: 'timer', seconds }
  }
  if (/(соат чанд|вақт чанд|чанд соат шуд|соатро гӯй|который час|сколько времени|what time|soat necha|saat kaç|ساعت چند)/.test(t)) return { kind: 'time' }
  if (/(имрӯз чанд|имрӯз кадом|чандуми|санаи имрӯз|рӯзи ҳафта|какое .*число|какой .*день|what('s| is) the date|what day)/.test(t)) return { kind: 'date' }
  if (/(обу ?ҳаво|ҳаво чӣ|ҳаво чи|погода|weather|ob-?havo|hava durumu|آب و هوا|هوا چطور)/.test(t)) return { kind: 'weather', when: /(фардо|завтра|tomorrow|ertaga|yarın|فردا)/.test(t) ? 'tomorrow' : 'now' }
  let m = /^(?:ба\s+)?(.+?)\s+занг\s+(?:зан|занед|задан)(?=\s|$)/.exec(t) ?? /^занг\s+(?:зан|занед)\s+(?:ба\s+)?(.+)$/.exec(t)
    ?? /^(?:позвони(?:те)?|набери(?:те)?)\s+(.+)$/.exec(t) ?? /^call\s+(.+)$/.exec(t)
    ?? /^(.+?)(?:ga|ge|ya|e|a)?\s+(?:qo'ng'iroq qil|qongiroq qil|ara|arayın)(?=\s|$)/.exec(t) ?? /^(?:به\s+)?(.+?)\s+زنگ\s+بزن/.exec(t)
  if (m) {
    const name = m[1].replace(/^(ба|к|to)\s+/, '').replace(/^(номер|рақам|рақами|number)\s+/, '').trim()
    const number = phoneOf(name)
    return number ? { kind: 'call', name, number } : { kind: 'call', name }
  }
  m = /^маро\s+ба\s+(.+?)\s+(?:бубар|бар|расон)$/.exec(t) ?? /^роҳ(?:и)?\s+(?:то|ба)\s+(.+?)(?:\s+(?:нишон деҳ|ро нишон деҳ))?$/.exec(t)
    ?? /^(?:проводи меня|отведи меня|маршрут)\s+(?:до|в|к|на)\s+(.+)$/.exec(t) ?? /^как\s+(?:дойти|доехать|добраться)\s+(?:до|в|к)\s+(.+)$/.exec(t)
    ?? /^(?:take me to|navigate to|directions to)\s+(.+)$/.exec(t) ?? /^meni\s+(.+?)(?:ga|ka)\s+olib bor$/.exec(t) ?? /^beni\s+(.+?)(?:'?[ae])?\s+götür$/.exec(t)
    ?? /^مرا\s+به\s+(.+?)\s+ببر$/.exec(t)
  if (m) return { kind: 'navigate', place: m[1].trim() }
  return { kind: 'ask', text: t }
}
