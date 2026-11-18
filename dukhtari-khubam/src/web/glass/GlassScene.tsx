'use client'

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

import { usePrefs } from '../prefs'

/**
 * Real 3D glass (spec §8): a solid glass sphere ray-traced in the fragment shader.
 * Each pixel's view ray is refracted on entry, travels through the sphere's real thickness,
 * refracts again on exit (Snell's law, per-channel IOR for dispersion) and samples what is
 * actually behind it — the backdrop, the lettering and the 3D objects rendered into a target.
 * Fresnel (Schlick) mixes in reflections of a studio environment; path length tints absorption.
 * The image behind the glass is therefore bent, magnified and inverted like a physical lens.
 * Several spheres float in one scene; each carries a short phrase printed on its curved surface,
 * and a garland of real flowers and stars hangs inside the scene so the glass refracts it too.
 */

const vert = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`

const frag = /* glsl */ `
  uniform sampler2D uScene;
  uniform mat4 uViewProj;
  uniform vec3 uCenter;
  uniform float uRadius;
  uniform vec3 uIor;
  uniform float uPlaneZ;
  uniform vec3 uAbsorb;
  uniform vec3 uEnvTop;
  uniform vec3 uEnvBottom;
  uniform vec3 uLight;
  varying vec3 vWorld;

  vec3 env(vec3 d) {
    float y = clamp(d.y * 0.5 + 0.5, 0.0, 1.0);
    vec3 col = mix(uEnvBottom, uEnvTop, smoothstep(0.1, 0.9, y));
    float key = smoothstep(0.86, 0.985, dot(d, normalize(vec3(-0.55, 0.65, 0.52))));
    float rim = smoothstep(0.93, 0.995, dot(d, normalize(vec3(0.85, 0.05, 0.52))));
    float strip = smoothstep(0.035, 0.0, abs(d.x + 0.22)) * smoothstep(-0.2, 0.6, d.y);
    return col + vec3(1.0, 0.98, 1.0) * (key * 1.5 + rim * 0.7 + strip * 0.35);
  }

  // Trace one wavelength through the sphere and return the colour seen behind it.
  float traceChannel(vec3 p, vec3 v, vec3 n, float ior, int channel, out float pathLen) {
    vec3 d1 = refract(v, n, 1.0 / ior);
    float t = -2.0 * dot(d1, p - uCenter);
    vec3 q = p + d1 * t;
    pathLen = t;
    vec3 n2 = normalize(q - uCenter);
    vec3 d2 = refract(d1, -n2, ior);
    if (dot(d2, d2) < 1e-4) d2 = reflect(d1, -n2);
    float s = (uPlaneZ - q.z) / min(d2.z, -1e-3);
    vec3 hit = q + d2 * s;
    vec4 clip = uViewProj * vec4(hit, 1.0);
    vec2 uv = clip.xy / clip.w * 0.5 + 0.5;
    vec3 c;
    if (d2.z > -0.02 || uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
      c = env(d2);
    } else {
      c = texture2D(uScene, uv).rgb;
    }
    return channel == 0 ? c.r : (channel == 1 ? c.g : c.b);
  }

  void main() {
    vec3 v = normalize(vWorld - cameraPosition);
    vec3 n = normalize(vWorld - uCenter);
    float lr, lg, lb;
    vec3 refr = vec3(
      traceChannel(vWorld, v, n, uIor.r, 0, lr),
      traceChannel(vWorld, v, n, uIor.g, 1, lg),
      traceChannel(vWorld, v, n, uIor.b, 2, lb)
    );
    refr *= exp(-uAbsorb * vec3(lr, lg, lb));

    float cosi = clamp(dot(-v, n), 0.0, 1.0);
    float f0 = pow((uIor.g - 1.0) / (uIor.g + 1.0), 2.0);
    float fresnel = f0 + (1.0 - f0) * pow(1.0 - cosi, 5.0);
    vec3 r = reflect(v, n);
    vec3 refl = env(r);
    float spec = pow(max(dot(r, normalize(uLight)), 0.0), 220.0) * 2.4
               + pow(max(dot(r, normalize(vec3(0.7, -0.35, 0.6))), 0.0), 60.0) * 0.35;
    float edge = pow(1.0 - cosi, 3.0);
    vec3 film = 0.5 + 0.5 * cos(6.2831 * (edge * 0.9 + vec3(0.0, 0.33, 0.67)));
    vec3 col = mix(refr, refl, fresnel) + spec + film * edge * 0.12;
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

export type SceneVariant = 'sphere' | 'sculpture'

/** Glass spheres per variant: centre, radius, bobbing phase. The first one follows the pointer. */
const GLASSES: Record<SceneVariant, { c: [number, number, number]; r: number; phase: number }[]> = {
  // a gentle arc along the lower half: small, large (over the lettering), small
  sphere: [
    { c: [0.6, -0.6, 0.6], r: 1.1, phase: 0 },
    { c: [-1.35, -0.05, 0.4], r: 0.55, phase: 1.3 },
    { c: [2.15, -1.35, 0.4], r: 0.5, phase: 2.4 }
  ],
  sculpture: [
    { c: [-0.05, -0.1, 0.6], r: 0.85, phase: 0 },
    { c: [-1.6, -0.55, 0.4], r: 0.6, phase: 1.7 }
  ]
}

/** The garland hangs from the top edge: centre x as a fraction of the half-width, height as a fraction of the frame. */
const GARLAND: Record<SceneVariant, { x: number; h: number }> = { sphere: { x: 0.6, h: 0.66 }, sculpture: { x: -0.62, h: 0.62 } }
const GARLAND_SRC = { url: '/assets/3d/garland.webp', w: 700, h: 1539 }

interface Props {
  word: string
  variant?: SceneVariant
  accent?: string
  className?: string
  /** pointer-driven movement of the glass (disabled with reduced motion) */
  interactive?: boolean
}

function cssVar(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v || fallback
}

/** A phrase printed on the glass: embossed ink on a transparent canvas, mapped onto a spherical cap. */
function drawMotto(canvas: HTMLCanvasElement, text: string, dark: boolean, font: string, rtl: boolean) {
  const ctx = canvas.getContext('2d')!
  const { width: w, height: h } = canvas
  ctx.clearRect(0, 0, w, h)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.direction = rtl ? 'rtl' : 'ltr'
  const words = text.split(' ')
  let size = h * 0.38
  let lines = [text]
  ctx.font = `italic 600 ${size}px ${font}`
  if (ctx.measureText(text).width > w * 0.86 && words.length > 1) {
    const mid = Math.ceil(words.length / 2)
    lines = [words.slice(0, mid).join(' '), words.slice(mid).join(' ')]
    size = h * 0.3
  }
  ctx.font = `italic 600 ${size}px ${font}`
  while (Math.max(...lines.map((l) => ctx.measureText(l).width)) > w * 0.86 && size > 12) {
    size *= 0.94
    ctx.font = `italic 600 ${size}px ${font}`
  }
  const lh = size * 1.08
  lines.forEach((line, i) => {
    const y = h / 2 + (i - (lines.length - 1) / 2) * lh
    ctx.shadowColor = dark ? 'rgba(20,12,30,0.7)' : 'rgba(255,255,255,0.95)'
    ctx.shadowBlur = size * 0.12
    ctx.fillStyle = dark ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.9)'
    ctx.fillText(line, w / 2, y + size * 0.045)
    ctx.shadowBlur = 0
    ctx.fillStyle = dark ? 'rgba(250,244,255,0.95)' : 'rgba(74,52,99,0.9)'
    ctx.fillText(line, w / 2, y)
  })
}

