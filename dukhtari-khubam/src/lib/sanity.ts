/**
 * Guards against answers that cannot be real: impossible ages, more study time than a day allows,
 * and meaningless or rude text (keyboard mashing, one letter repeated, no vowels, swearing).
 * Shared by the start screen, the welcome questions and the rating sheet.
 */

/** Ages a learner of this app can really have. */
export const MIN_AGE = 9
export const MAX_AGE = 40

/** Hours a day she can say she will study (the offered options go up to 4). */
export const MAX_HOURS = 6

const VOWELS = /[аеёиоуыэюяӣӯaeiouyäöüıаә]/i
const ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm', 'йцукенгшщзхъ', 'фывапролджэ', 'ячсмитьбю', '1234567890']
// common rude roots (Russian and Tajik), matched inside words
const RUDE = ['хуй', 'хуе', 'хуё', 'пизд', 'ебат', 'ебан', 'ёбан', 'бляд', 'блят', 'сука', 'суки', 'мудак', 'гандон', 'шлюх', 'пидор', 'пидар', 'залуп', 'кус ', 'кусмодар', 'гумшав', 'харкус', 'fuck', 'shit', 'bitch']

function mashed(word: string): boolean {
  const w = word.toLowerCase()
  for (const row of ROWS) {
    for (let i = 0; i + 4 <= row.length; i++) {
      const piece = row.slice(i, i + 4)
      if (w.includes(piece) || w.includes([...piece].reverse().join(''))) return true
    }
  }
  return false
}

/** Whether a free text reads like real words (an empty text is fine: it is optional). */
export function isMeaningful(text: string): boolean {
  const t = text.trim()
  if (!t) return true
  const low = ` ${t.toLowerCase()} `
  if (RUDE.some((r) => low.includes(r))) return false
  const letters = (t.match(/\p{L}/gu) ?? []).length
  const visible = t.replace(/\s/g, '').length
  if (letters < 2 || letters / visible < 0.6) return false
  if (/(\p{L})\1{3,}/u.test(t)) return false // аааа, !!!! is fine but letters not
  const persian = /[؀-ۿ]/.test(t)
  for (const word of t.split(/[^\p{L}]+/u).filter((w) => w.length >= 3)) {
    if (word.length > 25) return false
    if (!persian && !VOWELS.test(word)) return false
    if (mashed(word)) return false
  }
  return true
}

/** Hours a day typed in "your own answer" of the welcome question: a number from 1 to MAX_HOURS. */
export function hoursOk(text: string): boolean {
  const n = Number.parseFloat(text.replace(',', '.'))
  return Number.isFinite(n) && n > 0 && n <= MAX_HOURS
}
