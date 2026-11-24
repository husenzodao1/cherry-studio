import { addDays, review, type FsrsState, type Rating } from './fsrs'

/**
 * Flashcard decks and how two copies of them (this phone's and the server's) come together: each card keeps
 * the newer of its two versions (its words or its memory state, whichever was changed last), a deck the newer
 * title; a removed card or deck stays removed. Merging is the same whichever copy comes first.
 */

export interface Card { id: string; f: string; b: string; at: string; st?: FsrsState; del?: boolean }
export interface Deck { id: string; title: string; source: string; at: string; del?: boolean; cards: Card[] }

/** the longest side of a card, and the most cards a deck holds (a deck must stay small to back up) */
export const SIDE_MAX = 400
export const DECK_MAX = 300
/** new cards met in a day, across all decks */
export const NEW_PER_DAY = 15

const later = (a: string, b: string) => (a >= b ? a : b)

export function mergeDeck(a: Deck, b: Deck): Deck {
  const head = a.at >= b.at ? a : b
  const cards = new Map<string, Card>()
  for (const c of [...a.cards, ...b.cards]) {
    const had = cards.get(c.id)
    cards.set(c.id, !had ? c : had.at >= c.at ? (c.del && !had.del && c.at === had.at ? c : had) : c)
  }
  return {
    id: head.id, title: head.title, source: head.source, at: later(a.at, b.at),
    ...(a.del || b.del ? { del: (a.del && a.at >= b.at) || (b.del && b.at >= a.at) || false } : {}),
    cards: [...cards.values()].sort((x, y) => x.id.localeCompare(y.id))
  }
}

export function mergeDecks(a: Record<string, Deck>, b: Record<string, Deck>): Record<string, Deck> {
  const out: Record<string, Deck> = {}
  for (const id of new Set([...Object.keys(a), ...Object.keys(b)])) out[id] = a[id] && b[id] ? mergeDeck(a[id], b[id]) : (a[id] ?? b[id])!
  return out
}

/** whether the second copy already holds everything the first has (nothing to send) */
export const sameDeck = (a: Deck | undefined, b: Deck | undefined) => !!a && !!b && JSON.stringify(mergeDeck(a, b)) === JSON.stringify(b)

/** cards as typed or made by the AI: trimmed, cut to size, empty and repeated ones left out */
export function cleanCards(list: { front?: string; back?: string; f?: string; b?: string }[], now: string, idOf: () => string): Card[] {
  const seen = new Set<string>()
  const out: Card[] = []
  for (const x of list) {
    const f = String(x.front ?? x.f ?? '').trim().slice(0, SIDE_MAX)
    const b = String(x.back ?? x.b ?? '').trim().slice(0, SIDE_MAX)
    const key = f.toLowerCase()
    if (!f || !b || seen.has(key)) continue
    seen.add(key)
    out.push({ id: idOf(), f, b, at: now })
  }
  return out.slice(0, DECK_MAX)
}

export interface Due { deck: Deck; card: Card }
/** today's cards: due ones first (the longest overdue first), then new ones up to the day's share */
export function dueCards(decks: Record<string, Deck>, today: string, newToday = 0): Due[] {
  const live = Object.values(decks).filter((d) => !d.del)
  const due: Due[] = []
  const fresh: Due[] = []
  for (const deck of live) {
    for (const card of deck.cards) {
      if (card.del || !card.f) continue
      if (card.st) { if (card.st.due <= today) due.push({ deck, card }) } else fresh.push({ deck, card })
    }
  }
  due.sort((x, y) => x.card.st!.due.localeCompare(y.card.st!.due) || x.card.st!.s - y.card.st!.s)
  return [...due, ...fresh.slice(0, Math.max(0, NEW_PER_DAY - newToday))]
}

/** a card answered: its new memory state */
export function rate(card: Card, g: Rating, today: string, now: string): Card {
  return { ...card, st: review(card.st, g, today), at: now }
}

/** the deck's numbers: new, due today, learnt (stable for three weeks and more) */
export function deckStats(deck: Deck, today: string) {
  const cards = deck.cards.filter((c) => !c.del && c.f)
  return {
    total: cards.length,
    fresh: cards.filter((c) => !c.st).length,
    due: cards.filter((c) => c.st && c.st.due <= today).length,
    learnt: cards.filter((c) => c.st && c.st.s >= 21).length,
    next: cards.filter((c) => c.st && c.st.due > today).map((c) => c.st!.due).sort()[0] ?? addDays(today, 1)
  }
}
