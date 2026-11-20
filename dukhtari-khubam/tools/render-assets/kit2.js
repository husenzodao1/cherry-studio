// Second set of scene builders: solid glass petals (real thickness, so the edges catch light like
// cast glass), more glass flowers for the backdrop, and the detailed school icons.
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'

const D = () => window.kitDeps
const C = (c) => new THREE.Color(c)

// ---------------------------------------------------------------- materials
export function glass2(o = {}) {
  return new THREE.MeshPhysicalMaterial({
    color: C(o.color ?? '#ffffff'), vertexColors: !!o.vertexColors, transmission: 1, thickness: o.thickness ?? 0.06, ior: o.ior ?? 1.5,
    roughness: o.roughness ?? 0.02, metalness: 0, attenuationColor: C(o.attenuation ?? '#cdb6f4'), attenuationDistance: o.attDist ?? 2.5,
    iridescence: o.irid ?? 0.9, iridescenceIOR: 1.35, iridescenceThicknessMinimum: 220, iridescenceThicknessMaximum: 640,
    clearcoat: 1, clearcoatRoughness: 0.015, specularIntensity: 1, specularColor: C('#ffffff'), envMapIntensity: o.env ?? 1.7,
    side: THREE.FrontSide, dispersion: o.dispersion ?? 0.4
  })
}
const glossy = (color, o = {}) => new THREE.MeshPhysicalMaterial({
  color: C(color), roughness: o.roughness ?? 0.22, metalness: o.metalness ?? 0, clearcoat: 1, clearcoatRoughness: o.cc ?? 0.06,
  sheen: o.sheen ?? 0.3, sheenColor: C(o.sheenColor ?? '#ffffff'), iridescence: o.irid ?? 0, envMapIntensity: o.env ?? 1.15,
  vertexColors: !!o.vertexColors, side: o.side ?? THREE.FrontSide, flatShading: !!o.flat,
  emissive: C(o.emissive ?? '#000000'), emissiveIntensity: o.emissiveIntensity ?? 0
})
const gold = (o = {}) => new THREE.MeshPhysicalMaterial({ color: C(o.color ?? '#eab964'), metalness: 1, roughness: o.roughness ?? 0.18, clearcoat: 0.6, envMapIntensity: 1.5 })
const mesh = (geo, mat, pos = [0, 0, 0], rot = [0, 0, 0], scale = 1) => {
  const m = new THREE.Mesh(geo, mat); m.position.fromArray(pos); m.rotation.fromArray(rot)
  typeof scale === 'number' ? m.scale.setScalar(scale) : m.scale.fromArray(scale)
  m.castShadow = true; m.receiveShadow = true; return m
}
const lathe = (profile, seg = 96) => new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), seg)
let seed = 7
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647

// ---------------------------------------------------------------- solid petals
/** Turns a (segU+1)×(segV+1) petal surface into a closed slab of thickness t (front, back and rim). */
export function solidify(geo, segU, segV, t) {
  geo.computeVertexNormals()
  const P = geo.attributes.position, N = geo.attributes.normal, Cc = geo.attributes.color, U = geo.attributes.uv
  const n = P.count, pos = [], col = [], uv = [], idx = []
  for (const side of [1, -1]) for (let i = 0; i < n; i++) {
    // thinner towards the rim and the tip, like a hand-shaped glass petal
    const u = U.getY(i), v = U.getX(i) * 2 - 1
    const k = t * (0.35 + 0.65 * Math.sqrt(Math.max(0, 1 - v * v))) * (1 - 0.6 * u)
    pos.push(P.getX(i) + N.getX(i) * k * side * 0.5, P.getY(i) + N.getY(i) * k * side * 0.5, P.getZ(i) + N.getZ(i) * k * side * 0.5)
    if (Cc) col.push(Cc.getX(i), Cc.getY(i), Cc.getZ(i))
    uv.push(U.getX(i), U.getY(i))
  }
  const at = (i, j) => i * (segV + 1) + j
  for (let i = 0; i < segU; i++) for (let j = 0; j < segV; j++) {
    const a = at(i, j), b = at(i + 1, j), c = at(i, j + 1), d = at(i + 1, j + 1)
    idx.push(a, b, c, b, d, c)                    // front
    idx.push(n + a, n + c, n + b, n + b, n + c, n + d) // back
  }
  const ring = []
  for (let j = 0; j <= segV; j++) ring.push(at(0, j))
  for (let i = 1; i <= segU; i++) ring.push(at(i, segV))
  for (let j = segV - 1; j >= 0; j--) ring.push(at(segU, j))
  for (let i = segU - 1; i >= 1; i--) ring.push(at(i, 0))
  for (let r = 0; r < ring.length; r++) {
    const a = ring[r], b = ring[(r + 1) % ring.length]
    idx.push(a, n + a, b, b, n + a, n + b)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  if (col.length) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx); g.computeVertexNormals()
  return g
}
function petal(o, mat) {
  const { petalGeo } = D()
  const segU = o.segU ?? 56, segV = o.segV ?? 24
  const surf = petalGeo({ ...o, segU, segV })
  return new THREE.Mesh(solidify(surf, segU, segV, o.thick ?? 0.05), mat)
}
function place(m, az, elev, r = 0, y = 0) {
  D().placePetal(m, az, elev); m.updateMatrix = () => {}
  m.matrix.setPosition(Math.cos(az) * r, y, Math.sin(az) * r); m.castShadow = true
  return m
}
function stamens(g, n = 3, h = 0.42) {
  const anther = glossy('#f0b02a', { roughness: 0.35, sheen: 1, sheenColor: '#fff0b0' })
  const style = glossy('#f27a1d', { roughness: 0.35, sheen: 0.8, sheenColor: '#ffd2a0' })
  const fil = glossy('#f8ecc4', { roughness: 0.45 })
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.4
    const top = new THREE.Vector3(Math.cos(a) * 0.1, h, Math.sin(a) * 0.1)
    g.add(mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0.02, 0), new THREE.Vector3(Math.cos(a) * 0.05, h * 0.5, Math.sin(a) * 0.05), top), 16, 0.009, 8), fil))
    const an = mesh(new THREE.CapsuleGeometry(0.022, 0.12, 8, 16), anther, [top.x * 1.05, top.y + 0.07, top.z * 1.05])
    an.lookAt(top.clone().multiplyScalar(2.2).setY(1.4)); an.rotateX(Math.PI / 2); g.add(an)
  }
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 1.45
    const end = new THREE.Vector3(Math.cos(a) * 0.11, h + 0.05, Math.sin(a) * 0.11)
    g.add(mesh(new THREE.TubeGeometry(new THREE.CubicBezierCurve3(new THREE.Vector3(0, 0.02, 0), new THREE.Vector3(0, h * 0.7, 0), new THREE.Vector3(Math.cos(a) * 0.05, h, Math.sin(a) * 0.05), end), 20, 0.01, 8), style))
    g.add(mesh(new THREE.SphereGeometry(0.03, 20, 14), style, [end.x, end.y + 0.01, end.z], [0, 0, 0], [1.2, 0.7, 1.2]))
  }
}

// ---------------------------------------------------------------- glass flowers
export function crocus2(o = {}) {
  seed = o.seed ?? 7
  const g = new THREE.Group()
  const mat = glass2({ vertexColors: true, attenuation: o.attenuation ?? '#c7aaf3', attDist: o.attDist ?? 1.6, thickness: 0.08 })
  const palette = o.palette ?? ['#9d6be6', '#e7dafc', '#ffffff']
  const open = o.open ?? 0.5
  for (const r of [{ n: 3, len: 1.1, wid: 0.4, elev: open, curl: -0.3, cup: 0.5, rot: 0 }, { n: 3, len: 1.02, wid: 0.38, elev: open + 0.22, curl: -0.08, cup: 0.55, rot: Math.PI / 3 }]) {
    for (let i = 0; i < r.n; i++) {
      const az = r.rot + (i / r.n) * Math.PI * 2 + (rnd() - 0.5) * 0.12
      g.add(place(petal({ length: r.len * (1 + (rnd() - 0.5) * 0.08), width: r.wid, cup: r.cup, curl: r.curl + (rnd() - 0.5) * 0.1, colors: palette, ruffle: 0.01, thick: 0.06 }, mat), az, r.elev + (rnd() - 0.5) * 0.08, 0.05))
    }
  }
  stamens(g)
  return g
}

export function lotus2(o = {}) {
  seed = o.seed ?? 11
  const g = new THREE.Group()
  const mat = glass2({ vertexColors: true, attenuation: o.attenuation ?? '#e3b4ee', attDist: 1.8, thickness: 0.06 })
  const palette = o.palette ?? ['#c47ad8', '#f3dcf7', '#ffffff']
  const rings = [
    { n: 9, len: 0.95, wid: 0.3, elev: 0.12, curl: -0.25, cup: 0.45, r: 0.18 },
    { n: 8, len: 0.85, wid: 0.3, elev: 0.5, curl: -0.05, cup: 0.5, r: 0.14 },
    { n: 7, len: 0.7, wid: 0.28, elev: 0.88, curl: 0.12, cup: 0.5, r: 0.1 },
    { n: 5, len: 0.48, wid: 0.24, elev: 1.15, curl: 0.15, cup: 0.45, r: 0.06 }
  ]
  rings.forEach((r, ri) => {
    for (let i = 0; i < r.n; i++) {
      const az = (i / r.n) * Math.PI * 2 + ri * 0.4 + (rnd() - 0.5) * 0.08
      g.add(place(petal({ length: r.len * (1 + (rnd() - 0.5) * 0.1), width: r.wid, cup: r.cup, curl: r.curl + (rnd() - 0.5) * 0.12, colors: palette, ruffle: 0.012, thick: 0.045, segU: 44, segV: 18 }, mat), az, r.elev + (rnd() - 0.5) * 0.06, r.r, ri * 0.04))
    }
  })
  const gm = glossy('#f3c23d', { roughness: 0.4, sheen: 1, sheenColor: '#fff3b8' })
  g.add(mesh(new THREE.CylinderGeometry(0.13, 0.1, 0.1, 40), glossy('#d8e88a', { roughness: 0.4 }), [0, 0.1, 0]))
  for (let i = 0; i < 40; i++) {
    const a = i * 2.39996, r = 0.12 + 0.08 * (i / 40)
    const tip = new THREE.Vector3(Math.cos(a) * r, 0.2 + 0.05 * Math.sin(i), Math.sin(a) * r)
    g.add(mesh(new THREE.TubeGeometry(new THREE.LineCurve3(new THREE.Vector3(Math.cos(a) * 0.1, 0.12, Math.sin(a) * 0.1), tip), 1, 0.006, 6), gm))
    g.add(mesh(new THREE.SphereGeometry(0.014, 10, 8), gm, tip.toArray()))
  }
  return g
}

export function tulip2(o = {}) {
  seed = o.seed ?? 5
  const g = new THREE.Group()
  const mat = glass2({ vertexColors: true, attenuation: o.attenuation ?? '#f0b7dc', attDist: 1.4, thickness: 0.08 })
  const palette = o.palette ?? ['#c85aa8', '#f6cfe8', '#fff7fc']
  const head = new THREE.Group()
  for (const r of [{ n: 3, len: 1.0, wid: 0.5, elev: 1.15, curl: 0.35, cup: 0.75, rot: 0 }, { n: 3, len: 0.96, wid: 0.48, elev: 1.25, curl: 0.4, cup: 0.8, rot: Math.PI / 3 }]) {
    for (let i = 0; i < r.n; i++) {
      const az = r.rot + (i / r.n) * Math.PI * 2 + (rnd() - 0.5) * 0.1
      head.add(place(petal({ length: r.len, width: r.wid, cup: r.cup, curl: r.curl, colors: palette, ruffle: 0.008, thick: 0.07, round: true }, mat), az, r.elev, 0.05))
    }
  }
  head.position.y = 1.5; g.add(head)
  const stemMat = glass2({ attenuation: '#b9e3c4', attDist: 1.2, thickness: 0.1, irid: 0.5 })
  const stem = new THREE.CatmullRomCurve3([[0, 0, 0], [0.05, 0.5, 0], [-0.02, 1.0, 0.02], [0, 1.52, 0]].map((p) => new THREE.Vector3(...p)))
  g.add(mesh(new THREE.TubeGeometry(stem, 48, 0.035, 16), stemMat))
  const leafMat = glass2({ vertexColors: true, attenuation: '#bfe6c9', attDist: 1.4, thickness: 0.06, irid: 0.6 })
  for (const [az, elev, len] of [[0.3, 0.75, 1.1], [Math.PI + 0.2, 0.9, 0.9]]) {
    const leaf = place(petal({ length: len, width: 0.26, cup: 0.45, curl: -0.35, colors: ['#9fd6ad', '#e3f6e8', '#ffffff'], ruffle: 0.008, thick: 0.05 }, leafMat), az, elev, 0.02, 0.1)
    g.add(leaf)
  }
  return g
}

