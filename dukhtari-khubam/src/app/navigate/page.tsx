'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'

import { distanceText, leftFrom, metres, nextTurn, OFF_ROUTE_M, offLine, timeText, turnAngle, turnKey, type LatLon, type NavRoute } from '@/lib/navigation'
import { api, ApiFailure } from '@/web/api'
import { useAuth } from '@/web/auth'
import { CrownSpin } from '@/web/components/CrownSpin'
import { Header } from '@/web/components/Header'
import { Icon } from '@/web/components/Icon'
import { follow, hereOnce, openLocationSettings, readyToFollow, type Ready } from '@/web/offline/follow'
import { usePlan } from '@/web/plans'
import { usePrefs } from '@/web/prefs'

/**
 * "Маро бубар" (Premium): she says where she wants to go; the place is found near her, the way there is drawn
 * on the map (on foot or by car), and while she goes the app says each turn before it comes — "after 120 m,
 * turn left onto кӯчаи Шероз" — on the screen, with a buzz and in a voice; off the way, a new one is found.
 */

const NavMap = dynamic(() => import('@/web/components/NavMap').then((m) => m.NavMap), { ssr: false, loading: () => <div className="nav-map skeleton" /> })

interface Place { name: string; address: string; lat: number; lon: number }
type Mode = 'foot' | 'car'
/** the words of a turn are said again at these distances before it (metres) */
const SAY_AT = [400, 150, 40]
const ARRIVED_M = 25
/** quick searches under the box, as a map app has them */
const CATS = [
  { key: 'nav.cat_uni', emoji: '🎓' }, { key: 'nav.cat_pharmacy', emoji: '💊' }, { key: 'nav.cat_food', emoji: '🍽️' },
  { key: 'nav.cat_atm', emoji: '🏧' }, { key: 'nav.cat_fuel', emoji: '⛽' }, { key: 'nav.cat_hospital', emoji: '🏥' }
]

