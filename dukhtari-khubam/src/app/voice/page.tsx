'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'

import { commandOf, type VoiceCommand } from '@/lib/voiceCommands'
import { Icon } from '@/web/components/Icon'
import { useContent } from '@/web/offline/content'
import { hereOnce } from '@/web/offline/follow'
import { hey, native, skyKey, speakable, weatherAt } from '@/web/offline/hey'
import { useLearner } from '@/web/offline/learner'
import { aboutMe, ask as askMahliyo, copyOf, newChat, useMahliyo } from '@/web/offline/mahliyo'
import { placeNote } from '@/web/offline/place'
import { usePlan } from '@/web/plans'
import { usePrefs } from '@/web/prefs'

/**
 * "Эй Маҳлиё" listening: opened by her name (over the lock screen), by the phone's assistant button, or from
 * the app. What she says shows as it is heard; then it is done — the time, the date, a timer, a stopwatch,
 * the weather, a call, the way somewhere — or asked of Mahliyo, whose answer is spoken. Then the phone
 * listens for her name again.
 */

type Phase = 'listening' | 'thinking' | 'speaking' | 'idle'
interface Contact { name: string; number: string }

export default function VoicePage() {
  const { t, locale } = usePrefs()
  const router = useRouter()
  const { live, plan, open } = usePlan()
  const { learner, progress } = useLearner()
  const { bundle } = useContent()
  const { turns, pending } = useMahliyo()
  const [phase, setPhase] = useState<Phase>('idle')
  const [heard, setHeard] = useState('')
  const [answer, setAnswer] = useState('')
  const [choices, setChoices] = useState<Contact[] | null>(null)
  const [watch, setWatch] = useState<{ from: number; at: number; on: boolean } | null>(null)
  const waitingFor = useRef<number | null>(null)
  const locked = live && plan === 'free'

  const lang = locale === 'prs' ? 'fa' : locale === 'tg' ? 'tg' : locale

  const speak = useCallback(async (text: string) => {
    setAnswer(text)
    if (!native()) return
    setPhase('speaking')
    const { p } = await hey()
    try { await p.speak({ text: speakable(text), lang }) } catch { /* no voice on this phone */ }
    setPhase('idle')
  }, [lang])

  const finish = useCallback(async () => {
    if (!native()) return
    const { p } = await hey()
    // the phone listens for her name again
    await p.resume().catch(() => undefined)
  }, [])

  const act = useCallback(async (c: VoiceCommand) => {
    const now = new Date()
    const tag = locale === 'tg' ? 'tg-TJ' : locale === 'prs' ? 'fa-AF' : locale
    switch (c.kind) {
      case 'time':
        return speak(t('voice.time').replace('{t}', now.toLocaleTimeString(tag, { hour: '2-digit', minute: '2-digit', hour12: locale === 'en' })))
      case 'date':
        return speak(t('voice.date').replace('{d}', now.toLocaleDateString(tag, { weekday: 'long', day: 'numeric', month: 'long' })))
      case 'timer': {
        const { p } = await hey()
        const m = Math.floor(c.seconds / 60), s = c.seconds % 60
        const span = [m ? `${m} ${t('nav.min')}` : '', s ? `${s} ${t('voice.sec')}` : ''].filter(Boolean).join(' ')
        try { await p.setTimer({ seconds: c.seconds, label: 'Маҳлиё' }) } catch { return speak(t('voice.no_clock')) }
        return speak(t('voice.timer').replace('{d}', span))
      }
      case 'stopwatch':
        setWatch({ from: Date.now(), at: Date.now(), on: true })
        return speak(t('voice.stopwatch'))
      case 'weather': {
        const at = await hereOnce()
        if (!at) return speak(t('voice.no_place'))
        try {
          const w = await weatherAt(at, c.when)
          const sky = t(skyKey(w.code) as 'wx.clear')
          return speak(c.when === 'tomorrow'
            ? t('voice.weather_tomorrow').replace('{sky}', sky).replace('{max}', String(w.max)).replace('{min}', String(w.min))
            : t('voice.weather_now').replace('{t}', String(w.temp)).replace('{sky}', sky).replace('{wind}', String(w.wind)).replace('{max}', String(w.max)))
        } catch {
          return speak(t('nav.unavailable'))
        }
      }
      case 'call': {
        const { p } = await hey()
        const { granted } = await p.askCalls()
        if (!granted) return speak(t('voice.no_contacts'))
        const { contacts } = await p.findContacts({ name: c.name })
        if (!contacts.length) return speak(t('voice.nobody').replace('{n}', c.name))
        if (contacts.length > 1) { setChoices(contacts); return speak(t('voice.which')) }
        await speak(t('voice.calling').replace('{n}', contacts[0].name))
        return p.callNumber({ number: contacts[0].number })
      }
      case 'navigate':
        await speak(t('voice.leading').replace('{p}', c.place))
        return router.push(`/navigate?to=${encodeURIComponent(c.place)}`)
      case 'ask': {
        if (!c.text) return speak(t('voice.didnt_hear'))
        setPhase('thinking')
        newChat()
        waitingFor.current = Date.now()
        const who = { code: learner?.code, name: learner?.name, me: aboutMe(learner?.name, progress, bundle), account: learner?.code || learner?.email, place: placeNote() }
        await askMahliyo(c.text, who)
        return undefined
      }
    }
  }, [t, locale, speak, router, learner, progress, bundle])

  // her answer came in the chat: spoken
  useEffect(() => {
    if (waitingFor.current === null || pending) return
    const last = turns[turns.length - 1]
    if (last?.role !== 'assistant') return
    waitingFor.current = null
    void speak(copyOf(last)).then(finish)
  }, [turns, pending, speak, finish])

  const listen = useCallback(async () => {
    if (!native()) return
    const { p } = await hey()
    setChoices(null)
    setAnswer('')
    setHeard('')
    setPhase('listening')
    const l = await p.addListener('partial', (e) => setHeard(e.text))
    let text = ''
    try {
      text = (await p.listen({ seconds: 9 })).text
    } catch {
      setPhase('idle')
      return
    } finally {
      void l.remove()
    }
    setHeard(text)
    const c = commandOf(text)
    await act(c)
    if (c.kind !== 'ask') await finish()
  }, [act, finish])

  // opened: she is listened to at once
  useEffect(() => {
    if (!locked) void listen()
    return () => { void hey().then(({ p }) => { void p.stopListening(); void p.stopSpeaking(); void p.resume() }).catch(() => undefined) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  // opened again by her name while here
  useEffect(() => {
    if (!native()) return
    let remove: (() => void) | null = null
    void hey().then(({ p }) => p.addListener('wake', () => void listen())).then((h) => { remove = () => void h.remove() })
    return () => remove?.()
  }, [listen])

  // the stopwatch ticking
  useEffect(() => {
    if (!watch?.on) return
    const timer = setInterval(() => setWatch((w) => (w ? { ...w, at: Date.now() } : w)), 100)
    return () => clearInterval(timer)
  }, [watch?.on])
  const shown = watch ? (() => {
    const ms = watch.at - watch.from
    const m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000), cs = Math.floor((ms % 1000) / 10)
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(cs).padStart(2, '0')}`
  })() : null

  if (locked) {
    return (
      <div className="voice-screen">
        <div className="voice-orb" aria-hidden="true" />
        <p className="voice-said">{t('hey.locked')}</p>
        <button type="button" className="btn btn-lg" onClick={() => open('hey')}>{t('pw.settings_cta')}</button>
      </div>
    )
  }

  return (
    <div className={`voice-screen is-${phase}`}>
      <button type="button" className="voice-x" aria-label={t('action.close')} onClick={() => (history.length > 1 ? router.back() : router.push('/'))}><Icon name="x" size={22} /></button>
      <div className="voice-orb" aria-hidden="true"><span /><span /><span /></div>
      <p className="voice-state" role="status">{phase === 'listening' ? t('hey.listening') : phase === 'thinking' ? t('ai.thinking') : phase === 'speaking' ? t('voice.speaking') : ' '}</p>
      <p className="voice-said" aria-live="polite">{heard || (phase === 'listening' ? t('voice.say') : '')}</p>
      {answer ? <p className="voice-answer">{answer}</p> : null}
      {choices ? (
        <div className="voice-choices">
          {choices.map((c) => (
            <button key={c.number} type="button" className="glass" onClick={() => void hey().then(({ p }) => p.callNumber({ number: c.number }))}>
              <Icon name="phone" size={18} /> <b>{c.name}</b> <span>{c.number}</span>
            </button>
          ))}
        </div>
      ) : null}
      {shown ? (
        <div className="voice-watch">
          <b>{shown}</b>
          <button type="button" className="btn btn-soft" onClick={() => setWatch((w) => (w ? { ...w, on: !w.on, from: w.on ? w.from : Date.now() - (w.at - w.from) } : w))}>{watch?.on ? t('nav.stop') : t('nav.go')}</button>
        </div>
      ) : null}
      <button type="button" className={`voice-mic${phase === 'listening' ? ' is-live' : ''}`} aria-label={t('hey.speak')} disabled={phase === 'listening' || phase === 'thinking'} onClick={() => void listen()}>
        <Icon name="mic" size={30} />
      </button>
      {!native() ? <p className="muted">{t('hey.phone_only')}</p> : null}
    </div>
  )
}
