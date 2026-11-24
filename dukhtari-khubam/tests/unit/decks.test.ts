import { describe, expect, it } from 'vitest'

import { cleanCards, deckStats, dueCards, mergeDeck, mergeDecks, NEW_PER_DAY, rate, sameDeck, type Deck } from '@/lib/decks'
import { AGAIN, GOOD } from '@/lib/fsrs'

const T = '2026-11-24'
const deck = (at: string, cards: Deck['cards'], extra: Partial<Deck> = {}): Deck => ({ id: 'd', title: 'Химия', source: 'text', at, cards, ...extra })

describe('flashcard decks', () => {
  it('two copies merge card by card, the newer version of each; the same whichever comes first', () => {
    const phone = deck('2026-11-24T10:00:00Z', [
      { id: 'a', f: 'H₂O', b: 'Об', at: '2026-11-24T10:00:00Z', st: { s: 3, d: 5, due: '2026-11-27', last: T, reps: 1, lapses: 0 } },
      { id: 'b', f: 'NaCl', b: 'Намак', at: '2026-11-20T00:00:00Z' }
    ])
    const server = deck('2026-11-23T00:00:00Z', [
      { id: 'a', f: 'H₂O', b: 'Об', at: '2026-11-22T00:00:00Z' },
      { id: 'b', f: 'NaCl', b: 'Намаки ош', at: '2026-11-23T00:00:00Z' },
      { id: 'c', f: 'CO₂', b: 'Гази карбонат', at: '2026-11-23T00:00:00Z' }
    ], { title: 'Кимиё' })
    const m = mergeDeck(phone, server)
    expect(m.title).toBe('Химия')
    expect(m.cards.map((c) => [c.id, c.b, !!c.st])).toEqual([['a', 'Об', true], ['b', 'Намаки ош', false], ['c', 'Гази карбонат', false]])
    expect(mergeDeck(server, phone)).toEqual(m)
    // the server's copy holds everything this phone has: nothing to send; the phone's lacks a card
    expect(sameDeck(phone, m)).toBe(true)
    expect(sameDeck(m, phone)).toBe(false)
    expect(sameDeck(m, m)).toBe(true)
    expect(Object.keys(mergeDecks({ d: phone }, { e: { ...server, id: 'e' } }))).toEqual(['d', 'e'])
  })

  it('a removed deck stays removed unless written again later', () => {
    const removed = deck('2026-11-24T12:00:00Z', [], { del: true })
    expect(mergeDeck(removed, deck('2026-11-24T10:00:00Z', [])).del).toBe(true)
    expect(mergeDeck(removed, deck('2026-11-25T10:00:00Z', [])).del).toBe(false)
  })

  it('cards cleaned: trimmed, empty and repeated left out', () => {
    let n = 0
    const c = cleanCards([{ front: ' H₂O ', back: 'Об' }, { front: 'h₂o', back: 'x' }, { front: '', back: 'y' }, { f: 'CO₂', b: 'Гази карбонат' }], T, () => `id${n++}`)
    expect(c.map((x) => [x.id, x.f, x.b])).toEqual([['id0', 'H₂O', 'Об'], ['id1', 'CO₂', 'Гази карбонат']])
  })

  it('today: due cards first (oldest first), then new ones up to the day\'s share; answers move them', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ id: `n${i}`, f: `f${i}`, b: 'b', at: T }))
    const d = deck(T, [
      { id: 'late', f: 'x', b: 'y', at: T, st: { s: 2, d: 5, due: '2026-11-20', last: '2026-11-18', reps: 2, lapses: 0 } },
      { id: 'later', f: 'x', b: 'y', at: T, st: { s: 9, d: 5, due: '2026-12-20', last: T, reps: 3, lapses: 0 } },
      ...many
    ])
    const today = dueCards({ d }, T)
    expect(today[0].card.id).toBe('late')
    expect(today).toHaveLength(1 + NEW_PER_DAY)
    expect(dueCards({ d }, T, NEW_PER_DAY)).toHaveLength(1)
    const good = rate(today[0].card, GOOD, T, '2026-11-24T10:00:00Z')
    expect(good.st!.due > T).toBe(true)
    expect(rate(today[0].card, AGAIN, T, '2026-11-24T10:00:00Z').st!.due).toBe(T)
    expect(deckStats(d, T)).toMatchObject({ total: 32, fresh: 30, due: 1, learnt: 0, next: '2026-12-20' })
  })
})
