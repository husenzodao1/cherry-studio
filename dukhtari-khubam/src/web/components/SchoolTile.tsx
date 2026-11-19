'use client'

import Link from 'next/link'
import { useEffect, useRef } from 'react'

import { SCHOOL_ART } from '../art'
import { introPlayed } from '../intro'
import { LiquidGlass } from '../glass/LiquidGlass'
import type { SchoolSummary } from '../offline/content'
import { usePrefs } from '../prefs'

/**
 * School tile in clear, refracting glass with its 3D icon. `count` adds the number of courses
 * (schools screen); `long` lays the tile out sideways for a last tile that spans two columns.
 */
export function SchoolTile({ school, count = false, long = false }: { school: SchoolSummary; count?: boolean; long?: boolean }) {
  const { t } = usePrefs()
  const art = school.icon?.url ? { src: school.icon.url } : SCHOOL_ART[school.slug]
  return (
    <Link href={`/school?key=${encodeURIComponent(school.slug)}`} className={`tile-link${long ? ' tile-long' : ''}`}>
      <LiquidGlass radius={24} bezel={14} refract={false} className={`tile${count ? ' tile-wide' : ''}`}>
        {art ? <img className="tile-art" src={art.src} alt="" aria-hidden="true" decoding="async" /> : <span className="tile-art" />}
        <span className="tile-text">
          <span className="tile-title">{school.title}</span>
          {count ? <span className="tile-meta">{t('school.courses_n').replace('{n}', String(school.course_count))}</span> : null}
        </span>
      </LiquidGlass>
    </Link>
  )
}

/** Grid of school tiles; a lone tile in the last row spans two columns. */
export function SchoolGrid({ schools, cols, count = false }: { schools: SchoolSummary[]; cols: 2 | 3; count?: boolean }) {
  const lone = schools.length % cols === 1
  return (
    <div className={`tile-grid tile-grid-${cols} stagger`}>
      {schools.map((s, i) => <SchoolTile key={s.id} school={s} count={count} long={lone && i === schools.length - 1} />)}
    </div>
  )
}

let toured = false
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

/** Smoothly scrolls `el` to `to` over `ms`; stops when the finger takes over. */
function glide(el: HTMLElement, to: number, ms: number, stop: { now: boolean }): Promise<void> {
  return new Promise((resolve) => {
    const from = el.scrollLeft
    const start = performance.now()
    const step = (now: number) => {
      if (stop.now) return resolve()
      const k = Math.min(1, (now - start) / ms)
      el.scrollLeft = from + (to - from) * easeInOut(k)
      if (k < 1) requestAnimationFrame(step)
      else resolve()
    }
    requestAnimationFrame(step)
  })
}

/**
 * All schools in one row that the finger moves sideways; a fling carries it as far as the swipe was fast.
 * Each time the app is opened the row takes one gentle tour to its end and back, and every tile, one
 * after another, steps forward once as it passes.
 */
export function SchoolRow({ schools }: { schools: SchoolSummary[] }) {
  const row = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = row.current
    if (!el || toured) return
    const stop = { now: false }
    const halt = () => {
      stop.now = true
      el.classList.remove('is-touring')
    }
    let timer: ReturnType<typeof setTimeout> | undefined
    const tour = () => {
      if (toured) return
      toured = true
      timer = setTimeout(async () => {
        const max = el.scrollWidth - el.clientWidth
        el.style.scrollSnapType = 'none'
        el.classList.add('is-touring')
        if (max > 4) {
          await glide(el, max, 2300, stop)
          if (!stop.now) await new Promise((r) => setTimeout(r, 320))
          await glide(el, 0, 1500, stop)
        } else await new Promise((r) => setTimeout(r, 1600))
        el.style.scrollSnapType = ''
        setTimeout(() => el.classList.remove('is-touring'), 400)
      }, 1900)
    }
    el.addEventListener('pointerdown', halt, { once: true })
    el.addEventListener('touchstart', halt, { once: true, passive: true })
    if (introPlayed()) tour()
    else window.addEventListener('dk-intro', tour, { once: true })
    return () => {
      stop.now = true
      clearTimeout(timer)
      window.removeEventListener('dk-intro', tour)
      el.removeEventListener('pointerdown', halt)
      el.removeEventListener('touchstart', halt)
    }
  }, [])
  return (
    <div ref={row} className="school-row" role="list">
      {schools.map((s, i) => (
        <div key={s.id} role="listitem" className="school-row-item" style={{ ['--i' as string]: i }}><SchoolTile school={s} /></div>
      ))}
    </div>
  )
}
