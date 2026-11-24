'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

import { matchContacts } from '@/lib/voiceCommands'

import { LiveTalk, type LiveOptions, type LiveState } from '../live/liveTalk'
import { hereOnce } from '../offline/follow'
import { hey, native, weatherAt } from '../offline/hey'
import { usePlan } from '../plans'
import { usePrefs } from '../prefs'
import { Icon } from './Icon'
import { SongPlayer } from './SongPlayer'

/**
 * Mahliyo live (Gemini Live): she listens and answers in her own voice, as in a phone call; what each says is
 * written on the screen. With the camera she sees what the learner shows (and a sharp photo on "Акс"). The phone
 * does what she is asked: a timer, a call, a song, the way, the weather, a page of the app.
 */
const PAGES: Record<string, string> = { home: '/', schools: '/schools', library: '/library', workspace: '/workspace', profile: '/profile', settings: '/settings', plans: '/premium', chat: '/mahliyo' }

export function LiveScreen({ mode, scenario, name, me, onFallback }: {
  mode: LiveOptions['mode']; scenario?: LiveOptions['scenario']; name?: string; me?: string
  /** the live voice is not there (offline, not connected): the phone's own listening is used */
  onFallback: () => void
}) {
  const { t, locale, mode: appMode } = usePrefs()
  const router = useRouter()
  const { open } = usePlan()
  const [state, setState] = useState<LiveState>('connecting')
  const [heard, setHeard] = useState('')
  const [said, setSaid] = useState('')
  const [song, setSong] = useState<string | null>(null)
  const [camera, setCamera] = useState(mode === 'camera')
  const talk = useRef<LiveTalk | null>(null)
  const video = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    let gone = false
    const lang = locale === 'prs' ? 'fa' : locale
    const tool: LiveOptions['onTool'] = async (fn, a) => {
      const p = native() ? (await hey()).p : null
      switch (fn) {
        case 'set_timer':
          if (!p) return { error: 'not on this device' }
          await p.setTimer({ seconds: Math.max(1, Math.min(86400, Number(a.seconds) || 60)), label: String(a.label ?? 'Маҳлиё') })
          return { result: 'set' }
        case 'call_contact': {
          if (!p) return { error: 'not on this device' }
          if (!(await p.askCalls()).granted) return { error: 'no permission' }
          const number = String(a.number ?? '').replace(/[^\d+]/g, '')
          if (number.length >= 3) { await p.callNumber({ number }); return { result: `calling ${number}` } }
          const found = matchContacts(String(a.name ?? ''), (await p.contacts()).contacts)
          if (!found.length) return { error: 'no such contact' }
          if (found.length > 1) return { error: 'several contacts', names: found.slice(0, 5).map((c) => c.name) }
          await p.callNumber({ number: found[0].number })
          return { result: `calling ${found[0].name}` }
        }
        case 'play_song':
          setSong(String(a.query ?? ''))
          return { result: 'playing on the screen' }
        case 'navigate':
          setTimeout(() => router.push(`/navigate?to=${encodeURIComponent(String(a.place ?? ''))}`), 2500)
          return { result: 'the way is opening' }
        case 'weather': {
          const at = await hereOnce()
          if (!at) return { error: 'her place is not known' }
          return { ...(await weatherAt(at, a.when === 'tomorrow' ? 'tomorrow' : 'now')) }
        }
        case 'open_page':
          setTimeout(() => router.push(PAGES[String(a.page)] ?? '/'), 1500)
          return { result: 'opening' }
        default:
          return { error: 'unknown tool' }
      }
    }
    const run = async () => {
      // the phone's own listening for her name gives the microphone to the conversation
      if (native()) await hey().then(({ p }) => p.pause()).catch(() => undefined)
      if (gone) return
      const lt = new LiveTalk({
        lang, mode, scenario, name, me, boy: appMode === 'boy',
        onState: (s) => { if (!gone) setState(s) },
        onHeard: (text) => { if (!gone) setHeard(text) },
        onSaid: (text) => { if (!gone) setSaid(text) },
        onTool: tool,
        onLimit: () => open('live'),
        onUnavailable: () => onFallback()
      })
      talk.current = lt
      await lt.start()
      if (mode === 'camera' && video.current && !gone) await lt.cameraOn(video.current).catch(() => setCamera(false))
    }
    void run()
    return () => {
      gone = true
      talk.current?.stop()
      if (native()) void hey().then(({ p }) => p.resume()).catch(() => undefined)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleCamera = async () => {
    if (!talk.current || !video.current) return
    if (camera) { talk.current.cameraOff(); setCamera(false); return }
    setCamera(true)
    await talk.current.cameraOn(video.current).catch(() => setCamera(false))
  }

  return (
    <div className={`voice-screen live-screen is-${state === 'speaking' ? 'speaking' : state === 'connecting' ? 'thinking' : 'listening'}${camera ? ' has-camera' : ''}`}>
      <button type="button" className="voice-x" aria-label={t('action.close')} onClick={() => (history.length > 1 ? router.back() : router.push('/'))}><Icon name="x" size={22} /></button>
      <video ref={video} className="live-video" playsInline muted aria-hidden={!camera} />
      <div className="voice-orb" aria-hidden="true"><span /><span /><span /></div>
      <p className="voice-state" role="status">{t(state === 'connecting' ? 'live.connecting' : state === 'speaking' ? 'voice.speaking' : state === 'ended' ? 'live.ended' : state === 'error' ? 'live.error' : 'hey.listening')}</p>
      {heard ? <p className="voice-said">{heard}</p> : null}
      {said ? <p className="voice-answer">{said}</p> : null}
      {song ? <div className="voice-song"><SongPlayer query={song} /></div> : null}
      <div className="live-tools">
        {mode !== 'coach' ? (
          <button type="button" className={`live-tool${camera ? ' is-on' : ''}`} aria-pressed={camera} onClick={() => void toggleCamera()}>
            <Icon name="camera" size={22} /><span>{t('live.camera')}</span>
          </button>
        ) : null}
        {camera ? (
          <button type="button" className="live-tool" onClick={() => talk.current?.still()}><Icon name="image" size={22} /><span>{t('live.photo')}</span></button>
        ) : null}
        <button type="button" className="live-tool is-end" onClick={() => { talk.current?.stop(); router.back() }}><Icon name="phone" size={22} /><span>{t('live.end')}</span></button>
      </div>
    </div>
  )
}
