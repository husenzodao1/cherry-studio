import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'

/**
 * The sign-in screen's live scene (StartScene.tsx): eight small glass objects of what she learns here —
 * a book, a mosque, a heart, scales, a growth chart, a plant, a lantern and a Quran stand — circling one
 * another on a tilted orbit (rising on one side, sinking on the other), each also turning slowly on
 * its own axis, with a soft trail of light behind it that fades like a falling star's tail.
 * Loaded only on that screen (dynamic import), so three.js never weighs on the rest of the app.
 */

const TINT = {
  lilac: 0xb9a1f0, rose: 0xf4a6c8, peach: 0xffb9a0, mint: 0x94dcc6, gold: 0xf2c96e, sky: 0xa8c6ff, plum: 0x8a63ea, cream: 0xfff4e4
}

/** clear tinted glass: the page's gradient shows through, the room's light reflects on it */
const glass = (color: number, opacity = 0.78) => new THREE.MeshPhysicalMaterial({
  color, metalness: 0, roughness: 0.06, transparent: true, opacity, clearcoat: 1, clearcoatRoughness: 0.04,
  iridescence: 0.35, iridescenceIOR: 1.3, envMapIntensity: 1.7, depthWrite: false
})
/** polished, nearly opaque parts (gold, pages) */
const polished = (color: number, metal = 0.35) => new THREE.MeshPhysicalMaterial({
  color, metalness: metal, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.1, envMapIntensity: 1.3
})

const mesh = (g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0) => {
  const o = new THREE.Mesh(g, m)
  o.position.set(x, y, z)
  return o
}

function book() {
  const g = new THREE.Group()
  const cover = glass(TINT.plum, 0.7)
  g.add(mesh(new RoundedBoxGeometry(1, 0.09, 1.3, 3, 0.04), cover, 0, 0.14, 0))
  g.add(mesh(new RoundedBoxGeometry(1, 0.09, 1.3, 3, 0.04), cover, 0, -0.14, 0))
  g.add(mesh(new RoundedBoxGeometry(0.12, 0.37, 1.3, 3, 0.05), cover, -0.5, 0, 0))
  g.add(mesh(new THREE.BoxGeometry(0.92, 0.2, 1.22), polished(TINT.cream, 0), 0.03, 0, 0))
  g.add(mesh(new THREE.BoxGeometry(0.06, 0.012, 0.9), polished(TINT.gold, 0.8), 0.3, 0.19, 0.2))
  return g
}

function mosque() {
  const g = new THREE.Group()
  const wall = glass(TINT.mint, 0.6)
  const dome = glass(TINT.gold, 0.7)
  const gold = polished(TINT.gold, 0.9)
  g.add(mesh(new RoundedBoxGeometry(1.1, 0.55, 0.7, 3, 0.05), wall, 0, -0.3, 0))
  g.add(mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.14, 32), wall, 0, 0.04, 0))
  g.add(mesh(new THREE.SphereGeometry(0.36, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), dome, 0, 0.1, 0))
  g.add(mesh(new THREE.ConeGeometry(0.035, 0.2, 12), gold, 0, 0.55, 0))
  for (const x of [-0.66, 0.66]) {
    g.add(mesh(new THREE.CylinderGeometry(0.07, 0.08, 1.15, 20), wall, x, -0.01, 0))
    g.add(mesh(new THREE.ConeGeometry(0.1, 0.24, 20), dome, x, 0.68, 0))
  }
  g.add(mesh(new RoundedBoxGeometry(0.22, 0.3, 0.05, 2, 0.04), gold, 0, -0.42, 0.34))
  return g
}

function heart() {
  const s = new THREE.Shape()
  s.moveTo(0, -0.55)
  s.bezierCurveTo(-0.15, -0.42, -0.62, -0.12, -0.6, 0.18)
  s.bezierCurveTo(-0.58, 0.46, -0.22, 0.6, 0, 0.34)
  s.bezierCurveTo(0.22, 0.6, 0.58, 0.46, 0.6, 0.18)
  s.bezierCurveTo(0.62, -0.12, 0.15, -0.42, 0, -0.55)
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.22, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.1, bevelSegments: 8, curveSegments: 32 })
  geo.center()
  return mesh(geo, glass(TINT.rose, 0.72))
}