export function leaves2(o = {}) {
  seed = o.seed ?? 3
  const g = new THREE.Group()
  const mat = glass2({ vertexColors: true, attenuation: o.attenuation ?? '#cbb4f3', attDist: 2, thickness: 0.05 })
  const stem = new THREE.CatmullRomCurve3([[0, 0, 0], [0.1, 0.6, 0], [0.05, 1.2, 0.05], [-0.1, 1.7, 0]].map((p) => new THREE.Vector3(...p)))
  g.add(mesh(new THREE.TubeGeometry(stem, 48, 0.022, 12), glossy('#c9b2f2', { roughness: 0.15, irid: 0.3 })))
  for (let k = 0; k < 7; k++) {
    const t = 0.15 + k * 0.12, p = stem.getPoint(t)
    const az = k % 2 ? 0.2 : Math.PI - 0.2
    const leaf = petal({ length: 0.62 - k * 0.04, width: 0.24, cup: 0.4, curl: -0.25, colors: ['#b593ea', '#efe6fd', '#ffffff'], ruffle: 0.006, thick: 0.04, segU: 40, segV: 16 }, mat)
    D().placePetal(leaf, az, 0.55 + (rnd() - 0.5) * 0.2); leaf.updateMatrix = () => {}
    leaf.matrix.setPosition(p.x, p.y, p.z); g.add(leaf)
  }
  return g
}

export function crystals2(o = {}) {
  seed = o.seed ?? 13
  const g = new THREE.Group()
  const mat = glass2({ attenuation: o.attenuation ?? '#b392f0', attDist: 0.9, thickness: 0.5, ior: 1.55, irid: 0.4, dispersion: 0.8 })
  const prism = (r, h, tip) => {
    const pts = []
    const ring = (y, rad) => Array.from({ length: 6 }, (_, i) => new THREE.Vector3(Math.cos(i * Math.PI / 3) * rad, y, Math.sin(i * Math.PI / 3) * rad))
    const b = ring(0, r), t = ring(h, r * 0.92), apex = new THREE.Vector3(0, h + tip, 0), bottom = new THREE.Vector3(0, 0, 0)
    for (let i = 0; i < 6; i++) { const j = (i + 1) % 6; pts.push(b[i], t[i], b[j], b[j], t[i], t[j], t[i], apex, t[j], b[i], b[j], bottom) }
    const geo = new THREE.BufferGeometry().setFromPoints(pts); geo.computeVertexNormals(); return geo
  }
  // a geode-like fan of hexagonal points growing from one base
  const spec = o.spec ?? [[0, 0.17, 1.15, 0.3, 0], [-0.38, 0.12, 0.8, 0.22, 0.1], [0.42, 0.13, 0.85, 0.24, -0.08], [-0.72, 0.09, 0.55, 0.16, 0.05], [0.78, 0.09, 0.5, 0.15, 0.1], [0.15, 0.08, 0.45, 0.14, 0.35], [-0.2, 0.07, 0.38, 0.12, -0.3]]
  for (const [lean, r, h, tip, tilt] of spec) g.add(mesh(prism(r, h, tip), mat, [Math.sin(lean) * 0.1, 0, tilt * 0.3], [tilt, rnd() * 0.8, -lean]))
  g.add(mesh(new THREE.SphereGeometry(0.28, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), glass2({ attenuation: '#9f7fe0', attDist: 0.6, thickness: 0.4, roughness: 0.25 }), [0, -0.02, 0], [0, 0, 0], [1.4, 0.45, 0.9]))
  return g
}

export function petals2(o = {}) {
  seed = o.seed ?? 21
  const g = new THREE.Group()
  const mat = glass2({ vertexColors: true, attenuation: o.attenuation ?? '#d7b8f4', attDist: 2, thickness: 0.05 })
  for (const [x, y, z, rx, ry, rz, s] of o.spec ?? [[0, 0, 0, 0.4, 0.3, 0.2, 1], [0.9, 0.35, -0.2, -0.5, 1.4, 0.8, 0.8], [-0.7, 0.5, 0.1, 1.0, -0.6, -0.5, 0.7]]) {
    const p = petal({ length: 0.8, width: 0.4, cup: 0.5, curl: 0.25, colors: ['#a77ae8', '#ecdffc', '#ffffff'], ruffle: 0.01, thick: 0.05, segU: 40, segV: 18 }, mat)
    p.position.set(x, y, z); p.rotation.set(rx, ry, rz); p.scale.setScalar(s); g.add(p)
  }
  return g
}

// ---------------------------------------------------------------- detailed school icons
function onion(r = 0.5, h = 0.84) {
  return lathe([[0, 0], [r * 0.88, 0], [r, h * 0.14], [r * 0.98, h * 0.33], [r * 0.8, h * 0.55], [r * 0.52, h * 0.71], [r * 0.24, h * 0.86], [r * 0.08, h * 0.95], [0, h]])
}
function ribs(g, r, h, y, mat, n = 12) {
  const prof = [[r * 0.88, 0], [r, h * 0.14], [r * 0.98, h * 0.33], [r * 0.8, h * 0.55], [r * 0.52, h * 0.71], [r * 0.24, h * 0.86], [r * 0.08, h * 0.95]]
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    const pts = prof.map(([rr, yy]) => new THREE.Vector3(Math.cos(a) * rr * 1.01, y + yy, Math.sin(a) * rr * 1.01))
    g.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 32, 0.008, 6), mat))
  }
}
function arch(w, h, peak = 0.62) {
  const s = new THREE.Shape(), x = w / 2
  s.moveTo(-x, 0); s.lineTo(-x, h)
  s.bezierCurveTo(-x, h + w * peak * 0.55, -w * 0.12, h + w * peak * 0.8, 0, h + w * peak)
  s.bezierCurveTo(w * 0.12, h + w * peak * 0.8, x, h + w * peak * 0.55, x, h)
  s.lineTo(x, 0); s.closePath(); return s
}
const ext = (shape, depth, bevel = 0.01) => { const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 32 }); g.translate(0, 0, -depth / 2); g.computeVertexNormals(); return g }
function crescent(g, pos, s, mat) {
  g.add(mesh(new THREE.TorusGeometry(0.075 * s, 0.017 * s, 12, 48, Math.PI * 1.35), mat, pos, [0, 0, -Math.PI * 0.18]))
}

export function mosque2() {
  const g = new THREE.Group()
  const wall = glossy('#f4eefc', { roughness: 0.28 }), dome = glossy('#8d6be6', { irid: 0.3, roughness: 0.18 }), dark = glossy('#4f2f9c', { roughness: 0.3 })
  const tr = gold()
  g.add(mesh(new RoundedBoxGeometry(2.6, 0.1, 1.5, 4, 0.03), glossy('#e2d6f6'), [0, 0.05, 0]))
  g.add(mesh(new RoundedBoxGeometry(2.4, 0.08, 1.35, 4, 0.03), glossy('#ece4fa'), [0, 0.14, 0]))
  g.add(mesh(new RoundedBoxGeometry(1.8, 0.72, 1.0, 6, 0.05), wall, [0, 0.54, 0]))
  g.add(mesh(new RoundedBoxGeometry(1.86, 0.06, 1.06, 4, 0.02), tr, [0, 0.92, 0]))
  // arcade: five pointed arches with gold frames
  for (let i = 0; i < 5; i++) {
    const x = -0.68 + i * 0.34, big = i === 2
    g.add(mesh(ext(arch(big ? 0.24 : 0.17, big ? 0.3 : 0.22), 0.03, 0.006), dark, [x, 0.2, 0.505]))
    g.add(mesh(new THREE.TorusGeometry(big ? 0.13 : 0.095, 0.01, 8, 32, Math.PI), tr, [x, 0.2 + (big ? 0.3 : 0.22), 0.52]))
  }
  for (const x of [-0.6, -0.3, 0.3, 0.6]) g.add(mesh(ext(arch(0.07, 0.07), 0.02, 0.004), dark, [x, 0.72, 0.505]))
  g.add(mesh(new THREE.CylinderGeometry(0.46, 0.48, 0.24, 64), wall, [0, 1.07, 0]))
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; g.add(mesh(ext(arch(0.06, 0.06), 0.02, 0.004), dark, [Math.sin(a) * 0.47, 1.0, Math.cos(a) * 0.47], [0, a, 0])) }
  g.add(mesh(new THREE.TorusGeometry(0.47, 0.022, 12, 64), tr, [0, 1.19, 0], [Math.PI / 2, 0, 0]))
  g.add(mesh(onion(0.5, 0.86), dome, [0, 1.19, 0]))
  ribs(g, 0.5, 0.86, 1.19, tr)
  g.add(mesh(new THREE.SphereGeometry(0.04, 20, 16), tr, [0, 2.06, 0]))
  g.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.16, 12), tr, [0, 2.12, 0]))
  crescent(g, [0, 2.27, 0], 1, tr)
  for (const x of [-0.66, 0.66]) {
    g.add(mesh(new THREE.CylinderGeometry(0.2, 0.21, 0.12, 48), wall, [x, 0.98, 0.1]))
    g.add(mesh(onion(0.22, 0.38), dome, [x, 1.04, 0.1]))
    ribs(g, 0.22, 0.38, 1.04, tr, 8)
    g.add(mesh(new THREE.SphereGeometry(0.022, 14, 10), tr, [x, 1.44, 0.1]))
  }
  // four minarets with two balconies each
  for (const [x, z, h] of [[-1.15, 0.45, 2.1], [1.15, 0.45, 2.1], [-1.0, -0.5, 1.75], [1.0, -0.5, 1.75]]) {
    g.add(mesh(new THREE.CylinderGeometry(0.09, 0.12, h, 32), wall, [x, 0.18 + h / 2, z]))
    for (const f of [0.55, 0.82]) {
      g.add(mesh(new THREE.CylinderGeometry(0.14, 0.11, 0.06, 32), wall, [x, 0.18 + h * f, z]))
      g.add(mesh(new THREE.TorusGeometry(0.14, 0.014, 8, 32), tr, [x, 0.21 + h * f, z], [Math.PI / 2, 0, 0]))
    }
    g.add(mesh(new THREE.ConeGeometry(0.11, 0.36, 32), dome, [x, 0.18 + h + 0.18, z]))
    g.add(mesh(new THREE.SphereGeometry(0.02, 12, 10), tr, [x, 0.18 + h + 0.38, z]))
  }
  return g
}

export function heart2() {
  const { heartGeo } = D()
  const g = new THREE.Group()
  const shade = (geo, top, bottom) => {
    const pos = geo.attributes.position, col = []; geo.computeBoundingBox(); const { min, max } = geo.boundingBox
    for (let i = 0; i < pos.count; i++) { const t = (pos.getY(i) - min.y) / (max.y - min.y); const c = C(bottom).lerp(C(top), Math.pow(t, 0.8)); col.push(c.r, c.g, c.b) }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); return geo
  }
  g.add(mesh(shade(heartGeo(), '#f9b4ea', '#a947d6'), glossy('#ffffff', { vertexColors: true, roughness: 0.12, cc: 0.02, irid: 0.35, sheen: 0.4, sheenColor: '#ffe3f6' }), [0, 0, 0], [-0.1, 0.32, 0]))
  // golden band around the heart's side (the extruded outline, pushed out by the bevel)
  const sh = new THREE.Shape()
  sh.moveTo(0, -1.0)
  sh.bezierCurveTo(-0.35, -0.68, -1.05, -0.28, -1.05, 0.28); sh.bezierCurveTo(-1.05, 0.78, -0.62, 1.02, -0.3, 1.0)
  sh.bezierCurveTo(-0.1, 0.99, 0.0, 0.82, 0.0, 0.66); sh.bezierCurveTo(0.0, 0.82, 0.1, 0.99, 0.3, 1.0)
  sh.bezierCurveTo(0.62, 1.02, 1.05, 0.78, 1.05, 0.28); sh.bezierCurveTo(1.05, -0.28, 0.35, -0.68, 0, -1.0)
  const outline = sh.getSpacedPoints(160).map((p) => new THREE.Vector3(p.x * 1.2, p.y * 1.2 + 0.02, 0))
  g.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(outline, true), 320, 0.035, 10, true), gold(), [0, 0, 0], [-0.1, 0.32, 0]))
  // two small hearts in front and pearls
  g.add(mesh(shade(heartGeo(), '#ffd0f0', '#e07ad0'), glossy('#ffffff', { vertexColors: true, roughness: 0.15, irid: 0.3 }), [1.12, -0.55, 0.75], [0.1, -0.4, 0.3], 0.3))
  g.add(mesh(heartGeo(), glass2({ attenuation: '#f1a9e0', attDist: 0.6, thickness: 0.4 }), [-1.12, -0.25, 0.7], [0.2, 0.5, -0.35], 0.24))
  for (const [x, y, z, r] of [[-0.95, -0.62, 0.7, 0.07], [-0.78, -0.78, 0.72, 0.05], [0.86, -0.88, 0.72, 0.06], [1.15, 0.2, 0.5, 0.05]]) g.add(mesh(new THREE.SphereGeometry(r, 32, 24), glossy('#fbf3ff', { roughness: 0.1, irid: 0.8, sheen: 1, sheenColor: '#ffe0f8' }), [x, y, z]))
  return g
}

