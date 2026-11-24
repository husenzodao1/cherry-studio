'use client'

import { useEffect, useMemo, useState } from 'react'

import { deckStats, dueCards, type Due } from '@/lib/decks'
import { AGAIN, EASY, GOOD, HARD, preview, type Rating } from '@/lib/fsrs'
import { localDay } from '@/lib/progress'
import { Header } from '@/web/components/Header'
import { Icon } from '@/web/components/Icon'
import { showToast } from '@/web/components/Toast'
import { lessonText, photoData } from '@/web/files/studyInput'
import { useContent } from '@/web/offline/content'
import { addDeck, allDecks, answerCard, CardsError, LESSONS, makeCards, newToday, removeCard, removeDeck, syncDecks, useDecks } from '@/web/offline/decks'
import { useLearner } from '@/web/offline/learner'
import { usePlan } from '@/web/plans'
import { usePrefs } from '@/web/prefs'

type Source = 'text' | 'photo' | 'lesson' | 'manual'
const COUNTS = [10, 20, 30]
const RATINGS: [Rating, string][] = [[AGAIN, 'cards.again'], [HARD, 'cards.hard'], [GOOD, 'cards.good'], [EASY, 'cards.easy']]

/**
 * Flashcards: her decks, made by the AI from a text, a photo of a page or a finished lesson (or typed by
 * her), reviewed each day with FSRS — a card she knows well comes back after weeks, one she forgot tomorrow.
 */
export default function CardsPage() {
  const { t, locale } = usePrefs()
  const { learner, progress } = useLearner()
  const { bundle } = useContent()
  const { open } = usePlan()
  const decks = useDecks()
  const today = localDay()
  const [view, setView] = useState<'home' | 'make' | 'study' | string>('home')
  const [session, setSession] = useState<Due[]>([])
  useEffect(() => { if (learner?.code) void syncDecks(learner.code) }, [learner?.code])

  const mine = useMemo(() => Object.values(decks).filter((d) => !d.del && d.id !== LESSONS).sort((a, b) => b.at.localeCompare(a.at)), [decks])
  const due = useMemo(() => dueCards(Object.fromEntries(mine.map((d) => [d.id, d])), today, newToday(today)), [mine, today])

  const start = (only?: string) => {
    const list = only ? dueCards({ [only]: decks[only] }, today, newToday(today)) : due
    if (!list.length) { showToast(t('cards.nothing'), 'check'); return }
    setSession(list)
    setView('study')
  }

  if (view === 'study') return <Study session={session} onDone={() => setView('home')} />
  if (view === 'make') {
    return <Make bundle={bundle} done={Object.keys(progress.lessons).filter((id) => progress.lessons[id]?.done)} locale={locale}
      onBack={() => setView('home')} onPlan={() => open('cards')} onMade={(id) => { setView(id) }} />
  }
  const deck = view !== 'home' ? decks[view] : null
  if (deck) {
    const st = deckStats(deck, today)
    return (
      <>
        <Header onBack={() => setView('home')} title={deck.title} />
        <div className="section stack" style={{ gap: 12 }}>
          <section className="glass card-pad cards-stats">
            <span><b>{st.fresh}</b>{t('cards.new')}</span><span><b>{st.due}</b>{t('cards.due')}</span><span><b>{st.learnt}</b>{t('cards.learnt')}</span>
          </section>
          <button type="button" className="btn btn-block" onClick={() => start(deck.id)}>{t('cards.study')}</button>
          <section className="glass menu">
          {deck.cards.filter((c) => !c.del).map((c) => (
            <div key={c.id} className="menu-row cards-row">
              <span className="grow"><b>{c.f}</b><span>{c.b}</span></span>
              {c.st ? <span className="muted" style={{ fontSize: '0.75em' }}>{c.st.due}</span> : <span className="tag">{t('cards.new')}</span>}
              <button type="button" className="icon-btn" aria-label={t('sos.remove')} onClick={() => removeCard(deck.id, c.id)}><Icon name="x" size={16} /></button>
            </div>
          ))}
          </section>
          <button type="button" className="link-btn" style={{ color: '#e5484d' }} onClick={() => { if (window.confirm(t('cards.remove_q'))) { removeDeck(deck.id); setView('home') } }}>{t('cards.remove')}</button>
        </div>
      </>
    )
  }

  return (
    <>
      <Header back="/schools" title={t('cards.title')} />
      <div className="section stack" style={{ gap: 14 }}>
        {/* today at a glance: how many, and one button */}
        <section className="glass card-pad tool-hero">
          <span className="tool-ico is-lg" aria-hidden="true"><Icon name="layers" size={24} /></span>
          <span className="grow tool-hero-text">
            <b>{due.length ? t('cards.today').replace('{n}', String(due.length)) : t('cards.none_today')}</b>
            <span>{t('cards.how')}</span>
          </span>
        </section>
        {due.length ? <button type="button" className="btn btn-block" onClick={() => start()}><Icon name="play" size={16} /> {t('cards.study')}</button> : null}
        {mine.length ? (
          <section className="glass menu">
            {mine.map((d) => {
              const st = deckStats(d, today)
              const now = st.due + Math.min(st.fresh, 15)
              return (
                <button key={d.id} type="button" className="menu-row cards-deck" onClick={() => setView(d.id)}>
                  <Icon name="layers" size={20} />
                  <span className="grow"><b>{d.title}</b><span>{t('cards.count').replace('{n}', String(st.total))} · {t('cards.learnt')} {st.learnt}</span></span>
                  {now ? <span className="review-badge">{now}</span> : null}
                  <Icon name="forward" size={16} />
                </button>
              )
            })}
          </section>
        ) : null}
        <button type="button" className="btn btn-soft btn-block" onClick={() => setView('make')}><Icon name="sparkle" size={16} /> {t('cards.make')}</button>
      </div>
    </>
  )
}

