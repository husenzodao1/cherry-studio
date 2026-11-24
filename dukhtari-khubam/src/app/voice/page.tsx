'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'

import { commandOf, matchContacts, type VoiceCommand } from '@/lib/voiceCommands'
import { api } from '@/web/api'
import { Icon } from '@/web/components/Icon'
import { useContent } from '@/web/offline/content'
import { hereOnce } from '@/web/offline/follow'
import { hey, native, skyKey, speakable, voiceLang, weatherAt } from '@/web/offline/hey'
import { useLearner } from '@/web/offline/learner'
import { aboutMe, ask as askMahliyo, copyOf, newChat, useMahliyo } from '@/web/offline/mahliyo'
import { placeNote } from '@/web/offline/place'
import { usePlan } from '@/web/plans'
import { usePrefs } from '@/web/prefs'
import { markTried } from '@/web/offline/tried'

/**
 * "Эй Маҳлиё" listening: opened by her name (over the lock screen), by the phone's assistant button, or from
 * the app. What she says shows as it is heard (the phone's own model, in her language when it is downloaded);
 * online, the recording is heard again by the server's AI, which knows all seven languages well. Then it is
 * done — the time, the date, a timer, a stopwatch, the weather, a call (a contact by name, or a number said
 * aloud), the way somewhere — or, online, asked of Mahliyo: her answer is spoken, and she listens again, as
 * in a conversation, until she is thanked or nothing more is said. With headphones on, her voice is in them;
 * "Speaker" puts it on the phone's speaker. Then the phone listens for her name again.
 */

type Phase = 'listening' | 'thinking' | 'speaking' | 'idle'
interface Contact { name: string; number: string }

export default function VoicePage() {
  useEffect(() => markTried('hey'), [])
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
  /** a conversation going on in this screen (her questions and Mahliyo's answers kept together) */
  const talking = useRef(false)
  const [headset, setHeadset] = useState(false)
  const [loud, setLoud] = useState(false)
  const locked = live && plan === 'free'

  const lang = voiceLang(locale)

  const speak = useCallback(async (text: string) => {
    setAnswer(text)
    if (!native()) return
    setPhase('speaking')
    const { p } = await hey()
    try { await p.speak({ text: speakable(text), lang, speaker: loud }) } catch { /* no voice on this phone */ }
    setPhase('idle')
  }, [lang, loud])
  useEffect(() => {
    if (!native()) return
    const look = () => void hey().then(({ p }) => p.state()).then((s) => setHeadset(!!s.headset)).catch(() => undefined)
    look()
    const every = setInterval(look, 4000)
    return () => clearInterval(every)
  }, [])

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
        // a number said aloud: called as it is
        if (c.number) {
          await speak(t('voice.calling').replace('{n}', c.number.replace(/(\d{3})(?=\d)/g, '$1 ')))
          return p.callNumber({ number: c.number })
        }
        const found = matchContacts(c.name, (await p.contacts()).contacts)
        if (!found.length) return speak(t('voice.nobody').replace('{n}', c.name))
        if (found.length > 1) { setChoices(found.slice(0, 6)); return speak(t('voice.which')) }
        await speak(t('voice.calling').replace('{n}', found[0].name))
        return p.callNumber({ number: found[0].number })
      }
      case 'navigate':
        await speak(t('voice.leading').replace('{p}', c.place))
        return router.push(`/navigate?to=${encodeURIComponent(c.place)}`)
      case 'ask': {
        if (!c.text) return speak(t('voice.didnt_hear'))
        // offline: the phone's own tasks only
        if (typeof navigator !== 'undefined' && navigator.onLine === false) return speak(t('voice.offline'))
        setPhase('thinking')
        // the first question here starts a new conversation; the next ones go on with it
        if (!talking.current) newChat()
        talking.current = true
        waitingFor.current = Date.now()
        const who = { code: learner?.code, name: learner?.name, me: aboutMe(learner?.name, progress, bundle), account: learner?.code || learner?.email, place: placeNote() }
        await askMahliyo(c.text, who)
        return undefined
      }
    }
  }, [t, locale, speak, router, learner, progress, bundle])

  const listenRef = useRef<(again?: boolean) => Promise<void>>(async () => undefined)
  // her answer came in the chat: spoken; then she is listened to again (a conversation)
  useEffect(() => {
    if (waitingFor.current === null || pending) return
    const last = turns[turns.length - 1]
    if (last?.role !== 'assistant') return
    waitingFor.current = null
    void speak(copyOf(last)).then(() => listenRef.current(true))
  }, [turns, pending, speak])

  /** what she said: the phone's model at once; online, the server's AI hears the recording again (better) */
  const hearOnline = async (wav: string | undefined, local: string) => {
    if (!wav || !navigator.onLine) return local
    try {
      const r = await api<{ text: string }>('/voice/hear', { method: 'POST', body: { wav, lang: locale }, signal: AbortSignal.timeout(14_000) })
      return r.text.trim() || local
    } catch {
      return local
    }
  }

  const listen = useCallback(async (again = false) => {
    if (!native()) return
    const { p } = await hey()
    setChoices(null)
    if (!again) setAnswer('')
    setHeard('')
    setPhase('listening')
    const l = await p.addListener('partial', (e) => setHeard(e.text))
    let text = ''
    try {
      const r = await p.listen({ seconds: again ? 8 : 12, lang, audio: navigator.onLine })
      if (r.text || r.wav) {
        setPhase('thinking')
        text = await hearOnline(r.wav, r.text)
      }
    } catch {
      setPhase('idle')
      return
    } finally {
      void l.remove()
    }
    setHeard(text)
    // in a conversation: silence or "thank you" ends it
    if (again && (!text.trim() || /^(раҳмат|рахмат|ташаккур|бас|хайр|спасибо|хватит|стоп|thanks?( you)?|stop|bye|rahmat|teşekkürler|مرسی|ممنون)\b/i.test(text.trim()))) {
      setPhase('idle')
      talking.current = false
      return finish()
    }
    const c = commandOf(text)
    await act(c)
    if (c.kind !== 'ask') await finish()
  }, [act, finish, lang, locale]) // eslint-disable-line react-hooks/exhaustive-deps
  listenRef.current = listen

  // opened: she is listened to at once (once her plan is known to allow it: it may come a moment later)
  const began = useRef(false)
  useEffect(() => {
    if (locked || began.current) return
    began.current = true
    void listen()
  }, [locked]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { void hey().then(({ p }) => { void p.stopListening(); void p.stopSpeaking(); void p.resume() }).catch(() => undefined) }, [])
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
      {headset ? (
        <button type="button" className={`voice-out${loud ? ' is-on' : ''}`} aria-pressed={loud} onClick={() => setLoud(!loud)}>
          <Icon name={loud ? 'volume' : 'headphones'} size={16} /> {loud ? t('ai.call_speaker') : t('voice.headphones')}
        </button>
      ) : null}
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
