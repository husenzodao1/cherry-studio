'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'

import { ART, SCHOOL_ART } from '@/web/art'
import { Icon } from '@/web/components/Icon'
import { Orbit } from '@/web/components/Orbit'
import { playIntro } from '@/web/intro'
import { useContent } from '@/web/offline/content'
import { useLearner } from '@/web/offline/learner'
import { allowNotifications, canNotify, lines, readNotify, writeNotify } from '@/web/offline/notify'
import { usePrefs } from '@/web/prefs'

const CUSTOM = '\u0000custom'
const PREPARE_MS = 4600

/** One question: the 3D picture floating above, the question, its options and "your own answer". */
function Choice({ options, value, onChange, custom, onCustom }: {
  options: string[]; value: string | null; onChange: (v: string) => void; custom: string; onCustom: (v: string) => void
}) {
  const { t } = usePrefs()
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (value === CUSTOM) input.current?.focus()
  }, [value])
  return (
    <div className="wl-options" role="radiogroup">
      {options.map((o, i) => (
        <button key={o} type="button" role="radio" aria-checked={value === o} className="wl-option" style={{ ['--i' as string]: i }} onClick={() => onChange(o)}>
          <span className="wl-radio" aria-hidden="true" />{o}
        </button>
      ))}
      <button type="button" role="radio" aria-checked={value === CUSTOM} className="wl-option" style={{ ['--i' as string]: options.length }} onClick={() => onChange(CUSTOM)}>
        <span className="wl-radio" aria-hidden="true" />{t('welcome.custom')}
      </button>
      {value === CUSTOM ? (
        <input ref={input} className="input wl-custom" value={custom} maxLength={80} placeholder={t('welcome.custom_ph')} onChange={(e) => onCustom(e.target.value)} />
      ) : null}
    </div>
  )
}

/**
 * Welcome questions, once after signing in, one at a time: time a day (a clock), the mirrors she wants to
 * learn (a girl among floating symbols), where she heard of the app (a pin and a speech bubble). Then the
 * pictures and the schools circle a large filling percentage while "preparing your lessons…" runs.
 * Every text and option comes from the panel (Матнҳо → Саволнома).
 */
