/**
 * "Маро бубар": following her along a route — where she is on its line, which turn comes next and how far it
 * is, when she has left the way (a new route is asked), and the words to say for each turn.
 */

export type LatLon = [number, number]
export interface NavStep { type: string; modifier: string | null; name: string; distance: number; duration: number; at: LatLon; exit: number | null }
export interface NavRoute { distance: number; duration: number; line: LatLon[]; steps: NavStep[] }

const R = 6371000
const rad = (d: number) => (d * Math.PI) / 180

/** metres between two places */
export function metres(a: LatLon, b: LatLon): number {
  const dLat = rad(b[0] - a[0]), dLon = rad(b[1] - a[1])
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** how far she is from the route's line (metres), and the index of the stretch she is on */
export function offLine(p: LatLon, line: LatLon[]): { metres: number; at: number } {
  let best = { metres: Infinity, at: 0 }
  // flat around her: good enough over a few kilometres
  const kx = Math.cos(rad(p[0])) * 111320, ky = 110540
  for (let i = 0; i < line.length - 1; i++) {
    const ax = (line[i][1] - p[1]) * kx, ay = (line[i][0] - p[0]) * ky
    const bx = (line[i + 1][1] - p[1]) * kx, by = (line[i + 1][0] - p[0]) * ky
    const dx = bx - ax, dy = by - ay
    const t = dx || dy ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy))) : 0
    const d = Math.hypot(ax + t * dx, ay + t * dy)
    if (d < best.metres) best = { metres: d, at: i }
  }
  return best
}

/** a turn is passed once she is this close to it */
export const PASSED_M = 18
/** she has left the way: this far from its line (twice in a row) */
export const OFF_ROUTE_M = 45

/**
 * The next turn ahead of her: from `from` on, the first not yet reached. A turn counts as reached when she
 * comes within PASSED_M of it, or when she is already on the line beyond it.
 */
export function nextTurn(route: NavRoute, p: LatLon, from: number): number {
  const on = offLine(p, route.line).at
  let i = Math.max(1, from)
  while (i < route.steps.length - 1) {
    const s = route.steps[i]
    const where = offLine(s.at, route.line).at
    if (metres(p, s.at) < PASSED_M || where < on) i++
    else break
  }
  return Math.min(i, route.steps.length - 1)
}

/** "120 m", "1.4 km" — rounded as a driver or walker needs it */
export function distanceText(m: number, units: { m: string; km: string }): string {
  if (m < 1000) return `${m < 100 ? Math.max(5, Math.round(m / 5) * 5) : Math.round(m / 10) * 10} ${units.m}`
  return `${(m / 1000).toFixed(m < 10_000 ? 1 : 0)} ${units.km}`
}

/** "12 min", "1 h 05 min" */
export function timeText(s: number, units: { min: string; h: string }): string {
  const min = Math.max(1, Math.round(s / 60))
  return min < 60 ? `${min} ${units.min}` : `${Math.floor(min / 60)} ${units.h} ${String(min % 60).padStart(2, '0')} ${units.min}`
}

/** which words a turn takes (keys of the app's texts: nav.left, nav.roundabout, nav.arrive…) */
export function turnKey(s: Pick<NavStep, 'type' | 'modifier'>): string {
  if (s.type === 'arrive') return 'nav.arrive'
  if (s.type === 'depart') return 'nav.depart'
  if (s.type === 'roundabout' || s.type === 'rotary' || s.type === 'roundabout turn') return 'nav.roundabout'
  const m = s.modifier ?? 'straight'
  return {
    left: 'nav.left', right: 'nav.right', 'slight left': 'nav.slight_left', 'slight right': 'nav.slight_right',
    'sharp left': 'nav.sharp_left', 'sharp right': 'nav.sharp_right', uturn: 'nav.uturn', straight: 'nav.straight'
  }[m] ?? 'nav.straight'
}

/** the arrow a turn shows: degrees to turn the "up" arrow by */
export function turnAngle(s: Pick<NavStep, 'type' | 'modifier'>): number {
  if (s.type === 'arrive' || s.type === 'depart') return 0
  return ({ left: -90, right: 90, 'slight left': -45, 'slight right': 45, 'sharp left': -135, 'sharp right': 135, uturn: 180 } as Record<string, number>)[s.modifier ?? ''] ?? 0
}

/** what is left of the way from the turn she heads for */
export function leftFrom(route: NavRoute, next: number, toNext: number): { metres: number; seconds: number } {
  const rest = route.steps.slice(next)
  const m = toNext + rest.reduce((n, s) => n + s.distance, 0)
  const speed = route.duration ? route.distance / route.duration : 1.3
  return { metres: m, seconds: m / Math.max(0.5, speed) }
}
