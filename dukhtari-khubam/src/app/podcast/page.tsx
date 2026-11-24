'use client'

import { useEffect, useRef, useState } from 'react'

import { Header } from '@/web/components/Header'
import { Icon } from '@/web/components/Icon'
import { showToast } from '@/web/components/Toast'
import { lessonText, photoData } from '@/web/files/studyInput'
import { apiUrl } from '@/web/offline/base'
import { useContent } from '@/web/offline/content'
import { useLearner } from '@/web/offline/learner'
import { supportToken } from '@/web/offline/support'
import { usePlan } from '@/web/plans'
import { usePrefs } from '@/web/prefs'

interface Line { who: 'A' | 'B'; text: string }
interface Part { lines: Line[]; exp: number; sig: string }
interface Saved { id: string; title: string; at: string; lang: string; lines: Line[][] }
type Source = 'text' | 'photo' | 'lesson'

const LIST = 'podcasts'
const MINUTES = [3, 5, 8] as const

async function session(): Promise<string | undefined> {
  try {
    const { browserSupabase } = await import('@/web/supabase-browser')
    const { data } = await browserSupabase()?.auth.getSession() ?? { data: { session: null } }
    return data.session?.access_token ?? undefined
  } catch {
    return undefined
  }
}
const idb = () => import('idb-keyval')
const b64ToBlob = (b64: string) => new Blob([Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))], { type: 'audio/wav' })

/**
 * A podcast from a lecture: her material (a text, a photo of a page, a finished lesson) becomes a conversation —
 * Mahliyo explains, Sitora asks — voiced by two speakers, playing part by part while the next is made. Kept on
 * the phone to listen again offline (on the way, before sleep).
 */
export default function PodcastPage() {
  const { t, locale } = usePrefs()
  const { progress } = useLearner()
  const { bundle } = useContent()
  const { open } = usePlan()
  const [source, setSource] = useState<Source>('text')
  const [text, setText] = useState('')
  const [photo, setPhoto] = useState<{ mime: string; data: string } | null>(null)
  const [lesson, setLesson] = useState('')
  const [minutes, setMinutes] = useState<(typeof MINUTES)[number]>(5)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState<Saved[]>([])
  const [playing, setPlaying] = useState<Saved | null>(null)
  const lessons = Object.keys(progress.lessons).filter((id) => progress.lessons[id]?.done).map((id) => bundle?.lessons[id]).filter((l): l is NonNullable<typeof l> => !!l)

  useEffect(() => { void idb().then(({ get }) => get<Saved[]>(LIST)).then((l) => setSaved(l ?? [])).catch(() => undefined) }, [])

  const make = async () => {
    setBusy(true)
    try {
      const l = source === 'lesson' ? bundle?.lessons[lesson] : null
      const res = await fetch(apiUrl('/study/podcast'), {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          token: supportToken(), session: await session(), lang: locale, minutes,
          ...(source === 'text' ? { text } : source === 'photo' && photo ? { image: photo } : l ? { text: `${l.title}\n${lessonText(l.blocks, 40_000)}` } : {})
        })
      })
      if (res.status === 402) { open('podcast'); return }
      if (!res.ok) throw new Error(String(res.status))
      const r = (await res.json()) as { title: string; parts: Part[] }
      const item: Saved = { id: Date.now().toString(36), title: r.title, at: new Date().toISOString(), lang: locale, lines: r.parts.map((p) => p.lines) }
      setPlaying({ ...item, parts: r.parts } as Saved & { parts: Part[] })
    } catch {
      showToast(t('state.error'), 'alert')
    } finally {
      setBusy(false)
    }
  }

  if (playing) {
    return <Player item={playing} onBack={() => { setPlaying(null); void idb().then(({ get }) => get<Saved[]>(LIST)).then((l) => setSaved(l ?? [])) }} />
  }
  const ready = source === 'text' ? text.trim().length >= 80 : source === 'photo' ? !!photo : !!lesson
  return (
    <>
      <Header back="/schools" title={t('pod.title')} />
      <div className="section stack" style={{ gap: 12 }}>
        <section className="glass card-pad pod-hero">
          <span aria-hidden="true">🎧</span>
          <span className="muted">{t('pod.sub')}</span>
        </section>
        <div className="segmented" role="tablist">
          {(['text', 'photo', 'lesson'] as Source[]).map((s) => (
            <button key={s} type="button" role="tab" aria-selected={source === s} onClick={() => setSource(s)}>{t(`cards.src_${s}` as 'cards.src_text')}</button>
          ))}
        </div>
        <section className="glass card-pad stack" style={{ gap: 10 }}>
          {source === 'text' ? <textarea className="input" rows={7} value={text} maxLength={40_000} placeholder={t('pod.text_ph')} aria-label={t('cards.src_text')} onChange={(e) => setText(e.target.value)} /> : null}
          {source === 'photo' ? (
            <label className="btn btn-soft btn-block"><Icon name="camera" size={18} /> {photo ? t('cards.photo_ok') : t('cards.photo')}
              <input type="file" accept="image/*" hidden aria-label={t('cards.photo')} onChange={(e) => { const f = e.target.files?.[0]; if (f) void photoData(f).then(({ mime, data }) => setPhoto({ mime, data })) }} /></label>
          ) : null}
          {source === 'lesson' ? (lessons.length ? (
            <select className="input" value={lesson} aria-label={t('cards.src_lesson')} onChange={(e) => setLesson(e.target.value)}>
              <option value="">{t('cards.pick_lesson')}</option>
              {lessons.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
            </select>
          ) : <span className="muted">{t('cards.no_lessons')}</span>) : null}
          <div className="sos-chips">
            {MINUTES.map((m) => <button key={m} type="button" className="chip" aria-pressed={minutes === m} onClick={() => setMinutes(m)}>{t('sos.minutes').replace('{n}', String(m))}</button>)}
          </div>
          <button type="button" className="btn" disabled={!ready || busy} onClick={() => void make()}>{busy ? t('pod.writing') : `🎙️ ${t('pod.make')}`}</button>
        </section>
        {saved.length ? (
          <section className="glass card-pad stack" style={{ gap: 4 }}>
            <b>{t('pod.saved')}</b>
            {saved.map((s) => (
              <button key={s.id} type="button" className="cards-deck" style={{ padding: '10px 0', background: 'none' }} onClick={() => setPlaying(s)}>
                <span aria-hidden="true">🎧</span>
                <span className="grow"><b>{s.title}</b><span>{new Date(s.at).toLocaleDateString()}</span></span>
                <Icon name="play" size={16} />
              </button>
            ))}
          </section>
        ) : null}
      </div>
    </>
  )
}

