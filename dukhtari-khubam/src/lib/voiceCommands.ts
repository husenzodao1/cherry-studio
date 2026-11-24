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
  | { kind: 'call'; name: string }
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
  return text.toLowerCase().replace(/[!?.,]/g, ' ').replace(/\s+/g, ' ').trim()
    .replace(/^((эй|ҳей|хей|ҳой|hey|эй)\s+)?(маҳлиё|махлиё|mahliyo|маҳ лиё)\s*/, '').trim()
}

export function commandOf(said: string): VoiceCommand {
  const t = withoutName(said)
  if (!t) return { kind: 'ask', text: '' }
  if (/(секундомер|стопвотч|stopwatch)/.test(t)) return { kind: 'stopwatch' }
  if (/(таймер|timer|засеки|ёдрас кун)/.test(t) || (/^(баъди|после|через|in)\s/.test(t) && durationOf(t) > 0)) {
    const seconds = durationOf(t)
    if (seconds > 0) return { kind: 'timer', seconds }
  }
  if (/(соат чанд|вақт чанд|чанд соат шуд|соатро гӯй|который час|сколько времени|what time)/.test(t)) return { kind: 'time' }
  if (/(имрӯз чанд|имрӯз кадом|чандуми|санаи имрӯз|рӯзи ҳафта|какое .*число|какой .*день|what('s| is) the date|what day)/.test(t)) return { kind: 'date' }
  if (/(обу ?ҳаво|ҳаво чӣ|ҳаво чи|погода|weather)/.test(t)) return { kind: 'weather', when: /(фардо|завтра|tomorrow)/.test(t) ? 'tomorrow' : 'now' }
  let m = /^(?:ба\s+)?(.+?)\s+занг\s+(?:зан|занед|задан)(?=\s|$)/.exec(t) ?? /^занг\s+(?:зан|занед)\s+(?:ба\s+)?(.+)$/.exec(t)
    ?? /^(?:позвони(?:те)?|набери(?:те)?)\s+(.+)$/.exec(t) ?? /^call\s+(.+)$/.exec(t)
  if (m) return { kind: 'call', name: m[1].replace(/^(ба|к|to)\s+/, '').trim() }
  m = /^маро\s+ба\s+(.+?)\s+(?:бубар|бар|расон)$/.exec(t) ?? /^роҳ(?:и)?\s+(?:то|ба)\s+(.+?)(?:\s+(?:нишон деҳ|ро нишон деҳ))?$/.exec(t)
    ?? /^(?:проводи меня|отведи меня|маршрут)\s+(?:до|в|к|на)\s+(.+)$/.exec(t) ?? /^как\s+(?:дойти|доехать|добраться)\s+(?:до|в|к)\s+(.+)$/.exec(t)
    ?? /^(?:take me to|navigate to|directions to)\s+(.+)$/.exec(t)
  if (m) return { kind: 'navigate', place: m[1].trim() }
  return { kind: 'ask', text: t }
}
