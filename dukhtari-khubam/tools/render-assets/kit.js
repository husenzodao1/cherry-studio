// Scene kit for the glass/lavender look: glass flowers, glass lenses, glossy school icons and the
// "book on a rehal" hero. Glass is rendered with real transmission; render.html shoots each job on a
// black and on a white backdrop and matte.py recovers true per-pixel transparency from the pair.
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'

const D = () => window.kitDeps
const C = (c) => new THREE.Color(c)

// ---------------------------------------------------------------- materials
export function glass(o = {}) {
  return new THREE.MeshPhysicalMaterial({
    color: C(o.color ?? '#ffffff'), vertexColors: !!o.vertexColors, transmission: 1, thickness: o.thickness ?? 0.25, ior: o.ior ?? 1.45,
    roughness: o.roughness ?? 0.05, metalness: 0, attenuationColor: C(o.attenuation ?? '#a57be8'), attenuationDistance: o.attDist ?? 0.8,
    iridescence: o.irid ?? 0.55, iridescenceIOR: 1.3, iridescenceThicknessMinimum: 180, iridescenceThicknessMaximum: 520, clearcoat: 1, clearcoatRoughness: 0.02,
    specularIntensity: 1, specularColor: C('#ffffff'), envMapIntensity: o.env ?? 1.25, side: o.side ?? THREE.DoubleSide,
    dispersion: o.dispersion ?? 0.25, emissive: C(o.emissive ?? '#000000'), emissiveIntensity: o.emissiveIntensity ?? 0
  })
}
const glossy = (color, o = {}) => new THREE.MeshPhysicalMaterial({
  color: C(color), roughness: o.roughness ?? 0.24, metalness: o.metalness ?? 0, clearcoat: 1, clearcoatRoughness: o.cc ?? 0.07,
  sheen: o.sheen ?? 0.35, sheenColor: C(o.sheenColor ?? '#ffffff'), iridescence: o.irid ?? 0, envMapIntensity: o.env ?? 1.1,
  vertexColors: !!o.vertexColors, side: o.side ?? THREE.FrontSide, flatShading: !!o.flat
})
const gold = (o = {}) => new THREE.MeshPhysicalMaterial({ color: C(o.color ?? '#e8b860'), metalness: 1, roughness: o.roughness ?? 0.2, clearcoat: 0.5, envMapIntensity: 1.4 })
const mesh = (geo, mat, pos = [0, 0, 0], rot = [0, 0, 0], scale = 1) => {
  const m = new THREE.Mesh(geo, mat); m.position.fromArray(pos); m.rotation.fromArray(rot)
  typeof scale === 'number' ? m.scale.setScalar(scale) : m.scale.fromArray(scale)
  m.castShadow = true; m.receiveShadow = true; return m
}
function lathe(profile, seg = 96) { return new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), seg) }
function archShape(w, h, peak = 0.62) {
  const s = new THREE.Shape(), x = w / 2
  s.moveTo(-x, 0); s.lineTo(-x, h)
  s.bezierCurveTo(-x, h + w * peak * 0.55, -w * 0.12, h + w * peak * 0.8, 0, h + w * peak)
  s.bezierCurveTo(w * 0.12, h + w * peak * 0.8, x, h + w * peak * 0.55, x, h)
  s.lineTo(x, 0); s.closePath(); return s
}
const extrude = (shape, depth, bevel = 0.02, segs = 6) => {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: segs, curveSegments: 48 })
  g.translate(0, 0, -depth / 2); g.computeVertexNormals(); return g
}

