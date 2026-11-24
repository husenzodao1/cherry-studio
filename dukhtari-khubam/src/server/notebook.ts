import { GoogleGenAI } from '@google/genai'

import { geminiKeys } from './mahliyo'

/**
 * The red pen: a photo of a page of her notebook (a solved problem, a dictation, an essay, a translation) is
 * checked by the AI like a careful teacher — every mistake marked where it is on the page (a box on the photo),
 * what is right ticked, a short correction and why, a mark on the school's 5-point scale and what to practise.
 * The boxes come as the model gives them, [ymin, xmin, ymax, xmax] on a 0–1000 grid of the photo.
 */

export type MarkKind = 'error' | 'ok' | 'note'
export interface Mark { box: [number, number, number, number]; kind: MarkKind; text: string; why: string }
export interface Checked { subject: string; grade: number | null; summary: string; marks: Mark[]; next: string[] }

const LANGS: Record<string, string> = { tg: 'Tajik', ru: 'Russian', en: 'English', uz: 'Uzbek (Latin)', tr: 'Turkish', fa: 'Persian', prs: 'Dari' }
export const MODELS = ['gemini-3.5-flash', 'gemini-flash-latest']

export function rules(lang: string, task?: string, subject?: string) {
  return `You are a careful, kind school teacher checking a photo of a student's notebook page with a red pen.
${subject ? `The subject: ${subject}.` : 'First recognise the subject.'}${task ? `\nThe task she was given: ${task}` : ''}
Read the handwriting closely. Check EVERYTHING: arithmetic and algebra step by step, units, logic of a proof, spelling, grammar and punctuation, word choice, translation accuracy, facts.
Return JSON:
- "subject": the subject you see.
- "marks": every mistake as kind "error" (box tightly around the wrong part, "text" = the correct version, short; "why" = one or two sentences why); important correct steps as kind "ok" ("text" = "" or a few words of praise); anything unclear or that could be better as kind "note". Boxes are [ymin, xmin, ymax, xmax] on a 0–1000 grid of the photo. Never mark a correct thing as an error; if you cannot read a part, add a "note" saying so instead of guessing.
- "grade": the mark on the 5-point school scale (5 excellent … 2 poor) for this page, or null if it is not schoolwork.
- "summary": two or three warm, honest sentences: what is good and what to fix.
- "next": up to three short things to practise.
Write every text in ${LANGS[lang] ?? 'Tajik'}, simply, to a teenager. Never write the right answer of a whole unsolved task — only correct what she wrote.`
}

const SCHEMA = {
  type: 'object',
  properties: {
    subject: { type: 'string' },
    grade: { type: ['integer', 'null'] },
    summary: { type: 'string' },
    marks: {
      type: 'array',
      items: {
        type: 'object',
        properties: { box: { type: 'array', items: { type: 'integer' } }, kind: { type: 'string', enum: ['error', 'ok', 'note'] }, text: { type: 'string' }, why: { type: 'string' } },
        required: ['box', 'kind', 'text']
      }
    },
    next: { type: 'array', items: { type: 'string' } }
  },
  required: ['subject', 'summary', 'marks']
}

/** what the model gave, made safe to draw: boxes inside the photo, at most 40 marks, the grade 2–5 or none */
export function checkedFrom(raw: unknown): Checked {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const clamp = (n: unknown) => Math.max(0, Math.min(1000, Math.round(Number(n) || 0)))
  const marks: Mark[] = (Array.isArray(o.marks) ? o.marks : []).flatMap((m) => {
    const x = (m && typeof m === 'object' ? m : {}) as Record<string, unknown>
    const b = Array.isArray(x.box) ? x.box.map(clamp) : []
    if (b.length !== 4) return []
    const [y0, x0, y1, x1] = [Math.min(b[0], b[2]), Math.min(b[1], b[3]), Math.max(b[0], b[2]), Math.max(b[1], b[3])]
    if (y1 - y0 < 2 || x1 - x0 < 2) return []
    const kind: MarkKind = x.kind === 'ok' || x.kind === 'note' ? x.kind : 'error'
    return [{ box: [y0, x0, y1, x1] as [number, number, number, number], kind, text: String(x.text ?? '').slice(0, 300), why: String(x.why ?? '').slice(0, 600) }]
  }).sort((a, b) => a.box[0] - b.box[0] || a.box[1] - b.box[1]).slice(0, 40)
  const g = Number(o.grade)
  return {
    subject: String(o.subject ?? '').slice(0, 80),
    grade: Number.isInteger(g) && g >= 2 && g <= 5 ? g : null,
    summary: String(o.summary ?? '').slice(0, 800),
    marks,
    next: (Array.isArray(o.next) ? o.next : []).map((s) => String(s).slice(0, 200)).filter(Boolean).slice(0, 3)
  }
}

