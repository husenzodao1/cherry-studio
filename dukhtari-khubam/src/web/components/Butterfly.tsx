'use client'

import { useEffect, useRef } from 'react'

/**
 * Butterflies of four kinds that live on top of the pages (one fixed layer, drawn with transforms only).
 *
 * - Home: the violet one starts at the end of the motto and a pink swallowtail flies in a little later;
 *   both fly from place to place — school tiles, cards, the glass flower — and settle on top edges.
 * - Lists (schools, a school, a course, the garden, the profile, saved): a few of them already sit on
 *   the boxes when the page opens and scatter as it settles; one comes back and stays.
 * - Scrolling disturbs a perched butterfly: it takes off and finds another place. A tap near one
 *   startles it.
 *
 * Motion model, per animation frame:
 * - Flight: steering towards a target with a sideways flutter; each kind has its own wing beat
 *   (the morpho slow with long glides, the white quick and erratic); each down-stroke lifts the body
 *   a little; the body turns into the direction of travel; altitude grows the sprite slightly and pushes
 *   its shadow away and softer.
 * - Escape: an upward jump, fast beats and sharp zigzags, speeding up away from the screen.
 * - Perched: it follows the element it sits on and slowly opens and closes its wings, sometimes
 *   holding them open.
 */

export type Species = 'violet' | 'morpho' | 'rose' | 'pearl'

interface Kind {
  sprite: string // file prefix in /assets/3d
  size: number // scale of the 64 px sprite
  flap: number // wing beats a second
  glide: number // glides started a second (on average)
  speed: number // cruising speed, px/s
  wander: number // strength of the sideways flutter
}

const KINDS: Record<Species, Kind> = {
  violet: { sprite: 'butterfly', size: 1, flap: 8, glide: 0.6, speed: 170, wander: 1 },
  morpho: { sprite: 'butterfly-morpho', size: 1.14, flap: 5.5, glide: 1.1, speed: 190, wander: 1.25 },
  rose: { sprite: 'butterfly-rose', size: 1.06, flap: 6.5, glide: 1, speed: 200, wander: 0.8 },
  pearl: { sprite: 'butterfly-pearl', size: 0.8, flap: 10, glide: 0.15, speed: 150, wander: 1.6 }
}

const WING_W = 32 // px, one wing (the painted canvas is a little wider than the wing itself)
const WING_H = WING_W * (208 / 192)
const HINGE_Y = WING_H * (320 / 760)
// boxes a butterfly sits on (lists, cards, tiles) and, on the home screen, the hero and the flower
const SPOTS = '.tile-link, .pill-card, .list-row, .shelf, .module, .progress-card, .hero-plinth, .cert-card, .glass.card-pad, .h-page, .section-head .h-section'
const LANDING = `${SPOTS}, .hello-flower, .h-hero, .home-top .icon-btn`
const NOT_HERE = '.dock-wrap, .support-banner, .chat-form, .reader-nav, .bf-layer'
const TAU = Math.PI * 2

/** Home and the list pages have butterflies; reading, quizzes and forms stay calm. */
const SCATTER = /^\/(schools|school|course|garden|profile|saved)\/?$/

interface Pt { x: number; y: number }
interface Anchor { el: Element; rx: number; ry: number }
type Mode = 'wait' | 'perch' | 'fly' | 'escape' | 'gone'
interface Plan {
  species: Species
  /** flee: leaves the screen; stay: keeps living on the page */
  role: 'flee' | 'stay'
  /** where it is at the start: on this element, on some box, or flying in from the side */
  start: { at: string } | 'box' | 'arrive'
  /** seconds until it first moves */
  delay: number
}

interface Fly {
  kind: Kind
  plan: Plan
  el: HTMLDivElement
  wl: HTMLImageElement
  wr: HTMLImageElement
  sh: HTMLDivElement
  mode: Mode
  perch: Anchor | null
  landing: Anchor | null
  target: Pt | null
  waypoints: number
  pos: Pt
  vel: Pt
  away: Pt // escape direction
  heading: number
  perchHeading: number
  altitude: number
  phase: number
  glide: number
  wing: number
  timer: number
  basking: number
  calm: number // seconds a fresh landing ignores scrolling
  kick: number // seconds until a scroll-disturbed take-off (-1: none)
  panic: number // seconds of escape left
  zig: number
  fade: number
  bounded: boolean
  moved: boolean // has taken off at least once
}