function drawBackdrop(canvas: HTMLCanvasElement, word: string, dark: boolean, accent: string, serif: string) {
  const ctx = canvas.getContext('2d')!
  const { width: w, height: h } = canvas
  const g = ctx.createLinearGradient(0, 0, 0, h)
  if (dark) {
    g.addColorStop(0, '#1d1726'); g.addColorStop(0.62, '#30263b'); g.addColorStop(0.63, '#3b2f48'); g.addColorStop(1, '#241c2c')
  } else {
    g.addColorStop(0, '#f4eefa'); g.addColorStop(0.62, '#dccceb'); g.addColorStop(0.63, '#e9dcef'); g.addColorStop(1, '#ebdce4')
  }
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)

  // vertical light lines (what the glass visibly bends)
  const horizon = h * 0.62
  const step = Math.max(10, Math.round(w / 46))
  for (let x = step / 2; x < w; x += step) {
    const lw = Math.max(1.5, w / 800)
    const shade = ctx.createLinearGradient(0, 0, 0, horizon)
    shade.addColorStop(0, dark ? 'rgba(0,0,0,0)' : 'rgba(89,68,110,0)')
    shade.addColorStop(1, dark ? 'rgba(0,0,0,0.35)' : 'rgba(89,68,110,0.22)')
    ctx.fillStyle = shade
    ctx.fillRect(Math.round(x) + lw, 0, lw, horizon)
    const lg = ctx.createLinearGradient(0, 0, 0, horizon)
    lg.addColorStop(0, dark ? 'rgba(216,200,234,0.08)' : 'rgba(255,255,255,0.2)')
    lg.addColorStop(1, dark ? 'rgba(232,215,185,0.75)' : 'rgba(255,255,255,1)')
    ctx.fillStyle = lg
    ctx.fillRect(Math.round(x), 0, lw, horizon)
  }
  const glow = ctx.createLinearGradient(0, horizon - 6, 0, horizon + 6)
  glow.addColorStop(0, 'rgba(255,255,255,0)'); glow.addColorStop(0.5, dark ? 'rgba(232,215,185,0.8)' : 'rgba(255,255,255,1)'); glow.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, horizon - 6, w, 12)

  // lettering standing on the floor
  ctx.fillStyle = dark ? '#d8c8ea' : accent
  ctx.textBaseline = 'alphabetic'
  let size = h * 0.3
  ctx.font = `italic 600 ${size}px ${serif}`
  while (ctx.measureText(word).width > w * 0.94 && size > 20) {
    size *= 0.92
    ctx.font = `italic 600 ${size}px ${serif}`
  }
  ctx.fillText(word, w * 0.04, h * 0.97)
}

