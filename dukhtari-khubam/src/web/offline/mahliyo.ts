import { apiUrl } from './base'
import { supportToken } from './support'

/**
 * Mahliyo AI client: whether she can answer (the server has the AI set up), the conversation kept on
 * this phone, and a question to her. She answers in Tajik; written to in another language, she points to
 * the consultant (`tajik: false`).
 */

export interface AiTurn { role: 'user' | 'assistant'; content: string; at: string; tajik?: boolean }

const KEY = 'dk.ai'
/** how much of the conversation the phone keeps, and how much goes with a question */
const KEEP = 40
const CONTEXT = 12

export function loadChat(): AiTurn[] {
  try {
    const t = JSON.parse(localStorage.getItem(KEY) || '[]') as AiTurn[]
    return Array.isArray(t) ? t : []
  } catch {
    return []
  }
}
export function saveChat(turns: AiTurn[]) {
  try { localStorage.setItem(KEY, JSON.stringify(turns.slice(-KEEP))) } catch { /* storage blocked: the chat is not kept */ }
}

let ready: Promise<boolean> | null = null
/** Whether she can answer — asked once per opening of the app. */
export function aiReady(): Promise<boolean> {
  ready ??= fetch(apiUrl('/mahliyo/status'))
    .then((r) => (r.ok ? r.json() : { ready: false }))
    .then((r: { ready?: boolean }) => !!r.ready)
    .catch(() => {
      ready = null
      return false
    })
  return ready
}

export class AiError extends Error {
  constructor(readonly status: number) { super(`mahliyo ${status}`) }
}

/** Her answer to the conversation, whose last turn is the learner's question. */
export async function askMahliyo(turns: AiTurn[], who: { code?: string; name?: string }): Promise<{ tajik: boolean; reply: string }> {
  // the conversation sent starts with a question of hers (the server's rule)
  let recent = turns.slice(-CONTEXT)
  while (recent.length && recent[0].role !== 'user') recent = recent.slice(1)
  const res = await fetch(apiUrl('/mahliyo/ask'), {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token: supportToken(), ...who, turns: recent.map((t) => ({ role: t.role, content: t.content.slice(0, 1000) })) })
  })
  if (!res.ok) throw new AiError(res.status)
  return (await res.json()) as { tajik: boolean; reply: string }
}