function scales() {
  const g = new THREE.Group()
  const gold = polished(TINT.gold, 0.9)
  const pan = glass(TINT.sky, 0.66)
  g.add(mesh(new THREE.CylinderGeometry(0.035, 0.045, 1.1, 16), gold, 0, 0, 0))
  g.add(mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.08, 32), gold, 0, -0.56, 0))
  g.add(mesh(new RoundedBoxGeometry(1.36, 0.05, 0.05, 2, 0.02), gold, 0, 0.52, 0))
  g.add(mesh(new THREE.SphereGeometry(0.06, 16, 12), gold, 0, 0.6, 0))
  for (const x of [-0.66, 0.66]) {
    const bowl = mesh(new THREE.SphereGeometry(0.28, 32, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), pan, x, -0.02, 0)
    g.add(bowl)
    for (const dx of [-0.2, 0.2]) {
      const len = Math.hypot(dx, 0.52)
      const string = mesh(new THREE.CylinderGeometry(0.008, 0.008, len, 6), gold, x + dx / 2, 0.25, 0)
      string.rotation.z = Math.atan2(dx, 0.52)
      g.add(string)
    }
  }
  return g
}

function chart() {
  const g = new THREE.Group()
  const bars: [number, number, number][] = [[-0.38, 0.42, TINT.sky], [0, 0.72, TINT.lilac], [0.38, 1.04, TINT.mint]]
  for (const [x, h, c] of bars) g.add(mesh(new RoundedBoxGeometry(0.28, h, 0.28, 3, 0.05), glass(c, 0.7), x, -0.55 + h / 2, 0))
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.6, -0.2, 0.22), new THREE.Vector3(-0.2, 0.05, 0.22), new THREE.Vector3(0.1, 0.12, 0.22), new THREE.Vector3(0.5, 0.55, 0.22)
  ])
  const gold = polished(TINT.gold, 0.9)
  g.add(mesh(new THREE.TubeGeometry(curve, 40, 0.035, 10), gold))
  const head = mesh(new THREE.ConeGeometry(0.09, 0.2, 20), gold, 0.56, 0.63, 0.22)
  head.rotation.z = -0.75
  g.add(head)
  return g
}

function plant() {
  const g = new THREE.Group()
  g.add(mesh(new THREE.CylinderGeometry(0.3, 0.22, 0.44, 32), glass(TINT.peach, 0.75), 0, -0.4, 0))
  g.add(mesh(new THREE.TorusGeometry(0.3, 0.035, 10, 40), polished(TINT.gold, 0.85), 0, -0.18, 0).rotateX(Math.PI / 2))
  const leafShape = new THREE.Shape()
  leafShape.moveTo(0, 0)
  leafShape.bezierCurveTo(0.16, 0.12, 0.14, 0.42, 0, 0.56)
  leafShape.bezierCurveTo(-0.14, 0.42, -0.16, 0.12, 0, 0)
  const leafGeo = new THREE.ExtrudeGeometry(leafShape, { depth: 0.02, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 3 })
  const leaf = glass(TINT.mint, 0.75)
  const leaves: [number, number, number][] = [[0, 0, 0.12], [0.75, 1.2, 0.05], [-0.75, 2.4, 0.05], [0.45, 3.6, -0.02], [-0.4, 4.9, -0.02]]
  for (const [tilt, turn, lift] of leaves) {
    const l = mesh(leafGeo, leaf, 0, -0.2 + lift, 0)
    l.rotation.set(0, turn, tilt)
    g.add(l)
  }
  return g
}

