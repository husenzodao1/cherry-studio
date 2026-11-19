'use client'

import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react'

/**
 * UI glass that refracts the real page content behind it (spec §8.4, Bottom Navigation).
 * A displacement map is computed from a physical model of the glass edge: a convex squircle
 * bezel profile, its surface normal, and Snell's law (n = 1.5) give how far each pixel's view
 * ray is bent. The map drives an SVG feDisplacementMap applied with backdrop-filter, so the
 * content scrolling underneath is optically bent near the rim, not merely blurred.
 * Browsers without SVG backdrop filters (Safari, Firefox) get a frosted fallback with the
 * same rim lighting; text stays readable everywhere.
 */

interface MapResult {
  url: string
  scale: number
}

function surface(x: number): number {
  // convex squircle profile: 0 at the rim, 1 where the flat top begins
  const c = Math.min(Math.max(x, 0), 1)
  return Math.pow(1 - Math.pow(1 - c, 4), 0.25)
}

export function buildDisplacementMap(w: number, h: number, radius: number, bezel: number, ior = 1.5, depth = bezel * 0.8): MapResult {
  const samples = 256
  const profile = new Float32Array(samples + 1)
  let max = 0
  for (let i = 0; i <= samples; i++) {
    const x = i / samples
    const e = 1 / samples
    const height = surface(x) * depth
    const slope = ((surface(x + e) - surface(Math.max(x - e, 0))) / (x + e - Math.max(x - e, 0))) * (depth / bezel)
    const incident = Math.atan(slope)
    const refracted = Math.asin(Math.sin(incident) / ior)
    const shift = (height + 1.5) * Math.tan(incident - refracted)
    profile[i] = shift
    max = Math.max(max, shift)
  }
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  const img = ctx.createImageData(w, h)
  const r = Math.min(radius, w / 2, h / 2)
  const hx = w / 2 - r
  const hy = h / 2 - r
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const lx = px + 0.5 - w / 2
      const ly = py + 0.5 - h / 2
      const qx = Math.abs(lx) - hx
      const qy = Math.abs(ly) - hy
      const ox = Math.max(qx, 0)
      const oy = Math.max(qy, 0)
      const outside = Math.hypot(ox, oy)
      const sdf = outside + Math.min(Math.max(qx, qy), 0) - r
      const inside = -sdf
      let nx = 0
      let ny = 0
      if (qx > 0 && qy > 0) {
        nx = (ox / (outside || 1)) * Math.sign(lx)
        ny = (oy / (outside || 1)) * Math.sign(ly)
      } else if (qx > qy) nx = Math.sign(lx)
      else ny = Math.sign(ly)
      let dx = 0
      let dy = 0
      if (inside >= 0 && inside < bezel && max > 0) {
        const v = profile[Math.round((inside / bezel) * samples)] / max
        // rays bend toward the centre: sample from inward of the rim
        dx = -nx * v
        dy = -ny * v
      }
      const o = (py * w + px) * 4
      img.data[o] = Math.round(128 + dx * 127)
      img.data[o + 1] = Math.round(128 + dy * 127)
      img.data[o + 2] = 128
      img.data[o + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  return { url: canvas.toDataURL(), scale: max * 2 }
}

function supportsSvgBackdrop(): boolean {
  if (typeof navigator === 'undefined' || typeof CSS === 'undefined') return false
  const ua = navigator.userAgent
  const chromium = /Chrome\/|Chromium\//.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua)
  return chromium && CSS.supports('backdrop-filter', 'url(#a)')
}

interface Props {
  radius: number
  bezel?: number
  className?: string
  style?: CSSProperties
  children: ReactNode
  as?: 'div' | 'nav'
  label?: string
  /** bend the content behind (costly: redrawn whenever that content moves); false keeps clear frosted glass */
  refract?: boolean
}

export function LiquidGlass({ radius, bezel = 16, className, style, children, as = 'div', label, refract: bend = true }: Props) {
  const ref = useRef<HTMLElement | null>(null)
  const rawId = useId()
  const filterId = `lg${rawId.replace(/[^a-zA-Z0-9]/g, '')}`
  const [map, setMap] = useState<(MapResult & { w: number; h: number }) | null>(null)
  const [svgOk, setSvgOk] = useState(false)

  useEffect(() => {
    setSvgOk(bend && supportsSvgBackdrop())
  }, [bend])

  useEffect(() => {
    const el = ref.current
    if (!el || !svgOk) return
    let last = ''
    const update = () => {
      const w = Math.round(el.offsetWidth)
      const h = Math.round(el.offsetHeight)
      const sig = `${w}x${h}`
      if (!w || !h || sig === last) return
      last = sig
      setMap({ ...buildDisplacementMap(w, h, radius, bezel), w, h })
    }
    const ro = new ResizeObserver(update)
    ro.observe(el)
    update()
    return () => ro.disconnect()
  }, [radius, bezel, svgOk])

  const refract = svgOk && map
  const Tag = as
  return (
    <Tag
      ref={ref as never}
      aria-label={label}
      className={`lg ${className ?? ''}`}
      style={{
        ...style,
        borderRadius: radius,
        // Chromium aliases -webkit-backdrop-filter to backdrop-filter, so set only one of them
        ...(refract
          ? { backdropFilter: `url(#${filterId}) saturate(1.45) brightness(1.05)` }
          : { backdropFilter: 'blur(10px) saturate(1.5)', WebkitBackdropFilter: 'blur(10px) saturate(1.5)' })
      }}
    >
      {refract ? (
        <svg width="0" height="0" aria-hidden="true" style={{ position: 'absolute' }}>
          <filter id={filterId} x="0" y="0" width={map.w} height={map.h} filterUnits="userSpaceOnUse"
            primitiveUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
            <feImage href={map.url} x="0" y="0" width={map.w} height={map.h} preserveAspectRatio="none" result="map" />
            <feDisplacementMap in="SourceGraphic" in2="map" scale={map.scale} xChannelSelector="R" yChannelSelector="G" result="bent" />
            <feGaussianBlur in="bent" stdDeviation="0.4" />
          </filter>
        </svg>
      ) : null}
      <span className="lg-rim" aria-hidden="true" style={{ borderRadius: radius }} />
      {children}
    </Tag>
  )
}
