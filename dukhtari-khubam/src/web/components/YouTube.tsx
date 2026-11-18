'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { useOfflineSrc } from '../offline/media'
import { usePrefs } from '../prefs'
import { Icon } from './Icon'

/**
 * A YouTube video linked from a lesson (only the 11-character id is stored, so the database stays small).
 * The cover is YouTube's own thumbnail, kept on the phone for offline reading. Playback happens inside
 * the app in a privacy-enhanced embed with YouTube's controls hidden; our glass controls drive it over
 * the documented iframe postMessage protocol (no extra script is loaded).
 */

const HOST = 'https://www.youtube-nocookie.com'

export function youtubeId(input: string): string | null {
  const s = input.trim()
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s
  try {
    const u = new URL(s)
    const host = u.hostname.replace(/^(www|m|music)\./, '')
    if (host === 'youtu.be') return /^[A-Za-z0-9_-]{11}$/.test(u.pathname.slice(1, 12)) ? u.pathname.slice(1, 12) : null
    if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      const v = u.searchParams.get('v') ?? u.pathname.match(/^\/(?:embed|shorts|live|v)\/([A-Za-z0-9_-]{11})/)?.[1]
      return v && /^[A-Za-z0-9_-]{11}$/.test(v) ? v : null
    }
  } catch {
    /* not a URL */
  }
  return null
}

const clock = (s: number) => {
  const t = Math.max(0, Math.floor(s))
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), sec = t % 60
  return `${h ? `${h}:${String(m).padStart(2, '0')}` : m}:${String(sec).padStart(2, '0')}`
}

export function YouTube({ id, start, title }: { id: string; start?: number; title?: string }) {
  const { t } = usePrefs()
  const cover = useOfflineSrc(`https://i.ytimg.com/vi/${id}/hqdefault.jpg`)
  const frame = useRef<HTMLIFrameElement>(null)
  const [open, setOpen] = useState(false)
  const [offline, setOffline] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [controls, setControls] = useState(true)
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const send = useCallback((func: string, args: unknown[] = []) => {
    frame.current?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args }), HOST)
  }, [])

  // player → app: time, duration and state arrive as JSON messages
  useEffect(() => {
    if (!open) return
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== HOST || e.source !== frame.current?.contentWindow || typeof e.data !== 'string') return
      let msg: { event?: string; info?: { currentTime?: number; duration?: number; playerState?: number; muted?: boolean } }
      try {
        msg = JSON.parse(e.data)
      } catch {
        return
      }
      const info = msg.info
      if (!info || typeof info !== 'object') return
      if (typeof info.currentTime === 'number') setTime(info.currentTime)
      if (typeof info.duration === 'number' && info.duration > 0) setDuration(info.duration)
      if (typeof info.muted === 'boolean') setMuted(info.muted)
      if (typeof info.playerState === 'number') setPlaying(info.playerState === 1 || info.playerState === 3)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [open])

  // controls fade away while the video plays; a tap brings them back
  const wake = useCallback(() => {
    setControls(true)
    clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => setControls(false), 2800)
  }, [])
  useEffect(() => {
    if (!playing) {
      clearTimeout(hideTimer.current)
      setControls(true)
    } else wake()
    return () => clearTimeout(hideTimer.current)
  }, [playing, wake])

  const start0 = () => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setOffline(true)
      return
    }
    setOffline(false)
    setOpen(true)
  }
  const onLoad = () => {
    frame.current?.contentWindow?.postMessage(JSON.stringify({ event: 'listening', id, channel: 'widget' }), HOST)
  }
  const origin = typeof window === 'undefined' ? '' : window.location.origin
  const src = `${HOST}/embed/${id}?enablejsapi=1&controls=0&disablekb=1&fs=0&rel=0&iv_load_policy=3&playsinline=1&autoplay=1&modestbranding=1${start ? `&start=${start}` : ''}&origin=${encodeURIComponent(origin)}`

  return (
    <figure className="yt">
      {cover ? <img src={cover} alt="" className="fade" onLoad={(e) => e.currentTarget.classList.add('is-ready')} /> : null}
      {open ? (
        <>
          <div className="yt-frame">
            <iframe ref={frame} src={src} title={title ?? 'YouTube'} allow="autoplay; encrypted-media; picture-in-picture" onLoad={onLoad} />
          </div>
          <button type="button" className="yt-tap" aria-label={playing ? t('video.pause') : t('video.play')}
            onClick={() => (controls ? (playing ? send('pauseVideo') : send('playVideo')) : wake())} />
          <div className={`yt-controls${controls ? '' : ' hidden'}`}>
            <div className="player glass">
              <button type="button" className="play-btn" style={{ width: 40, height: 40 }} aria-label={playing ? t('video.pause') : t('video.play')}
                onClick={() => { (playing ? send('pauseVideo') : send('playVideo')); wake() }}>
                <Icon name={playing ? 'pause' : 'play'} size={18} fill="currentColor" />
              </button>
              <span className="time">{clock(time)} / {clock(duration)}</span>
              <input type="range" min={0} max={Math.max(duration, 1)} step={1} value={Math.min(time, duration || 1)} aria-label="seek"
                onChange={(e) => { const v = Number(e.target.value); setTime(v); send('seekTo', [v, true]); wake() }} />
              <button type="button" className="icon-btn" aria-label={t('video.mute')} aria-pressed={muted}
                onClick={() => { send(muted ? 'unMute' : 'mute'); setMuted(!muted); wake() }}>
                <Icon name={muted ? 'mute' : 'volume'} size={20} />
              </button>
            </div>
          </div>
        </>
      ) : (
        <button type="button" className="yt-cover" onClick={start0} aria-label={`${t('video.play')}${title ? `: ${title}` : ''}`}>
          <span className="play-btn"><Icon name="play" size={26} fill="currentColor" /></span>
          {title ? <span className="yt-title">{title}</span> : null}
        </button>
      )}
      {offline ? <span className="yt-offline glass" role="status">{t('video.offline')}</span> : null}
    </figure>
  )
}
