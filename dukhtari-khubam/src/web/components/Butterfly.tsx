'use client'

import { useEffect, useRef } from 'react'

/**
 * Butterflies that live on top of the pages (one fixed layer, drawn with transforms only). They are all
 * "whites" (rounded wings, dark tips, two spots) in four colours.
 *
 * - Home: a lilac one starts at the end of the motto and a pink one flies in a little later; both fly from
 *   place to place — school tiles, cards, the glass flower — and settle on top edges.
 * - Lists (schools, a school, a course, the garden, the profile, saved): three sit on the boxes when the
 *   page opens and scatter as it settles; one comes back and stays.
 * - Scrolling disturbs a perched butterfly: it takes off and finds another place. A tap near one startles it.
 *
 * Flight is simulated, not tweened. The screen is a wall seen from the front, gravity pulls down.
 * - Each wing beat has a quick down-stroke and a slower up-stroke. Only the down-stroke pushes: lift
 *   against gravity and thrust along the travel direction; between strokes drag slows it and gravity
 *   pulls it down. That gives the pulsing speed and the bobbing, hopping path of a real butterfly.
 * - Every beat is a little different (strength, lift, rate), and the direction is a random walk biased
 *   towards the goal, so the path wanders and jinks. Now and then it glides with spread wings.
 * - Landing: it slows and hovers into place, sometimes circles once first, settles with a few dying
 *   beats and turns head-up; at rest the wings stay raised and now and then open slowly to bask.
 * - Take-off begins with a few strong beats; a startled one escapes with fast, erratic beats.
 */

export type Species = 'pearl' | 'lilac' | 'rose' | 'sky'
const COLOURS: Species[] = ['pearl', 'lilac', 'rose', 'sky']

const WING_W = 32 // px, one wing (the painted canvas is a little wider than the wing itself)
const WING_H = WING_W * (208 / 192)
const HINGE_Y = WING_H * (320 / 760)
// boxes a butterfly sits on (lists, cards, tiles) and, on the home screen, the flower; never on text
const SPOTS = '.tile-link, .pill-card, .list-row, .shelf, .module, .progress-card, .hero-plinth, .cert-card, .glass.card-pad, .stat'
const LANDING = `${SPOTS}, .hello-flower, .home-top .icon-btn`
const NOT_HERE = '.dock-wrap, .support-banner, .chat-form, .reader-nav, .bf-layer'
const TAU = Math.PI * 2

// flight (px and seconds)
const G = 3000 // gravity, towards the bottom of the screen
const DRAG = 3.2 // share of the speed lost per second
const THRUST = 1000 // along the travel direction, during the down-stroke
const DOWN = 0.44 // share of a beat spent on the down-stroke
const TOP = 82 // wing angle at the top of a stroke (deg; 0 = spread flat, 90 = clapped together)
const BOTTOM = -24 // and at the bottom, a little below flat
const STEP = 1 / 240 // physics step

/** Home and the list pages have butterflies; reading, quizzes and forms stay calm. */
const SCATTER = /^\/(schools|school|course|garden|profile|saved)\/?$/

interface Pt { x: number; y: number }
interface Anchor { el: Element; rx: number; ry: number }
type Mode = 'wait' | 'perch' | 'fly' | 'escape' | 'gone'
export interface Plan {
  species: Species
  /** flee: leaves the screen; stay: keeps living on the page */
  role: 'flee' | 'stay'
  /** where it is at the start: on this element, on some box, or flying in from the side */
  start: { at: string } | 'box' | 'arrive'
  /** seconds until it first moves */
  delay: number
}

interface Fly {
  plan: Plan
  size: number
  hz: number // its own wing-beat rate
  el: HTMLDivElement
  wl: HTMLImageElement
  wr: HTMLImageElement
  sh: HTMLDivElement
  mode: Mode
  perch: Anchor | null
  landing: Anchor | null
  target: Pt | null // a waypoint before the landing
  waypoints: number
  circled: boolean // has decided whether to circle before this landing
  near: number // seconds spent close to the landing spot
  pos: Pt
  vel: Pt
  z: number // distance from the wall: grows the sprite and moves the shadow away
  zAim: number
  dir: number // travel direction, radians clockwise from up
  yaw: number // body orientation as drawn
  perchYaw: number
  wander: number
  side: number // sideways push, +1 or -1
  away: Pt
  beat: number // wing-beat clock, in beats
  rate: number // this beat's rate
  push: number // this beat's thrust
  lift: number // this beat's lift
  burst: number // strong beats left (take-off)
  glide: number // seconds of glide left
  wing: number // wing angle, deg
  timer: number
  calm: number // seconds a fresh landing ignores scrolling
  kick: number // seconds until a scroll-disturbed take-off (-1: none)
  panic: number // seconds of escape left
  settle: number // seconds of dying beats after a landing
  rest: number // wing angle it moves towards at rest
  bask: number // seconds until the resting wings change
  fade: number
  bounded: boolean
  moved: boolean // has taken off at least once
}