// ---------------------------------------------------------------- glass crocus
export function glassFlower(o = {}) {
  const { petalGeo, placePetal } = D()
  const g = new THREE.Group()
  const palette = o.palette ?? ['#ad80ea', '#eee4fc', '#ffffff']
  const mat = glass({ vertexColors: true, attenuation: o.attenuation ?? '#c6a8f2', attDist: o.attDist ?? 3, thickness: 0.1, roughness: o.roughness ?? 0.03, irid: 0.8 })
  let seed = o.seed ?? 5
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  const rings = o.rings ?? [
    { n: 3, len: 1.08, wid: 0.36, elev: o.open ?? 0.5, curl: -0.25, cup: 0.5, rot: 0 },
    { n: 3, len: 1.0, wid: 0.34, elev: (o.open ?? 0.5) + 0.2, curl: -0.05, cup: 0.55, rot: Math.PI / 3 }
  ]
  for (const r of rings) for (let i = 0; i < r.n; i++) {
    const geo = petalGeo({ length: r.len * (1 + (rnd() - 0.5) * 0.08), width: r.wid, cup: r.cup, curl: r.curl + (rnd() - 0.5) * 0.12, colors: palette, ruffle: 0.012, segU: 64, segV: 32 })
    const m = new THREE.Mesh(geo, mat)
    const az = r.rot + (i / r.n) * Math.PI * 2 + (rnd() - 0.5) * 0.12
    placePetal(m, az, r.elev + (rnd() - 0.5) * 0.08)
    m.updateMatrix = () => {}
    m.matrix.setPosition(Math.cos(az) * 0.05, 0, Math.sin(az) * 0.05)
    g.add(m)
  }
  // crocus heart: three golden anthers and a frilled orange style
  const anther = glossy('#eda928', { roughness: 0.35, sheen: 1, sheenColor: '#fff0b0' })
  const style = glossy('#f27a1d', { roughness: 0.35, sheen: 0.8, sheenColor: '#ffd2a0' })
  const filament = glossy('#f6e7b8', { roughness: 0.5 })
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.4
    const top = new THREE.Vector3(Math.cos(a) * 0.1, 0.42, Math.sin(a) * 0.1)
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0.02, 0), new THREE.Vector3(Math.cos(a) * 0.05, 0.2, Math.sin(a) * 0.05), top)
    g.add(mesh(new THREE.TubeGeometry(curve, 16, 0.009, 8), filament))
    const an = mesh(new THREE.CapsuleGeometry(0.022, 0.13, 8, 16), anther, [top.x * 1.05, top.y + 0.08, top.z * 1.05])
    an.lookAt(top.clone().multiplyScalar(2.2).setY(1.4)); an.rotateX(Math.PI / 2)
    g.add(an)
  }
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 1.45
    const end = new THREE.Vector3(Math.cos(a) * 0.11, 0.47, Math.sin(a) * 0.11)
    const curve = new THREE.CubicBezierCurve3(new THREE.Vector3(0, 0.02, 0), new THREE.Vector3(0, 0.3, 0), new THREE.Vector3(Math.cos(a) * 0.05, 0.4, Math.sin(a) * 0.05), end)
    g.add(mesh(new THREE.TubeGeometry(curve, 20, 0.01, 8), style))
    g.add(mesh(new THREE.SphereGeometry(0.03, 20, 14), style, [end.x, end.y + 0.01, end.z], [0, 0, 0], [1.2, 0.7, 1.2]))
  }
  return g
}

// ---------------------------------------------------------------- glass lens / bubble
export function lens(o = {}) {
  const g = new THREE.Group()
  const geo = new THREE.SphereGeometry(1, 128, 96)
  const m = mesh(geo, glass({ attenuation: o.attenuation ?? '#d6c4f6', attDist: o.attDist ?? 7, thickness: 1.2, roughness: 0.02, irid: o.irid ?? 0.9, side: THREE.FrontSide, dispersion: 0.6 }), [0, 0, 0], [0, 0, 0], o.squash ? [1, 1, o.squash] : 1)
  m.castShadow = false
  g.add(m); return g
}

