'use client'

import { Capacitor } from '@capacitor/core'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

import { alphaVideo } from '../mahliyo'
import { usePrefs } from '../prefs'

/**
 * From 22:00 to 05:00, once a night: Mahliyo, sleepy, asks her to go to sleep. "Барномаро пӯшидан ва хоб
 * рафтан" closes the app (on the website: a good-night screen); "Рад кардан" lets her go on until morning.
 * Her sleepy clip (transparent, cut from a green-screen film) plays once: she yawns, a book falls on her
 * head, she flops onto the sofa and sleeps; then she stays asleep and only the Z's above her go on rising.
 */
const SLEEP = { video: '/assets/mahliyo/sleep.webm', first: '/assets/mahliyo/sleep.webp', end: '/assets/mahliyo/sleep-end.webp' }
const KEY = 'dk.night'
const isNight = (d: Date) => d.getHours() >= 22 || d.getHours() < 5
/** the night a moment belongs to: after midnight it is still the evening's night */
const nightOf = (d: Date) => {
  const n = new Date(d)
  if (n.getHours() < 5) n.setDate(n.getDate() - 1)
  return n.toISOString().slice(0, 10)
}
const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

export function NightGuard() {
  const { t } = usePrefs()
  const path = usePathname() ?? '/'
  const [now, setNow] = useState<Date | null>(null)
  const [dismissed, setDismissed] = useState<string | null>(null)
  const [bye, setBye] = useState(false)
  const [video, setVideo] = useState(false)
  const [asleep, setAsleep] = useState(false)

  useEffect(() => {
    try { setDismissed(localStorage.getItem(KEY)) } catch { /* none */ }
    setVideo(alphaVideo())
    const tick = () => setNow(new Date())
    tick()
    const timer = setInterval(tick, 30_000)
    document.addEventListener('visibilitychange', tick)
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', tick) }
  }, [])

  if (!now || !isNight(now) || dismissed === nightOf(now) || /^\/(admin|start)(\/|$)/.test(path)) return null
  const refuse = () => {
    const night = nightOf(new Date())
    try { localStorage.setItem(KEY, night) } catch { /* only for now */ }
    setDismissed(night)
  }
  const sleep = async () => {
    if (Capacitor.isNativePlatform()) {
      const { App } = await import('@capacitor/app')
      return void App.exitApp()
    }
    setBye(true)
  }
  // where the clip cannot play (iPhone, less motion asked), she is shown asleep at once
  const sleeping = asleep || !video
  return (
    <div className="night" role="dialog" aria-modal="true" aria-label={t('night.title')}>
      <div className="night-sky" aria-hidden="true"><i className="night-moon" /><i className="night-stars" /><i className="night-stars night-stars-2" /><i className="night-shoot" /></div>
      <h2 className="night-title">{t('night.title')}</h2>
      <div className="night-art" aria-hidden="true">
        {sleeping
          ? <img className="night-breathe" src={SLEEP.end} alt="" />
          : <video src={SLEEP.video} poster={SLEEP.first} autoPlay muted playsInline onEnded={() => setAsleep(true)} onError={() => setAsleep(true)} />}
        {sleeping ? <span className="night-z"><i>Z</i><i>z</i><i>z</i></span> : null}
      </div>
      {bye ? (
        <p className="night-text">{t('night.bye')}</p>
      ) : (
        <>
          <p className="night-text">{t('night.text').replace('{соат}', hhmm(now))}</p>
          <div className="night-actions">
            <button type="button" className="night-sleep" onClick={() => void sleep()}><span aria-hidden="true">🌙</span>{t('night.sleep')}</button>
            <button type="button" className="night-refuse" onClick={refuse}>{t('night.refuse')}</button>
          </div>
        </>
      )}
    </div>
  )
}