/** her page checked; null when no AI could answer */
export async function checkNotebook(image: { mime: string; data: string }, o: { lang: string; task?: string; subject?: string }, keys = geminiKeys()): Promise<Checked | null> {
  for (const model of MODELS) {
    for (const key of keys) {
      try {
        const r = await new GoogleGenAI({ apiKey: key, httpOptions: { retryOptions: { attempts: 1 } } }).models.generateContent({
          model,
          contents: [{ role: 'user', parts: [{ inlineData: { mimeType: image.mime, data: image.data } }, { text: 'Check this page.' }] }],
          config: { systemInstruction: rules(o.lang, o.task, o.subject), responseMimeType: 'application/json', responseJsonSchema: SCHEMA, temperature: 0.2, httpOptions: { timeout: 90_000 } }
        })
        return checkedFrom(JSON.parse(r.text ?? '{}'))
      } catch (e) {
        console.warn('[notebook]', model, String(e instanceof Error ? e.message : e).slice(0, 160))
      }
    }
  }
  return null
}

// ---------------------------------------------------------------- flashcards made by the AI

const CARD_SCHEMA = { type: 'array', items: { type: 'object', properties: { front: { type: 'string' }, back: { type: 'string' } }, required: ['front', 'back'] } }

export function cardRules(lang: string, count: number) {
  return `You make study flashcards from the material given (text of a lesson or her notes, or a photo of a textbook or notebook page).
Make up to ${count} cards of the most important facts, terms, rules, formulas, dates and definitions — ONLY what the material says, never invented.
Each card: "front" — a short, clear question or term (at most 120 characters); "back" — the exact answer, short (at most 250 characters), with the key number, formula or word.
One idea per card; no "true or false"; no card answered by another card's front. Write in ${LANGS[lang] ?? 'Tajik'} unless the material is a foreign-language lesson (then keep its words on the front). Return a JSON array.`
}

/** flashcards from her material; null when no AI could answer */
export async function makeCards(o: { text?: string; image?: { mime: string; data: string }; lang: string; count: number }, keys = geminiKeys()): Promise<{ front: string; back: string }[] | null> {
  const parts = [
    ...(o.image ? [{ inlineData: { mimeType: o.image.mime, data: o.image.data } }] : []),
    { text: o.text ? `MATERIAL:\n${o.text}` : 'Make the cards from the photo.' }
  ]
  for (const model of MODELS) {
    for (const key of keys) {
      try {
        const r = await new GoogleGenAI({ apiKey: key, httpOptions: { retryOptions: { attempts: 1 } } }).models.generateContent({
          model, contents: [{ role: 'user', parts }],
          config: { systemInstruction: cardRules(o.lang, o.count), responseMimeType: 'application/json', responseJsonSchema: CARD_SCHEMA, temperature: 0.3, httpOptions: { timeout: 90_000 } }
        })
        const out = JSON.parse(r.text ?? '[]') as unknown
        if (!Array.isArray(out)) continue
        return out.filter((c): c is { front: string; back: string } => !!c && typeof c.front === 'string' && typeof c.back === 'string').slice(0, o.count)
      } catch (e) {
        console.warn('[cards]', model, String(e instanceof Error ? e.message : e).slice(0, 160))
      }
    }
  }
  return null
}