export function GlassScene({ word, variant = 'sphere', accent = '#59446e', className, interactive = true }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const { reducedMotion, t, locale } = usePrefs()
  const mottos = [t('glass.motto_1'), t('glass.motto_2'), t('glass.motto_3')]
  const mottoKey = mottos.join('|')
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const el = host.current
    if (!el) return
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' })
    } catch {
      setFailed(true)
      return
    }
    if (!renderer.capabilities.isWebGL2) {
      renderer.dispose()
      setFailed(true)
      return
    }
    const dark = document.documentElement.dataset.theme === 'dark'
    const serif = cssVar('--font-lora', 'Georgia, serif')
    const rtl = locale === 'ar'
    const mottoFont = rtl ? cssVar('--font-naskh', 'serif') : serif
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.NoToneMapping
    renderer.domElement.setAttribute('aria-hidden', 'true')
    el.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const pmrem = new THREE.PMREMGenerator(renderer)
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environment = envTex

    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100)
    camera.position.set(0, 0, 9)
    const planeZ = -1.6

    // backdrop: a real plane in the scene, drawn from a canvas
    const backCanvas = document.createElement('canvas')
    const backTex = new THREE.CanvasTexture(backCanvas)
    backTex.colorSpace = THREE.SRGBColorSpace
    backTex.anisotropy = 4
    const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: backTex }))
    backdrop.position.z = planeZ
    scene.add(backdrop)

    // studio light for the opaque objects
    scene.add(new THREE.HemisphereLight(0xffffff, 0xdccceb, 0.6))
    const key = new THREE.DirectionalLight(0xffffff, 1.6)
    key.position.set(-3, 4, 5)
    scene.add(key)

    const objects = new THREE.Group()
    scene.add(objects)
    const tint = new THREE.Color(accent)
    const glossy = (c: THREE.ColorRepresentation) =>
      new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.22, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.08, sheen: 0.6, sheenColor: new THREE.Color('#ffd6f0'), envMapIntensity: 1.1 })
    const chrome = new THREE.MeshStandardMaterial({ color: '#f1eef7', metalness: 1, roughness: 0.12, envMapIntensity: 1.3 })

    const specs = GLASSES[variant]
    const center = new THREE.Vector3(...specs[0].c)
    if (variant === 'sphere') {
      const pearl = new THREE.Mesh(new THREE.SphereGeometry(0.48, 64, 48), glossy('#b493d9'))
      pearl.position.set(1.95, 0.55, -0.6)
      const pearl2 = new THREE.Mesh(new THREE.SphereGeometry(0.3, 48, 32), glossy('#e7b7cf'))
      pearl2.position.set(-0.1, 0.6, -0.9)
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.65, 0.028, 24, 200), chrome)
      ring.position.copy(center).setZ(-0.35)
      ring.rotation.set(1.15, 0.25, 0)
      objects.add(pearl, pearl2, ring)
      // pre-rendered brilliant-cut diamonds (ray-traced offline) placed in the scene, so the glass refracts them
      const loader = new THREE.TextureLoader()
      const sprite = (url: string, w: number, h: number, x: number, y: number, z: number, size: number) => {
        const tex = loader.load(url, () => kick())
        tex.colorSpace = THREE.SRGBColorSpace
        const m = new THREE.Mesh(new THREE.PlaneGeometry(size, (size * h) / w),
          new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }))
        m.position.set(x, y, z)
        objects.add(m)
      }
      sprite('/assets/3d/diamond-cluster.webp', 900, 488, -1.75, 1.0, -0.95, 2.2)
      sprite('/assets/3d/diamond-single.webp', 418, 321, 2.5, -1.05, -0.5, 0.95)
    } else {
      const purple = glossy(tint.clone().lerp(new THREE.Color('#8e5bd0'), 0.55))
      const pink = glossy('#d9a1c4')
      const balls: [number, number, number, number, THREE.Material][] = [
        [-0.35, 0.9, -0.3, 0.62, purple], [0.55, 1.15, -0.8, 0.42, pink], [-1.1, 0.05, -0.6, 0.38, pink],
        [1.55, -0.4, -0.5, 0.5, purple], [-0.2, -0.85, -0.2, 0.3, purple]
      ]
      for (const [x, y, z, r, m] of balls) {
        const b = new THREE.Mesh(new THREE.SphereGeometry(r * 1.38, 64, 48), m)
        b.position.set(x, y, z)
        objects.add(b)
      }
      const pts = [[-1.6, -1.2, -0.4], [-0.35, 0.9, -0.3], [0.55, 1.15, -0.8], [1.55, -0.4, -0.5], [2.4, 0.9, -0.9]]
      const curve = new THREE.CatmullRomCurve3(pts.map(([x, y, z]) => new THREE.Vector3(x, y, z)))
      objects.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 200, 0.07, 24, false), chrome))
      const curve2 = new THREE.CatmullRomCurve3([[-1.1, 0.05, -0.6], [-0.2, -0.85, -0.2], [1.55, -0.4, -0.5]].map(([x, y, z]) => new THREE.Vector3(x, y, z)))
      objects.add(new THREE.Mesh(new THREE.TubeGeometry(curve2, 120, 0.05, 20, false), chrome))
    }

    // garland of flowers and stars (composed from photographs, see PROVENANCE.json), placed against the frame in resize()
    const garlandZ = -1.05
    const garlandTex = new THREE.TextureLoader().load(GARLAND_SRC.url, () => kick())
    garlandTex.colorSpace = THREE.SRGBColorSpace
    const garland = new THREE.Mesh(new THREE.PlaneGeometry(1, GARLAND_SRC.h / GARLAND_SRC.w),
      new THREE.MeshBasicMaterial({ map: garlandTex, transparent: true, depthWrite: false }))
    scene.add(garland)

    // the glass spheres, each with its phrase
    const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 0 })
    const shared = {
      uScene: { value: rt.texture },
      uViewProj: { value: new THREE.Matrix4() },
      uIor: { value: new THREE.Vector3(1.485, 1.5, 1.518) },
      uPlaneZ: { value: planeZ },
      uAbsorb: { value: dark ? new THREE.Vector3(0.05, 0.09, 0.04) : new THREE.Vector3(0.025, 0.05, 0.02) },
      uEnvTop: { value: new THREE.Color(dark ? '#3b2f48' : '#ffffff') },
      uEnvBottom: { value: new THREE.Color(dark ? '#17131e' : '#cdbbe3') },
      uLight: { value: new THREE.Vector3(-0.5, 0.6, 0.62) }
    }
    const mottoTextures: THREE.CanvasTexture[] = []
    const glasses = specs.map((spec, i) => {
      const uniforms = { ...shared, uCenter: { value: new THREE.Vector3(...spec.c) }, uRadius: { value: spec.r } }
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(spec.r, 128, 96), new THREE.ShaderMaterial({ uniforms, vertexShader: vert, fragmentShader: frag }))
      const canvas = document.createElement('canvas')
      canvas.width = 1024
      canvas.height = 512
      const tex = new THREE.CanvasTexture(canvas)
      tex.colorSpace = THREE.SRGBColorSpace
      tex.anisotropy = 4
      mottoTextures.push(tex)
      const draw = () => {
        drawMotto(canvas, mottos[i % mottos.length], dark, mottoFont, rtl)
        tex.needsUpdate = true
      }
      draw()
      document.fonts?.ready.then(() => { draw(); kick() })
      // a cap of ±54° × ±29° facing the camera, just above the glass surface
      const a = 0.95
      const b = 0.5
      const cap = new THREE.Mesh(new THREE.SphereGeometry(spec.r * 1.004, 64, 32, Math.PI / 2 - a, 2 * a, Math.PI / 2 - b, 2 * b),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }))
      mesh.add(cap)
      scene.add(mesh)
      return { mesh, uniforms, spec }
    })

    let width = 0
    let height = 0
    const resize = () => {
      const r = el.getBoundingClientRect()
      width = Math.max(1, Math.round(r.width))
      height = Math.max(1, Math.round(r.height))
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      const dist = camera.position.z - planeZ
      const ph = 2 * dist * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
      backdrop.scale.set(ph * camera.aspect * 1.02, ph * 1.02, 1)
      const scale = Math.min(window.devicePixelRatio, 1.75)
      backCanvas.width = Math.min(2048, Math.round(width * scale))
      backCanvas.height = Math.round(backCanvas.width / camera.aspect)
      drawBackdrop(backCanvas, word, dark, accent, serif)
      backTex.needsUpdate = true
      const size = renderer.getDrawingBufferSize(new THREE.Vector2())
      rt.setSize(size.x, size.y)
      // keep the sculpture framed on narrow screens
      const fit = Math.min(1, camera.aspect / 1.6)
      objects.scale.setScalar(Math.max(0.62, fit))
      for (const g of glasses) {
        g.mesh.scale.setScalar(Math.max(0.85, fit))
        g.uniforms.uRadius.value = g.spec.r * g.mesh.scale.x
      }
      // garland: hangs from just above the top edge
      const halfH = (camera.position.z - garlandZ) * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
      const gl = GARLAND[variant]
      const gh = 2 * halfH * gl.h
      garland.scale.setScalar(gh / (GARLAND_SRC.h / GARLAND_SRC.w))
      garland.position.set(gl.x * halfH * camera.aspect, halfH + 0.06 - gh / 2, garlandZ)
    }

    const target = new THREE.Vector2(0, 0)
    const pointer = new THREE.Vector2(0, 0)
    const onPointer = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      target.set(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1))
    }
    const motion = !reducedMotion
    if (interactive && motion) el.addEventListener('pointermove', onPointer)

    const clock = new THREE.Clock()
    const render = () => {
      const t = clock.getElapsedTime()
      if (motion) {
        pointer.lerp(target, 0.06)
        objects.rotation.y = Math.sin((t / 6) * Math.PI * 2) * 0.06
        garland.rotation.z = Math.sin((t / 7) * Math.PI * 2) * 0.01
      }
      glasses.forEach(({ mesh, uniforms, spec }, i) => {
        const follow = i === 0 ? 1 : 0.35
        const bob = motion ? Math.sin((t / 5) * Math.PI * 2 + spec.phase) * (i === 0 ? 0.07 : 0.05) : 0
        mesh.position.set(spec.c[0] * mesh.scale.x + pointer.x * 0.35 * follow, spec.c[1] + bob + pointer.y * 0.22 * follow, spec.c[2])
        mesh.rotation.y = motion ? Math.sin((t / 8) * Math.PI * 2 + spec.phase) * 0.08 : 0
        uniforms.uCenter.value.copy(mesh.position)
      })
      camera.updateMatrixWorld()
      shared.uViewProj.value.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
      for (const g of glasses) g.mesh.visible = false
      renderer.setRenderTarget(rt)
      renderer.render(scene, camera)
      for (const g of glasses) g.mesh.visible = true
      renderer.setRenderTarget(null)
      renderer.render(scene, camera)
    }

    let raf = 0
    let visible = true
    const loop = () => {
      raf = 0
      if (!visible || document.hidden) return
      render()
      if (motion) raf = requestAnimationFrame(loop)
    }
    const kick = () => {
      if (!raf) raf = requestAnimationFrame(loop)
    }
    const ro = new ResizeObserver(() => {
      resize()
      render()
    })
    ro.observe(el)
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      if (visible) kick()
    })
    io.observe(el)
    const onVisibility = () => !document.hidden && kick()
    document.addEventListener('visibilitychange', onVisibility)
    const onLost = (e: Event) => {
      e.preventDefault()
      setFailed(true)
    }
    renderer.domElement.addEventListener('webglcontextlost', onLost)

    resize()
    kick()

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      io.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      el.removeEventListener('pointermove', onPointer)
      renderer.domElement.removeEventListener('webglcontextlost', onLost)
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh
        mesh.geometry?.dispose()
        const m = mesh.material as THREE.Material | THREE.Material[] | undefined
        if (Array.isArray(m)) m.forEach((x) => x.dispose())
        else m?.dispose()
      })
      backTex.dispose()
      garlandTex.dispose()
      mottoTextures.forEach((x) => x.dispose())
      envTex.dispose()
      pmrem.dispose()
      rt.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    }
    // mottos are read through mottoKey (a new array every render)
  }, [word, variant, accent, reducedMotion, interactive, mottoKey, locale])

  return (
    <div ref={host} className={className} style={{ position: 'absolute', inset: 0 }}>
      {failed ? <GlassFallback /> : null}
    </div>
  )
}

/** Fallback when WebGL2 is unavailable: still layered, with edge highlights, never empty (spec §8.9). */
function GlassFallback() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute', inset: 0,
        background: 'repeating-linear-gradient(90deg, rgba(255,255,255,0.55) 0 1.5px, transparent 1.5px 22px), linear-gradient(160deg, var(--lavender), var(--lilac) 62%, var(--rose))'
      }}
    >
      <div
        style={{
          position: 'absolute', right: '12%', top: '18%', width: '38%', aspectRatio: '1', borderRadius: '50%',
          background: 'radial-gradient(circle at 30% 25%, rgba(255,255,255,0.95), rgba(255,255,255,0.15) 35%, rgba(167,139,203,0.25) 70%, rgba(89,68,110,0.35))',
          boxShadow: 'inset 0 0 0 1.5px rgba(255,255,255,0.8), inset -12px -18px 40px rgba(89,68,110,0.25), 0 30px 50px -30px rgba(58,40,80,0.6)',
          backdropFilter: 'blur(6px) saturate(1.4)'
        }}
      />
    </div>
  )
}
