'use client'

import { useSyncExternalStore } from 'react'

import { cleanCards, mergeDecks, rate, sameDeck, type Card, type Deck } from '@/lib/decks'
import { type Rating } from '@/lib/fsrs'
import { localDay } from '@/lib/progress'

import { apiUrl } from './base'
import { supportToken } from './support'
import { browserSupabase } from '../supabase-browser'

/**
 * Her flashcard decks on this phone, backed up by her code (api_decks / api_deck_put) and merged card by card
 * with the server's copy (lib/decks). Every change is written here at once and sent a moment later; offline it
 * waits for the connection. Her lesson questions' memory states live in the deck "_lessons" (no words, only
 * states), so the daily review uses the same scheduler (FSRS) and comes back on a new phone.
 */

const KEY = 'dk.decks'
const NEW_KEY = 'dk.decks.new'
export const LESSONS = '_lessons'

let decks: Record<string, Deck> = {}
let loaded = false
const listeners = new Set<() => void>()
function load() {
  if (loaded || typeof window === 'undefined') return
  loaded = true
  try { decks = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, Deck> } catch { decks = {} }
}
function emit() {
  try { localStorage.setItem(KEY, JSON.stringify(decks)) } catch { /* not kept */ }
  for (const f of listeners) f()
}
export function allDecks(): Record<string, Deck> {
  load()
  return decks
}
export function useDecks(): Record<string, Deck> {
  return useSyncExternalStore((f) => { listeners.add(f); return () => listeners.delete(f) }, allDecks, () => ({}))
}

const now = () => new Date().toISOString()
const newId = () => (crypto.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32)

let code: string | null = null
let timer: ReturnType<typeof setTimeout> | null = null
const dirty = new Set<string>()
function put(deck: Deck) {
  load()
  decks = { ...decks, [deck.id]: deck }
  dirty.add(deck.id)
  emit()
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => void push(), 1500)
}

/** a new deck from cards (made by the AI or typed); its id */
export function addDeck(title: string, source: string, list: { front?: string; back?: string; f?: string; b?: string }[]): string {
  const at = now()
  const id = newId()
  put({ id, title: title.trim().slice(0, 120) || '—', source, at, cards: cleanCards(list, at, newId) })
  return id
}

/** cards added to a deck (made first when there is none of that name) */
export function addToDeck(title: string, source: string, list: { front?: string; back?: string }[]): string {
  load()
  const found = Object.values(decks).find((d) => !d.del && d.title === title && d.source === source)
  if (!found) return addDeck(title, source, list)
  const at = now()
  const known = new Set(found.cards.filter((c) => !c.del).map((c) => c.f.toLowerCase()))
  const extra = cleanCards(list, at, newId).filter((c) => !known.has(c.f.toLowerCase()))
  put({ ...found, at, cards: [...found.cards, ...extra] })
  return found.id
}

export function removeDeck(id: string) {
  load()
  const d = decks[id]
  if (d) put({ ...d, del: true, at: now() })
}

export function removeCard(deckId: string, cardId: string) {
  load()
  const d = decks[deckId]
  if (d) put({ ...d, at: now(), cards: d.cards.map((c) => (c.id === cardId ? { ...c, del: true, at: now() } : c)) })
}

/** new cards met today (the day's share of new ones is counted on the phone) */
export function newToday(today = localDay()): number {
  try {
    const v = JSON.parse(localStorage.getItem(NEW_KEY) ?? 'null') as { day: string; n: number } | null
    return v?.day === today ? v.n : 0
  } catch {
    return 0
  }
}

/** her answer to a card: its next day */
export function answerCard(deckId: string, cardId: string, g: Rating) {
  load()
  const d = decks[deckId]
  const c = d?.cards.find((x) => x.id === cardId)
  if (!d || !c) return
  const today = localDay()
  if (!c.st) { try { localStorage.setItem(NEW_KEY, JSON.stringify({ day: today, n: newToday(today) + 1 })) } catch { /* not counted */ } }
  const next = rate(c, g, today, now())
  put({ ...d, at: next.at, cards: d.cards.map((x) => (x.id === cardId ? next : x)) })
}

/** a lesson question answered in the daily review: its memory state in the deck "_lessons" */
export function answerLessonQuestion(questionId: string, g: Rating) {
  load()
  const d: Deck = decks[LESSONS] ?? { id: LESSONS, title: 'Lessons', source: 'lessons', at: now(), cards: [] }
  const old: Card = d.cards.find((c) => c.id === questionId) ?? { id: questionId, f: '', b: '', at: now() }
  const next = rate(old, g, localDay(), now())
  put({ ...d, at: next.at, cards: [...d.cards.filter((c) => c.id !== questionId), next] })
  return next.st!
}

// ---------------------------------------------------------------- backup

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const sb = browserSupabase()
  if (!sb) throw new Error('offline')
  const { data, error } = await sb.rpc(fn, args)
  if (error) throw new Error(error.message)
  return data as T
}

/** the server's decks merged in, then what it lacks sent; quietly does nothing offline */
export async function syncDecks(learnerCode: string): Promise<void> {
  code = learnerCode
  load()
  try {
    const list = await rpc<Deck[]>('api_decks', { p_code: learnerCode })
    const server = Object.fromEntries(list.map((d) => [d.id, d]))
    decks = mergeDecks(decks, server)
    for (const d of Object.values(decks)) if (!sameDeck(d, server[d.id])) dirty.add(d.id)
    emit()
    await push()
  } catch { /* offline: later */ }
}

async function push() {
  if (!code || !dirty.size) return
  for (const id of [...dirty]) {
    const d = decks[id]
    if (!d) { dirty.delete(id); continue }
    try {
      await rpc('api_deck_put', { p_code: code, p_id: d.id, p_title: d.title, p_source: d.source, p_cards: d.cards, p_at: d.at, p_deleted: !!d.del })
      dirty.delete(id)
    } catch {
      return
    }
  }
}

if (typeof window !== 'undefined') window.addEventListener('online', () => void push())

// ---------------------------------------------------------------- cards by the AI

export class CardsError extends Error {
  constructor(readonly status: number) { super(String(status)) }
}

async function session(): Promise<string | undefined> {
  try {
    const { data } = await browserSupabase()?.auth.getSession() ?? { data: { session: null } }
    return data.session?.access_token ?? undefined
  } catch {
    return undefined
  }
}

/** cards made by the AI from a text or a photo (402: her plan's share is used up) */
export async function makeCards(o: { text?: string; image?: { mime: string; data: string }; lang: string; count?: number }): Promise<{ front: string; back: string }[]> {
  const res = await fetch(apiUrl('/study/cards'), {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token: supportToken(), session: await session(), ...o })
  })
  if (!res.ok) throw new CardsError(res.status)
  return ((await res.json()) as { cards: { front: string; back: string }[] }).cards
}