export default function Welcome() {
  const { t } = usePrefs()
  const router = useRouter()
  const { bundle } = useContent()
  const { learner, progress, answerWelcome } = useLearner()
  const [step, setStep] = useState(0)
  const [time, setTime] = useState<string | null>(null)
  const [timeOwn, setTimeOwn] = useState('')
  const [schools, setSchools] = useState<string[]>([])
  const [source, setSource] = useState<string | null>(null)
  const [sourceOwn, setSourceOwn] = useState('')
  const [pct, setPct] = useState(0)
  const done = useRef(false)

  // answered already (another phone, or back here by mistake): straight home
  useEffect(() => {
    if (progress.about && step < 3) router.replace('/')
  }, [progress.about, step, router])

  const schoolList = bundle?.schools ?? []
  const answer = (v: string | null, own: string) => (v === CUSTOM ? own.trim() : v ?? '')
  const ok = step === 0 ? !!answer(time, timeOwn) : step === 1 ? schools.length > 0 : !!answer(source, sourceOwn)

  const finish = (skip = false) => {
    if (done.current) return
    done.current = true
    answerWelcome(skip ? {} : { time: answer(time, timeOwn), schools, source: answer(source, sourceOwn) })
    setStep(3)
  }

  // the preparing screen: the percentage fills, then reminders are offered and home opens
  useEffect(() => {
    if (step !== 3) return
    const start = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / PREPARE_MS)
      setPct(Math.round(100 * (1 - Math.pow(1 - k, 2.2))))
      if (k < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    const timer = setTimeout(async () => {
      if (canNotify() && (await allowNotifications().catch(() => false))) {
        const p = readNotify()
        writeNotify({ ...p, lesson: { ...p.lesson, on: true } })
      }
      playIntro(true)
      router.replace('/')
    }, PREPARE_MS + 900)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(timer)
    }
  }, [step, router])

  const orbit = useMemo(() => [
    '/assets/3d/welcome-clock.webp', '/assets/3d/welcome-girl.webp', '/assets/3d/welcome-track.webp', ART.flower.src, ART.book.src,
    ...(schools.length ? schools : schoolList.map((s) => s.slug)).map((slug) => SCHOOL_ART[slug]?.src).filter(Boolean).slice(0, 5) as string[]
  ], [schools, schoolList])

  if (!learner) return null

  if (step === 3) {
    const r = 104
    const len = 2 * Math.PI * r
    return (
      <div className="wl wl-prepare">
        <Orbit items={orbit}>
          <svg className="wl-ring" viewBox="0 0 260 260" aria-hidden="true">
            <defs>
              <linearGradient id="wl-ring" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffb08f" /><stop offset="0.55" stopColor="#f2737a" /><stop offset="1" stopColor="#d9487f" /></linearGradient>
            </defs>
            <circle cx="130" cy="130" r={r} className="wl-ring-track" />
            <circle cx="130" cy="130" r={r} className="wl-ring-fill" strokeDasharray={len} strokeDashoffset={len * (1 - pct / 100)} />
          </svg>
          <div className="wl-pct" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <span className="wl-num">{pct}</span><span className="wl-sign">%</span>
          </div>
        </Orbit>
        <p className="wl-preparing" role="status">
          {pct < 100 ? <>{t('welcome.preparing')}<span className="wl-dots" aria-hidden="true"><i>.</i><i>.</i><i>.</i></span></> : <b className="wl-ready">{t('welcome.ready')} ✨</b>}
        </p>
      </div>
    )
  }

  const art = ['/assets/3d/welcome-clock.webp', '/assets/3d/welcome-girl.webp', '/assets/3d/welcome-track.webp'][step]
  const question = t(step === 0 ? 'welcome.time.q' : step === 1 ? 'welcome.schools.q' : 'welcome.source.q')
  return (
    <div className="wl">
      <div className="wl-top">
        <div className="wl-steps" aria-label={t('welcome.step').replace('{n}', String(step + 1)).replace('{total}', '3')}>
          {[0, 1, 2].map((i) => <span key={i} className={i < step ? 'is-done' : i === step ? 'is-now' : ''} />)}
        </div>
        <button type="button" className="link-btn" onClick={() => finish(true)}>{t('welcome.skip')}</button>
      </div>
      <div className="wl-step" key={step}>
        <div className="wl-art"><span className="wl-glow" aria-hidden="true" /><img src={art} alt="" aria-hidden="true" /></div>
        <span className="eyebrow">{t('welcome.step').replace('{n}', String(step + 1)).replace('{total}', '3')}</span>
        <h1 className="wl-q">{question}</h1>
        {step === 0 ? (
          <Choice options={lines(t('welcome.time.options'))} value={time} onChange={setTime} custom={timeOwn} onCustom={setTimeOwn} />
        ) : step === 1 ? (
          <>
            <p className="muted wl-hint">{t('welcome.schools.hint')}</p>
            <div className="wl-schools" role="group" aria-label={question}>
              {schoolList.map((s, i) => {
                const on = schools.includes(s.slug)
                const icon = s.icon?.url ?? SCHOOL_ART[s.slug]?.src
                return (
                  <button key={s.id} type="button" aria-pressed={on} className="wl-school" style={{ ['--i' as string]: i }}
                    onClick={() => setSchools(on ? schools.filter((x) => x !== s.slug) : [...schools, s.slug])}>
                    {icon ? <img src={icon} alt="" aria-hidden="true" /> : null}
                    <span>{s.title}</span>
                    <span className="wl-check" aria-hidden="true"><Icon name="check" size={14} strokeWidth={2.4} /></span>
                  </button>
                )
              })}
              {/* "next" fills the last place of the grid, so the boxes stay even */}
              <button type="button" className={`btn wl-school-next${schoolList.length % 2 === 0 ? ' is-wide' : ''}`} disabled={!ok} onClick={() => setStep(2)}>
                {t('welcome.next')} <Icon name="arrow" size={18} />
              </button>
            </div>
          </>
        ) : (
          <Choice options={lines(t('welcome.source.options'))} value={source} onChange={setSource} custom={sourceOwn} onCustom={setSourceOwn} />
        )}
      </div>
      {step === 1 ? null : (
        <button type="button" className="btn btn-block btn-lg wl-next" disabled={!ok} onClick={() => (step < 2 ? setStep(step + 1) : finish())}>
          {t('welcome.next')} <Icon name="arrow" size={18} />
        </button>
      )}
    </div>
  )
}