export default function NavigatePage() {
  const { t, locale } = usePrefs()
  const { session } = useAuth()
  const { live, plan, open } = usePlan()
  const locked = live && plan !== 'premium'
  const [ready, setReady] = useState<Ready | null>(null)
  const [here, setHere] = useState<LatLon | null>(null)
  const [q, setQ] = useState('')
  const [places, setPlaces] = useState<Place[] | null>(null)
  const [to, setTo] = useState<Place | null>(null)
  const [mode, setMode] = useState<Mode>('foot')
  const [route, setRoute] = useState<NavRoute | null>(null)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [going, setGoing] = useState(false)
  const [next, setNext] = useState(1)
  const [heading, setHeading] = useState<number | null>(null)
  const [arrived, setArrived] = useState(false)
  const [recenter, setRecenter] = useState(0)
  const said = useRef(new Set<string>())
  const offCount = useRef(0)
  const rerouting = useRef(0)
  const units = { m: t('nav.m'), km: t('nav.km'), min: t('nav.min'), h: t('nav.h') }

  // her place, once she can be followed (the location switch, the permission)
  const check = useCallback(async () => {
    const r = await readyToFollow()
    setReady(r)
    if (r === 'ok' && !here) setHere(await hereOnce())
  }, [here])
  useEffect(() => { if (session && !locked) void check() }, [session, locked]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const back = () => { if (document.visibilityState === 'visible' && ready === 'off') void check() }
    document.addEventListener('visibilitychange', back)
    return () => document.removeEventListener('visibilitychange', back)
  }, [ready, check])
  // came with a place to go to (Mahliyo: "take me to …")
  useEffect(() => {
    const asked = new URLSearchParams(window.location.search).get('to')
    if (asked) setQ(asked.slice(0, 160))
  }, [])

  // places named like her words, near her, as she stops typing
  useEffect(() => {
    if (to || q.trim().length < 2) { setPlaces(null); return }
    const timer = setTimeout(async () => {
      try {
        const near = here ? `&near=${here[0].toFixed(4)},${here[1].toFixed(4)}` : ''
        const r = await api<{ places: Place[] }>(`/nav/places?q=${encodeURIComponent(q.trim())}&lang=${locale}${near}`)
        setPlaces(r.places)
      } catch (e) {
        if (e instanceof ApiFailure && e.code === 'plan_limit') open('navigate')
        setPlaces([])
      }
    }, 650)
    return () => clearTimeout(timer)
  }, [q, here, to, locale, open])

  const findWay = useCallback(async (from: LatLon, place: Place, how: Mode) => {
    setBusy(true)
    setProblem(null)
    try {
      setRoute(await api<NavRoute>(`/nav/route?from=${from[0].toFixed(5)},${from[1].toFixed(5)}&to=${place.lat.toFixed(5)},${place.lon.toFixed(5)}&mode=${how}`))
      setNext(1)
      said.current.clear()
    } catch (e) {
      setProblem(e instanceof ApiFailure && e.code === 'no_route' ? t('nav.no_route') : t('nav.unavailable'))
    } finally {
      setBusy(false)
    }
  }, [t])

  const choose = (p: Place) => {
    setTo(p)
    setPlaces(null)
    setQ(p.name)
    if (here) void findWay(here, p, mode)
  }
  useEffect(() => { if (to && here && !going) void findWay(here, to, mode) }, [mode]) // eslint-disable-line react-hooks/exhaustive-deps

  // the words of a turn: on the screen, with a buzz, and in a voice when the phone has one for her language
  const say = useCallback((text: string) => {
    try { navigator.vibrate?.([120, 60, 120]) } catch { /* no vibration */ }
    try {
      const synth = window.speechSynthesis
      if (!synth) return
      const lang = locale === 'tg' ? 'tg' : locale === 'prs' ? 'fa' : locale
      const voice = synth.getVoices().find((v) => v.lang.toLowerCase().startsWith(lang))
      if (!voice) return
      const u = new SpeechSynthesisUtterance(text)
      u.voice = voice
      u.lang = voice.lang
      synth.cancel()
      synth.speak(u)
    } catch { /* no voice */ }
  }, [locale])

  const step = route?.steps[next]
  const words = (s: NonNullable<typeof step>) => {
    const action = t(turnKey(s) as 'nav.left').replace('{n}', String(s.exit ?? 1))
    return s.name && s.type !== 'arrive' ? `${action} — ${s.name}` : action
  }

  // going: her place again and again; the next turn, its words before it, a new way when she left this one
  useEffect(() => {
    if (!going || !route || !to) return
    let stop: (() => void) | null = null
    let gone = false
    void follow((f) => {
      if (gone) return
      setHere(f.at)
      if (f.heading !== null && Number.isFinite(f.heading)) setHeading(f.heading)
      if (metres(f.at, [to.lat, to.lon]) < ARRIVED_M) {
        setArrived(true)
        setGoing(false)
        say(t('nav.arrive'))
        return
      }
      // off the way twice in a row: a new way from here (at most every 15 seconds)
      if (offLine(f.at, route.line).metres > OFF_ROUTE_M + Math.min(30, f.accuracy)) {
        offCount.current++
        if (offCount.current >= 2 && Date.now() - rerouting.current > 15_000) {
          rerouting.current = Date.now()
          offCount.current = 0
          say(t('nav.rerouting'))
          void findWay(f.at, to, mode)
        }
        return
      }
      offCount.current = 0
      const n = nextTurn(route, f.at, next)
      if (n !== next) setNext(n)
      const s = route.steps[n]
      const d = metres(f.at, s.at)
      const mark = SAY_AT.find((m) => d <= m)
      const key = `${n}:${mark}`
      if (mark !== undefined && !said.current.has(key)) {
        said.current.add(key)
        say(d < 50 ? words(s) : `${t('nav.in').replace('{d}', distanceText(d, units))} ${words(s)}`)
      }
    }, () => undefined).then((s) => { stop = s; if (gone) s() })
    return () => { gone = true; stop?.() }
  }, [going, route, to, next, mode]) // eslint-disable-line react-hooks/exhaustive-deps

  const start = async () => {
    const r = await readyToFollow()
    setReady(r)
    if (r !== 'ok') return
    setArrived(false)
    setGoing(true)
    if (step) say(words(route!.steps[0].type === 'depart' && route!.steps[1] ? route!.steps[1] : step))
  }

  const toNext = here && step ? metres(here, step.at) : 0
  const left = route ? (going ? leftFrom(route, next, toNext) : { metres: route.distance, seconds: route.duration }) : null

  if (!session || locked) {
    return (
      <>
        <Header back="/" title={t('nav.title')} />
        <div className="section stack" style={{ gap: 14 }}>
          <div className="glass card-pad ws-locked">
            <CrownSpin plan="premium" size={92} />
            <b>{t(session ? 'nav.locked' : 'nav.title')}</b>
            <span className="muted">{t(session ? 'nav.locked_sub' : 'nav.sign_in')}</span>
            {session ? <button type="button" className="btn btn-block btn-lg" onClick={() => open('navigate')}>{t('pw.settings_cta')}</button>
              : <Link className="btn btn-block btn-lg" href="/start">{t('start.login')}</Link>}
          </div>
        </div>
      </>
    )
  }

  return (
    <div className={`nav-screen${going ? ' is-going' : ''}`}>
      <NavMap line={route?.line ?? null} me={here} heading={heading} to={to ? [to.lat, to.lon] : null} following={going} recenter={recenter} />
      {here ? (
        <button type="button" className="nav-fab nav-me-btn" aria-label={t('nav.me')} onClick={() => setRecenter((n) => n + 1)}><Icon name="target" size={22} /></button>
      ) : null}

      {going && step ? (
        <div className="nav-turn" role="status" aria-live="polite">
          <span className="nav-turn-arrow" aria-hidden="true" style={{ transform: `rotate(${turnAngle(step)}deg)` }}><Icon name="up" size={34} /></span>
          <span className="grow">
            <b>{distanceText(toNext, units)}</b>
            <span>{words(step)}</span>
          </span>
        </div>
      ) : (
        <div className="nav-top">
          <Header back="/" title={t('nav.title')} />
          <div className="nav-search glass">
            <Icon name="search" size={18} />
            <input className="grow" value={q} placeholder={t('nav.where')} aria-label={t('nav.where')} maxLength={160}
              onChange={(e) => { setQ(e.target.value); setTo(null); setRoute(null); setArrived(false) }} />
            {q ? <button type="button" className="nav-x" aria-label={t('action.close')} onClick={() => { setQ(''); setTo(null); setRoute(null) }}><Icon name="x" size={16} /></button> : null}
          </div>
          {!q && !to ? (
            <div className="nav-cats" role="group" aria-label={t('nav.where')}>
              {CATS.map((c) => (
                <button key={c.key} type="button" className="nav-cat glass" onClick={() => setQ(t(c.key as 'nav.cat_uni'))}>
                  <span aria-hidden="true">{c.emoji}</span>{t(c.key as 'nav.cat_uni')}
                </button>
              ))}
            </div>
          ) : null}
          {places ? (
            <div className="nav-places glass" role="listbox" aria-label={t('nav.where')}>
              {places.length ? places.map((p) => (
                <button key={`${p.lat},${p.lon}`} type="button" role="option" aria-selected={false} className="nav-place" onClick={() => choose(p)}>
                  <Icon name="compass" size={18} />
                  <span className="grow"><b>{p.name}</b><span>{p.address}</span></span>
                  {here ? <span className="nav-place-far">{distanceText(metres(here, [p.lat, p.lon]), units)}</span> : null}
                </button>
              )) : <span className="muted" style={{ padding: 12 }}>{t('nav.none')}</span>}
            </div>
          ) : null}
        </div>
      )}

      <div className="nav-bottom glass">
        {ready === 'off' ? (
          <div className="stack" style={{ gap: 8 }}>
            <b>{t('nav.need_location')}</b>
            <button type="button" className="btn btn-block" onClick={() => void openLocationSettings()}><Icon name="compass" size={18} /> {t('nav.turn_on')}</button>
          </div>
        ) : ready === 'refused' ? (
          <span className="muted">{t('nav.allow')}</span>
        ) : arrived ? (
          <div className="nav-arrived"><Icon name="check" size={22} /> <b>{t('nav.arrive')}</b></div>
        ) : route && left ? (
          <>
            <div className="row" style={{ gap: 12, alignItems: 'center' }}>
              <span className="grow nav-left">
                <b>{timeText(left.seconds, units)}</b>
                <span>{distanceText(left.metres, units)}{to ? ` · ${to.name}` : ''}</span>
              </span>
              {going ? (
                <button type="button" className="btn nav-stop" onClick={() => setGoing(false)}><Icon name="stop" size={16} /> {t('nav.stop')}</button>
              ) : (
                <button type="button" className="btn btn-lg nav-go" disabled={busy} onClick={() => void start()}><Icon name="arrow" size={18} /> {t('nav.go')}</button>
              )}
            </div>
            {!going ? (
              <div className="segmented" role="radiogroup" aria-label={t('nav.title')}>
                {(['foot', 'car'] as const).map((m) => <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => setMode(m)}>{t(m === 'foot' ? 'nav.foot' : 'nav.car')}</button>)}
              </div>
            ) : null}
          </>
        ) : busy ? (
          <span className="muted">{t('nav.searching')}</span>
        ) : problem ? (
          <span className="muted" role="alert">{problem}</span>
        ) : (
          <span className="muted">{here ? t('nav.lead') : ready === 'ok' ? t('nav.finding_you') : t('nav.lead')}</span>
        )}
      </div>
    </div>
  )
}