// ---------------------------------------------------------------- school icons (glossy, reference palette)
export function mosque() {
  const g = new THREE.Group()
  const wall = glossy('#f1e9fb', { roughness: 0.3 }), dome = glossy('#8b6be3', { irid: 0.25 }), door = glossy('#5c3aa8', { roughness: 0.35 })
  const trim = gold()
  g.add(mesh(new RoundedBoxGeometry(1.7, 0.72, 0.95, 6, 0.06), wall, [0, 0.36, 0]))
  g.add(mesh(new RoundedBoxGeometry(1.76, 0.06, 1.0, 4, 0.02), trim, [0, 0.74, 0]))
  g.add(mesh(new THREE.CylinderGeometry(0.44, 0.46, 0.2, 64), wall, [0, 0.86, 0]))
  g.add(mesh(new THREE.TorusGeometry(0.45, 0.02, 12, 64), trim, [0, 0.96, 0], [Math.PI / 2, 0, 0]))
  const onion = [[0, 0], [0.44, 0], [0.5, 0.12], [0.49, 0.28], [0.4, 0.46], [0.26, 0.6], [0.12, 0.72], [0.04, 0.8], [0, 0.84]]
  g.add(mesh(lathe(onion), dome, [0, 0.96, 0]))
  for (const x of [-0.58, 0.58]) {
    g.add(mesh(new THREE.CylinderGeometry(0.2, 0.21, 0.1, 48), wall, [x, 0.8, 0.05]))
    g.add(mesh(lathe(onion), dome, [x, 0.85, 0.05], [0, 0, 0], 0.42))
    g.add(mesh(new THREE.SphereGeometry(0.03, 16, 12), trim, [x, 1.22, 0.05]))
  }
  // finial and crescent
  g.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.16, 12), trim, [0, 1.86, 0]))
  g.add(mesh(new THREE.SphereGeometry(0.04, 20, 16), trim, [0, 1.82, 0]))
  const cres = new THREE.TorusGeometry(0.075, 0.018, 12, 48, Math.PI * 1.35)
  g.add(mesh(cres, trim, [0, 2.0, 0], [0, 0, -Math.PI * 0.18]))
  // minarets
  for (const x of [-1.05, 1.05]) {
    g.add(mesh(new THREE.CylinderGeometry(0.11, 0.13, 1.7, 40), wall, [x, 0.85, -0.05]))
    g.add(mesh(new THREE.TorusGeometry(0.15, 0.03, 12, 40), trim, [x, 1.35, -0.05], [Math.PI / 2, 0, 0]))
    g.add(mesh(new THREE.CylinderGeometry(0.15, 0.12, 0.06, 40), wall, [x, 1.32, -0.05]))
    g.add(mesh(new THREE.ConeGeometry(0.13, 0.36, 40), dome, [x, 1.88, -0.05]))
    g.add(mesh(new THREE.SphereGeometry(0.025, 16, 12), trim, [x, 2.08, -0.05]))
  }
  // arched door and windows on the front face
  g.add(mesh(extrude(archShape(0.3, 0.3, 0.6), 0.03, 0.008, 3), door, [0, 0.04, 0.475]))
  for (const x of [-0.5, 0.5]) g.add(mesh(extrude(archShape(0.16, 0.14, 0.6), 0.03, 0.006, 3), door, [x, 0.32, 0.475]))
  return g
}

export function house() {
  const g = new THREE.Group()
  const wall = glossy('#a882ec'), roof = glossy('#6a3fc7', { irid: 0.2 }), white = glossy('#f6f0ff', { roughness: 0.3 })
  g.add(mesh(new RoundedBoxGeometry(1.25, 0.9, 1.0, 6, 0.07), wall, [0, 0.45, 0]))
  const tri = new THREE.Shape(); tri.moveTo(-0.8, 0); tri.lineTo(0, 0.62); tri.lineTo(0.8, 0); tri.closePath()
  g.add(mesh(extrude(tri, 1.12, 0.05, 6), roof, [0, 0.9, 0]))
  g.add(mesh(new RoundedBoxGeometry(0.16, 0.36, 0.16, 4, 0.03), roof, [0.38, 1.25, -0.2]))
  g.add(mesh(extrude(archShape(0.28, 0.26, 0.5), 0.04, 0.012, 3), white, [0, 0.0, 0.5]))
  for (const x of [-0.38, 0.38]) {
    g.add(mesh(new RoundedBoxGeometry(0.22, 0.22, 0.04, 3, 0.015), white, [x, 0.52, 0.5]))
    g.add(mesh(new THREE.BoxGeometry(0.02, 0.2, 0.05), wall, [x, 0.52, 0.51]))
    g.add(mesh(new THREE.BoxGeometry(0.2, 0.02, 0.05), wall, [x, 0.52, 0.51]))
  }
  g.add(mesh(new THREE.SphereGeometry(0.02, 12, 10), gold(), [0.08, 0.17, 0.53]))
  return g
}

