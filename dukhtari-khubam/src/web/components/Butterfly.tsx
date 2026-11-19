'use client'

import { useEffect, useRef } from 'react'

/**
 * A butterfly that lives on the home screen. It starts perched at the end of the motto, then flies
 * from place to place — school tiles, cards, the glass flower — and settles on their top edges.
 *
 * Motion model (per animation frame, transforms only):
 * - Flight: steering towards a target with a lateral flutter, flapping about 8 times a second with
 *   short glides; each down-stroke lifts the body a little; the body turns smoothly into the direction
 *   of travel; altitude grows the sprite slightly and pushes its shadow away and softer.
 * - Perched: the butterfly follows the element it sits on (so it scrolls with it) and slowly opens and
 *   closes its wings, sometimes holding them open; after a few seconds it takes off again.
 * - A tap near it startles it away. Wings are two images rotating around the body axis in 3D.
 */

const WING_W = 32 // px, one wing (the painted canvas is a little wider than the wing itself)
const WING_H = WING_W * (208 / 192)
const HINGE_Y = WING_H * (320 / 760)
const LANDING = '.tile-link, .pill-card, .hello-flower, .h-hero, .section-head .h-section, .home-top .icon-btn'
const TAU = Math.PI * 2

interface Anchor { el: Element; rx: number; ry: number }
type State = 'perch' | 'fly'

const rand = (a: number, b: number) => a + Math.random() * (b - a)
const angleTo = (from: number, to: number) => Math.atan2(Math.sin(to - from), Math.cos(to - from))

function anchorPoint(a: Anchor): { x: number; y: number; visible: boolean } {
  const r = a.el.getBoundingClientRect()
  const x = r.left + a.rx * r.width
  const y = r.top + a.ry * r.height
  return { x, y, visible: r.width > 0 && y > 60 && y < innerHeight - 110 && x > 10 && x < innerWidth - 10 }
}

/** A landing spot on the top edge of something on screen (or on the petals of the glass flower). */
function pickLanding(avoid: Element | null): Anchor | null {
  const options = [...document.querySelectorAll(LANDING)].filter((el) => {
    if (el === avoid) return false
    const r = el.getBoundingClientRect()
    return r.width > 36 && r.top > 70 && r.top < innerHeight - 160
  })
  if (!options.length) return null
  const el = options[Math.floor(Math.random() * options.length)]
  if (el.classList.contains('hello-flower')) return { el, rx: rand(0.35, 0.7), ry: rand(0.3, 0.45) }
  // sit on the top edge: the thorax a few pixels above it
  const r = el.getBoundingClientRect()
  return { el, rx: rand(0.2, 0.8), ry: -6 / Math.max(1, r.height) }
}

