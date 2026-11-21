/**
 * Mahliyo's words beside her clips (MahliyoIntro.tsx), shown word by word as she says them. Each sentence
 * comes with the stretches of its clip (s) in which she says it, measured from the clip's sound; a pause
 * may split one sentence in two stretches. She speaks at an even pace (about 17 letters a second), so a
 * word appears when the share of the sentence already said reaches the share of its letters before it.
 */
export type Spoken = readonly (readonly [number, number])[]

/** Her introduction: "Салом, дӯсти азиз!" · "Ман омӯзгори шумо ҳастам." · "Дар ин ҷо … омӯзед!" · "Омодаед оғоз кунем?" */
export const INTRO: readonly Spoken[] = [[[1.0, 2.05]], [[2.5, 3.95]], [[4.2, 6.75], [7.1, 8.25]], [[8.7, 9.85]]]
/** After "Бале": "Офарин!" · "Пас, рафтем!" · "Шуморо чизҳои нав интизоранд!" (then she claps) */
export const BRAVO: readonly Spoken[] = [[[1.2, 1.85]], [[2.2, 2.85]], [[3.4, 5.2]]]

/** When she has said everything (s). */
export const spokenBy = (speech: readonly Spoken[]) => Math.max(...speech.flat().map(([, to]) => to))

/** How much of a sentence she has said by time `t` (0…1). */
function share(spoken: Spoken, t: number): number {
  const total = spoken.reduce((a, [from, to]) => a + to - from, 0)
  const done = spoken.reduce((a, [from, to]) => a + Math.max(0, Math.min(t, to) - from), 0)
  return Math.min(1, done / total)
}

export interface Said {
  /** words of each sentence shown */
  shown: number[]
  /** the word she is saying now: [sentence, word] */
  now: [number, number] | null
  /** whether she is speaking at all */
  speaking: boolean
}

/** The words of each sentence (`words[i]`) shown at time `t` of the clip. */
export function wordsAt(words: string[][], t: number, speech: readonly Spoken[]): Said {
  let now: [number, number] | null = null
  const shown = words.map((w, i) => {
    const spoken = speech[Math.min(i, speech.length - 1)]
    const said = share(spoken, t)
    if (said <= 0) return 0
    // letters before each word (with the spaces), against the sentence's length
    const total = w.reduce((a, x) => a + [...x].length, 0) + w.length - 1
    let before = 0
    let n = 0
    for (const word of w) {
      if (before / total < said) n++
      before += [...word].length + 1
    }
    if (said < 1 && spoken.some(([from, to]) => t > from && t < to)) now = [i, n - 1]
    return n
  })
  return { shown, now, speaking: now !== null }
}