export function culture2() {
  const { petalGeo, placePetal } = D()
  const g = new THREE.Group()
  // glossy vase with gold bands
  const vase = lathe([[0.001, 0], [0.26, 0], [0.32, 0.08], [0.4, 0.3], [0.38, 0.5], [0.24, 0.72], [0.16, 0.86], [0.2, 0.96], [0.2, 0.98]])
  g.add(mesh(vase, glossy('#6b3fc8', { roughness: 0.16, irid: 0.25 })))
  for (const [y, r] of [[0.08, 0.322], [0.42, 0.397], [0.86, 0.165]]) g.add(mesh(new THREE.TorusGeometry(r, 0.016, 10, 64), gold(), [0, y, 0], [Math.PI / 2, 0, 0]))
  // ornament dots around the belly
  for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; g.add(mesh(new THREE.SphereGeometry(0.022, 12, 10), gold(), [Math.cos(a) * 0.405, 0.3, Math.sin(a) * 0.405])) }
  const petalsMat = glossy('#ffffff', { vertexColors: true, roughness: 0.28, side: THREE.DoubleSide, sheen: 0.3, sheenColor: '#ffd9fb', irid: 0.15 })
  const flower = (pos, rot, s, cols) => {
    const f = new THREE.Group()
    for (let i = 0; i < 8; i++) { const m = new THREE.Mesh(petalGeo({ length: 0.5, width: 0.22, cup: 0.35, curl: -0.12, colors: cols, ruffle: 0.015 }), petalsMat); placePetal(m, (i / 8) * Math.PI * 2, 0.3); m.updateMatrix = () => {}; m.castShadow = true; f.add(m) }
    for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(petalGeo({ length: 0.3, width: 0.18, cup: 0.4, curl: 0.1, colors: cols, ruffle: 0.012 }), petalsMat); placePetal(m, (i / 6) * Math.PI * 2 + 0.3, 0.75); m.updateMatrix = () => {}; f.add(m) }
    f.add(mesh(new THREE.SphereGeometry(0.09, 32, 20), glossy('#f2b630', { roughness: 0.4, sheen: 1, sheenColor: '#fff2b8' }), [0, 0.05, 0], [0, 0, 0], [1, 0.55, 1]))
    f.position.fromArray(pos); f.rotation.fromArray(rot); f.scale.setScalar(s); g.add(f)
    const stem = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0.9, 0), new THREE.Vector3(pos[0] * 0.4, (0.9 + pos[1]) / 2, pos[2] * 0.4), new THREE.Vector3(...pos))
    g.add(mesh(new THREE.TubeGeometry(stem, 16, 0.016, 8), glossy('#4f9a4a')))
  }
  flower([0, 1.55, 0.05], [0.35, 0, 0], 1, ['#7a1fa8', '#c447d8', '#f3b0ef'])
  flower([-0.45, 1.3, 0.1], [0.4, 0, 0.5], 0.75, ['#a8338f', '#e568b9', '#ffd0ea'])
  flower([0.48, 1.28, 0.05], [0.4, 0, -0.5], 0.7, ['#5a2fb8', '#9a76ea', '#e6dcff'])
  const leafMat = glossy('#ffffff', { vertexColors: true, roughness: 0.3, side: THREE.DoubleSide })
  for (const [az, el] of [[0.4, 0.5], [2.6, 0.45], [4.4, 0.55]]) { const m = new THREE.Mesh(petalGeo({ length: 0.55, width: 0.2, cup: 0.3, curl: -0.3, colors: ['#2e7d34', '#4cb848', '#8dd468'] }), leafMat); placePetal(m, az, el); m.updateMatrix = () => {}; m.matrix.setPosition(0, 0.95, 0); m.castShadow = true; g.add(m) }
  return g
}

export function house2() {
  const g = new THREE.Group()
  const wall = glossy('#a985ee'), roof = glossy('#6a3fc7', { irid: 0.2 }), white = glossy('#f7f2ff', { roughness: 0.3 }), green = glossy('#6fbf73', { roughness: 0.35 })
  g.add(mesh(new RoundedBoxGeometry(2.2, 0.06, 1.7, 4, 0.03), glossy('#e7dcf8'), [0, 0.03, 0]))
  g.add(mesh(new RoundedBoxGeometry(1.25, 0.9, 1.0, 6, 0.06), wall, [0, 0.51, 0]))
  // tiled roof: rows of rounded tiles on both slopes
  const tri = new THREE.Shape(); tri.moveTo(-0.82, 0); tri.lineTo(0, 0.64); tri.lineTo(0.82, 0); tri.closePath()
  g.add(mesh(new THREE.ExtrudeGeometry(tri, { depth: 1.14, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 4 }).translate(0, 0, -0.57), roof, [0, 0.95, 0]))
  for (const side of [-1, 1]) for (let r = 0; r < 5; r++) for (let c = 0; c < 7; c++) {
    const t = (r + 0.5) / 5, x = side * (0.82 - t * 0.82) + side * 0.02, y = 0.95 + t * 0.64 + 0.04
    g.add(mesh(new THREE.CapsuleGeometry(0.035, 0.1, 4, 8), roof, [x, y, -0.5 + c * 0.167], [0, 0, side * (Math.PI / 2 - Math.atan2(0.64, 0.82))]))
  }
  g.add(mesh(new RoundedBoxGeometry(0.18, 0.4, 0.18, 4, 0.03), roof, [0.4, 1.4, -0.22]))
  for (let i = 0; i < 3; i++) g.add(mesh(new THREE.SphereGeometry(0.07 + i * 0.025, 20, 16), glass2({ attenuation: '#e8defa', attDist: 3, thickness: 0.2 }), [0.42 + i * 0.07, 1.68 + i * 0.13, -0.22]))
  // door, steps, knob, heart
  g.add(mesh(ext(arch(0.3, 0.3, 0.5), 0.05, 0.012), white, [0, 0.07, 0.5]))
  g.add(mesh(ext(arch(0.24, 0.27, 0.5), 0.02, 0.008), glossy('#c9b2f6'), [0, 0.09, 0.53]))
  g.add(mesh(new THREE.SphereGeometry(0.022, 12, 10), gold(), [0.07, 0.25, 0.555]))
  g.add(mesh(new RoundedBoxGeometry(0.46, 0.05, 0.16, 3, 0.015), white, [0, 0.085, 0.6]))
  // windows with frames, sills and shutters
  for (const x of [-0.38, 0.38]) {
    g.add(mesh(new RoundedBoxGeometry(0.26, 0.26, 0.04, 3, 0.02), white, [x, 0.58, 0.5]))
    g.add(mesh(new RoundedBoxGeometry(0.2, 0.2, 0.03, 3, 0.015), glass2({ attenuation: '#cfe2ff', attDist: 1, thickness: 0.05 }), [x, 0.58, 0.515]))
    g.add(mesh(new THREE.BoxGeometry(0.02, 0.2, 0.05), white, [x, 0.58, 0.52]))
    g.add(mesh(new THREE.BoxGeometry(0.2, 0.02, 0.05), white, [x, 0.58, 0.52]))
    g.add(mesh(new RoundedBoxGeometry(0.32, 0.04, 0.1, 3, 0.012), white, [x, 0.44, 0.54]))
    for (let k = 0; k < 3; k++) g.add(mesh(new THREE.SphereGeometry(0.035, 12, 10), glossy(k % 2 ? '#f08fcf' : '#ffd36e', { roughness: 0.3 }), [x - 0.08 + k * 0.08, 0.48, 0.56]))
  }
  // bushes and a little fence
  for (const [x, z, r] of [[-0.85, 0.35, 0.2], [-0.7, 0.62, 0.15], [0.85, 0.4, 0.19], [0.72, 0.65, 0.13]]) g.add(mesh(new THREE.SphereGeometry(r, 24, 18), green, [x, r * 0.8, z]))
  for (let i = 0; i < 9; i++) { const x = -1.0 + i * 0.25; if (Math.abs(x) < 0.3) continue; g.add(mesh(new RoundedBoxGeometry(0.06, 0.26, 0.04, 2, 0.015), white, [x, 0.16, 0.8])) }
  g.add(mesh(new THREE.BoxGeometry(0.75, 0.035, 0.03), white, [-0.66, 0.2, 0.8])); g.add(mesh(new THREE.BoxGeometry(0.75, 0.035, 0.03), white, [0.66, 0.2, 0.8]))
  return g
}

export function plant2() {
  const { petalGeo, placePetal } = D()
  const g = new THREE.Group()
  const pot = lathe([[0.001, 0], [0.32, 0], [0.4, 0.5], [0.46, 0.52], [0.46, 0.62], [0.001, 0.62]])
  g.add(mesh(pot, glossy('#8e66ea', { roughness: 0.16, irid: 0.25 })))
  g.add(mesh(new THREE.TorusGeometry(0.455, 0.02, 10, 64), gold(), [0, 0.57, 0], [Math.PI / 2, 0, 0]))
  g.add(mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.04, 48), glossy('#6b4a3e', { roughness: 0.8 }), [0, 0.61, 0]))
  const stemMat = glossy('#3f8f3f', { roughness: 0.35 })
  g.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([[0, 0.6, 0], [0.02, 0.85, 0], [-0.02, 1.05, 0]].map((p) => new THREE.Vector3(...p))), 24, 0.03, 10), stemMat))
  const leafMat = glossy('#ffffff', { vertexColors: true, roughness: 0.26, side: THREE.DoubleSide, sheen: 0.1 })
  for (const [az, el, len, y] of [[Math.PI * 0.95, 0.75, 0.62, 1.04], [0.05, 0.8, 0.58, 1.04], [Math.PI * 0.5, 0.95, 0.42, 0.9], [Math.PI * 1.5, 0.9, 0.4, 0.86]]) {
    const m = new THREE.Mesh(petalGeo({ length: len, width: 0.36, cup: 0.3, curl: -0.25, colors: ['#1f6e2a', '#38a23c', '#74c850'], ruffle: 0.006 }), leafMat)
    placePetal(m, az, el); m.updateMatrix = () => {}; m.matrix.setPosition(0, y, 0); m.castShadow = true; g.add(m)
  }
  g.add(mesh(new THREE.SphereGeometry(0.06, 32, 24), glass2({ attenuation: '#d9f2ff', attDist: 4, thickness: 0.12 }), [-0.38, 1.2, 0.15], [0, 0, 0], [1, 0.85, 1]))
  return g
}

export function star2() {
  const g = new THREE.Group()
  const starGeo = (rIn = 0.46, depth = 0.42) => {
    const pts = [], front = new THREE.Vector3(0, 0, depth), back = new THREE.Vector3(0, 0, -depth)
    const rim = Array.from({ length: 10 }, (_, i) => { const r = i % 2 ? rIn : 1.05, a = Math.PI / 2 + (i * Math.PI) / 5; return new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0) })
    for (let i = 0; i < 10; i++) { const a = rim[i], b = rim[(i + 1) % 10]; pts.push(front, a, b, back, b, a) }
    const geo = new THREE.BufferGeometry().setFromPoints(pts); geo.computeVertexNormals(); return geo
  }
  const crystal = glass2({ attenuation: '#9b6ff0', attDist: 1.1, thickness: 0.8, ior: 1.6, irid: 0.5, color: '#f5efff', dispersion: 0.8 })
  g.add(mesh(starGeo(), crystal, [0, 1.55, 0], [0, 0.35, 0.08]))
  // pedestal with a gold rim
  g.add(mesh(new THREE.CylinderGeometry(0.62, 0.7, 0.22, 64), glossy('#efe7fc', { roughness: 0.2 }), [0, 0.11, 0]))
  g.add(mesh(new THREE.CylinderGeometry(0.5, 0.56, 0.14, 64), glossy('#8d6be6', { roughness: 0.16 }), [0, 0.29, 0]))
  g.add(mesh(new THREE.TorusGeometry(0.565, 0.02, 10, 64), gold(), [0, 0.36, 0], [Math.PI / 2, 0, 0]))
  g.add(mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.76, 16), gold(), [0, 0.73, 0]))
  // small stars and sparkles around
  g.add(mesh(starGeo(0.46, 0.4), glossy('#f2c35a', { metalness: 1, roughness: 0.2 }), [-0.95, 1.85, 0.1], [0, -0.4, 0.3], 0.22))
  g.add(mesh(starGeo(0.46, 0.4), crystal, [1.0, 1.75, -0.1], [0, 0.5, -0.25], 0.26))
  for (const [x, y, z, s] of [[-0.8, 0.9, 0.3, 0.07], [0.85, 0.95, 0.35, 0.06], [0.4, 2.35, 0.1, 0.05], [-0.45, 2.25, 0.2, 0.045]]) g.add(mesh(new THREE.OctahedronGeometry(s), gold(), [x, y, z], [0.3, 0.6, 0]))
  return g
}