const rand = (a: number, b: number) => a + Math.random() * (b - a)
const gauss = () => Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(TAU * Math.random())
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))
const angleTo = (from: number, to: number) => Math.atan2(Math.sin(to - from), Math.cos(to - from))
const dirTo = (dx: number, dy: number) => Math.atan2(dx, -dy)
const shuffle = <T,>(xs: T[]) => xs.map((x) => [Math.random(), x] as const).sort((a, b) => a[0] - b[0]).map(([, x]) => x)
const ease = (t: number) => (1 - Math.cos(Math.PI * t)) / 2

/** Wing angle through one beat: a quick down-stroke, then a slower up-stroke; `amp` shrinks the sweep. */
function stroke(u: number, amp = 1): number {
  const bottom = TOP - (TOP - BOTTOM) * amp
  return u < DOWN ? TOP + (bottom - TOP) * ease(u / DOWN) : bottom + (TOP - bottom) * ease((u - DOWN) / (1 - DOWN))
}

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
      { species: 'lilac', role: 'stay', start: { at: '.bf-anchor' }, delay: 2.6 },
      { species: 'rose', role: 'stay', start: 'arrive', delay: 3.4 }
    ]
  }
  if (!SCATTER.test(path)) return []
  const colours = shuffle(COLOURS).slice(0, 3)
  // they sit while the page rises, then take off one after another; the last one stays
  return colours.map((species, i) => ({
    species, role: i === colours.length - 1 ? 'stay' : 'flee', start: 'box', delay: 0.55 + i * rand(0.22, 0.38)
  }))
}