function lantern() {
  const g = new THREE.Group()
  const gold = polished(TINT.gold, 0.9)
  g.add(mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.66, 6), glass(TINT.rose, 0.45), 0, 0, 0))
  g.add(mesh(new THREE.CylinderGeometry(0.34, 0.3, 0.07, 6), gold, 0, -0.36, 0))
  g.add(mesh(new THREE.ConeGeometry(0.36, 0.3, 6), gold, 0, 0.48, 0))
  g.add(mesh(new THREE.TorusGeometry(0.08, 0.02, 8, 24), gold, 0, 0.7, 0))
  g.add(mesh(new THREE.SphereGeometry(0.12, 20, 14), new THREE.MeshBasicMaterial({ color: 0xffd27a }), 0, -0.05, 0))
  g.add(mesh(new THREE.SphereGeometry(0.2, 20, 14), new THREE.MeshBasicMaterial({ color: 0xffc070, transparent: true, opacity: 0.28, depthWrite: false }), 0, -0.05, 0))
  return g
}

function rehal() {
  const g = new THREE.Group()
  const wood = glass(TINT.lilac, 0.7)
  for (const r of [0.62, -0.62]) {
    const plank = mesh(new RoundedBoxGeometry(0.9, 0.05, 0.62, 2, 0.02), wood, 0, -0.1, 0)
    plank.rotation.z = r
    g.add(plank)
  }
  const page = polished(TINT.cream, 0)
  for (const [x, r] of [[-0.22, 0.38], [0.22, -0.38]] as const) {
    const p = mesh(new RoundedBoxGeometry(0.46, 0.04, 0.56, 2, 0.015), page, x, 0.24, 0)
    p.rotation.z = r
    g.add(p)
  }
  g.add(mesh(new THREE.BoxGeometry(0.04, 0.1, 0.56), polished(TINT.plum, 0.2), 0, 0.15, 0))
  return g
}

const MAKERS: [() => THREE.Object3D, number][] = [
  [book, TINT.plum], [mosque, TINT.mint], [heart, TINT.rose], [scales, TINT.gold],
  [chart, TINT.sky], [plant, TINT.mint], [lantern, TINT.peach], [rehal, TINT.lilac]
]

/** how many trail points follow each object, and how long the orbit takes (s) */
const TRAIL = 110
const LAP_S = 30

const trailVertex = /* glsl */ `
  attribute float aAge;
  uniform float uSize;
  varying float vAge;
  void main() {
    vAge = aAge;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = uSize * (1.0 - aAge * 0.8) / -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`
const trailFragment = /* glsl */ `
  uniform vec3 uColor;
  varying float vAge;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d) * pow(1.0 - vAge, 2.2) * 0.85;
    vec3 c = mix(uColor, vec3(1.0), 0.45 * (1.0 - vAge) * (1.0 - d * 2.0));
    gl_FragColor = vec4(c, a);
  }
`

interface Body { obj: THREE.Object3D; axis: THREE.Vector3; spin: number; phase: number; trail: Float32Array; geo: THREE.BufferGeometry; filled: number }

/** Mounts the scene on the canvas; returns the clean-up. `light` draws fewer pixels (weaker phones). */
/**
 * `focus` gives the height (0 top … 1 bottom) the orbit circles at — the girls' eye line; `refocus()`
 * places it again (once their pictures are in).
 */