export function bulb2() {
  const g = new THREE.Group()
  const glassProfile = [[0.001, 1.64], [0.2, 1.62], [0.4, 1.52], [0.54, 1.33], [0.57, 1.12], [0.51, 0.9], [0.35, 0.66], [0.26, 0.5], [0.25, 0.42]]
  g.add(mesh(lathe(glassProfile, 128), glass2({ attenuation: '#d7c2ff', attDist: 6, thickness: 0.04, irid: 0.8, side: THREE.DoubleSide })))
  const base = []
  for (let i = 0; i <= 16; i++) base.push([0.26 + (i % 2 ? 0.028 : 0), 0.42 - i * 0.022])
  base.push([0.19, 0.04], [0.12, -0.02], [0.001, -0.03])
  g.add(mesh(lathe(base, 96), gold({ color: '#ddb066', roughness: 0.22 })))
  g.add(mesh(new THREE.CylinderGeometry(0.13, 0.17, 0.05, 48), glossy('#3a2a5a'), [0, 0.06, 0]))
  g.add(mesh(new THREE.SphereGeometry(0.07, 24, 16), gold({ color: '#d6a95c' }), [0, -0.03, 0], [0, 0, 0], [1, 0.5, 1]))
  // inner glass stem and filament supports
  g.add(mesh(lathe([[0.001, 0.82], [0.05, 0.8], [0.08, 0.6], [0.13, 0.45], [0.001, 0.45]]), glass2({ attenuation: '#efe6ff', attDist: 6, thickness: 0.05 })))
  const wire = glossy('#b9b9c6', { metalness: 1, roughness: 0.3 })
  for (const x of [-0.1, 0.1]) g.add(mesh(new THREE.TubeGeometry(new THREE.LineCurve3(new THREE.Vector3(x * 0.4, 0.78, 0), new THREE.Vector3(x, 1.02, 0)), 1, 0.006, 6), wire))
  const fil = new THREE.CatmullRomCurve3(Array.from({ length: 41 }, (_, i) => { const t = i / 40; return new THREE.Vector3(-0.1 + t * 0.2, 1.02 + 0.05 * Math.sin(t * Math.PI), Math.sin(t * Math.PI * 12) * 0.018) }))
  g.add(mesh(new THREE.TubeGeometry(fil, 200, 0.008, 6), new THREE.MeshStandardMaterial({ color: '#ffd28a', emissive: C('#ffb347'), emissiveIntensity: 4 })))
  const light = new THREE.PointLight('#ffc070', 1.6, 0, 2); light.position.set(0, 1.05, 0); g.add(light)
  // halo ring and sparkles
  g.add(mesh(new THREE.TorusGeometry(0.85, 0.018, 12, 128), glass2({ attenuation: '#cdb4ff', attDist: 2, thickness: 0.05 }), [0, 1.1, 0], [1.25, 0.2, 0.25]))
  for (const [x, y, z, s] of [[-0.78, 1.55, 0.2, 0.06], [0.82, 1.6, 0.1, 0.05], [0.7, 0.5, 0.3, 0.045]]) g.add(mesh(new THREE.OctahedronGeometry(s), gold(), [x, y, z], [0.3, 0.6, 0]))
  return g
}

// ---------------------------------------------------------------- school icons, third set: fewer parts, one clear idea each
const shaded = (geo, top, bottom, axis = 'y') => {
  const pos = geo.attributes.position, col = []; geo.computeBoundingBox(); const { min, max } = geo.boundingBox
  for (let i = 0; i < pos.count; i++) {
    const t = axis === 'y' ? (pos.getY(i) - min.y) / (max.y - min.y) : (pos.getX(i) - min.x) / (max.x - min.x)
    const c = C(bottom).lerp(C(top), Math.pow(t, 0.85)); col.push(c.r, c.g, c.b)
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); return geo
}
const candy = (o = {}) => glossy('#ffffff', { vertexColors: true, roughness: 0.14, cc: 0.02, irid: o.irid ?? 0.25, sheen: 0.5, sheenColor: o.sheen ?? '#ffeefb' })
function star5(rIn = 0.46, depth = 0.34) {
  const pts = [], front = new THREE.Vector3(0, 0, depth), back = new THREE.Vector3(0, 0, -depth)
  const rim = Array.from({ length: 10 }, (_, i) => { const r = i % 2 ? rIn : 1.05, a = Math.PI / 2 + (i * Math.PI) / 5; return new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0) })
  for (let i = 0; i < 10; i++) { const a = rim[i], b = rim[(i + 1) % 10]; pts.push(front, a, b, back, b, a) }
  const geo = new THREE.BufferGeometry().setFromPoints(pts); geo.computeVertexNormals(); return geo
}

/** Family and relationships: a soft little house with a heart on its front; two tiny hearts rise from the chimney. */
export function family3() {
  const { heartGeo } = D()
  const g = new THREE.Group()
  const roofMat = glossy('#6d43d2', { roughness: 0.16, irid: 0.3 })
  g.add(mesh(new RoundedBoxGeometry(2.0, 0.08, 1.5, 4, 0.035), glossy('#e9e0fb', { roughness: 0.3 }), [0, 0.04, 0]))
  g.add(mesh(shaded(new RoundedBoxGeometry(1.46, 1.02, 1.0, 8, 0.12), '#d2c0fb', '#9f7deb'), candy(), [0, 0.59, 0]))
  // roof: a bevelled gable with a small overhang
  const tri = new THREE.Shape(); tri.moveTo(-0.98, 0); tri.lineTo(0, 0.74); tri.lineTo(0.98, 0); tri.closePath()
  g.add(mesh(new THREE.ExtrudeGeometry(tri, { depth: 1.08, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.07, bevelSegments: 6, curveSegments: 8 }).translate(0, 0, -0.54), roofMat, [0, 1.06, 0]))
  g.add(mesh(new RoundedBoxGeometry(0.22, 0.46, 0.22, 4, 0.05), roofMat, [0.5, 1.42, -0.18]))
  // round window in the gable and the heart on the wall
  g.add(mesh(new THREE.TorusGeometry(0.115, 0.022, 12, 48), gold(), [0, 1.36, 0.635]))
  g.add(mesh(new THREE.CircleGeometry(0.11, 48), glossy('#fff1fb', { roughness: 0.2, emissive: '#ffd9f2', emissiveIntensity: 0.35 }), [0, 1.36, 0.628]))
  g.add(mesh(shaded(heartGeo(), '#ffc4ec', '#e2559f'), candy({ irid: 0.35 }), [0, 0.58, 0.56], [0, 0, 0], 0.27))
  for (const [x, y, z, s, r] of [[0.62, 1.92, -0.14, 0.085, 0.3], [0.78, 2.16, -0.1, 0.065, -0.25]]) {
    g.add(mesh(shaded(heartGeo(), '#ffd3f1', '#ef7fc4'), candy(), [x, y, z], [0, 0.2, r], s))
  }
  return g
}

/** Science and health: a glass flask with violet liquid and bubbles; a pink heart with a white cross beside it. */
export function health3() {
  const { heartGeo } = D()
  const g = new THREE.Group()
  const outer = [[0.001, 0], [0.5, 0], [0.6, 0.06], [0.64, 0.16], [0.6, 0.3], [0.2, 1.02], [0.17, 1.12], [0.17, 1.44], [0.2, 1.47], [0.2, 1.52]]
  g.add(mesh(lathe(outer, 128), glass2({ attenuation: '#e6dcff', attDist: 8, thickness: 0.05, irid: 0.7 })))
  // liquid (opaque, so it shows through the glass) with a meniscus
  const liquid = [[0.001, 0.03], [0.48, 0.03], [0.56, 0.08], [0.6, 0.16], [0.565, 0.29], [0.38, 0.62], [0.001, 0.62]]
  g.add(mesh(shaded(lathe(liquid, 96), '#c49cff', '#6a3ad4'), candy({ irid: 0.4 })))
  g.add(mesh(new THREE.TorusGeometry(0.205, 0.018, 10, 64), gold(), [0, 1.5, 0], [Math.PI / 2, 0, 0]))
  for (const [x, y, z, r] of [[-0.14, 0.72, 0.05, 0.05], [0.06, 0.86, 0.02, 0.035], [-0.02, 1.0, 0.0, 0.028], [0.2, 0.48, 0.28, 0.045], [-0.26, 0.34, 0.3, 0.035]]) {
    g.add(mesh(new THREE.SphereGeometry(r, 24, 16), glossy('#f6efff', { roughness: 0.08, irid: 0.8, sheen: 1, sheenColor: '#ffffff' }), [x, y, z]))
  }
  // the heart with a cross, floating at the shoulder of the flask
  const h = new THREE.Group()
  h.add(mesh(shaded(heartGeo(), '#ffc2e6', '#e04e95'), candy({ irid: 0.3 }), [0, 0, 0], [0, 0, 0], 1))
  const bar = (w, hh) => new RoundedBoxGeometry(w, hh, 0.2, 4, 0.06)
  h.add(mesh(bar(0.86, 0.28), glossy('#ffffff', { roughness: 0.15 }), [0, 0.04, 0.46]))
  h.add(mesh(bar(0.28, 0.86), glossy('#ffffff', { roughness: 0.15 }), [0, 0.04, 0.46]))
  h.position.set(0.6, 1.28, 0.22); h.rotation.set(0, -0.28, 0.12); h.scale.setScalar(0.3)
  h.traverse((m) => { m.castShadow = false }) // a floating badge: no shadow on the ground
  g.add(h)
  return g
}

/** Personal growth: three rising steps and a golden star above the highest one. */
export function growth3() {
  const g = new THREE.Group()
  const steps = [[-0.66, 0.42, '#e3d6fd', '#c3abf6'], [0, 0.82, '#c8b1f8', '#9d7aec'], [0.66, 1.22, '#a989f2', '#7149dc']]
  g.add(mesh(new RoundedBoxGeometry(2.24, 0.06, 1.0, 4, 0.03), glossy('#ece4fb', { roughness: 0.3 }), [0, 0.03, 0]))
  for (const [x, h, top, bottom] of steps) {
    g.add(mesh(shaded(new RoundedBoxGeometry(0.6, h, 0.74, 6, 0.08), top, bottom), candy(), [x, 0.06 + h / 2, 0]))
    g.add(mesh(new RoundedBoxGeometry(0.46, 0.02, 0.6, 2, 0.01), gold(), [x, 0.06 + h + 0.003, 0]))
  }
  g.add(mesh(star5(0.46, 0.3), gold({ color: '#f2c35a', roughness: 0.16 }), [0.66, 1.8, 0.02], [0, -0.35, 0.06], 0.44))
  for (const [x, y, z, s] of [[0.16, 1.74, 0.2, 0.05], [1.14, 2.08, 0.1, 0.045], [1.08, 1.5, 0.3, 0.035]]) g.add(mesh(new THREE.OctahedronGeometry(s), gold(), [x, y, z], [0.3, 0.6, 0]))
  return g
}

/** Background for the "words of the day" card: a wide band of small pastel shapes, glass and flowers at the
 *  two ends, the middle left calm for the text. */
