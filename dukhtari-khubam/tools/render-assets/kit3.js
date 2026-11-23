// Third set: the boys' schools' icons — glossy navy, electric blue and steel, with a little gold;
// solid, simple shapes that read at a glance, lit like the girls' icons (same studio, same matte pass).
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'

const C = (c) => new THREE.Color(c)
const glossy = (color, o = {}) => new THREE.MeshPhysicalMaterial({
  color: C(color), roughness: o.roughness ?? 0.2, metalness: o.metalness ?? 0, clearcoat: 1, clearcoatRoughness: o.cc ?? 0.05,
  sheen: o.sheen ?? 0.25, sheenColor: C('#ffffff'), envMapIntensity: o.env ?? 1.2, flatShading: !!o.flat,
  emissive: C(o.emissive ?? '#000000'), emissiveIntensity: o.emissiveIntensity ?? 0
})
const metal = (color = '#eab964', roughness = 0.32) => new THREE.MeshPhysicalMaterial({ color: C(color), metalness: 1, roughness, clearcoat: 0.6, envMapIntensity: 1.5 })
const glass = (tint = '#bfe0ff') => new THREE.MeshPhysicalMaterial({
  color: C('#ffffff'), transmission: 1, thickness: 0.3, ior: 1.5, roughness: 0.03, attenuationColor: C(tint), attenuationDistance: 1.2,
  clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.6, iridescence: 0.4, iridescenceIOR: 1.3
})
const mesh = (geo, mat, pos = [0, 0, 0], rot = [0, 0, 0], scale = 1) => {
  const m = new THREE.Mesh(geo, mat); m.position.fromArray(pos); m.rotation.fromArray(rot)
  typeof scale === 'number' ? m.scale.setScalar(scale) : m.scale.fromArray(scale)
  m.castShadow = true; m.receiveShadow = true; return m
}
const lathe = (profile, seg = 96) => new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), seg)
const rbox = (w, h, d, r = 0.04) => new RoundedBoxGeometry(w, h, d, 6, r)
const NAVY = '#1e3a8a', BLUE = '#2563eb', SKY = '#38bdf8', STEEL = '#cfd8e6', WHITE = '#f4f7fc'

function star(r1 = 1, r0 = 0.45, depth = 0.18, n = 5) {
  const sh = new THREE.Shape()
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? r0 : r1, a = Math.PI / 2 + (i * Math.PI) / n
    i ? sh.lineTo(Math.cos(a) * r, Math.sin(a) * r) : sh.moveTo(Math.cos(a) * r, Math.sin(a) * r)
  }
  sh.closePath()
  const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 6 })
  g.center(); return g
}

/** Одоби умумӣ: two hardcover books and a graduation cap on them */
function books() {
  const g = new THREE.Group()
  const book = (w, h, d, cover, y, rot) => {
    const b = new THREE.Group()
    b.add(mesh(rbox(w, h, d, 0.03), glossy(cover)))
    b.add(mesh(rbox(w - 0.08, h - 0.07, d * 0.97, 0.01), glossy(WHITE, { roughness: 0.5 }), [0.05, 0, 0]))
    for (const x of [-w / 2 + 0.1, -w / 2 + 0.22]) b.add(mesh(new THREE.BoxGeometry(0.04, h * 1.01, d * 1.01), metal(), [x, 0, 0]))
    b.position.y = y; b.rotation.y = rot; return b
  }
  g.add(book(1.5, 0.26, 1.05, NAVY, 0.13, 0.08))
  g.add(book(1.35, 0.22, 0.95, BLUE, 0.38, -0.16))
  // the cap: a board on a band, a tassel hanging at the side
  const cap = new THREE.Group()
  cap.add(mesh(lathe([[0, 0], [0.36, 0], [0.38, 0.05], [0.36, 0.24], [0, 0.24]]), glossy('#111a33')))
  cap.add(mesh(rbox(1.05, 0.05, 1.05, 0.02), glossy('#141d38', { roughness: 0.35 }), [0, 0.27, 0], [0, Math.PI / 4, 0]))
  cap.add(mesh(new THREE.SphereGeometry(0.05, 24, 16), metal(), [0, 0.31, 0]))
  const cord = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.31, 0), new THREE.Vector3(0.36, 0.3, 0.05), new THREE.Vector3(0.6, 0.24, 0.1), new THREE.Vector3(0.66, 0.02, 0.12)])
  cap.add(mesh(new THREE.TubeGeometry(cord, 40, 0.016, 8), metal()))
  cap.add(mesh(lathe([[0.001, 0], [0.05, 0.02], [0.06, 0.16], [0.03, 0.2], [0.001, 0.2]]), metal(), [0.66, -0.16, 0.12]))
  cap.position.set(0.05, 0.5, 0); cap.rotation.set(0.05, 0.3, -0.05)
  g.add(cap)
  return g
}