export function sprout() {
  const { petalGeo, placePetal } = D()
  const g = new THREE.Group()
  const leafMat = glossy('#ffffff', { vertexColors: true, roughness: 0.28, side: THREE.DoubleSide, sheen: 0.15, sheenColor: '#eaffd8' })
  const stem = glossy('#4c9a3c', { roughness: 0.35 })
  const curve = new THREE.CubicBezierCurve3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.02, 0.15, 0), new THREE.Vector3(-0.03, 0.3, 0), new THREE.Vector3(0, 0.42, 0))
  g.add(mesh(new THREE.TubeGeometry(curve, 24, 0.035, 12), stem))
  for (const [az, elev, len, curl] of [[Math.PI * 0.95, 0.42, 0.95, 0.5], [0.05, 0.62, 0.8, 0.45]]) {
    const m = new THREE.Mesh(petalGeo({ length: len, width: 0.36, cup: 0.32, curl, colors: ['#1f6e2a', '#38a23c', '#6cc24c'], ruffle: 0.006 }), leafMat)
    placePetal(m, az, elev); m.updateMatrix = () => {}; m.matrix.setPosition(0, 0.4, 0); m.castShadow = true
    g.add(m)
  }
  g.add(mesh(new THREE.SphereGeometry(0.22, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2), glossy('#8a6a58', { roughness: 0.6 }), [0, -0.02, 0], [0, 0, 0], [1.4, 0.35, 1.2]))
  return g
}

export function crystalStar() {
  const pts = [], P = 5, front = new THREE.Vector3(0, 0, 0.42), back = new THREE.Vector3(0, 0, -0.42)
  const rim = Array.from({ length: P * 2 }, (_, i) => { const r = i % 2 ? 0.46 : 1.05, a = Math.PI / 2 + (i * Math.PI) / P; return new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0) })
  for (let i = 0; i < P * 2; i++) {
    const a = rim[i], b = rim[(i + 1) % (P * 2)]
    pts.push(front, a, b, back, b, a)
  }
  const geo = new THREE.BufferGeometry().setFromPoints(pts); geo.computeVertexNormals()
  const m = mesh(geo, glass({ attenuation: '#9d72ee', attDist: 1.3, thickness: 0.8, ior: 1.6, roughness: 0.04, irid: 0.5, side: THREE.FrontSide, color: '#f4eeff' }))
  const g = new THREE.Group(); g.add(m); return g
}

export function cosmos() {
  const { petalGeo, placePetal } = D()
  const g = new THREE.Group()
  const mat = glossy('#ffffff', { vertexColors: true, roughness: 0.3, side: THREE.DoubleSide, sheen: 0.25, sheenColor: '#ffd9fb', irid: 0.15 })
  for (let i = 0; i < 8; i++) {
    const m = new THREE.Mesh(petalGeo({ length: 0.9, width: 0.36, cup: 0.32, curl: -0.12, colors: ['#7a1fa8', '#c447d8', '#ee9fe9'], ruffle: 0.02 }), mat)
    const az = (i / 8) * Math.PI * 2
    placePetal(m, az, 0.22); m.updateMatrix = () => {}; m.matrix.setPosition(Math.cos(az) * 0.08, 0, Math.sin(az) * 0.08); m.castShadow = true
    g.add(m)
  }
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(petalGeo({ length: 0.5, width: 0.3, cup: 0.4, curl: 0.1, colors: ['#8a28b8', '#d060e2', '#f4b6ef'], ruffle: 0.015 }), mat)
    const az = (i / 6) * Math.PI * 2 + 0.3
    placePetal(m, az, 0.6); m.updateMatrix = () => {}; m.matrix.setPosition(Math.cos(az) * 0.06, 0.04, Math.sin(az) * 0.06); m.castShadow = true
    g.add(m)
  }
  g.add(mesh(new THREE.SphereGeometry(0.17, 48, 32), glossy('#f2b630', { roughness: 0.45, sheen: 1, sheenColor: '#fff2b8' }), [0, 0.1, 0], [0, 0, 0], [1, 0.55, 1]))
  for (let i = 0; i < 40; i++) {
    const a = i * 2.39996, r = 0.15 * Math.sqrt(i / 40)
    g.add(mesh(new THREE.SphereGeometry(0.018, 10, 8), glossy('#e98a16', { roughness: 0.4 }), [Math.cos(a) * r, 0.18 - r * 0.25, Math.sin(a) * r]))
  }
  return g
}