export function words3() {
  const g = new THREE.Group()
  const pastel = (c, o = {}) => glossy(c, { roughness: 0.16, cc: 0.03, sheen: 0.6, sheenColor: '#ffffff', irid: o.irid ?? 0.25 })
  const clear = glass2({ attenuation: '#e2d4ff', attDist: 3, thickness: 0.5, irid: 0.8, dispersion: 0.6 })
  // left end
  g.add(mesh(new THREE.SphereGeometry(0.46, 64, 48), clear, [-2.09, 0.19, 0]))
  g.add(mesh(new THREE.TorusGeometry(0.27, 0.095, 32, 96), pastel('#f6b3d6'), [-1.53, -0.62, 0.35], [0.82, 0.46, 0.4]))
  g.add(mesh(new RoundedBoxGeometry(0.42, 0.42, 0.42, 5, 0.09), pastel('#c9b4fb'), [-2.5, -0.65, 0.3], [0.41, 1.08, 0.2]))
  const c1 = crocus2({ palette: ['#e48fc6', '#fbe0f1', '#ffffff'], attenuation: '#f2b5dc' }); c1.scale.setScalar(0.42); c1.position.set(-1.31, 0.34, -0.3); c1.rotation.set(0.5, 0, -0.35); g.add(c1)
  g.add(mesh(new THREE.SphereGeometry(0.09, 32, 24), pastel('#fff3fb', { irid: 0.9 }), [-1.72, 0.93, 0.3]))
  // right end
  g.add(mesh(new THREE.ConeGeometry(0.34, 0.62, 48), pastel('#ffd3bf'), [1.68, -0.46, 0.2], [0.2, 0.0, -0.35]))
  g.add(mesh(new THREE.TorusGeometry(0.36, 0.06, 24, 96), clear, [2.25, 0.28, -0.1], [0.25, -0.93, 0]))
  g.add(mesh(new THREE.SphereGeometry(0.24, 48, 32), pastel('#bfeee2'), [2.13, -0.78, 0.45]))
  const c2 = crocus2({ palette: ['#9d6be6', '#e7dafc', '#ffffff'] }); c2.scale.setScalar(0.36); c2.position.set(2.54, -0.08, 0.1); c2.rotation.set(0.4, 0, 0.45); g.add(c2)
  g.add(mesh(new THREE.OctahedronGeometry(0.1), gold(), [1.35, 0.7, 0.2], [0.25, 0.93, 0]))
  // a few small pearls drifting towards the middle
  for (const [x, y, z, r] of [[-0.94, 0.85, 0.1, 0.06], [0.98, -0.85, 0.1, 0.05], [0.74, 0.96, -0.2, 0.04], [-0.78, -0.93, 0.2, 0.045]]) {
    g.add(mesh(new THREE.SphereGeometry(r, 24, 18), pastel('#fbf3ff', { irid: 0.9 }), [x, y, z]))
  }
  return g
}

// ---------------------------------------------------------------- welcome questions (onboarding)
/** "How much time a day?": a soft peach alarm clock with golden bells, hands at ten past ten, sparkles. */
export function clock3() {
  const g = new THREE.Group()
  const body = new THREE.Group()
  // the case: a thick rounded disc, peach to coral, with a golden bezel and a pearly face
  body.add(mesh(shaded(new THREE.CylinderGeometry(0.92, 0.92, 0.42, 128, 1).rotateX(Math.PI / 2), '#ffc7ad', '#ef7a8c'), candy({ irid: 0.3 })))
  body.add(mesh(new THREE.TorusGeometry(0.9, 0.075, 32, 160), gold(), [0, 0, 0.21]))
  body.add(mesh(new THREE.CircleGeometry(0.82, 128), glossy('#fff8f4', { roughness: 0.18, sheen: 0.6 }), [0, 0, 0.212]))
  // twelve hour marks, the four main ones larger
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2, big = i % 3 === 0
    body.add(mesh(new THREE.SphereGeometry(big ? 0.05 : 0.028, 20, 14), big ? gold() : glossy('#e7a3a8', { roughness: 0.2 }),
      [Math.sin(a) * 0.68, Math.cos(a) * 0.68, 0.23]))
  }
  // hands: ten past ten
  const hand = (len, w, a, z, mat) => { const m = mesh(new RoundedBoxGeometry(w, len, 0.03, 3, w / 2.2), mat, [0, 0, z]); m.geometry.translate(0, len / 2 - 0.06, 0); m.rotation.z = -a; return m }
  body.add(hand(0.42, 0.075, (10 / 12) * Math.PI * 2 + 0.09, 0.245, glossy('#7a3f5e', { roughness: 0.2 })))
  body.add(hand(0.6, 0.055, (2 / 12) * Math.PI * 2, 0.27, glossy('#7a3f5e', { roughness: 0.2 })))
  body.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.06, 32).rotateX(Math.PI / 2), gold(), [0, 0, 0.29]))
  // glass over the face
  body.add(mesh(new THREE.SphereGeometry(0.84, 96, 48, 0, Math.PI * 2, 0, 0.42).rotateX(Math.PI / 2).scale(1, 1, 0.35).translate(0, 0, 0.2), glass2({ attenuation: '#ffe3d8', attDist: 6, thickness: 0.04, irid: 0.5 })))
  // two bells and the hammer
  for (const sx of [-1, 1]) {
    const bell = mesh(new THREE.SphereGeometry(0.3, 64, 32, 0, Math.PI * 2, 0, Math.PI / 2), gold({ color: '#f0c46d' }), [sx * 0.58, 0.86, 0], [0, 0, -sx * 0.62])
    body.add(bell)
    body.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.16, 16), gold(), [sx * 0.46, 0.74, 0], [0, 0, -sx * 0.62]))
  }
  body.add(mesh(new THREE.TorusGeometry(0.16, 0.035, 16, 64, Math.PI), gold(), [0, 1.0, 0]))
  // feet
  for (const sx of [-1, 1]) body.add(mesh(new THREE.SphereGeometry(0.11, 24, 16), gold(), [sx * 0.52, -0.86, 0], [0, 0, 0], [1, 0.8, 1]))
  body.position.y = 0.98; body.rotation.set(0.05, -0.32, 0.04)
  g.add(body)
  for (const [x, y, z, s] of [[-1.15, 1.9, 0.2, 0.09], [1.2, 1.55, 0.3, 0.07], [1.05, 2.25, -0.1, 0.05]]) g.add(mesh(new THREE.OctahedronGeometry(s), gold(), [x, y, z], [0.3, 0.6, 0]))
  return g
}

/** "Which mirrors of a girl?": a girl made of soft shapes (dress, scarf, face) and, floating around her,
 *  small symbols of the schools: a book, a heart, a crescent, a star, a flower, a pearl. */
export function girl3() {
  const { heartGeo } = D()
  const g = new THREE.Group()
  // dress: a lathe bell, lilac to rose
  const dress = [[0.001, 0], [0.62, 0], [0.66, 0.05], [0.6, 0.3], [0.42, 0.9], [0.3, 1.2], [0.24, 1.3], [0.001, 1.32]]
  g.add(mesh(shaded(lathe(dress, 128), '#e2b3f7', '#8f5fe0'), candy({ irid: 0.35 })))
  // shawl over the shoulders, then the scarf: a rounded hood that frames the face
  const shawl = [[0.001, 1.22], [0.42, 1.22], [0.46, 1.27], [0.36, 1.42], [0.2, 1.5], [0.001, 1.52]]
  g.add(mesh(shaded(lathe(shawl, 96), '#f9a9bd', '#d9628c'), candy({ irid: 0.3 })))
  g.add(mesh(shaded(new THREE.SphereGeometry(0.4, 96, 64), '#f7a5bb', '#d65d8b'), candy({ irid: 0.3 }), [0, 1.66, -0.06], [0, 0, 0], [1, 1.1, 0.92]))
  g.add(mesh(shaded(new THREE.TorusGeometry(0.255, 0.075, 32, 128), '#fbb6c6', '#e0739a'), candy({ irid: 0.3 }), [0, 1.63, 0.2], [0, 0, 0], [1, 1.12, 1]))
  // face, set into the scarf
  g.add(mesh(new THREE.SphereGeometry(0.25, 96, 64), glossy('#ffe8dc', { roughness: 0.34, sheen: 0.8, sheenColor: '#fff3ee' }), [0, 1.62, 0.17], [0, 0, 0], [0.98, 1.08, 0.72]))
  for (const sx of [-1, 1]) {
    g.add(mesh(new THREE.SphereGeometry(0.026, 16, 12), glossy('#5a3550', { roughness: 0.15 }), [sx * 0.085, 1.65, 0.345]))
    g.add(mesh(new THREE.SphereGeometry(0.042, 16, 12), glossy('#ffb2bf', { roughness: 0.5 }), [sx * 0.145, 1.56, 0.33], [0, 0, 0], [1, 0.6, 0.4]))
  }
  g.add(mesh(new THREE.TorusGeometry(0.045, 0.011, 8, 32, Math.PI), glossy('#d26a86', { roughness: 0.3 }), [0, 1.55, 0.35], [0, 0, Math.PI]))
  // floating symbols
  const book = new THREE.Group()
  book.add(mesh(new RoundedBoxGeometry(0.42, 0.04, 0.3, 3, 0.015), glossy('#ffffff', { roughness: 0.25 }), [-0.11, 0.02, 0], [0, 0, 0.14]))
  book.add(mesh(new RoundedBoxGeometry(0.42, 0.04, 0.3, 3, 0.015), glossy('#ffffff', { roughness: 0.25 }), [0.11, 0.02, 0], [0, 0, -0.14]))
  book.add(mesh(new RoundedBoxGeometry(0.46, 0.03, 0.34, 3, 0.012), glossy('#8c5ce0', { roughness: 0.2 }), [-0.12, -0.02, 0], [0, 0, 0.14]))
  book.add(mesh(new RoundedBoxGeometry(0.46, 0.03, 0.34, 3, 0.012), glossy('#8c5ce0', { roughness: 0.2 }), [0.12, -0.02, 0], [0, 0, -0.14]))
  book.position.set(-1.05, 1.55, 0.2); book.rotation.set(0.6, 0.4, 0.1); g.add(book)
  g.add(mesh(shaded(heartGeo(), '#ffc4ec', '#e2559f'), candy({ irid: 0.35 }), [1.0, 1.95, 0.1], [0, -0.3, 0.2], 0.22))
  const moon = new THREE.Shape(); moon.absarc(0, 0, 1, 0, Math.PI * 2, false)
  const hole = new THREE.Path(); hole.absarc(0.42, 0.18, 0.86, 0, Math.PI * 2, true); moon.holes.push(hole)
  g.add(mesh(new THREE.ExtrudeGeometry(moon, { depth: 0.25, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.06, bevelSegments: 6, curveSegments: 64 }).center(), gold({ color: '#f2c35a' }), [-0.85, 2.25, -0.2], [0.1, 0.4, -0.4], 0.17))
  g.add(mesh(star5(0.46, 0.3), gold({ color: '#f2c35a', roughness: 0.16 }), [0.95, 0.95, 0.35], [0.1, -0.4, 0.2], 0.2))
  const c = crocus2({ palette: ['#e48fc6', '#fbe0f1', '#ffffff'], attenuation: '#f2b5dc' }); c.scale.setScalar(0.32); c.position.set(-1.0, 0.6, 0.35); c.rotation.set(0.4, 0, 0.3); g.add(c)
  for (const [x, y, z, r] of [[0.55, 2.35, 0.1, 0.07], [-0.5, 0.25, 0.6, 0.05], [1.25, 1.45, -0.2, 0.05], [-1.3, 1.05, -0.1, 0.04]]) {
    g.add(mesh(new THREE.SphereGeometry(r, 24, 18), glossy('#fbf3ff', { roughness: 0.08, irid: 0.9, sheen: 1 }), [x, y, z]))
  }
  g.traverse((m) => { if (m.isMesh && m.position.y > 0.4 && Math.abs(m.position.x) > 0.7) m.castShadow = false })
  return g
}