/** Писар дар ҷамъият: three figures side by side, the middle one taller */
function society() {
  const g = new THREE.Group()
  const person = (x, s, color) => {
    const p = new THREE.Group()
    p.add(mesh(lathe([[0, 0], [0.34, 0], [0.38, 0.06], [0.36, 0.42], [0.28, 0.62], [0.12, 0.7], [0, 0.7]]), glossy(color)))
    p.add(mesh(new THREE.SphereGeometry(0.22, 48, 32), glossy(color), [0, 0.95, 0]))
    p.position.x = x; p.scale.setScalar(s); return p
  }
  g.add(person(-0.62, 0.86, SKY), person(0.62, 0.86, '#6366f1'), person(0, 1.05, BLUE))
  g.children[2].position.z = 0.18
  return g
}

/** Хислатҳои мардона: a shield with a silver star */
function shield() {
  const sh = new THREE.Shape()
  sh.moveTo(0, 1.05)
  sh.bezierCurveTo(0.35, 0.92, 0.62, 0.9, 0.8, 0.86)
  sh.bezierCurveTo(0.82, 0.2, 0.62, -0.55, 0, -1.0)
  sh.bezierCurveTo(-0.62, -0.55, -0.82, 0.2, -0.8, 0.86)
  sh.bezierCurveTo(-0.62, 0.9, -0.35, 0.92, 0, 1.05)
  const g = new THREE.Group()
  const body = new THREE.ExtrudeGeometry(sh, { depth: 0.22, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.09, bevelSegments: 10, curveSegments: 48 })
  body.center()
  g.add(mesh(body, glossy(BLUE, { roughness: 0.16 })))
  const rim = new THREE.ExtrudeGeometry(sh, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 4, curveSegments: 48 })
  rim.center()
  const inner = mesh(rim, glossy(NAVY), [0, 0, 0.17], [0, 0, 0], [0.8, 0.8, 1])
  g.add(inner)
  g.add(mesh(star(0.42, 0.19, 0.08), glossy('#ffffff', { roughness: 0.12 }), [0, 0.04, 0.27]))
  g.rotation.set(-0.12, -0.32, 0)
  return g
}

/** Фарҳанги тоҷик: the crown of the flag with its arc of seven stars, in gold, on a navy disc */
function crown() {
  const g = new THREE.Group()
  g.add(mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.16, 96), glossy(NAVY), [0, 0, 0], [Math.PI / 2, 0, 0]))
  g.add(mesh(new THREE.TorusGeometry(1.1, 0.05, 16, 96), glossy('#f5b931', { roughness: 0.2 })))
  // the crown: a band, three points with balls
  const cr = new THREE.Shape()
  cr.moveTo(-0.5, -0.3); cr.lineTo(0.5, -0.3); cr.lineTo(0.55, 0.05); cr.lineTo(0.3, -0.08); cr.lineTo(0, 0.22); cr.lineTo(-0.3, -0.08); cr.lineTo(-0.55, 0.05); cr.closePath()
  const cg = new THREE.ExtrudeGeometry(cr, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.03, bevelSegments: 5 })
  cg.center()
  g.add(mesh(cg, glossy('#f5b931', { roughness: 0.18, emissive: '#7a4a00', emissiveIntensity: 0.25 }), [0, -0.28, 0.14], [0, 0, 0], 1.25))
  for (const [x, y] of [[-0.69, -0.12], [0, 0.1], [0.69, -0.12]]) g.add(mesh(new THREE.SphereGeometry(0.07, 24, 16), glossy('#ffd45c', { roughness: 0.15 }), [x, y - 0.18, 0.2]))
  for (let i = 0; i < 7; i++) {
    const a = Math.PI * (0.12 + (0.76 * i) / 6)
    g.add(mesh(star(0.13, 0.055, 0.05), glossy('#ffd45c', { roughness: 0.15, emissive: '#7a4a00', emissiveIntensity: 0.2 }), [Math.cos(a) * 0.78, -0.02 + Math.sin(a) * 0.72, 0.14]))
  }
  g.rotation.set(-0.08, -0.25, 0)
  return g
}

/** Замони муосир: a rocket rising */
function rocket() {
  const g = new THREE.Group()
  g.add(mesh(lathe([[0, -0.9], [0.26, -0.88], [0.34, -0.5], [0.36, 0.1], [0.3, 0.55], [0.16, 0.85], [0, 0.98]]), glossy(WHITE, { roughness: 0.18 })))
  g.add(mesh(lathe([[0.001, 0.55], [0.3, 0.55], [0.16, 0.85], [0.001, 0.98]].map(([r, y]) => [r * 1.02, y])), glossy(BLUE)))
  g.add(mesh(new THREE.TorusGeometry(0.15, 0.035, 16, 48), metal('#d9e2ef', 0.12), [0, 0.18, 0.33]))
  g.add(mesh(new THREE.CircleGeometry(0.13, 48), glass('#7cc8ff'), [0, 0.18, 0.345]))
  for (let k = 0; k < 3; k++) {
    const f = new THREE.Shape(); f.moveTo(0, 0); f.lineTo(0.38, -0.32); f.lineTo(0.36, -0.62); f.lineTo(0, -0.42); f.closePath()
    const fg = new THREE.ExtrudeGeometry(f, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 3 })
    const fin = mesh(fg, glossy(NAVY), [0, -0.38, 0]); const holder = new THREE.Group(); fin.position.x = 0.28; holder.add(fin); holder.rotation.y = (k * 2 * Math.PI) / 3 + 0.5; g.add(holder)
  }
  g.add(mesh(lathe([[0.2, -0.88], [0.24, -0.98], [0.16, -1.02], [0.001, -1.02]]), metal('#8b95a7', 0.3)))
  // the flame
  g.add(mesh(lathe([[0.001, -1.0], [0.17, -1.04], [0.12, -1.3], [0.001, -1.55]]), glossy('#ffb020', { emissive: '#ff8a00', emissiveIntensity: 1.6 })))
  g.add(mesh(lathe([[0.001, -1.0], [0.09, -1.04], [0.06, -1.2], [0.001, -1.32]]), glossy('#fff2b0', { emissive: '#ffe680', emissiveIntensity: 2 })))
  g.rotation.set(0.1, 0.3, -0.55)
  return g
}

