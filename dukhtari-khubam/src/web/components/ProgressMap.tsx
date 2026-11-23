'use client'

import Link from 'next/link'

import type { Leg } from '../offline/journey'
import { usePrefs } from '../prefs'
import { Icon } from './Icon'
import { emojify } from './Emoji'

/** The drawing's width (it scales to the screen), the step between stops and the sway. */
const W = 360
const STEP = 112
const TOP = 70
const SWAY = 100
/** a road as on a real map: its bends wide and narrow by turns, never the same twice */
const xAt = (i: number) => W / 2 + SWAY * (0.62 + 0.38 * Math.sin(i * 2.3 + 1)) * Math.sin(i * 1.15 + 0.5)
const yAt = (i: number) => TOP + i * STEP

/** A smooth road through the points (Catmull-Rom turned into Bézier curves). */
function road(pts: [number, number][]): string {
  let d = `M${pts[0][0]},${pts[0][1]}`
  for (let i = 0; i < pts.length - 1; i++) {
    const [p0, p1, p2, p3] = [pts[i - 1] ?? pts[i], pts[i], pts[i + 1], pts[i + 2] ?? pts[i + 1]]
    d += ` C${p1[0] + (p2[0] - p0[0]) / 6},${p1[1] + (p2[1] - p0[1]) / 6} ${p2[0] - (p3[0] - p1[0]) / 6},${p2[1] - (p3[1] - p1[1]) / 6} ${p2[0]},${p2[1]}`
  }
  return d
}

/** One course: its road from the start flag through every lesson to the finish. */
function MapLeg({ leg }: { leg: Leg }) {
  const { t } = usePrefs()
  const n = leg.stops.length
  // start flag, the stops, the finish
  const pts: [number, number][] = [[W / 2, 22], ...leg.stops.map((_, i): [number, number] => [xAt(i), yAt(i)]), [W / 2, yAt(n) - 10]]
  const H = yAt(n) + 34
  const pct = ([x, y]: [number, number]) => ({ left: `${(x / W) * 100}%`, top: `${(y / H) * 100}%` })
  const finished = leg.done === n
  return (
    <section className="map-leg">
      <header className="map-head">
        {leg.icon ? <img src={leg.icon.src} alt="" aria-hidden="true" /> : null}
        <b>{emojify(leg.title)}</b>
        <span className="map-count">{leg.done}/{n}</span>
      </header>
      <div className="map-road" style={{ aspectRatio: `${W} / ${H}` }}>
        <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
          <defs>
            <linearGradient id={`road-${leg.course}`} x1="0" y1="0" x2="0" y2="1">
              <stop className="map-g1" offset="0" /><stop className="map-g2" offset="0.55" /><stop className="map-g3" offset="1" />
            </linearGradient>
          </defs>
          {/* the road: a soft glow, a ribbon of frosted glass, its colour running from the start to the cup, pearls along it */}
          <path className="map-glow" d={road(pts)} />
          <path className="map-edge" d={road(pts)} />
          <path className="map-way" d={road(pts)} stroke={`url(#road-${leg.course})`} />
          <path className="map-way-line" d={road(pts)} />
          {/* the part already walked, each stretch in the colour of the lesson it reaches */}
          {leg.stops.map((s, i) => (s.grade ? <path key={s.id} className={`map-walked is-${s.grade}`} d={road(pts.slice(i, i + 2))} /> : null))}
        </svg>
        <span className="map-flag" style={pct(pts[0])}>{t('map.start')}</span>
        {leg.stops.map((s, i) => (
          <Link key={s.id} href={`/lesson?id=${encodeURIComponent(s.id)}`} style={pct([xAt(i), yAt(i)])}
            className={`map-stop ${s.grade ? `is-${s.grade}` : s.next ? 'is-next' : 'is-wait'}`}
            aria-label={`${i + 1}. ${s.title}${s.grade ? ` · ${t(`map.${s.grade}`)}` : ''}${s.score !== null ? ` · ${s.score}%` : ''}`}>
            <span className="map-dot" aria-hidden="true">
              {s.grade ? (s.score !== null ? `${Math.round(s.score)}%` : <Icon name="check" size={22} strokeWidth={2.4} />)
                : s.next ? <Icon name="play" size={20} fill="currentColor" /> : i + 1}
            </span>
            <span className="map-label">{emojify(s.title)}</span>
          </Link>
        ))}
        <span className={`map-goal${finished ? ' is-done' : ''}`} style={pct(pts[pts.length - 1])} aria-label={t('map.finish')}>
          <Icon name="trophy" size={22} />
        </span>
      </div>
    </section>
  )
}

/**
 * The progress map: no box and nothing behind — for every begun course a winding ribbon of frosted glass
 * in the app's colours (lavender to rose, a soft glow, pearls along its middle), through its lessons. A finished lesson's stop is green, yellow or red by its test; the next one pulses; a tap
 * opens the lesson.
 */
export function ProgressMap({ legs }: { legs: Leg[] }) {
  return <div className="map">{legs.map((l) => <MapLeg key={l.course} leg={l} />)}</div>
}
