'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { Header } from '@/web/components/Header'
import { Icon } from '@/web/components/Icon'
import { showToast } from '@/web/components/Toast'
import { useLearner } from '@/web/offline/learner'
import { askPlace } from '@/web/offline/place'
import {
  activeAlert, configureGuard, exactPlace, guard, keepActive, loadPeople, localPeople, openSms, phoneDigits, savePeople, sendPlace,
  smsBody, startAlert, stopAlert, type Active, type GuardState, type Guardian
} from '@/web/offline/sos'
import { usePrefs } from '@/web/prefs'

const HOLD_MS = 1500
const SEND_EVERY_MS = 30_000
const WALKS = [10, 20, 30, 45, 60]
/** Tajikistan's numbers: one for everything, the police, the ambulance */
const NUMBERS = [['112', 'sos.n112'], ['102', 'sos.n102'], ['103', 'sos.n103']] as const

/**
 * SOS for her: a big button held for a moment sends her place to her people (WhatsApp, else SMS) and keeps it
 * going until she says she is safe; "walk me home" lets them follow her way and asks her if she arrived; a fake
 * call rings when she needs a reason to leave. On the phone, the power button pressed five times does the SOS
 * without opening the app. Free for everyone.
 */
export default function SosPage() {
  const { t, locale } = usePrefs()
  const { learner } = useLearner()
  const code = learner?.code ?? ''
  const name = (learner?.name ?? '').split(' ')[0]
  const lang = locale
  const [people, setPeople] = useState<Guardian[]>([])
  const [editing, setEditing] = useState(false)
  const [active, setActive] = useState<Active | null>(null)
  const [sent, setSent] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [hold, setHold] = useState(0)
  const [walk, setWalk] = useState(20)
  const [g, setG] = useState<GuardState | null>(null)
  const [fake, setFake] = useState<'off' | 'waiting' | 'ringing' | 'talking'>('off')
  const [caller, setCaller] = useState('')
  const [now, setNow] = useState(() => Date.now())
  const holdTimer = useRef<number | null>(null)

  useEffect(() => {
    setActive(activeAlert())
    setPeople(localPeople())
    if (code) void loadPeople(code).then((list) => { setPeople(list); if (!list.length) setEditing(true) })
    void guard().then((x) => x?.state().then(setG)).catch(() => undefined)
  }, [code])

  // the guard always knows her people and her code (it sends the SOS without the app)
  useEffect(() => {
    if (code && people.length) void configureGuard({ code, lang, name, people }).then((s) => s && setG(s)).catch(() => undefined)
  }, [code, lang, name, people])

  // an SOS sent by the power button while the app was away shows here too
  useEffect(() => {
    let off: (() => void) | undefined
    void guard().then(async (x) => {
      if (!x) return
      const h = await x.addListener('change', (s) => {
        setG(s)
        if (s.token) { const a: Active = { token: s.token, kind: s.kind ?? 'sos', link: s.link ?? '', dueAt: s.walkDue ?? null, since: Date.now() }; keepActive(a); setActive(a) }
        else { keepActive(null); setActive(null) }
      })
      off = () => void h.remove()
    })
    return () => off?.()
  }, [])

  // while an alert is open and this page is shown: her place every half minute, and a clock for the walk
  useEffect(() => {
    if (!active) return
    const tick = setInterval(() => setNow(Date.now()), 1000)
    const send = setInterval(() => {
      void exactPlace(10_000).then((p) => p && sendPlace(code, active, p)).then((open) => { if (open === false) setActive(null) })
    }, SEND_EVERY_MS)
    return () => { clearInterval(tick); clearInterval(send) }
  }, [active, code])

  const fire = useCallback(async (kind: 'sos' | 'walk' | 'late', minutes?: number) => {
    if (!code || busy) return
    if (!people.length) { setEditing(true); showToast(t('sos.need_people'), 'alert'); return }
    setBusy(true)
    if (navigator.vibrate) navigator.vibrate(kind === 'walk' ? 60 : [200, 100, 200])
    await askPlace(10_000)
    const place = await exactPlace()
    const r = await startAlert({ code, kind, place, minutes, lang })
    setBusy(false)
    if (r) setActive(activeAlert())
    setSent(r ? r.sent : 0)
    // WhatsApp could not be reached: her own SMS, with the map's link when there is one
    if (!r || (r.sent === 0 && kind !== 'walk')) openSms(people, smsBody(t('sos.sms'), name, place, r?.link))
  }, [busy, code, lang, name, people, t])

  // the walk ran over its time with the page open: asked first, then an SOS
  useEffect(() => {
    if (active?.kind !== 'walk' || !active.dueAt || now < active.dueAt) return
    if (now > active.dueAt + 3 * 60_000) { void fire('late'); return }
  }, [active, now, fire])

  const startHold = () => {
    if (busy || active?.kind === 'sos') return
    const t0 = performance.now()
    const step = () => {
      const p = Math.min(1, (performance.now() - t0) / HOLD_MS)
      setHold(p)
      if (p >= 1) { holdTimer.current = null; setHold(0); void fire('sos'); return }
      holdTimer.current = requestAnimationFrame(step)
    }
    holdTimer.current = requestAnimationFrame(step)
  }
  const endHold = () => {
    if (holdTimer.current) cancelAnimationFrame(holdTimer.current)
    holdTimer.current = null
    setHold(0)
  }

  const safe = async () => {
    await stopAlert(code, lang)
    setActive(null)
    setSent(null)
    showToast(t(active?.kind === 'walk' ? 'sos.arrived_sent' : 'sos.safe_sent'), 'check')
  }

  const toggleGuard = async () => {
    const x = await guard()
    if (!x) return
    if (!g?.enabled) {
      if (!(await askPlace(15_000, true))) { showToast(t('sos.need_place'), 'alert'); return }
      if (!g?.sms) await x.askSms().catch(() => undefined)
    }
    try { setG(await x.enable({ on: !g?.enabled })) } catch { showToast(t('sos.need_place'), 'alert') }
  }

  if (!learner) return null
  const left = active?.dueAt ? Math.max(0, active.dueAt - now) : 0
  const late = !!active?.dueAt && now >= active.dueAt
  return (
    <>
      <Header back="/profile" title={t('sos.title')} />
      <div className="section stack" style={{ gap: 14 }}>
        {active ? (
          <section className={`glass card-pad sos-live is-${active.kind}`}>
            <span className="sos-pulse" aria-hidden="true" />
            <b>{t(active.kind === 'walk' ? 'sos.walk_on' : 'sos.on')}</b>
            <span className="muted">
              {sent === 0 && active.kind === 'sos' ? t('sos.sent_sms') : t('sos.sent_to').replace('{names}', people.map((p) => p.name).join(', '))}
            </span>
            {active.kind === 'walk' && active.dueAt ? (
              <span className="sos-clock">{late ? t('sos.late_q') : `${Math.floor(left / 60_000)}:${String(Math.floor(left / 1000) % 60).padStart(2, '0')}`}</span>
            ) : null}
            <button type="button" className="btn btn-block sos-safe" onClick={() => void safe()}>
              <Icon name="check" size={18} /> {t(active.kind === 'walk' ? 'sos.arrived' : 'sos.safe')}
            </button>
          </section>
        ) : (
          <section className="sos-hero">
            <button type="button" className="sos-button" disabled={busy} style={{ ['--p' as string]: hold }}
              onPointerDown={startHold} onPointerUp={endHold} onPointerLeave={endHold} onPointerCancel={endHold}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') void fire('sos') }}
              aria-label={t('sos.hold')}>
              <span>SOS</span>
            </button>
            <span className="muted sos-hint">{busy ? t('sos.sending') : t('sos.hold')}</span>
          </section>
        )}

        {!active ? (
          <section className="glass card-pad stack" style={{ gap: 10 }}>
            <b>🚶‍♀️ {t('sos.walk')}</b>
            <span className="muted" style={{ fontSize: '0.85em' }}>{t('sos.walk_sub')}</span>
            <div className="sos-chips">
              {WALKS.map((m) => (
                <button key={m} type="button" aria-pressed={walk === m} className="chip" onClick={() => setWalk(m)}>
                  {t('sos.minutes').replace('{n}', String(m))}
                </button>
              ))}
            </div>
            <button type="button" className="btn btn-soft" disabled={busy} onClick={() => void fire('walk', walk)}>{t('sos.walk_go')}</button>
          </section>
        ) : null}

        <section className="glass card-pad stack" style={{ gap: 10 }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <b>👨‍👩‍👧 {t('sos.people')}</b>
            {!editing ? <button type="button" className="link-btn" onClick={() => setEditing(true)}>{t('sos.edit')}</button> : null}
          </div>
          {editing ? (
            <PeopleEditor people={people} onSave={async (list) => {
              try { setPeople(await savePeople(code, list)); setEditing(false); showToast(t('social.saved'), 'check') } catch { showToast(t('sos.bad_phone'), 'alert') }
            }} />
          ) : people.map((p) => (
            <div key={p.phone} className="friends-row">
              <span className="friends-ava" aria-hidden="true">{p.name.charAt(0)}</span>
              <span className="grow"><b>{p.name}</b><span>+{p.phone}</span></span>
            </div>
          ))}
        </section>

        <section className="glass card-pad stack" style={{ gap: 10 }}>
          <b>📞 {t('sos.fake')}</b>
          <span className="muted" style={{ fontSize: '0.85em' }}>{t('sos.fake_sub')}</span>
          <div className="row" style={{ gap: 8 }}>
            <input className="input grow" value={caller} maxLength={30} placeholder={t('sos.fake_name')} aria-label={t('sos.fake_name')} onChange={(e) => setCaller(e.target.value)} />
            <button type="button" className="btn" disabled={fake !== 'off'} onClick={() => { setFake('waiting'); setTimeout(() => setFake('ringing'), 5000) }}>
              {fake === 'waiting' ? '5…' : t('sos.fake_go')}
            </button>
          </div>
        </section>

        {g ? (
          <section className="glass card-pad stack" style={{ gap: 8 }}>
            <div className="row" style={{ justifyContent: 'space-between', gap: 12 }}>
              <span className="stack" style={{ gap: 2 }}><b>⚡ {t('sos.guard')}</b><span className="muted" style={{ fontSize: '0.85em' }}>{t('sos.guard_sub')}</span></span>
              <button type="button" role="switch" className="switch" aria-checked={g.enabled} onClick={() => void toggleGuard()} aria-label={t('sos.guard')} />
            </div>
            {g.enabled && !g.sms ? <button type="button" className="link-btn" onClick={() => void guard().then((x) => x?.askSms().then(setG))}>{t('sos.allow_sms')}</button> : null}
          </section>
        ) : null}

        <section className="sos-numbers">
          {NUMBERS.map(([n, key]) => (
            <a key={n} className="glass sos-number" href={`tel:${n}`}><b>{n}</b><span>{t(key)}</span></a>
          ))}
        </section>
      </div>
      {fake === 'ringing' || fake === 'talking' ? (
        <FakeCall name={caller.trim() || t('sos.fake_default')} talking={fake === 'talking'}
          onAnswer={() => setFake('talking')} onEnd={() => setFake('off')} answer={t('sos.answer')} decline={t('sos.decline')} mobile={t('sos.mobile')} />
      ) : null}
    </>
  )
}

function PeopleEditor({ people, onSave }: { people: Guardian[]; onSave: (list: Guardian[]) => Promise<void> }) {
  const { t } = usePrefs()
  const [rows, setRows] = useState<{ name: string; phone: string }[]>(() => {
    const r = people.map((p) => ({ name: p.name, phone: `+${p.phone}` }))
    return r.length ? r : [{ name: t('sos.mother'), phone: '+992' }]
  })
  const valid = rows.every((r) => r.name.trim() && phoneDigits(r.phone))
  return (
    <div className="stack" style={{ gap: 8 }}>
      {rows.map((r, i) => (
        <div key={i} className="sos-person">
          <input className="input" value={r.name} maxLength={40} placeholder={t('sos.person_name')} aria-label={`${t('sos.person_name')} ${i + 1}`}
            onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
          <input className="input" value={r.phone} inputMode="tel" maxLength={20} placeholder="+992 90 123 45 67" aria-label={`WhatsApp ${i + 1}`}
            onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, phone: e.target.value.replace(/[^\d+ ()-]/g, '') } : x)))} />
          <button type="button" className="icon-btn" aria-label={t('sos.remove')} onClick={() => setRows(rows.filter((_, j) => j !== i))}><Icon name="x" size={16} /></button>
        </div>
      ))}
      {rows.length < 3 ? <button type="button" className="link-btn" onClick={() => setRows([...rows, { name: '', phone: '+992' }])}>+ {t('sos.add_person')}</button> : null}
      <span className="muted" style={{ fontSize: '0.8em' }}>{t('sos.people_sub')}</span>
      <button type="button" className="btn" disabled={!valid} onClick={() => void onSave(rows.map((r) => ({ name: r.name.trim(), phone: phoneDigits(r.phone)! })))}>{t('social.save')}</button>
    </div>
  )
}