export function mountOrbit(canvas: HTMLCanvasElement, opts: { light: boolean; still: boolean; focus?: () => number }): { stop: () => void; refocus: () => void } {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: !opts.light, powerPreference: 'low-power' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, opts.light ? 1.5 : 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.NeutralToneMapping
  renderer.toneMappingExposure = 1.05
  renderer.setClearColor(0x000000, 0)

  const scene = new THREE.Scene()
  const pmrem = new THREE.PMREMGenerator(renderer)
  const room = new RoomEnvironment()
  scene.environment = pmrem.fromScene(room, 0.04).texture
  room.dispose()
  scene.add(new THREE.HemisphereLight(0xfff4fb, 0xc8b6f2, 1.1))
  const sun = new THREE.DirectionalLight(0xffffff, 1.6)
  sun.position.set(-3, 5, 6)
  scene.add(sun)

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 60)
  camera.position.set(0, 0, 11)

  // the orbit's plane leans back and to one side: the objects rise on the right and sink on the left
  const orbit = new THREE.Group()
  orbit.rotation.set(0.38, 0, -0.16)
  scene.add(orbit)

  const bodies: Body[] = MAKERS.map(([make, color], i) => {
    const obj = make()
    const box = new THREE.Box3().setFromObject(obj)
    const size = box.getSize(new THREE.Vector3())
    obj.scale.setScalar(0.62 / Math.max(size.x, size.y, size.z))
    orbit.add(obj)
    const trail = new Float32Array(TRAIL * 3)
    const age = new Float32Array(TRAIL).map((_, n) => n / (TRAIL - 1))
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(trail, 3).setUsage(THREE.DynamicDrawUsage))
    geo.setAttribute('aAge', new THREE.BufferAttribute(age, 1))
    geo.setDrawRange(0, 0)
    const points = new THREE.Points(geo, new THREE.ShaderMaterial({
      vertexShader: trailVertex, fragmentShader: trailFragment, transparent: true, depthWrite: false,
      uniforms: { uColor: { value: new THREE.Color(color) }, uSize: { value: 0 } }
    }))
    points.frustumCulled = false
    scene.add(points)
    const axis = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize()
    obj.rotation.set(Math.random() * 6, Math.random() * 6, 0)
    return { obj, axis, spin: 0.45 + Math.random() * 0.55, phase: (i / MAKERS.length) * Math.PI * 2, trail, geo, filled: 0 }
  })

  let rx = 2
  const rz = 1.7
  const resize = () => {
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    if (!w || !h) return
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    // the visible half-height and half-width at the centre: the orbit circles at the girls' eye line,
    // narrow enough to stay between their faces
    const halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z
    const half = halfH * camera.aspect
    rx = Math.min(half * 0.3, 1.8)
    const f = Math.min(0.75, Math.max(0.25, opts.focus?.() ?? 0.5))
    orbit.position.y = halfH * (1 - 2 * f)
    const px = renderer.getPixelRatio() * Math.min(h, 330) * 0.2
    scene.traverse((o) => { if (o instanceof THREE.Points) (o.material as THREE.ShaderMaterial).uniforms.uSize.value = px })
  }
  resize()
  const ro = new ResizeObserver(resize)
  ro.observe(canvas)

  const world = new THREE.Vector3()
  let angle = 0
  let last = performance.now()
  const step = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    angle += (dt * Math.PI * 2) / LAP_S
    for (const b of bodies) {
      const a = angle + b.phase
      b.obj.position.set(Math.cos(a) * rx, 0, Math.sin(a) * rz)
      b.obj.rotateOnAxis(b.axis, b.spin * dt)
      b.obj.getWorldPosition(world)
      // the trail: newest point first, the oldest falls off the end
      b.trail.copyWithin(3, 0, (TRAIL - 1) * 3)
      b.trail[0] = world.x
      b.trail[1] = world.y
      b.trail[2] = world.z
      b.filled = Math.min(TRAIL, b.filled + 1)
      b.geo.setDrawRange(0, b.filled)
      ;(b.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true
    }
    renderer.render(scene, camera)
  }

  let raf = 0
  let visible = true
  const loop = (now: number) => {
    step(now)
    raf = requestAnimationFrame(loop)
  }
  const play = () => {
    cancelAnimationFrame(raf)
    if (opts.still || !visible || document.hidden) return
    last = performance.now()
    raf = requestAnimationFrame(loop)
  }
  // a still frame (less motion asked for), then only while it is on screen
  angle = 0.6
  step(performance.now())
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; play() })
  io.observe(canvas)
  document.addEventListener('visibilitychange', play)
  play()

  const stop = () => {
    cancelAnimationFrame(raf)
    io.disconnect()
    ro.disconnect()
    document.removeEventListener('visibilitychange', play)
    scene.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.Points) {
        o.geometry.dispose()
        ;(Array.isArray(o.material) ? o.material : [o.material]).forEach((m: THREE.Material) => m.dispose())
      }
    })
    scene.environment?.dispose()
    pmrem.dispose()
    renderer.dispose()
  }
  return { stop, refocus: resize }
}