/** "Where did you find us?": a glossy location pin, a speech bubble with a heart and a glass magnifier. */
export function track3() {
  const { heartGeo } = D()
  const g = new THREE.Group()
  // the pin: a teardrop lathe with a pearl in its eye
  const pin = []
  for (let i = 0; i <= 48; i++) { const t = i / 48, a = Math.PI * t; pin.push([Math.sin(a) * 0.5 * (1 - 0.65 * Math.pow(1 - t, 3)), 0.5 - Math.cos(a) * 0.5 * (t < 0.5 ? 1.9 : 1)]) }
  pin[0] = [0.001, pin[0][1]]; pin[48] = [0.001, pin[48][1]]
  const p = mesh(shaded(lathe(pin, 128), '#ffb59e', '#e0577e'), candy({ irid: 0.3 }), [0, 0.47, 0], [0, 0, 0], [1, 1, 0.8])
  p.geometry.translate(0, 0, 0)
  g.add(p)
  g.add(mesh(new THREE.SphereGeometry(0.18, 48, 32), glossy('#fff6f2', { roughness: 0.1, irid: 0.8 }), [0, 0.82, 0.34]))
  g.add(mesh(new THREE.TorusGeometry(0.42, 0.03, 16, 96), glossy('#f6a6a6', { roughness: 0.3 }), [0, 0.03, 0], [Math.PI / 2, 0, 0]))
  // the speech bubble with a heart
  const b = new THREE.Shape()
  b.moveTo(-0.5, -0.25); b.quadraticCurveTo(-0.5, -0.45, -0.3, -0.45); b.lineTo(-0.15, -0.45); b.lineTo(-0.28, -0.68); b.lineTo(0.05, -0.45)
  b.lineTo(0.3, -0.45); b.quadraticCurveTo(0.5, -0.45, 0.5, -0.25); b.lineTo(0.5, 0.25); b.quadraticCurveTo(0.5, 0.45, 0.3, 0.45)
  b.lineTo(-0.3, 0.45); b.quadraticCurveTo(-0.5, 0.45, -0.5, 0.25); b.closePath()
  const bubble = new THREE.Group()
  bubble.add(mesh(new THREE.ExtrudeGeometry(b, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.07, bevelSegments: 8, curveSegments: 32 }).translate(0, 0, -0.06), shaded(new THREE.BoxGeometry(1, 1, 1), '#d9c8ff', '#9f7deb') && candy({ irid: 0.3 })))
  bubble.children[0].material = glossy('#c8b1f8', { roughness: 0.14, irid: 0.35, sheen: 0.6 })
  bubble.add(mesh(shaded(heartGeo(), '#ffd3f1', '#e2559f'), candy({ irid: 0.35 }), [0, 0.0, 0.16], [0, 0, 0], 0.22))
  bubble.position.set(0.95, 1.3, -0.1); bubble.rotation.set(0, -0.35, 0.08); bubble.scale.setScalar(0.85)
  bubble.traverse((m) => { m.castShadow = false })
  g.add(bubble)
  // the magnifier
  const lens = new THREE.Group()
  lens.add(mesh(new THREE.TorusGeometry(0.32, 0.06, 24, 128), gold()))
  lens.add(mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.05, 96).rotateX(Math.PI / 2), glass2({ attenuation: '#e6dcff', attDist: 5, thickness: 0.1, irid: 0.8 })))
  lens.add(mesh(new RoundedBoxGeometry(0.12, 0.5, 0.12, 4, 0.05), glossy('#7a4fd8', { roughness: 0.2 }), [0, -0.6, 0]))
  lens.position.set(-0.95, 0.75, 0.25); lens.rotation.set(0.2, 0.5, 0.65)
  lens.traverse((m) => { m.castShadow = false })
  g.add(lens)
  for (const [x, y, z, s] of [[-0.6, 1.6, 0.1, 0.07], [1.45, 0.6, 0.2, 0.05]]) g.add(mesh(new THREE.OctahedronGeometry(s), gold(), [x, y, z], [0.3, 0.6, 0]))
  return g
}

// ---------------------------------------------------------------- welcome questions, second take: product-style
const roseGold = (o = {}) => new THREE.MeshPhysicalMaterial({ color: C(o.color ?? '#f2b49a'), metalness: 1, roughness: o.roughness ?? 0.16, clearcoat: 0.7, clearcoatRoughness: 0.06, envMapIntensity: 1.6 })
const enamel = (color, o = {}) => new THREE.MeshPhysicalMaterial({ color: C(color), roughness: o.roughness ?? 0.14, clearcoat: 1, clearcoatRoughness: 0.14,
  sheen: o.sheenAmt ?? 0.25, sheenColor: C(o.sheen ?? '#ffffff'), sheenRoughness: 0.5, iridescence: o.irid ?? 0.12, envMapIntensity: o.env ?? 0.95, vertexColors: !!o.vc })
/** Satin fabric: soft, velvety highlights instead of glossy reflections (the girl's scarf). */
const satin = () => new THREE.MeshPhysicalMaterial({ color: C('#ffffff'), vertexColors: true, roughness: 0.55, sheen: 1, sheenColor: C('#ffd0e2'), sheenRoughness: 0.35, clearcoat: 0, envMapIntensity: 0.8 })
const pearl = () => new THREE.MeshPhysicalMaterial({ color: C('#fff8f4'), roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.05, iridescence: 1, iridescenceIOR: 1.6,
  iridescenceThicknessMinimum: 280, iridescenceThicknessMaximum: 520, sheen: 1, sheenColor: C('#ffe6f2'), envMapIntensity: 1.4 })

/** A soft round podium with a rounded edge and a thin rose-gold ring: the stage of each picture. */
function podium(top = '#ffd9cc', side = '#f3a597', r = 1.3) {
  const g = new THREE.Group()
  const prof = [[0.001, 0], [r - 0.08, 0], [r, 0.06], [r, 0.2], [r - 0.06, 0.26], [0.001, 0.26]]
  g.add(mesh(shaded(lathe(prof, 160), top, side), enamel('#ffffff', { vc: true, roughness: 0.2 })))
  g.add(mesh(new THREE.TorusGeometry(r - 0.005, 0.022, 16, 200), roseGold(), [0, 0.2, 0], [Math.PI / 2, 0, 0]))
  return g
}
/** A small four-point sparkle. */
function sparkle(s = 0.12) {
  const sh = new THREE.Shape()
  for (let i = 0; i < 8; i++) { const r = i % 2 ? 0.22 : 1, a = (i * Math.PI) / 4; i ? sh.lineTo(Math.sin(a) * r, Math.cos(a) * r) : sh.moveTo(Math.sin(a) * r, Math.cos(a) * r) }
  sh.closePath()
  return mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.18, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.06, bevelSegments: 4 }).center(), gold({ color: '#f6cf7a', roughness: 0.12 }), [0, 0, 0], [0, 0, 0], s)
}
function floaters(g, list) {
  const { heartGeo } = D()
  for (const f of list) {
    let m
    if (f.k === 'heart') m = mesh(shaded(heartGeo(), f.a ?? '#ffc4ec', f.b ?? '#e2559f'), candy({ irid: 0.35 }), [0, 0, 0], [0, 0, 0], f.s)
    else if (f.k === 'pearl') m = mesh(new THREE.SphereGeometry(f.s, 32, 24), pearl())
    else if (f.k === 'star') m = mesh(star5(0.46, 0.3), gold({ color: '#f4c766', roughness: 0.14 }), [0, 0, 0], [0, 0, 0], f.s)
    else m = sparkle(f.s)
    m.position.fromArray(f.p); m.rotation.fromArray(f.r ?? [0.2, -0.3, 0.15]); m.castShadow = false
    g.add(m)
  }
}

/** Time a day: a luxurious enamel alarm clock with rose-gold bells on a peach podium, sparkles around. */
export function clock4() {
  const g = new THREE.Group()
  g.add(podium('#ffd2c0', '#ee8e78'))
  const body = new THREE.Group()
  body.add(mesh(shaded(new THREE.CylinderGeometry(0.95, 0.95, 0.5, 160, 1).rotateX(Math.PI / 2), '#ff9fa0', '#d9467a'), enamel('#ffffff', { vc: true, irid: 0.25 })))
  // fluted rose-gold bezel
  const bez = []
  for (let i = 0; i <= 64; i++) { const t = i / 64, a = t * Math.PI * 2; bez.push(new THREE.Vector2(0.9 + 0.035 * Math.cos(a * 1), 0)) }
  body.add(mesh(new THREE.TorusGeometry(0.93, 0.085, 48, 240), roseGold(), [0, 0, 0.25]))
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2
    body.add(mesh(new THREE.SphereGeometry(0.03, 12, 10), roseGold({ roughness: 0.1 }), [Math.sin(a) * 1.0, Math.cos(a) * 1.0, 0.2]))
  }
  body.add(mesh(new THREE.CircleGeometry(0.86, 160), pearl(), [0, 0, 0.252]))
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2, big = i % 3 === 0
    const m = big ? mesh(new RoundedBoxGeometry(0.05, 0.16, 0.03, 2, 0.02), roseGold(), [Math.sin(a) * 0.68, Math.cos(a) * 0.68, 0.27], [0, 0, -a])
      : mesh(new THREE.SphereGeometry(0.03, 16, 12), roseGold(), [Math.sin(a) * 0.7, Math.cos(a) * 0.7, 0.27])
    body.add(m)
  }
  const hand = (len, w, a, z) => { const geo = new RoundedBoxGeometry(w, len, 0.03, 3, w / 2.2); geo.translate(0, len / 2 - 0.08, 0); return mesh(geo, glossy('#6a2f52', { roughness: 0.18 }), [0, 0, z], [0, 0, -a]) }
  body.add(hand(0.46, 0.08, (10 / 12) * Math.PI * 2 + 0.09, 0.29))
  body.add(hand(0.64, 0.055, (2 / 12) * Math.PI * 2, 0.31))
  body.add(mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.07, 32).rotateX(Math.PI / 2), roseGold(), [0, 0, 0.33]))
  body.add(mesh(new THREE.SphereGeometry(0.88, 128, 64, 0, Math.PI * 2, 0, 0.5).rotateX(Math.PI / 2).scale(1, 1, 0.32).translate(0, 0, 0.24), glass2({ attenuation: '#ffe7de', attDist: 8, thickness: 0.03, irid: 0.6 })))
  for (const sx of [-1, 1]) {
    body.add(mesh(new THREE.SphereGeometry(0.34, 96, 48, 0, Math.PI * 2, 0, Math.PI / 2), roseGold({ color: '#f5b39a' }), [sx * 0.6, 0.92, 0], [0, 0, -sx * 0.6]))
    body.add(mesh(new THREE.SphereGeometry(0.06, 24, 16), pearl(), [sx * 0.86, 1.18, 0]))
  }
  body.add(mesh(new THREE.TorusGeometry(0.2, 0.045, 20, 80, Math.PI), roseGold(), [0, 1.08, 0]))
  body.add(mesh(new THREE.SphereGeometry(0.05, 20, 14), pearl(), [0, 1.3, 0]))
  for (const sx of [-1, 1]) body.add(mesh(new THREE.ConeGeometry(0.1, 0.24, 32), roseGold(), [sx * 0.55, -0.95, 0], [0, 0, sx * 0.35]))
  body.position.set(0, 1.32, 0); body.rotation.set(0.04, -0.62, 0.07)
  g.add(body)
  floaters(g, [{ k: 'sparkle', p: [-1.25, 2.3, 0.3], s: 0.13 }, { k: 'sparkle', p: [1.3, 1.85, 0.4], s: 0.09 }, { k: 'pearl', p: [1.15, 2.55, -0.2], s: 0.08 },
    { k: 'heart', p: [-1.25, 1.1, 0.6], s: 0.2, r: [0.1, 0.5, 0.3] }, { k: 'star', p: [1.35, 0.85, 0.55], s: 0.17 }])
  return g
}