/**
 * Plays a podcast part by part: a new one is voiced by the server (the next one made while the current one
 * plays) and kept on the phone; a kept one plays from the phone, offline too.
 */
function Player({ item, onBack }: { item: Saved & { parts?: Part[] }; onBack: () => void }) {
  const { t } = usePrefs()
  const [index, setIndex] = useState(0)
  const [ready, setReady] = useState<Record<number, string>>({})
  const [paused, setPaused] = useState(false)
  const [failed, setFailed] = useState(false)
  const audio = useRef<HTMLAudioElement | null>(null)
  const asked = useRef(new Set<number>())

  // a part's sound: kept on the phone, or voiced now (and kept)
  const fetchPart = async (i: number) => {
    if (asked.current.has(i) || i >= item.lines.length) return
    asked.current.add(i)
    const { get, set } = await idb()
    const key = `podcast:${item.id}:${i}`
    let b64 = await get<string>(key).catch(() => undefined)
    if (!b64 && item.parts?.[i]) {
      const res = await fetch(apiUrl('/study/podcast/voice'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ lang: item.lang, part: item.parts[i] }) })
      if (res.ok) {
        b64 = ((await res.json()) as { wav: string }).wav
        await set(key, b64).catch(() => undefined)
        // the first part made: the podcast joins her list
        if (i === 0) {
          const list = (await get<Saved[]>(LIST).catch(() => undefined)) ?? []
          await set(LIST, [{ id: item.id, title: item.title, at: item.at, lang: item.lang, lines: item.lines }, ...list.filter((x) => x.id !== item.id)].slice(0, 30))
        }
      }
    }
    if (b64) setReady((r) => ({ ...r, [i]: URL.createObjectURL(b64ToBlob(b64)) }))
    else if (i === 0) setFailed(true)
  }
  useEffect(() => { void fetchPart(index); void fetchPart(index + 1) }, [index]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const src = ready[index]
    const a = audio.current
    if (!src || !a || paused) return
    if (a.src !== src) { a.src = src; void a.play().catch(() => setPaused(true)) }
  }, [ready, index, paused])

  const toggle = () => {
    const a = audio.current
    if (!a) return
    if (a.paused) { setPaused(false); void a.play().catch(() => undefined) } else { setPaused(true); a.pause() }
  }
  const done = index >= item.lines.length
  return (
    <>
      <Header onBack={onBack} title={item.title} />
      <div className="section stack" style={{ gap: 12 }}>
        <audio ref={audio} onEnded={() => setIndex((i) => i + 1)} hidden />
        <section className="glass card-pad pod-player">
          <span className={`pod-disc${!paused && !done && ready[index] ? ' is-on' : ''}`} aria-hidden="true">🎧</span>
          <span className="muted">{failed ? t('pod.no_voice') : done ? t('pod.done') : ready[index] ? `${index + 1} / ${item.lines.length}` : t('pod.voicing')}</span>
          <div className="row" style={{ gap: 10 }}>
            <button type="button" className="icon-btn" aria-label={t('action.back')} disabled={index === 0} onClick={() => setIndex((i) => Math.max(0, i - 1))}><Icon name="back" /></button>
            <button type="button" className="btn pod-play" aria-label={paused ? t('pod.play') : t('pod.pause')} disabled={!ready[index]} onClick={toggle}><Icon name={paused ? 'play' : 'pause'} size={22} /></button>
            <button type="button" className="icon-btn" aria-label={t('action.next')} disabled={index >= item.lines.length - 1} onClick={() => setIndex((i) => i + 1)}><Icon name="forward" /></button>
          </div>
        </section>
        <section className="glass card-pad stack" style={{ gap: 8 }}>
          {item.lines.map((part, i) => part.map((l, k) => (
            <p key={`${i}-${k}`} className={`pod-line is-${l.who}${i === index ? ' is-now' : ''}`}><b>{t(l.who === 'A' ? 'pod.host' : 'pod.guest')}</b> {l.text}</p>
          )))}
        </section>
      </div>
    </>
  )
}