const rand = (a: number, b: number) => a + Math.random() * (b - a)
const angleTo = (from: number, to: number) => Math.atan2(Math.sin(to - from), Math.cos(to - from))
const shuffle = <T,>(xs: T[]) => xs.map((x) => [Math.random(), x] as const).sort((a, b) => a[0] - b[0]).map(([, x]) => x)

function anchorPoint(a: Anchor): Pt & { visible: boolean } {
  const r = a.el.getBoundingClientRect()
  const x = r.left + a.rx * r.width
  const y = r.top + a.ry * r.height
  return { x, y, visible: a.el.isConnected && r.width > 0 && y > 60 && y < innerHeight - 110 && x > 10 && x < innerWidth - 10 }
}

/** Visible boxes matching a selector, top edge well inside the screen and above the tab bar. */
function onScreen(selector: string, exclude: Set<Element>): Element[] {
  return [...document.querySelectorAll(selector)].filter((el) => {
    if (exclude.has(el) || el.closest(NOT_HERE)) return false
    const r = el.getBoundingClientRect()
    return r.width > 36 && r.top > 70 && r.top < innerHeight - 160
  })
}

/** A place on the top edge of an element (or among the petals of the glass flower). */
function spotOn(el: Element): Anchor {
  if (el.classList.contains('hello-flower')) return { el, rx: rand(0.35, 0.7), ry: rand(0.3, 0.45) }
  const r = el.getBoundingClientRect()
  return { el, rx: rand(0.15, 0.85), ry: -6 / Math.max(1, r.height) }
}

/** Which butterflies a page starts with. */
export function planFor(path: string): Plan[] {
  if (path === '/') {
    return [
      { species: 'violet', role: 'stay', start: { at: '.bf-anchor' }, delay: 2.6 },
      { species: 'rose', role: 'stay', start: 'arrive', delay: 3.4 }
    ]
  }
  if (!SCATTER.test(path)) return []
  const kinds = shuffle<Species>(['violet', 'morpho', 'rose', 'pearl']).slice(0, 3)
  // they sit while the page rises, then take off one after another; the last one stays
  return kinds.map((species, i) => ({
    species, role: i === kinds.length - 1 ? 'stay' : 'flee', start: 'box', delay: 0.55 + i * rand(0.22, 0.38)
  }))
}

function makeFly(layer: HTMLElement, plan: Plan): Fly {
  const kind = KINDS[plan.species]
  const sh = document.createElement('div')
  sh.className = 'bf-shadow'
  const el = document.createElement('div')
  el.className = 'bf'
  const img = (cls: string, part: string) => {
    const i = document.createElement('img')
    i.className = cls
    i.src = `/assets/3d/${kind.sprite}-${part}.webp`
    i.alt = ''
    i.decoding = 'async'
    el.appendChild(i)
    return i
  }
  const wl = img('bf-wing bf-wing-l', 'wing-l')
  const wr = img('bf-wing bf-wing-r', 'wing-r')
  img('bf-body', 'body')
  el.style.opacity = sh.style.opacity = '0'
  layer.append(sh, el)
  const heading = rand(-0.5, 0.5)
  return {
    kind, plan, el, wl, wr, sh, mode: 'wait', perch: null, landing: null, target: null, waypoints: 0,
    pos: { x: -100, y: -100 }, vel: { x: 0, y: 0 }, away: { x: 0, y: -1 }, heading, perchHeading: heading,
    altitude: 0, phase: rand(0, TAU), glide: 0, wing: 20, timer: plan.delay, basking: 0, calm: 0, kick: -1,
    panic: 0, zig: 0, fade: 0, bounded: true, moved: false
  }
}