/** A call that looks real: rings (with the phone's vibration), answered it counts the seconds. */
function FakeCall({ name, talking, onAnswer, onEnd, answer, decline, mobile }: { name: string; talking: boolean; onAnswer: () => void; onEnd: () => void; answer: string; decline: string; mobile: string }) {
  const [secs, setSecs] = useState(0)
  useEffect(() => {
    if (talking) {
      const id = setInterval(() => setSecs((s) => s + 1), 1000)
      return () => clearInterval(id)
    }
    // a phone's ring: two tones for two seconds, then four of quiet
    let ctx: AudioContext | null = null
    try { ctx = new AudioContext() } catch { /* no sound here */ }
    const ring = () => {
      navigator.vibrate?.([800, 400, 800])
      if (!ctx) return
      const gain = ctx.createGain()
      gain.gain.value = 0.12
      gain.connect(ctx.destination)
      for (const f of [440, 480]) {
        const o = ctx.createOscillator()
        o.frequency.value = f
        o.connect(gain)
        o.start()
        o.stop(ctx.currentTime + 2)
      }
    }
    ring()
    const id = setInterval(ring, 6000)
    return () => { clearInterval(id); navigator.vibrate?.(0); void ctx?.close() }
  }, [talking])
  // over everything (the dock and the mascot too): drawn at the page's root
  return createPortal(
    <div className="fake-call" role="dialog" aria-label={name}>
      <div className="fake-call-who">
        <span className="fake-call-ava" aria-hidden="true">{name.charAt(0)}</span>
        <b>{name}</b>
        <span>{talking ? `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}` : mobile}</span>
      </div>
      <div className="fake-call-actions">
        <button type="button" className="fake-call-btn is-end" onClick={onEnd} aria-label={decline}><Icon name="phone" size={28} /></button>
        {!talking ? <button type="button" className="fake-call-btn is-answer" onClick={onAnswer} aria-label={answer}><Icon name="phone" size={28} /></button> : null}
      </div>
    </div>,
    document.body
  )
}