export function bulb() {
  const g = new THREE.Group()
  const glassProfile = [[0.001, 1.62], [0.2, 1.6], [0.4, 1.5], [0.53, 1.32], [0.56, 1.12], [0.5, 0.9], [0.34, 0.66], [0.25, 0.48], [0.24, 0.4]]
  g.add(mesh(lathe(glassProfile), glass({ attenuation: '#c7a6ff', attDist: 4, thickness: 0.05, roughness: 0.03, irid: 0.6, side: THREE.DoubleSide })))
  const base = []
  for (let i = 0; i <= 12; i++) base.push([0.25 + (i % 2 ? 0.025 : 0), 0.4 - i * 0.03])
  base.push([0.16, 0.0], [0.08, -0.06], [0.001, -0.07])
  g.add(mesh(lathe(base), gold({ color: '#d9a85a', roughness: 0.25 })))
  const fil = new THREE.CatmullRomCurve3([[-0.1, 0.5, 0], [-0.1, 0.9, 0], [-0.06, 1.0, 0], [0, 0.94, 0], [0.06, 1.0, 0], [0.1, 0.9, 0], [0.1, 0.5, 0]].map((p) => new THREE.Vector3(...p)))
  const fm = new THREE.MeshStandardMaterial({ color: '#ffcf7a', emissive: C('#ffb347'), emissiveIntensity: 3 })
  g.add(mesh(new THREE.TubeGeometry(fil, 64, 0.012, 8), fm))
  const light = new THREE.PointLight('#ffc070', 1.2, 0, 2); light.position.set(0, 1.0, 0); g.add(light)
  return g
}

export function heart() {
  const { heartGeo } = D()
  const geo = heartGeo()
  const pos = geo.attributes.position, col = []
  const top = C('#f6a8e6'), bottom = C('#b04fd8')
  geo.computeBoundingBox()
  const { min, max } = geo.boundingBox
  for (let i = 0; i < pos.count; i++) { const t = (pos.getY(i) - min.y) / (max.y - min.y); const c = bottom.clone().lerp(top, Math.pow(t, 0.8)); col.push(c.r, c.g, c.b) }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  const g = new THREE.Group()
  g.add(mesh(geo, glossy('#ffffff', { vertexColors: true, roughness: 0.14, cc: 0.03, irid: 0.3, sheen: 0.4, sheenColor: '#ffe3f6' }), [0, 0, 0], [-0.12, 0.3, 0]))
  return g
}