export function Butterflies({ path }: { path: string }) {
  const layer = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!layer.current || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const plans = planFor(path)
    if (!plans.length) return
    const box = layer.current
    const flies = plans.map((p) => makeFly(box, p))
    const born = performance.now()
    let last = born
    let raf = 0

    const taken = (self: Fly) => {
      const s = new Set<Element>()
      for (const f of flies) if (f !== self) for (const a of [f.perch, f.landing]) if (a) s.add(a.el)
      return s
    }
    const pickLanding = (f: Fly, avoid: Element | null): Anchor | null => {
      const ex = taken(f)
      if (avoid) ex.add(avoid)
      const options = onScreen(LANDING, ex)
      return options.length ? spotOn(options[Math.floor(Math.random() * options.length)]) : null
    }
    const settle = (f: Fly, at: Anchor) => {
      f.mode = 'perch'
      f.perch = at
      const a = anchorPoint(at)
      f.pos = { x: a.x, y: a.y }
      f.wing = rand(10, 50)
    }
    const takeOff = (f: Fly) => {
      const from = f.perch?.el ?? null
      f.mode = 'fly'
      f.perch = null
      f.kick = -1
      f.moved = true
      f.waypoints = Math.random() < 0.45 ? 1 : 0
      f.landing = pickLanding(f, from)
      f.target = f.waypoints ? { x: rand(40, innerWidth - 40), y: rand(90, innerHeight - 170) } : null
      f.vel.y = -60
    }
    /** Startled: an upward jump and a zigzag escape, away from `from` (or from the middle of the screen). */
    const startle = (f: Fly, from?: Pt) => {
      const c = from ?? { x: innerWidth / 2, y: innerHeight * 0.6 }
      let dx = f.pos.x - c.x
      if (Math.abs(dx) < 20) dx = Math.random() < 0.5 ? -1 : 1
      const ax = Math.sign(dx) * rand(0.4, 1.3), ay = -rand(0.6, 1.2)
      const d = Math.hypot(ax, ay)
      f.away = { x: ax / d, y: ay / d }
      f.vel = { x: f.away.x * 90, y: -170 }
      f.mode = 'escape'
      f.perch = null
      f.kick = -1
      f.moved = true
      f.panic = f.plan.role === 'flee' ? 99 : rand(0.6, 1)
      f.zig = 0
      f.glide = 0
    }

    /** Puts the waiting ones in their places once the page has something to sit on. */
    const place = (elapsed: number) => {
      const waiting = flies.filter((f) => f.mode === 'wait')
      const boxed = waiting.filter((f) => f.plan.start === 'box')
      if (boxed.length) {
        const options = shuffle(onScreen(SPOTS, new Set()))
        if (options.length >= boxed.length || (options.length && elapsed > 1.2)) {
          boxed.forEach((f, i) => {
            if (i < options.length) settle(f, spotOn(options[i]))
            else f.mode = 'gone'
          })
        } else if (elapsed > 2.5) boxed.forEach((f) => (f.mode = 'gone'))
      }
      for (const f of waiting) {
        const start = f.plan.start
        if (typeof start === 'object') {
          const el = document.querySelector(start.at)
          if (el) settle(f, { el, rx: 0.5, ry: 0.55 })
          else if (elapsed > 2.5) f.mode = 'gone'
        } else if (start === 'arrive' && elapsed > f.plan.delay) {
          // flies in from one side
          const left = Math.random() < 0.5
          f.pos = { x: left ? -40 : innerWidth + 40, y: rand(160, innerHeight * 0.5) }
          f.vel = { x: left ? 120 : -120, y: 0 }
          f.heading = left ? Math.PI / 2 : -Math.PI / 2
          f.bounded = false
          f.mode = 'fly'
          f.landing = pickLanding(f, null)
          f.waypoints = 0
          f.target = { x: rand(innerWidth * 0.3, innerWidth * 0.7), y: rand(160, innerHeight * 0.45) }
        }
      }
    }

    const step = (f: Fly, dt: number, t: number) => {
      const k = f.kind
      if (f.mode === 'perch' && f.perch) {
        const a = anchorPoint(f.perch)
        f.pos.x = a.x
        f.pos.y = a.y
        f.altitude += (0 - f.altitude) * Math.min(1, dt * 8)
        f.heading += angleTo(f.heading, f.perchHeading) * Math.min(1, dt * 5)
        // slow opening and closing, now and then holding the wings open in the sun
        if (f.basking > 0) {
          f.basking -= dt
          f.wing += (6 - f.wing) * Math.min(1, dt * 3)
        } else {
          f.wing = 8 + 58 * (0.5 - 0.5 * Math.cos(t * TAU / 2.8 + f.phase))
          if (Math.random() < dt * 0.25) f.basking = rand(0.8, 2)
        }
        f.calm -= dt
        f.timer -= dt
        if (f.kick >= 0) {
          f.kick -= dt
          if (f.kick < 0) takeOff(f)
        } else if (f.timer <= 0 || !a.visible) {
          // those sitting on the boxes when the page opens are startled together the first time
          if (f.plan.role === 'flee' || (f.plan.start === 'box' && !f.moved)) startle(f)
          else takeOff(f)
        }
        return
      }

      if (f.mode === 'escape') {
        // fast beats, sharp sideways jinks, speeding up along the way out
        f.panic -= dt
        f.zig -= dt
        if (f.zig <= 0) {
          f.zig = rand(0.1, 0.28)
          const side = rand(-1, 1) * 230 * k.wander
          f.vel.x += -f.away.y * side
          f.vel.y += f.away.x * side
        }
        const speed = k.speed * 1.9
        f.vel.x += (f.away.x * speed - f.vel.x) * Math.min(1, dt * 2.2)
        f.vel.y += (f.away.y * speed - f.vel.y) * Math.min(1, dt * 2.2)
        f.phase += dt * TAU * k.flap * 1.45
        f.wing = 12 + 70 * (0.5 + 0.5 * Math.sin(f.phase))
        f.pos.x += f.vel.x * dt
        f.pos.y += f.vel.y * dt
        f.heading += angleTo(f.heading, Math.atan2(f.vel.x, -f.vel.y)) * Math.min(1, dt * 9)
        f.altitude += (55 - f.altitude) * Math.min(1, dt * 2.5)
        if (f.plan.role === 'flee') {
          if (f.pos.x < -90 || f.pos.x > innerWidth + 90 || f.pos.y < -90 || f.pos.y > innerHeight + 90) f.mode = 'gone'
        } else if (f.panic <= 0 || f.pos.y < 80 || f.pos.x < 30 || f.pos.x > innerWidth - 30) {
          // the one that stays calms down and looks for a new place
          f.mode = 'fly'
          f.landing = pickLanding(f, null)
          f.waypoints = 0
          f.target = { x: rand(60, innerWidth - 60), y: rand(140, innerHeight * 0.55) }
        }
        return
      }

      // where to: a waypoint first, then the landing spot
      let goal = f.target
      if (!goal && f.landing) {
        const a = anchorPoint(f.landing)
        goal = a.visible ? { x: a.x, y: a.y } : null
        if (!a.visible) f.landing = pickLanding(f, f.landing.el)
      }
      if (!goal) {
        f.landing = pickLanding(f, null)
        goal = { x: innerWidth / 2, y: innerHeight / 2 }
      }
      const dx = goal.x - f.pos.x, dy = goal.y - f.pos.y
      const dist = Math.hypot(dx, dy) || 1
      const final = !f.target && !!f.landing
      const cruise = final ? Math.min(k.speed, 35 + dist * 1.6) : k.speed
      // flutter: a wandering sideways push, stronger far from the goal
      const side = (Math.sin(t * 2.3 + f.phase) * 70 + Math.sin(t * 5.7 + 1) * 30) * k.wander * Math.min(1, dist / 120)
      const want = { x: (dx / dist) * cruise - (dy / dist) * side, y: (dy / dist) * cruise + (dx / dist) * side }
      const kk = Math.min(1, dt * (final && dist < 50 ? 6 : 2.6))
      f.vel.x += (want.x - f.vel.x) * kk
      f.vel.y += (want.y - f.vel.y) * kk
      // flap and glide
      if (f.glide > 0) f.glide -= dt
      else if (Math.random() < dt * k.glide && dist > 90) f.glide = rand(0.25, 0.5) * (k.flap < 7 ? 1.6 : 1)
      if (f.glide > 0) {
        f.wing += (14 - f.wing) * Math.min(1, dt * 10)
        f.vel.y += 25 * dt // a glide sinks a little
      } else {
        f.phase += dt * TAU * (final && dist < 40 ? k.flap * 0.75 : k.flap)
        f.wing = 16 + 64 * (0.5 + 0.5 * Math.sin(f.phase))
      }
      f.pos.x += f.vel.x * dt
      f.pos.y += f.vel.y * dt
      // keep to the screen, above the tab bar (once it is in)
      const inside = f.pos.x > 24 && f.pos.x < innerWidth - 24 && f.pos.y > 70 && f.pos.y < innerHeight - 130
      if (inside) f.bounded = true
      if (f.bounded) {
        f.pos.x = Math.min(innerWidth - 24, Math.max(24, f.pos.x))
        f.pos.y = Math.min(innerHeight - 130, Math.max(70, f.pos.y))
      }
      const speed = Math.hypot(f.vel.x, f.vel.y)
      if (speed > 12) f.heading += angleTo(f.heading, Math.atan2(f.vel.x, -f.vel.y)) * Math.min(1, dt * 5)
      f.altitude += ((final ? Math.min(30, dist / 3) : 30) - f.altitude) * Math.min(1, dt * 3)
      if (f.target && dist < 26) {
        f.target = f.waypoints > 1 ? { x: rand(40, innerWidth - 40), y: rand(90, innerHeight - 170) } : null
        f.waypoints = Math.max(0, f.waypoints - 1)
      } else if (final && dist < 3 && speed < 40) {
        f.mode = 'perch'
        f.perch = f.landing
        f.landing = null
        // on the home screen it moves on after a few seconds; on lists it mostly sits
        f.timer = path === '/' ? rand(3, 7) : rand(9, 16)
        f.calm = 1.2
        f.perchHeading = f.heading + rand(-0.5, 0.5)
        f.vel.x = f.vel.y = 0
      }
    }

    const draw = (f: Fly, dt: number) => {
      const shown = f.mode !== 'wait' && f.mode !== 'gone'
      f.fade = Math.min(1, Math.max(0, f.fade + (shown ? dt * 4 : -1)))
      f.el.style.opacity = String(f.fade)
      if (!shown) {
        f.sh.style.opacity = '0'
        return
      }
      // body bob on each down-stroke; wings fold up over the back, towards the viewer
      const flying = f.mode !== 'perch'
      const bob = flying && f.glide <= 0 ? Math.sin(f.phase) * 2.5 : 0
      const scale = f.kind.size * (1 + f.altitude / 260)
      f.el.style.transform = `translate3d(${f.pos.x - WING_W}px, ${f.pos.y - HINGE_Y - bob}px, 0) rotate(${f.heading}rad) scale(${scale})`
      f.wl.style.transform = `rotateY(${f.wing}deg)`
      f.wr.style.transform = `rotateY(${-f.wing}deg)`
      const lift = 1 + f.altitude / 90
      f.sh.style.transform = `translate3d(${f.pos.x - 22 + f.altitude * 0.35}px, ${f.pos.y - 6 + f.altitude * 0.9}px, 0) rotate(${f.heading}rad) scale(${lift * f.kind.size}, ${lift * f.kind.size * Math.max(0.35, Math.cos((f.wing * Math.PI) / 180))})`
      f.sh.style.opacity = String(f.fade * Math.max(0.06, 0.32 - f.altitude / 110))
    }

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const t = now / 1000
      place((now - born) / 1000)
      for (const f of flies) if (f.mode !== 'wait' && f.mode !== 'gone') step(f, dt, t)
      for (const f of flies) draw(f, dt)
      if (flies.some((f) => f.mode !== 'gone')) raf = requestAnimationFrame(frame)
      else box.replaceChildren()
    }
    raf = requestAnimationFrame(frame)

    // scrolling disturbs a perched butterfly: it lifts off and finds another place
    const onScroll = () => {
      for (const f of flies) {
        if (f.mode === 'perch' && f.plan.role === 'stay' && f.calm <= 0 && f.kick < 0) f.kick = rand(0.05, 0.35)
      }
    }
    // a tap close to one startles it away
    const onDown = (e: PointerEvent) => {
      for (const f of flies) {
        if ((f.mode === 'perch' || f.mode === 'fly') && Math.hypot(e.clientX - f.pos.x, e.clientY - f.pos.y) < 80) {
          startle(f, { x: e.clientX, y: e.clientY })
        }
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true, capture: true })
    window.addEventListener('pointerdown', onDown, { passive: true })
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', onScroll, { capture: true })
      window.removeEventListener('pointerdown', onDown)
      box.replaceChildren()
    }
  }, [path])

  return <div className="bf-layer" ref={layer} aria-hidden="true" />
}