export function Butterfly({ anchor }: { anchor: string }) {
  const root = useRef<HTMLDivElement>(null)
  const wingL = useRef<HTMLImageElement>(null)
  const wingR = useRef<HTMLImageElement>(null)
  const shadow = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const start = document.querySelector(anchor)
    if (!start || !root.current) return
    let state: State = 'perch'
    let perch: Anchor | null = { el: start, rx: 0.5, ry: 0.55 }
    const p = anchorPoint(perch)
    const pos = { x: p.x, y: p.y }
    const vel = { x: 0, y: 0 }
    let heading = rand(-0.4, 0.4)
    let perchHeading = heading
    let altitude = 0
    let phase = 0
    let glide = 0
    let wing = 20
    let target: { x: number; y: number } | null = null
    let landing: Anchor | null = null
    let waypoints = 0
    let timer = 2.6 // seconds until the first take-off
    let basking = 0
    let last = performance.now()
    let raf = 0

    const takeOff = (away?: { x: number; y: number }) => {
      state = 'fly'
      const from = perch?.el ?? null
      perch = null
      waypoints = Math.random() < 0.45 ? 1 : 0
      landing = pickLanding(from)
      if (away) {
        const dx = pos.x - away.x, dy = pos.y - away.y, d = Math.hypot(dx, dy) || 1
        target = { x: pos.x + (dx / d) * 180, y: pos.y + (dy / d) * 180 }
        waypoints = 1
      } else target = waypoints ? { x: rand(40, innerWidth - 40), y: rand(90, innerHeight - 170) } : null
      vel.y = -60
    }

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const t = now / 1000

      if (state === 'perch' && perch) {
        const a = anchorPoint(perch)
        pos.x = a.x
        pos.y = a.y
        altitude += (0 - altitude) * Math.min(1, dt * 8)
        heading += angleTo(heading, perchHeading) * Math.min(1, dt * 5)
        // slow opening and closing, now and then holding the wings open in the sun
        if (basking > 0) {
          basking -= dt
          wing += (6 - wing) * Math.min(1, dt * 3)
        } else {
          wing = 8 + 58 * (0.5 - 0.5 * Math.cos(t * TAU / 2.8))
          if (Math.random() < dt * 0.25) basking = rand(0.8, 2)
        }
        timer -= dt
        if (timer <= 0 || !a.visible) takeOff()
      } else {
        // where to: a waypoint first, then the landing spot
        let goal = target
        if (!goal && landing) {
          const a = anchorPoint(landing)
          goal = a.visible ? { x: a.x, y: a.y } : null
          if (!a.visible) landing = pickLanding(landing.el)
        }
        if (!goal) {
          landing = pickLanding(null)
          goal = { x: innerWidth / 2, y: innerHeight / 2 }
        }
        const dx = goal.x - pos.x, dy = goal.y - pos.y
        const dist = Math.hypot(dx, dy) || 1
        const final = !target && !!landing
        const cruise = final ? Math.min(170, 35 + dist * 1.6) : 170
        // flutter: a wandering sideways push, stronger far from the goal
        const side = (Math.sin(t * 2.3) * 70 + Math.sin(t * 5.7 + 1) * 30) * Math.min(1, dist / 120)
        const want = { x: (dx / dist) * cruise - (dy / dist) * side, y: (dy / dist) * cruise + (dx / dist) * side }
        const k = Math.min(1, dt * (final && dist < 50 ? 6 : 2.6))
        vel.x += (want.x - vel.x) * k
        vel.y += (want.y - vel.y) * k
        // flap and glide
        if (glide > 0) glide -= dt
        else if (Math.random() < dt * 0.6 && dist > 90) glide = rand(0.25, 0.5)
        if (glide > 0) {
          wing += (14 - wing) * Math.min(1, dt * 10)
          vel.y += 25 * dt // a glide sinks a little
        } else {
          phase += dt * TAU * (final && dist < 40 ? 6 : 8)
          wing = 16 + 64 * (0.5 + 0.5 * Math.sin(phase))
        }
        pos.x += vel.x * dt
        pos.y += vel.y * dt
        // keep to the screen, above the tab bar
        pos.x = Math.min(innerWidth - 24, Math.max(24, pos.x))
        pos.y = Math.min(innerHeight - 130, Math.max(70, pos.y))
        const speed = Math.hypot(vel.x, vel.y)
        if (speed > 12) heading += angleTo(heading, Math.atan2(vel.x, -vel.y)) * Math.min(1, dt * 5)
        altitude += ((final ? Math.min(30, dist / 3) : 30) - altitude) * Math.min(1, dt * 3)
        if (target && dist < 26) {
          target = waypoints > 1 ? { x: rand(40, innerWidth - 40), y: rand(90, innerHeight - 170) } : null
          waypoints = Math.max(0, waypoints - 1)
        } else if (final && dist < 3 && speed < 40) {
          state = 'perch'
          perch = landing
          landing = null
          timer = rand(3, 7)
          perchHeading = heading + rand(-0.5, 0.5)
          vel.x = vel.y = 0
        }
      }

      // draw: body bob on each down-stroke, wings rotating about the body axis
      const bob = state === 'fly' && glide <= 0 ? Math.sin(phase) * 2.5 : 0
      const scale = 1 + altitude / 260
      root.current!.style.transform = `translate3d(${pos.x - WING_W}px, ${pos.y - HINGE_Y - bob}px, 0) rotate(${heading}rad) scale(${scale})`
      // wings fold up over the back, towards the viewer
      wingL.current!.style.transform = `rotateY(${wing}deg)`
      wingR.current!.style.transform = `rotateY(${-wing}deg)`
      const s = shadow.current!.style
      s.transform = `translate3d(${pos.x - 22 + altitude * 0.35}px, ${pos.y - 6 + altitude * 0.9}px, 0) rotate(${heading}rad) scale(${1 + altitude / 90}, ${(1 + altitude / 90) * Math.max(0.35, Math.cos((wing * Math.PI) / 180))})`
      s.opacity = String(Math.max(0.08, 0.32 - altitude / 110))
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    // a tap close to it startles it away
    const onDown = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - pos.x, e.clientY - pos.y) < 80) takeOff({ x: e.clientX, y: e.clientY })
    }
    window.addEventListener('pointerdown', onDown, { passive: true })
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointerdown', onDown)
    }
  }, [anchor])

  return (
    <div className="bf-layer" aria-hidden="true">
      <div className="bf-shadow" ref={shadow} />
      <div className="bf" ref={root}>
        <img ref={wingL} className="bf-wing bf-wing-l" src="/assets/3d/butterfly-wing-l.webp" alt="" />
        <img ref={wingR} className="bf-wing bf-wing-r" src="/assets/3d/butterfly-wing-r.webp" alt="" />
        <img className="bf-body" src="/assets/3d/butterfly-body.webp" alt="" />
      </div>
    </div>
  )
}