function Make({ bundle, done, locale, onBack, onPlan, onMade }: { bundle: ReturnType<typeof useContent>['bundle']; done: string[]; locale: string; onBack: () => void; onPlan: () => void; onMade: (id: string) => void }) {
  const { t } = usePrefs()
  const [source, setSource] = useState<Source>('text')
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  const [photo, setPhoto] = useState<{ mime: string; data: string } | null>(null)
  const [lesson, setLesson] = useState('')
  const [count, setCount] = useState(20)
  const [busy, setBusy] = useState(false)
  const [manual, setManual] = useState<{ f: string; b: string }[]>([{ f: '', b: '' }])
  const lessons = done.map((id) => bundle?.lessons[id]).filter((l): l is NonNullable<typeof l> => !!l)

  const make = async () => {
    setBusy(true)
    try {
      if (source === 'manual') {
        const list = manual.filter((c) => c.f.trim() && c.b.trim())
        if (!list.length) return
        onMade(addDeck(title || t('cards.my_deck'), 'manual', list))
        return
      }
      const l = source === 'lesson' ? bundle?.lessons[lesson] : null
      const cards = await makeCards({
        lang: locale, count,
        ...(source === 'text' ? { text } : source === 'photo' && photo ? { image: photo } : l ? { text: `${l.title}\n${lessonText(l.blocks)}` } : {})
      })
      if (!cards.length) { showToast(t('cards.none_made'), 'alert'); return }
      const id = addDeck(title || l?.title || t('cards.my_deck'), source, cards)
      // repeated cards are left out: the number kept is told
      showToast(t('cards.made').replace('{n}', String(allDecks()[id]?.cards.length ?? cards.length)), 'check')
      onMade(id)
    } catch (e) {
      if (e instanceof CardsError && e.status === 402) onPlan()
      else showToast(t('state.error'), 'alert')
    } finally {
      setBusy(false)
    }
  }
  const ready = source === 'text' ? text.trim().length >= 40 : source === 'photo' ? !!photo : source === 'lesson' ? !!lesson : manual.some((c) => c.f.trim() && c.b.trim())

  return (
    <>
      <Header onBack={onBack} title={t('cards.make')} />
      <div className="section stack" style={{ gap: 12 }}>
        <div className="segmented" role="tablist">
          {(['text', 'photo', 'lesson', 'manual'] as Source[]).map((s) => (
            <button key={s} type="button" role="tab" aria-selected={source === s} onClick={() => setSource(s)}>{t(`cards.src_${s}` as 'cards.src_text')}</button>
          ))}
        </div>
        <section className="glass card-pad stack" style={{ gap: 10 }}>
          <input className="input" value={title} maxLength={120} placeholder={t('cards.deck_name')} aria-label={t('cards.deck_name')} onChange={(e) => setTitle(e.target.value)} />
          {source === 'text' ? <textarea className="input" rows={7} value={text} maxLength={30_000} placeholder={t('cards.text_ph')} aria-label={t('cards.src_text')} onChange={(e) => setText(e.target.value)} /> : null}
          {source === 'photo' ? (
            <label className="btn btn-soft btn-block"><Icon name="camera" size={18} /> {photo ? t('cards.photo_ok') : t('cards.photo')}
              <input type="file" accept="image/*" hidden aria-label={t('cards.photo')} onChange={(e) => { const f = e.target.files?.[0]; if (f) void photoData(f).then(({ mime, data }) => setPhoto({ mime, data })) }} /></label>
          ) : null}
          {source === 'lesson' ? (
            lessons.length ? (
              <select className="input" value={lesson} aria-label={t('cards.src_lesson')} onChange={(e) => setLesson(e.target.value)}>
                <option value="">{t('cards.pick_lesson')}</option>
                {lessons.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
              </select>
            ) : <span className="muted">{t('cards.no_lessons')}</span>
          ) : null}
          {source === 'manual' ? manual.map((c, i) => (
            <div key={i} className="stack" style={{ gap: 6 }}>
              <input className="input" value={c.f} maxLength={400} placeholder={t('cards.front')} aria-label={`${t('cards.front')} ${i + 1}`} onChange={(e) => setManual(manual.map((x, j) => (j === i ? { ...x, f: e.target.value } : x)))} />
              <input className="input" value={c.b} maxLength={400} placeholder={t('cards.back')} aria-label={`${t('cards.back')} ${i + 1}`}
                onChange={(e) => { const next = manual.map((x, j) => (j === i ? { ...x, b: e.target.value } : x)); setManual(i === manual.length - 1 && e.target.value ? [...next, { f: '', b: '' }] : next) }} />
            </div>
          )) : (
            <div className="sos-chips">
              {COUNTS.map((n) => <button key={n} type="button" className="chip" aria-pressed={count === n} onClick={() => setCount(n)}>{t('cards.count').replace('{n}', String(n))}</button>)}
            </div>
          )}
          <button type="button" className="btn" disabled={!ready || busy} onClick={() => void make()}>{busy ? t('cards.making') : source === 'manual' ? t('social.save') : `✨ ${t('cards.make_go')}`}</button>
        </section>
      </div>
    </>
  )
}

/** One card at a time: the front, then the back, then how well she knew it (each button says when it returns). */
function Study({ session, onDone }: { session: Due[]; onDone: () => void }) {
  const { t } = usePrefs()
  const today = localDay()
  const [queue, setQueue] = useState(session)
  const [shown, setShown] = useState(false)
  const [done, setDone] = useState(0)
  const cur = queue[0]
  if (!cur) {
    return (
      <>
        <Header onBack={onDone} title={t('cards.title')} />
        <div className="section">
          <div className="glass card-pad stack" style={{ alignItems: 'center', textAlign: 'center', gap: 10 }}>
            <span style={{ fontSize: '2.6rem' }} aria-hidden="true">🎉</span>
            <b>{t('cards.finished').replace('{n}', String(done))}</b>
            <button type="button" className="btn btn-block" onClick={onDone}>{t('mmt.done')}</button>
          </div>
        </div>
      </>
    )
  }
  const days = preview(cur.card.st, today)
  const when = (n: number) => (n === 0 ? t('cards.now') : t('cards.days').replace('{n}', String(n)))
  const pick = (g: Rating) => {
    answerCard(cur.deck.id, cur.card.id, g)
    setShown(false)
    setDone((n) => n + 1)
    // forgotten: once more at the end of today's cards, as it is now
    const fresh = allDecks()[cur.deck.id]?.cards.find((c) => c.id === cur.card.id) ?? cur.card
    setQueue((q) => (g === AGAIN ? [...q.slice(1), { ...cur, card: fresh }] : q.slice(1)))
  }
  return (
    <>
      <Header onBack={onDone} title={cur.deck.title} end={<span className="muted" style={{ paddingInlineEnd: 8 }}>{queue.length}</span>} />
      <div className="section stack" style={{ gap: 14 }}>
        <button type="button" className={`glass flashcard${shown ? ' is-shown' : ''}`} onClick={() => setShown(true)} aria-label={shown ? cur.card.b : t('cards.show')}>
          <span className="flashcard-front">{cur.card.f}</span>
          {shown ? <span className="flashcard-back">{cur.card.b}</span> : <span className="muted flashcard-hint">{t('cards.show')}</span>}
        </button>
        {shown ? (
          <div className="flashcard-rate">
            {RATINGS.map(([g, key]) => (
              <button key={g} type="button" className={`flashcard-btn is-${g}`} onClick={() => pick(g)}>
                <b>{t(key as 'cards.good')}</b><span>{when(days[g])}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </>
  )
}