/** The mirrors: a chibi girl in a scarf holding a glowing book on a rose podium, the schools' symbols around. */
export function girl4() {
  const { heartGeo } = D()
  const g = new THREE.Group()
  g.add(podium('#f7c6dd', '#d77aae'))
  const ch = new THREE.Group()
  // dress: a soft bell with a rose-gold hem
  const dress = [[0.001, 0], [0.7, 0], [0.74, 0.06], [0.66, 0.36], [0.46, 0.86], [0.32, 1.1], [0.001, 1.14]]
  ch.add(mesh(shaded(lathe(dress, 160), '#c99af7', '#6f3fd1'), enamel('#ffffff', { vc: true, irid: 0.3 })))
  ch.add(mesh(new THREE.TorusGeometry(0.71, 0.03, 16, 200), roseGold(), [0, 0.07, 0], [Math.PI / 2, 0, 0]))
  // the scarf: a rounded hood with a soft drape over the shoulders and a pearl pin
  ch.add(mesh(shaded(new THREE.SphereGeometry(0.66, 128, 96), '#f585ac', '#c23a73'), satin(), [0, 1.62, -0.04], [0, 0, 0], [1, 1.02, 0.94]))
  const drape = [[0.001, 1.0], [0.62, 1.0], [0.66, 1.06], [0.56, 1.24], [0.34, 1.36], [0.001, 1.38]]
  ch.add(mesh(shaded(lathe(drape, 128), '#f792b5', '#cc4a80'), satin()))
  // the face, set in the scarf's opening
  ch.add(mesh(new THREE.SphereGeometry(0.47, 128, 96), new THREE.MeshPhysicalMaterial({ color: C('#ffd9c4'), roughness: 0.45, sheen: 0.6, sheenColor: C('#ffc4b0'), sheenRoughness: 0.5, clearcoat: 0.2, envMapIntensity: 0.9 }),
    [0, 1.6, 0.2], [0, 0, 0], [1, 1.02, 0.86]))
  ch.add(mesh(shaded(new THREE.TorusGeometry(0.47, 0.06, 32, 160), '#f78db3', '#d9578c'), satin(), [0, 1.6, 0.25], [0, 0, 0], [1, 1.04, 1]))
  for (const sx of [-1, 1]) {
    const eye = new THREE.Group()
    eye.add(mesh(new THREE.SphereGeometry(0.085, 48, 32), glossy('#3b1d33', { roughness: 0.05, cc: 0.01 }), [0, 0, 0], [0, 0, 0], [0.86, 1.15, 0.5]))
    eye.add(mesh(new THREE.SphereGeometry(0.026, 20, 14), new THREE.MeshBasicMaterial({ color: '#ffffff' }), [0.025, 0.04, 0.04]))
    eye.add(mesh(new THREE.SphereGeometry(0.012, 12, 10), new THREE.MeshBasicMaterial({ color: '#ffffff' }), [-0.02, -0.035, 0.04]))
    eye.position.set(sx * 0.16, 1.62, 0.6); eye.rotation.y = sx * 0.18; ch.add(eye)
    ch.add(mesh(new THREE.SphereGeometry(0.075, 24, 16), new THREE.MeshPhysicalMaterial({ color: C('#ff9fb3'), roughness: 0.6, transparent: true, opacity: 0.75 }), [sx * 0.27, 1.5, 0.55], [0, 0, 0], [1, 0.62, 0.3]))
  }
  ch.add(mesh(new THREE.TorusGeometry(0.06, 0.016, 12, 48, Math.PI), glossy('#c9506f', { roughness: 0.3 }), [0, 1.47, 0.62], [0, 0, Math.PI]))
  ch.add(mesh(new THREE.SphereGeometry(0.06, 24, 16), pearl(), [0.36, 1.2, 0.45]))
  // the open book, glowing, held before her
  const book = new THREE.Group()
  const page = (sx) => mesh(new THREE.BoxGeometry(0.36, 0.025, 0.46).translate(sx * 0.18, 0, 0), new THREE.MeshPhysicalMaterial({ color: C('#fffaf2'), roughness: 0.5, emissive: C('#fff1d6'), emissiveIntensity: 0.35 }), [0, 0, 0], [0, 0, sx * -0.18])
  book.add(page(-1), page(1))
  book.add(mesh(new RoundedBoxGeometry(0.78, 0.035, 0.5, 3, 0.015), enamel('#8f5ce0'), [0, -0.03, 0]))
  book.add(mesh(shaded(heartGeo(), '#ffd4ef', '#ec6aa8'), candy(), [0, 0.12, 0], [-Math.PI / 2 + 0.4, 0, 0], 0.08))
  book.position.set(0, 0.82, 0.62); book.rotation.set(-0.75, 0, 0); ch.add(book)
  for (const sx of [-1, 1]) ch.add(mesh(new THREE.SphereGeometry(0.1, 32, 24), new THREE.MeshPhysicalMaterial({ color: C('#ffe4d6'), roughness: 0.42, sheen: 1, sheenColor: C('#ffd2c4') }), [sx * 0.33, 0.82, 0.62]))
  ch.position.y = 0.26; ch.rotation.y = -0.18
  g.add(ch)
  // the schools' symbols floating around her
  const moon = new THREE.Shape(); moon.absarc(0, 0, 1, 0, Math.PI * 2, false)
  const hole = new THREE.Path(); hole.absarc(0.42, 0.2, 0.84, 0, Math.PI * 2, true); moon.holes.push(hole)
  g.add(mesh(new THREE.ExtrudeGeometry(moon, { depth: 0.3, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.08, bevelSegments: 8, curveSegments: 96 }).center(), gold({ color: '#f4c766', roughness: 0.12 }), [-1.2, 2.55, -0.1], [0.1, 0.5, -0.5], 0.2))
  const c = crocus2({ palette: ['#e48fc6', '#fbe0f1', '#ffffff'], attenuation: '#f2b5dc' }); c.scale.setScalar(0.34); c.position.set(-1.35, 1.25, 0.45); c.rotation.set(0.5, 0, 0.35); g.add(c)
  floaters(g, [{ k: 'heart', p: [1.3, 2.35, 0.15], s: 0.24, r: [0, -0.35, 0.25] }, { k: 'star', p: [1.4, 1.2, 0.5], s: 0.2 }, { k: 'sparkle', p: [0.55, 2.95, 0.2], s: 0.11 },
    { k: 'pearl', p: [-0.65, 2.95, 0.3], s: 0.07 }, { k: 'sparkle', p: [-1.45, 1.95, 0.4], s: 0.08 }, { k: 'pearl', p: [1.05, 0.6, 0.85], s: 0.06 }])
  return g
}

/** Where from: a candy map pin on a folded pastel map with a dotted route, a heart bubble and a lens. */
export function track4() {
  const { heartGeo } = D()
  const g = new THREE.Group()
  g.add(podium('#ffd2c0', '#ee8e78'))
  // the folded map: three panels at small angles, with a dotted route
  const map = new THREE.Group()
  const cols = [['#9fe0cf', '#5fbfa5'], ['#ffc4d8', '#f08bb0'], ['#cdbdfd', '#9a7ff0']]
  cols.forEach(([a, b], i) => {
    const p = mesh(shaded(new RoundedBoxGeometry(0.62, 0.03, 1.2, 3, 0.012), a, b, 'z'), enamel('#ffffff', { vc: true, roughness: 0.3 }), [(i - 1) * 0.6, 0.32 + (i === 1 ? 0.05 : 0), 0], [0, 0, (i - 1) * -0.09])
    map.add(p)
  })
  for (let i = 0; i < 9; i++) {
    const t = i / 8
    map.add(mesh(new THREE.SphereGeometry(0.028, 12, 10), glossy('#e0577e', { roughness: 0.3 }), [-0.8 + t * 1.25, 0.37 + Math.sin(t * Math.PI) * 0.03, 0.35 - Math.sin(t * Math.PI * 1.3) * 0.45]))
  }
  map.rotation.y = -0.35; g.add(map)
  // the pin
  const pin = []
  for (let i = 0; i <= 64; i++) { const t = i / 64, a = Math.PI * t; pin.push([Math.sin(a) * 0.5 * (1 - 0.7 * Math.pow(1 - t, 3)), 0.5 - Math.cos(a) * 0.5 * (t < 0.5 ? 1.95 : 1)]) }
  pin[0] = [0.001, pin[0][1]]; pin[64] = [0.001, pin[64][1]]
  const pg = new THREE.Group()
  pg.add(mesh(shaded(lathe(pin, 160), '#ffb19b', '#e04a79'), enamel('#ffffff', { vc: true, irid: 0.3 })))
  pg.add(mesh(new THREE.TorusGeometry(0.2, 0.05, 24, 96), roseGold(), [0, 0.52, 0.38]))
  pg.add(mesh(new THREE.SphereGeometry(0.17, 48, 32), pearl(), [0, 0.52, 0.37]))
  pg.position.set(0.15, 0.93, 0.1); pg.scale.set(1, 1, 0.82); pg.rotation.y = -0.2
  g.add(pg)
  g.add(mesh(new THREE.TorusGeometry(0.3, 0.03, 16, 96), roseGold(), [0.15, 0.4, 0.1], [Math.PI / 2, 0, 0]))
  // speech bubble with a heart
  const b = new THREE.Shape()
  b.moveTo(-0.5, -0.25); b.quadraticCurveTo(-0.5, -0.45, -0.3, -0.45); b.lineTo(-0.15, -0.45); b.lineTo(-0.3, -0.7); b.lineTo(0.05, -0.45)
  b.lineTo(0.3, -0.45); b.quadraticCurveTo(0.5, -0.45, 0.5, -0.25); b.lineTo(0.5, 0.25); b.quadraticCurveTo(0.5, 0.45, 0.3, 0.45)
  b.lineTo(-0.3, 0.45); b.quadraticCurveTo(-0.5, 0.45, -0.5, 0.25); b.closePath()
  const bubble = new THREE.Group()
  bubble.add(mesh(new THREE.ExtrudeGeometry(b, { depth: 0.14, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 10, curveSegments: 40 }).translate(0, 0, -0.07),
    glass2({ attenuation: '#d9c8ff', attDist: 1.2, thickness: 0.4, irid: 0.7 })))
  bubble.add(mesh(shaded(heartGeo(), '#ffd3f1', '#e2559f'), candy({ irid: 0.35 }), [0, 0.02, 0.04], [0, 0, 0], 0.2))
  bubble.position.set(1.15, 2.25, -0.1); bubble.rotation.set(0, -0.4, 0.1); bubble.scale.setScalar(0.85)
  bubble.traverse((m) => { m.castShadow = false }); g.add(bubble)
  const lens = new THREE.Group()
  lens.add(mesh(new THREE.TorusGeometry(0.3, 0.07, 32, 160), roseGold()))
  lens.add(mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.05, 96).rotateX(Math.PI / 2), glass2({ attenuation: '#ffe6dc', attDist: 5, thickness: 0.1, irid: 0.8 })))
  lens.add(mesh(new RoundedBoxGeometry(0.13, 0.52, 0.13, 4, 0.06), enamel('#8f5ce0'), [0, -0.6, 0]))
  lens.position.set(-1.15, 1.75, 0.3); lens.rotation.set(0.15, 0.5, 0.6)
  lens.traverse((m) => { m.castShadow = false }); g.add(lens)
  floaters(g, [{ k: 'sparkle', p: [-0.5, 2.55, 0.2], s: 0.11 }, { k: 'pearl', p: [1.45, 1.3, 0.4], s: 0.07 }, { k: 'star', p: [-1.35, 0.85, 0.5], s: 0.16 }, { k: 'sparkle', p: [0.75, 2.9, -0.1], s: 0.08 }])
  return g
}

/** The night launcher icon: a real-looking moon (craters, maria) lit from the side into a crescent. */
export function moon4() {
  const size = 1024
  const cv = document.createElement('canvas'); cv.width = size; cv.height = size / 2
  const ctx = cv.getContext('2d')
  ctx.fillStyle = '#d9d2c4'; ctx.fillRect(0, 0, cv.width, cv.height)
  let sd = 11
  const r = () => (sd = (sd * 16807) % 2147483647) / 2147483647
  for (let i = 0; i < 26; i++) { // maria: large soft dark patches
    const x = r() * cv.width, y = cv.height * (0.15 + r() * 0.7), rad = 30 + r() * 150
    const gr = ctx.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, `rgba(118,110,102,${0.35 + r() * 0.3})`); gr.addColorStop(1, 'rgba(118,110,102,0)')
    ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(x, y, rad, rad * (0.6 + r() * 0.5), r() * 3, 0, Math.PI * 2); ctx.fill()
  }
  for (let i = 0; i < 900; i++) { // craters of every size: soft dark floor, a faint bright rim on one side
    const x = r() * cv.width, y = r() * cv.height, rad = 0.8 + Math.pow(r(), 4) * 30
    const gr = ctx.createRadialGradient(x, y, rad * 0.2, x, y, rad); gr.addColorStop(0, `rgba(92,86,78,${0.18 + r() * 0.25})`); gr.addColorStop(1, 'rgba(92,86,78,0)')
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill()
    if (rad > 4) { ctx.strokeStyle = `rgba(248,242,230,${0.1 + r() * 0.2})`; ctx.lineWidth = rad * 0.12; ctx.beginPath(); ctx.arc(x, y, rad * 0.9, Math.PI * 1.0, Math.PI * 1.7); ctx.stroke() }
  }
  for (let i = 0; i < 4000; i++) { ctx.fillStyle = `rgba(${r() > 0.5 ? '255,250,240' : '80,74,68'},0.08)`; ctx.fillRect(r() * cv.width, r() * cv.height, 2, 2) } // grain
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = THREE.RepeatWrapping
  const g = new THREE.Group()
  const m = mesh(new THREE.SphereGeometry(1, 192, 128), new THREE.MeshStandardMaterial({ map: tex, bumpMap: tex, bumpScale: 3.2, roughness: 0.96, metalness: 0, color: C('#fff0d4') }))
  m.rotation.set(0.15, Math.PI * 1.5, 0.05); m.castShadow = false; m.receiveShadow = false
  g.add(m)
  return g
}

/** The night launcher icon, stylised: a slim crescent of clear glass with a soft yellow gradient inside,
 *  pillowy bevels, opening to the upper left (the lit side at the bottom right). */