function makeFly(layer: HTMLElement, plan: Plan): Fly {
  const sh = document.createElement('div')
  sh.className = 'bf-shadow'
  const el = document.createElement('div')
  el.className = 'bf'
  const img = (cls: string, part: string) => {
    const i = document.createElement('img')
    i.className = cls
    i.src = `/assets/3d/butterfly-${plan.species}-${part}.webp`
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
  const yaw = rand(-0.4, 0.4)
  return {
    plan, size: rand(0.86, 0.98), hz: rand(8.5, 10.5), el, wl, wr, sh, mode: 'wait',
    perch: null, landing: null, target: null, waypoints: 0, circled: false, near: 0,
    pos: { x: -100, y: -100 }, vel: { x: 0, y: 0 }, z: 0, zAim: 34, dir: 0, yaw, perchYaw: yaw, wander: 0, side: 1, away: { x: 0, y: -1 },
    beat: Math.random(), rate: 9, push: 1, lift: 1, burst: 0, glide: 0, wing: 66,
    timer: plan.delay, calm: 0, kick: -1, panic: 0, settle: 0, rest: rand(58, 74), bask: rand(1, 3),
    fade: 0, bounded: true, moved: false
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
    const randomPoint = (): Pt => ({ x: rand(50, innerWidth - 50), y: rand(110, innerHeight - 190) })

    const settle = (f: Fly, at: Anchor, fresh: boolean) => {
      f.mode = 'perch'
      f.perch = at
      f.landing = null
      f.target = null
      const a = anchorPoint(at)
      if (!fresh) f.pos = { x: a.x, y: a.y }
      f.vel = { x: 0, y: 0 }
      // perched on a wall, a butterfly turns roughly head-up
      f.perchYaw = clamp(f.yaw, -1.2, 1.2) * 0.35 + rand(-0.3, 0.3)
      f.settle = fresh ? rand(0.25, 0.45) : 0
      f.rest = rand(58, 76)
      f.wing = fresh ? f.wing : rand(30, 70)
      f.bask = rand(1, 3)
    }
    const launch = (f: Fly) => {
      f.perch = null
      f.kick = -1
      f.moved = true
      f.circled = false
      f.near = 0
      f.burst = 3 // a few strong beats to get away from the surface
      f.beat = Math.floor(f.beat) + 0.999 // the next beat starts now
      f.glide = 0
      f.settle = 0
    }
    const takeOff = (f: Fly) => {
      const from = f.perch?.el ?? null
      launch(f)
      f.mode = 'fly'
      f.dir = rand(-0.9, 0.9)
      f.vel = { x: 0, y: -40 }
      f.landing = pickLanding(f, from)
      f.waypoints = Math.random() < 0.5 ? 1 : 0
      f.target = f.waypoints ? randomPoint() : null
    }
    /** Startled: strong, erratic beats away from `from` (or from the middle of the screen), climbing. */
    const startle = (f: Fly, from?: Pt) => {
      const c = from ?? { x: innerWidth / 2, y: innerHeight * 0.6 }
      let dx = f.pos.x - c.x
      if (Math.abs(dx) < 20) dx = Math.random() < 0.5 ? -1 : 1
      const ax = Math.sign(dx) * rand(0.4, 1.3), ay = -rand(0.6, 1.2)
      const d = Math.hypot(ax, ay)
      f.away = { x: ax / d, y: ay / d }
      launch(f)
      f.mode = 'escape'
      f.dir = dirTo(f.away.x, f.away.y)
      f.vel = { x: f.away.x * 60, y: -90 }
      f.panic = f.plan.role === 'flee' ? 99 : rand(0.6, 1)
    }

    /** Puts the waiting ones in their places once the page has something to sit on. */
    const place = (elapsed: number) => {
      const waiting = flies.filter((f) => f.mode === 'wait')
      if (!waiting.length) return
      const boxed = waiting.filter((f) => f.plan.start === 'box')
      if (boxed.length) {
        const options = shuffle(onScreen(SPOTS, new Set()))
        if (options.length >= boxed.length || (options.length && elapsed > 1.2)) {
          boxed.forEach((f, i) => {
            if (i < options.length) settle(f, spotOn(options[i]), false)
            else f.mode = 'gone'
          })
        } else if (elapsed > 2.5) boxed.forEach((f) => (f.mode = 'gone'))
      }
      for (const f of waiting) {
        const start = f.plan.start
        if (typeof start === 'object') {
          const el = document.querySelector(start.at)
          if (el) settle(f, { el, rx: 0.5, ry: 0.55 }, false)
          else if (elapsed > 2.5) f.mode = 'gone'
        } else if (start === 'arrive' && elapsed > f.plan.delay) {
          // flies in from one side
          const left = Math.random() < 0.5
          f.pos = { x: left ? -40 : innerWidth + 40, y: rand(160, innerHeight * 0.45) }
          f.vel = { x: left ? 110 : -110, y: 0 }
          f.dir = f.yaw = left ? Math.PI / 2 : -Math.PI / 2
          f.bounded = false
          f.mode = 'fly'
          f.landing = pickLanding(f, null)
          f.waypoints = 0
          f.target = { x: rand(innerWidth * 0.3, innerWidth * 0.7), y: rand(170, innerHeight * 0.45) }
        }
      }
    }

    /** Where a flying butterfly is heading this frame. */
    const goalOf = (f: Fly): { goal: Pt; final: boolean } => {
      if (f.mode === 'escape') return { goal: { x: f.pos.x + f.away.x * 600, y: f.pos.y + f.away.y * 600 }, final: false }
      if (f.target) return { goal: f.target, final: false }
      if (f.landing) {
        const a = anchorPoint(f.landing)
        if (a.visible) return { goal: a, final: true }
        f.landing = pickLanding(f, f.landing.el)
      }
      if (!f.landing && Math.random() < 0.05) f.landing = pickLanding(f, null)
      f.target = randomPoint()
      return { goal: f.target, final: false }
    }

    /** A new wing beat: its strength and rate, and a new direction (a random walk biased to the goal). */
    const newBeat = (f: Fly, goal: Pt, final: boolean) => {
      const escape = f.mode === 'escape'
      const dx = goal.x - f.pos.x, dy = goal.y - f.pos.y
      const dist = Math.hypot(dx, dy)
      const strong = f.burst > 0 ? 1.45 : 1
      if (f.burst > 0) f.burst--
      f.rate = f.hz * rand(0.92, 1.08) * (escape ? 1.22 : strong > 1 ? 1.12 : 1)
      f.push = rand(0.75, 1.25) * strong * (escape ? 1.65 : 1)
      f.lift = rand(0.86, 1.14) * (strong > 1 ? 1.12 : 1)
      const m = escape ? 1 : clamp(dist / 160, 0.12, 1)
      f.wander = f.wander * 0.6 + gauss() * (escape ? 0.55 : 0.45)
      const want = dirTo(dx, dy) + f.wander * m
      f.dir += angleTo(f.dir, want) * (final && dist < 60 ? 0.75 : 0.5) + gauss() * 0.2 * m
      if (Math.random() < 0.35) f.side = -f.side
      f.zAim = escape ? 80 : final ? Math.min(34, dist / 3) : rand(26, 46)
      // whites glide rarely and briefly
      if (!escape && f.burst <= 0 && dist > 120 && Math.random() < 0.035) f.glide = rand(0.12, 0.26)
    }

    /** One physics step of a flying butterfly. */
    const physics = (f: Fly, h: number, goal: Pt, final: boolean) => {
      const dx = goal.x - f.pos.x, dy = goal.y - f.pos.y
      const dist = Math.hypot(dx, dy)
      const drag = DRAG * (final && dist < 60 ? 1.8 : 1)
      let ax = -f.vel.x * drag
      let ay = G - f.vel.y * drag
      if (f.glide > 0) {
        f.glide -= h
        ay -= G * 0.8 // spread wings hold most of the weight; it sinks slowly
      } else {
        const before = Math.floor(f.beat)
        f.beat += h * f.rate
        if (Math.floor(f.beat) !== before) newBeat(f, goal, final)
        if (f.beat % 1 < DOWN) {
          // lift balances gravity (a little more near the landing spot if it is above); the travel
          // direction does the climbing, with a sideways component that flips every few beats (zigzags)
          const hold = f.mode === 'escape' ? 1.12 : final && dist < 120 ? 1 + clamp(-dy / 80, -0.25, 0.25) : 1
          const push = f.push * (final ? clamp(dist / 110, 0.22, 1) : 1)
          const sx = Math.sin(f.dir), sy = -Math.cos(f.dir)
          const side = f.side * THRUST * 0.35 * (final && dist < 60 ? 0.3 : 1)
          ax += sx * THRUST * push - sy * side
          ay += sy * THRUST * push + sx * side - (G / DOWN) * hold * f.lift
        }
      }
      f.vel.x += ax * h
      f.vel.y += ay * h
      f.pos.x += f.vel.x * h
      f.pos.y += f.vel.y * h
    }

    const step = (f: Fly, dt: number) => {
      if (f.mode === 'perch' && f.perch) {
        const a = anchorPoint(f.perch)
        if (f.settle > 0) {
          // touching down: slide the last pixels in while the wings die down
          f.pos.x += (a.x - f.pos.x) * Math.min(1, dt * 20)
          f.pos.y += (a.y - f.pos.y) * Math.min(1, dt * 20)
          f.settle -= dt
          f.beat += dt * f.hz
          const amp = clamp(f.settle / 0.45, 0, 1)
          f.wing = f.rest + (stroke(f.beat % 1, 0.8) - f.rest) * amp
        } else {
          f.pos.x = a.x
          f.pos.y = a.y
          // at rest the wings stay raised; now and then they open slowly in the sun, or twitch
          f.bask -= dt
          if (f.bask <= 0) {
            const open = f.rest > 40
            f.rest = open ? rand(4, 20) : rand(58, 76)
            f.bask = open ? rand(1.5, 4) : rand(1.5, 4.5)
          }
          f.wing += (f.rest - f.wing) * Math.min(1, dt * 2)
          if (Math.random() < dt * 0.12) f.wing = Math.max(0, f.wing - rand(15, 30))
        }
        f.z += (0 - f.z) * Math.min(1, dt * 10)
        f.yaw += angleTo(f.yaw, f.perchYaw) * Math.min(1, dt * 4)
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

      // flying: fixed physics steps towards this frame's goal (read from the page once per frame)
      const { goal, final } = goalOf(f)
      let left = dt
      while (left > 1e-6) {
        const h = Math.min(STEP, left)
        left -= h
        physics(f, h, goal, final)
      }
      const dist = Math.hypot(goal.x - f.pos.x, goal.y - f.pos.y)
      const speed = Math.hypot(f.vel.x, f.vel.y)

      // wings: the stroke, or held spread in a glide
      if (f.glide > 0) f.wing += (12 - f.wing) * Math.min(1, dt * 14)
      else f.wing = stroke(f.beat % 1, clamp(0.75 + 0.25 * f.push, 0.7, 1))
      // the body turns towards the travel direction and rocks a little with each stroke
      f.yaw += angleTo(f.yaw, f.dir) * Math.min(1, dt * 9)
      f.z += (f.zAim - f.z) * Math.min(1, dt * 2.5)

      if (f.mode === 'escape') {
        f.panic -= dt
        if (f.plan.role === 'flee') {
          if (f.pos.x < -90 || f.pos.x > innerWidth + 90 || f.pos.y < -90 || f.pos.y > innerHeight + 90) f.mode = 'gone'
        } else if (f.panic <= 0 || f.pos.y < 90 || f.pos.x < 40 || f.pos.x > innerWidth - 40) {
          // the one that stays calms down and looks for a new place
          f.mode = 'fly'
          f.landing = pickLanding(f, null)
          f.waypoints = 0
          f.target = randomPoint()
        }
        return
      }

      // keep to the screen, above the tab bar (once it is in): bounce softly off the edges
      const inside = f.pos.x > 24 && f.pos.x < innerWidth - 24 && f.pos.y > 70 && f.pos.y < innerHeight - 130
      if (inside) f.bounded = true
      if (f.bounded && !inside) {
        const x = clamp(f.pos.x, 24, innerWidth - 24), y = clamp(f.pos.y, 70, innerHeight - 130)
        if (x !== f.pos.x) f.vel.x *= -0.4
        if (y !== f.pos.y) f.vel.y *= -0.4
        f.pos.x = x
        f.pos.y = y
        f.dir += angleTo(f.dir, dirTo(innerWidth / 2 - x, innerHeight / 2 - y)) * 0.3
      }

      if (f.target && dist < 30) {
        f.target = f.waypoints > 1 ? randomPoint() : null
        f.waypoints = Math.max(0, f.waypoints - 1)
      } else if (final && f.landing) {
        // sometimes it circles once before settling
        if (!f.circled && dist < 45) {
          f.circled = true
          if (Math.random() < 0.35) {
            const a = rand(0, TAU), r = rand(70, 120)
            f.target = { x: clamp(f.pos.x + Math.sin(a) * r, 50, innerWidth - 50), y: clamp(f.pos.y - Math.abs(Math.cos(a)) * r, 100, innerHeight - 190) }
            return
          }
        }
        f.near = dist < 14 ? f.near + dt : 0
        if ((dist < 6 && speed < 80) || f.near > 0.6) {
          settle(f, f.landing, true)
          // on the home screen it moves on after a few seconds; on lists it mostly sits
          f.timer = path === '/' ? rand(3, 7) : rand(9, 16)
          f.calm = 1.2
        }
      }
    }

    const draw = (f: Fly, dt: number) => {
      const shown = f.mode !== 'wait' && f.mode !== 'gone'
      f.fade = clamp(f.fade + (shown ? dt * 4 : -1), 0, 1)
      f.el.style.opacity = String(f.fade)
      if (!shown) {
        f.sh.style.opacity = '0'
        return
      }
      const rock = f.mode === 'perch' ? 0 : Math.sin((f.beat % 1) * TAU) * 0.05
      const scale = f.size * (1 + f.z / 220)
      f.el.style.transform = `translate3d(${f.pos.x - WING_W}px, ${f.pos.y - HINGE_Y}px, 0) rotate(${f.yaw + rock}rad) scale(${scale})`
      // wings fold up over the back, towards the viewer
      f.wl.style.transform = `rotateY(${f.wing}deg)`
      f.wr.style.transform = `rotateY(${-f.wing}deg)`
      const lift = f.size * (1 + f.z / 90)
      const open = Math.max(0.3, Math.cos((clamp(f.wing, 0, 90) * Math.PI) / 180))
      f.sh.style.transform = `translate3d(${f.pos.x - 22 + f.z * 0.35}px, ${f.pos.y - 6 + f.z * 0.9}px, 0) rotate(${f.yaw}rad) scale(${lift}, ${lift * open})`
      f.sh.style.opacity = String(f.fade * Math.max(0.06, 0.32 - f.z / 110))
    }

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      place((now - born) / 1000)
      for (const f of flies) if (f.mode !== 'wait' && f.mode !== 'gone') step(f, dt)
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