// ---------------------------------------------------------------- open book on a rehal, glass arch, lantern
function textTexture(mirror) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 1024
  const x = c.getContext('2d')
  const gr = x.createLinearGradient(0, 0, 1024, 0)
  gr.addColorStop(0, mirror ? '#fffaf0' : '#efe2cc'); gr.addColorStop(0.12, '#fbf4e6'); gr.addColorStop(1, mirror ? '#efe2cc' : '#fffaf0')
  x.fillStyle = gr; x.fillRect(0, 0, 1024, 1024)
  // ornamental frame (gold and lilac)
  x.strokeStyle = '#c99b47'; x.lineWidth = 10; x.strokeRect(110, 90, 804, 844)
  x.strokeStyle = '#9b7ad6'; x.lineWidth = 4; x.strokeRect(132, 112, 760, 800)
  // abstract text lines (no real script)
  x.fillStyle = 'rgba(70, 50, 90, 0.42)'
  let seed = mirror ? 11 : 3
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  for (let row = 0; row < 15; row++) {
    const y = 200 + row * 46
    let px = 180
    while (px < 840) { const w = 24 + rnd() * 70; if (px + w > 845) break; x.beginPath(); x.roundRect(px, y, w, 9, 4.5); x.fill(); px += w + 14 + rnd() * 8 }
  }
  // header medallion
  x.fillStyle = '#c99b47'; x.beginPath(); x.ellipse(512, 152, 120, 22, 0, 0, Math.PI * 2); x.fill()
  x.fillStyle = '#fbf4e6'; x.beginPath(); x.ellipse(512, 152, 104, 14, 0, 0, Math.PI * 2); x.fill()
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 16; return t
}
function edgeTexture() {
  const c = document.createElement('canvas'); c.width = 16; c.height = 512
  const x = c.getContext('2d'); x.fillStyle = '#f7efdf'; x.fillRect(0, 0, 16, 512)
  for (let i = 0; i < 512; i += 4) { x.fillStyle = `rgba(150, 120, 90, ${0.12 + Math.random() * 0.12})`; x.fillRect(0, i, 16, 1) }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 6); t.colorSpace = THREE.SRGBColorSpace; return t
}
function bookHalf(L, Dp, left) {
  const g = new THREE.Group()
  const top = (x) => 0.02 + 0.11 * (1 - Math.exp(-x / 0.07)) - 0.035 * Math.pow(x / L, 1.5)
  const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(L, 0)
  for (let i = 40; i >= 0; i--) { const x = (i / 40) * L; s.lineTo(x, top(x)) }
  s.closePath()
  const block = new THREE.ExtrudeGeometry(s, { depth: Dp, bevelEnabled: false, curveSegments: 4 })
  block.translate(0, 0, -Dp / 2)
  g.add(mesh(block, new THREE.MeshPhysicalMaterial({ map: edgeTexture(), roughness: 0.7, sheen: 0.4, sheenColor: C('#fff6e0') })))
  // top page with text, following the curve
  const seg = 48, pg = new THREE.PlaneGeometry(1, 1, seg, 1), p = pg.attributes.position, uv = pg.attributes.uv
  for (let i = 0; i < p.count; i++) {
    const u = uv.getX(i), v = uv.getY(i), x = 0.012 + u * (L - 0.02)
    p.setXYZ(i, x, top(x) + 0.0015, (0.5 - v) * (Dp - 0.02))
  }
  pg.computeVertexNormals()
  g.add(mesh(pg, new THREE.MeshPhysicalMaterial({ map: textTexture(left), roughness: 0.62, sheen: 0.5, sheenColor: C('#fff3da'), side: THREE.DoubleSide })))
  // cover board below, slightly larger
  const cover = glossy('#4b2f8f', { roughness: 0.4, sheen: 0.6, sheenColor: '#b9a0ff' })
  g.add(mesh(new RoundedBoxGeometry(L + 0.04, 0.03, Dp + 0.06, 3, 0.01), cover, [L / 2 + 0.01, -0.016, 0]))
  g.add(mesh(new THREE.BoxGeometry(L + 0.042, 0.008, 0.012), gold(), [L / 2 + 0.01, -0.016, Dp / 2 + 0.032]))
  if (left) g.scale.x = -1
  return g
}
export async function shrine(job) {
  const g = new THREE.Group()
  const arm = THREE.MathUtils.degToRad(job.armDeg ?? 24)
  // rehal: two crossed carved boards
  const wood = new THREE.MeshPhysicalMaterial({ color: C('#3a1f24'), roughness: 0.55, clearcoat: 0.25, clearcoatRoughness: 0.35, envMapIntensity: 0.35 })
  const len = 1.75, Dp = 0.9
  for (const sgn of [1, -1]) {
    const board = new THREE.Group()
    const shape = new THREE.Shape()
    shape.moveTo(-len / 2, -0.03); shape.lineTo(len / 2, -0.03); shape.lineTo(len / 2, 0.03); shape.lineTo(-len / 2, 0.03); shape.closePath()
    board.add(mesh(new RoundedBoxGeometry(len, 0.05, Dp * (sgn > 0 ? 1 : 0.86), 4, 0.018), wood))
    board.add(mesh(new THREE.BoxGeometry(len * 0.98, 0.012, 0.018), gold(), [0, 0.026, Dp * (sgn > 0 ? 0.5 : 0.43) - 0.012]))
    board.rotation.z = sgn * arm
    g.add(board)
  }
  // book halves resting on the upper arms
  const L = 0.86, Db = 0.86
  const right = bookHalf(L, Db, false); right.rotation.z = arm; right.position.set(0.01, 0.045, 0); g.add(right)
  const leftH = bookHalf(L, Db, true); leftH.rotation.z = -arm; leftH.position.set(-0.01, 0.045, 0); g.add(leftH)
  g.position.y = len / 2 * Math.sin(arm) + 0.03
  const scene = new THREE.Group(); scene.add(g)
  // glass arch (pointed) behind the book
  if (job.arch !== false) {
    const outer = archShape(2.0, 1.1, 0.62), hole = archShape(1.56, 1.06, 0.6)
    const ring = archShape(2.0, 1.1, 0.62); ring.holes.push(new THREE.Path(hole.getPoints(64).map((p) => new THREE.Vector2(p.x, p.y + 0.0)).reverse()))
    scene.add(mesh(extrude(ring, 0.26, 0.05, 8), glass({ attenuation: '#c9b0f4', attDist: 2.6, thickness: 0.3, roughness: 0.16, irid: 0.6 }), [0, 0, -0.62]))
    const panel = new THREE.Mesh(new THREE.ShapeGeometry(outer, 48), new THREE.MeshBasicMaterial({ color: C('#eadff9'), transparent: true, opacity: 0.4 }))
    panel.position.set(0, 0, -0.76); scene.add(panel)
  }
  // hanging lantern with a warm glow
  if (job.lantern !== false) {
    const gltf = await new GLTFLoader().loadAsync('models/brass_diya_lantern/model.gltf')
    const lan = gltf.scene
    lan.traverse((o) => {
      if (!o.isMesh) return
      o.castShadow = true
      const m = o.material
      if (/glass/i.test(m.name)) o.material = new THREE.MeshPhysicalMaterial({ color: C('#ffe2b0'), emissive: C('#ffb050'), emissiveIntensity: 2.6, roughness: 0.25, transparent: true, opacity: 0.85 })
      if (/flame/i.test(m.name)) { m.emissive = C('#ffc070'); m.emissiveIntensity = 4 }
    })
    lan.scale.setScalar(job.lanternScale ?? 3.6)
    lan.position.fromArray(job.lanternPos ?? [1.25, 1.2, -0.2])
    scene.add(lan)
    const warm = new THREE.PointLight('#ffb35c', 2.2, 0, 2); warm.position.set((job.lanternPos ?? [1.25])[0], (job.lanternPos ?? [0, 1.2])[1] - 0.25, 0); scene.add(warm)
  }
  // a few fallen petals
  if (job.petals === false) return scene
  const { petalGeo } = D()
  const pm = glossy('#ffffff', { vertexColors: true, roughness: 0.35, side: THREE.DoubleSide, sheen: 0.8, sheenColor: '#ffe0f6' })
  for (const [x, z, r] of [[-0.95, 0.45, 0.4], [0.8, 0.6, 2.1], [-0.55, 0.8, 1.2]]) {
    const pe = new THREE.Mesh(petalGeo({ length: 0.18, width: 0.12, cup: 0.22, curl: 0.12, colors: ['#b56ad9', '#e0a6ef', '#fbe6fb'] }), pm)
    pe.position.set(x, 0.01, z); pe.rotation.set(-Math.PI / 2 + 0.15, 0, r); pe.castShadow = true; scene.add(pe)
  }
  return scene
}

export async function buildKind(job) {
  switch (job.kind) {
    case 'glassflower': {
      const g = new THREE.Group()
      for (const f of job.flowers) { const b = glassFlower(f); b.position.fromArray(f.pos ?? [0, 0, 0]); b.rotation.fromArray(f.rot ?? [0, 0, 0]); b.scale.setScalar(f.scale ?? 1); g.add(b) }
      return g
    }
    case 'lens': {
      const g = new THREE.Group()
      for (const l of job.lenses) { const b = lens(l); b.position.fromArray(l.pos ?? [0, 0, 0]); b.rotation.fromArray(l.rot ?? [0, 0, 0]); b.scale.setScalar(l.scale ?? 1); g.add(b) }
      return g
    }
    case 'mosque': return mosque()
    case 'house': return house()
    case 'sprout': return sprout()
    case 'cstar': return crystalStar()
    case 'cosmos': return cosmos()
    case 'bulb': return bulb()
    case 'pheart': return heart()
    case 'shrine': return shrine(job)
    default: return null
  }
}