/** Одоби оиладорӣ: a house — white walls, a navy roof, warm windows, a chimney */
function house() {
  const g = new THREE.Group()
  g.add(mesh(rbox(1.3, 0.9, 1, 0.05), glossy(WHITE, { roughness: 0.35 }), [0, 0.45, 0]))
  const roof = new THREE.Shape(); roof.moveTo(-0.82, 0); roof.lineTo(0, 0.68); roof.lineTo(0.82, 0); roof.closePath()
  const rg = new THREE.ExtrudeGeometry(roof, { depth: 1.18, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 4 })
  rg.center()
  g.add(mesh(rg, glossy(NAVY, { roughness: 0.25 }), [0, 1.14, 0]))
  g.add(mesh(rbox(0.18, 0.4, 0.18, 0.02), glossy('#9fb2d6'), [0.42, 1.38, -0.15]))
  g.add(mesh(rbox(0.3, 0.5, 0.06, 0.02), glossy(BLUE), [0, 0.27, 0.51]))
  g.add(mesh(new THREE.SphereGeometry(0.025, 16, 12), metal(), [0.09, 0.27, 0.55]))
  for (const x of [-0.42, 0.42]) {
    g.add(mesh(rbox(0.28, 0.26, 0.05, 0.015), glossy('#ffd27a', { emissive: '#ffb84d', emissiveIntensity: 0.8 }), [x, 0.55, 0.51]))
    g.add(mesh(new THREE.BoxGeometry(0.3, 0.025, 0.06), glossy(NAVY), [x, 0.55, 0.53]))
  }
  g.add(mesh(new THREE.CylinderGeometry(1.0, 1.05, 0.08, 64), glossy('#bfd3f2'), [0, -0.04, 0]))
  g.rotation.y = -0.45
  return g
}

/** Сахтиҳои ҳаёт: a mountain with a snowy top and a flag on its peak */
function mountain() {
  const g = new THREE.Group()
  const peak = (h, r, x, z, color) => {
    const geo = new THREE.ConeGeometry(r, h, 7, 1); geo.translate(0, h / 2, 0)
    const m = mesh(geo, glossy(color, { flat: true, roughness: 0.3 }), [x, 0, z])
    const snow = new THREE.ConeGeometry(r * 0.36, h * 0.36, 7, 1); snow.translate(0, h - h * 0.18 + 0.005, 0)
    g.add(m, mesh(snow, glossy(WHITE, { flat: true, roughness: 0.4 }), [x, 0, z], [0, 0, 0], [1.03, 1, 1.03]))
  }
  peak(1.7, 0.95, 0, 0, '#3157c9')
  peak(1.1, 0.7, -0.75, 0.25, '#4f7fe0')
  peak(0.9, 0.6, 0.78, 0.3, '#1e3a8a')
  g.add(mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.55, 12), metal('#d9e2ef', 0.15), [0, 1.95, 0]))
  const flag = new THREE.Shape(); flag.moveTo(0, 0); flag.quadraticCurveTo(0.18, 0.06, 0.36, -0.02); flag.lineTo(0.36, -0.24); flag.quadraticCurveTo(0.18, -0.16, 0, -0.22); flag.closePath()
  g.add(mesh(new THREE.ExtrudeGeometry(flag, { depth: 0.02, bevelEnabled: false }), glossy('#ef4444', { roughness: 0.3 }), [0.01, 2.2, 0]))
  g.add(mesh(new THREE.CylinderGeometry(1.15, 1.2, 0.08, 64), glossy('#bfd3f2'), [0, -0.04, 0.1]))
  g.rotation.y = 0.25
  return g
}

export function buildKind3(job) {
  switch (job.kind) {
    case 'b-books': return books()
    case 'b-society': return society()
    case 'b-shield': return shield()
    case 'b-crown': return crown()
    case 'b-rocket': return rocket()
    case 'b-house': return house()
    case 'b-mountain': return mountain()
    default: return null
  }
}