export function moon5(o = {}) {
  // the crescent outline: the outer circle's arc away from the cut, then the cutting circle's arc back
  // (o.cut moves the cutting circle further out for a fuller, thicker crescent)
  const cx = o.cut?.[0] ?? -0.4, cy = o.cut?.[1] ?? 0.33, r2 = o.cut?.[2] ?? 0.9
  const d = Math.hypot(cx, cy), ux = cx / d, uy = cy / d
  const along = (1 - r2 * r2 + d * d) / (2 * d), h = Math.sqrt(1 - along * along)
  const P1 = [ux * along - uy * h, uy * along + ux * h], P2 = [ux * along + uy * h, uy * along - ux * h]
  const arc = (ox, oy, r, from, to, through, n) => {
    const ang = (p) => Math.atan2(p[1] - oy, p[0] - ox)
    let a0 = ang(from), a1 = ang(to); const t = Math.atan2(through[1] - oy, through[0] - ox)
    const norm = (x) => ((x % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)
    const ccw = norm(t - a0) < norm(a1 - a0) // does the counter-clockwise way pass through the target?
    const span = ccw ? norm(a1 - a0) : -norm(a0 - a1)
    return Array.from({ length: n + 1 }, (_, i) => { const x = a0 + (span * i) / n; return [ox + Math.cos(x) * r, oy + Math.sin(x) * r] })
  }
  const outer = arc(0, 0, 1, P1, P2, [-ux, -uy], 160)
  const inner = arc(cx, cy, r2, P2, P1, [cx - ux * r2, cy - uy * r2], 160)
  const sh = new THREE.Shape()
  ;[...outer, ...inner.slice(1, -1)].forEach(([x, y], i) => (i ? sh.lineTo(x, y) : sh.moveTo(x, y)))
  sh.closePath()
  const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.2, bevelEnabled: true, bevelThickness: 0.16, bevelSize: 0.08, bevelSegments: 20, curveSegments: 12 }).center()
  geo.computeVertexNormals()
  // gradient: pale cream at the thin tips, warm yellow at the full bottom-right
  const pos = geo.attributes.position, col = new Float32Array(pos.count * 3)
  const a = new THREE.Color('#fff8dc'), b = new THREE.Color('#ffc93d'), c = new THREE.Color()
  for (let i = 0; i < pos.count; i++) {
    const k = THREE.MathUtils.clamp((pos.getX(i) - pos.getY(i) + 0.4) / 1.9, 0, 1)
    c.copy(a).lerp(b, k); col.set([c.r, c.g, c.b], i * 3)
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
  const mat = new THREE.MeshPhysicalMaterial({
    color: C('#ffffff'), vertexColors: true, transmission: 0.72, thickness: 0.9, ior: 1.45, roughness: 0.06,
    attenuationColor: C('#ffd45e'), attenuationDistance: 1.6, clearcoat: 1, clearcoatRoughness: 0.03,
    iridescence: 0.35, iridescenceIOR: 1.3, sheen: 0.5, sheenColor: C('#fff1b8'), envMapIntensity: 1.5, specularIntensity: 1
  })
  const m = mesh(geo, mat, [0, 0, 0], [0.12, -0.28, 0.08])
  m.castShadow = false
  const g = new THREE.Group(); g.add(m)
  return g
}

/** Launcher flower: five plump, rounded glass petals (rose at the tips, cream at the heart) and a glossy golden centre. */
export function flower5() {
  const g = new THREE.Group()
  const petal = new THREE.Shape()
  petal.moveTo(0, 0.12)
  petal.bezierCurveTo(0.42, 0.28, 0.52, 0.9, 0, 1.08)
  petal.bezierCurveTo(-0.52, 0.9, -0.42, 0.28, 0, 0.12)
  const geo = new THREE.ExtrudeGeometry(petal, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.13, bevelSize: 0.1, bevelSegments: 18, curveSegments: 40 })
  geo.computeVertexNormals()
  const pos = geo.attributes.position, col = new Float32Array(pos.count * 3)
  const a = new THREE.Color('#fff4e6'), b = new THREE.Color('#ff8fb4'), c = new THREE.Color()
  for (let i = 0; i < pos.count; i++) {
    const k = THREE.MathUtils.clamp((pos.getY(i) - 0.15) / 0.95, 0, 1)
    c.copy(a).lerp(b, Math.pow(k, 0.8)); col.set([c.r, c.g, c.b], i * 3)
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
  const mat = new THREE.MeshPhysicalMaterial({
    color: C('#ffffff'), vertexColors: true, transmission: 0.68, thickness: 0.8, ior: 1.45, roughness: 0.05,
    attenuationColor: C('#ff9ec0'), attenuationDistance: 1.8, clearcoat: 1, clearcoatRoughness: 0.03,
    iridescence: 0.3, iridescenceIOR: 1.3, sheen: 0.5, sheenColor: C('#ffe0ec'), envMapIntensity: 1.5, specularIntensity: 1
  })
  for (let i = 0; i < 5; i++) {
    const holder = new THREE.Group()
    holder.rotation.z = (i / 5) * Math.PI * 2
    const p = new THREE.Mesh(geo, mat)
    p.rotation.x = 0.22 // the petals cup a little toward the viewer
    p.position.z = -0.05 * (i % 2)
    p.castShadow = false
    holder.add(p)
    g.add(holder)
  }
  const heart = new THREE.Mesh(new THREE.SphereGeometry(0.27, 64, 48), new THREE.MeshPhysicalMaterial({
    color: C('#ffc93d'), roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.04, sheen: 0.6, sheenColor: C('#fff2b0'), envMapIntensity: 1.4
  }))
  heart.scale.z = 0.7
  heart.position.z = 0.22
  g.add(heart)
  g.rotation.set(0.18, -0.2, 0.12)
  return g
}

/** "Гулбоғи эҷод": an open book with lines of verse, a feather quill with a gold nib and a small flower. */
export function verse2() {
  const { petalGeo, placePetal } = D()
  const g = new THREE.Group()
  const cover = glossy('#6b3fc8', { roughness: 0.18, irid: 0.25 })
  const paper = glossy('#fff8f2', { roughness: 0.45 })
  const ink = glossy('#b7a3e6', { roughness: 0.5 })
  // the cover under both halves, and the two page blocks opening like a shallow V
  g.add(mesh(new RoundedBoxGeometry(2.3, 0.08, 1.5, 4, 0.035), cover, [0, 0.04, 0]))
  for (const side of [-1, 1]) {
    const half = new THREE.Group()
    half.add(mesh(new RoundedBoxGeometry(1.06, 0.14, 1.36, 4, 0.05), paper, [side * 0.55, 0, 0]))
    for (let r = 0; r < 6; r++) {
      const w = r % 3 === 2 ? 0.5 : 0.76
      half.add(mesh(new RoundedBoxGeometry(w, 0.012, 0.045, 2, 0.006), ink, [side * 0.55 - side * (0.76 - w) / 2, 0.075, -0.45 + r * 0.17]))
    }
    half.position.y = 0.15
    half.rotation.z = side * -0.1
    g.add(half)
  }
  g.add(mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.38, 16), gold(), [0, 0.12, 0], [Math.PI / 2, 0, 0]))
  // the feather: a curved vane in pink to lilac, its shaft ending in a gold nib touching the right page
  const vane = new THREE.Shape()
  vane.moveTo(0, 0)
  vane.bezierCurveTo(0.28, 0.25, 0.3, 0.95, 0.06, 1.45)
  vane.bezierCurveTo(-0.05, 1.2, -0.2, 0.6, 0, 0)
  const vg = new THREE.ExtrudeGeometry(vane, { depth: 0.02, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 6, curveSegments: 40 })
  const pos = vg.attributes.position, col = new Float32Array(pos.count * 3)
  const ca = new THREE.Color('#ffd1e6'), cb = new THREE.Color('#a77bf0'), cc = new THREE.Color()
  for (let i = 0; i < pos.count; i++) { cc.copy(ca).lerp(cb, THREE.MathUtils.clamp(pos.getY(i) / 1.45, 0, 1)); col.set([cc.r, cc.g, cc.b], i * 3) }
  vg.setAttribute('color', new THREE.BufferAttribute(col, 3))
  const quill = new THREE.Group()
  quill.add(mesh(vg, glossy('#ffffff', { vertexColors: true, roughness: 0.3, sheen: 0.6, sheenColor: '#ffe6f4', irid: 0.2 })))
  const shaft = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, -0.35, 0.02), new THREE.Vector3(0.04, 0.6, 0.02), new THREE.Vector3(0.06, 1.42, 0.02))
  quill.add(mesh(new THREE.TubeGeometry(shaft, 24, 0.018, 8), glossy('#fff3e6')))
  quill.add(mesh(new THREE.ConeGeometry(0.035, 0.16, 16), gold(), [0, -0.42, 0.02], [Math.PI, 0, 0]))
  quill.scale.setScalar(0.78)
  quill.position.set(0.6, 0.58, 0.05)
  quill.rotation.set(0.1, 0.3, -0.55)
  g.add(quill)
  // a small flower resting on the left page
  const petalsMat = glossy('#ffffff', { vertexColors: true, roughness: 0.28, side: THREE.DoubleSide, sheen: 0.3, sheenColor: '#ffd9fb', irid: 0.15 })
  const f = new THREE.Group()
  for (let i = 0; i < 8; i++) { const m = new THREE.Mesh(petalGeo({ length: 0.5, width: 0.22, cup: 0.35, curl: -0.12, colors: ['#c2185b', '#f06292', '#ffd0e4'], ruffle: 0.015 }), petalsMat); placePetal(m, (i / 8) * Math.PI * 2, 0.3); m.updateMatrix = () => {}; f.add(m) }
  for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(petalGeo({ length: 0.3, width: 0.18, cup: 0.4, curl: 0.1, colors: ['#c2185b', '#f06292', '#ffd0e4'], ruffle: 0.012 }), petalsMat); placePetal(m, (i / 6) * Math.PI * 2 + 0.3, 0.75); m.updateMatrix = () => {}; f.add(m) }
  f.add(mesh(new THREE.SphereGeometry(0.09, 32, 20), glossy('#f2b630', { roughness: 0.4, sheen: 1, sheenColor: '#fff2b8' }), [0, 0.05, 0], [0, 0, 0], [1, 0.55, 1]))
  f.position.set(-0.62, 0.32, 0.38); f.rotation.set(0.25, 0, 0.12); f.scale.setScalar(0.6)
  g.add(f)
  return g
}

/** A magnifying glass without its glass (the page draws the lens): rose-gold rim, plum handle. */
export function magnifier() {
  const g = new THREE.Group()
  const rose = new THREE.MeshPhysicalMaterial({ color: C('#e8b4a0'), metalness: 1, roughness: 0.16, clearcoat: 0.8, clearcoatRoughness: 0.08, envMapIntensity: 1.6 })
  const plum = glossy('#6a3a66', { roughness: 0.22, irid: 0.15 })
  // the rim: a rounded ring with a thin inner bevel
  g.add(mesh(new THREE.TorusGeometry(1.0, 0.085, 48, 160), rose))
  g.add(mesh(new THREE.TorusGeometry(0.93, 0.025, 24, 160), rose, [0, 0, 0.02]))
  // the neck and the handle, down to the right
  const arm = new THREE.Group()
  arm.add(mesh(new THREE.CylinderGeometry(0.075, 0.09, 0.32, 32), rose, [0, -1.2, 0]))
  arm.add(mesh(new THREE.TorusGeometry(0.1, 0.03, 16, 48), rose, [0, -1.37, 0], [Math.PI / 2, 0, 0]))
  arm.add(mesh(new THREE.CapsuleGeometry(0.115, 1.05, 12, 32), plum, [0, -2.0, 0]))
  arm.add(mesh(new THREE.TorusGeometry(0.118, 0.022, 16, 48), rose, [0, -2.42, 0], [Math.PI / 2, 0, 0]))
  arm.rotation.z = Math.PI / 4
  g.add(arm)
  g.rotation.set(0.12, -0.18, 0)
  return g
}

export function buildKind2(job) {
  const many = (fn, list) => { const g = new THREE.Group(); for (const f of list) { const b = fn(f); b.position.fromArray(f.pos ?? [0, 0, 0]); b.rotation.fromArray(f.rot ?? [0, 0, 0]); b.scale.setScalar(f.scale ?? 1); g.add(b) } return g }
  switch (job.kind) {
    case 'crocus2': return many(crocus2, job.flowers ?? [{}])
    case 'lotus2': return many(lotus2, job.flowers ?? [{}])
    case 'tulip2': return many(tulip2, job.flowers ?? [{}])
    case 'leaves2': return many(leaves2, job.items ?? [{}])
    case 'crystals2': return many(crystals2, job.items ?? [{}])
    case 'petals2': return many(petals2, job.items ?? [{}])
    case 'mosque2': return mosque2()
    case 'heart2': return heart2()
    case 'culture2': return culture2()
    case 'house2': return house2()
    case 'plant2': return plant2()
    case 'star2': return star2()
    case 'bulb2': return bulb2()
    case 'family3': return family3()
    case 'health3': return health3()
    case 'growth3': return growth3()
    case 'words3': return words3()
    case 'clock3': return clock3()
    case 'girl3': return girl3()
    case 'track3': return track3()
    case 'clock4': return clock4()
    case 'girl4': return girl4()
    case 'track4': return track4()
    case 'moon4': return moon4()
    case 'moon5': return moon5(job)
    case 'flower5': return flower5()
    case 'verse2': return verse2()
    case 'magnifier': return magnifier()
    default: return null
  }
}
