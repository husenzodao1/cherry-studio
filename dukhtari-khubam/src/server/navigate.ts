/**
 * "Маро бубар" (Premium): where she wants to go, found on OpenStreetMap (Nominatim), and the way there on foot
 * or by car with every turn (OSRM, the FOSSGIS servers of openstreetmap.de). Both are free services with
 * fair-use rules: the app names itself, asks little (her search as she stops typing, a route when she starts
 * or leaves it), and says "© OpenStreetMap" on the map. Another provider can take their place here alone.
 */

const AGENT = 'LifeHub/1.0 (educational app; navigation)'
const WAIT_MS = 8000

export interface Place { name: string; address: string; lat: number; lon: number }
export interface Step {
  /** OSRM's maneuver: turn, new name, depart, arrive, merge, fork, end of road, roundabout, rotary, continue… */
  type: string
  /** left, right, slight left, slight right, sharp left, sharp right, straight, uturn */
  modifier: string | null
  /** the street she turns onto */
  name: string
  /** metres and seconds of the stretch after the turn */
  distance: number
  duration: number
  /** where the turn is: [lat, lon] */
  at: [number, number]
  /** a roundabout's exit */
  exit: number | null
}
export interface Route { distance: number; duration: number; line: [number, number][]; steps: Step[] }

const get = async (url: string, fetcher: typeof fetch) => {
  const res = await fetcher(url, { headers: { 'user-agent': AGENT, accept: 'application/json' }, signal: AbortSignal.timeout(WAIT_MS) })
  if (!res.ok) throw new Error(`navigation service ${res.status}`)
  return res.json() as Promise<unknown>
}

/** her words as a map may know them: as said, in Russian letters, "бозор" as "базар", without the city part */
export function variantsOf(q: string): string[] {
  const base = q.replace(/\s+/g, ' ').trim()
  const toRu = (s: string) => s.replace(/ҳ/g, 'х').replace(/Ҳ/g, 'Х').replace(/қ/g, 'к').replace(/Қ/g, 'К').replace(/ҷ/g, 'дж').replace(/Ҷ/g, 'Дж')
    .replace(/ғ/g, 'г').replace(/Ғ/g, 'Г').replace(/ӣ/g, 'и').replace(/Ӣ/g, 'И').replace(/ӯ/g, 'у').replace(/Ӯ/g, 'У')
  const bazaar = (s: string) => s.replace(/бозор/gi, 'базар')
  const firstPart = base.split(',')[0].trim()
  const out = [base, toRu(base), bazaar(toRu(base)), firstPart, bazaar(toRu(firstPart))]
  return [...new Set(out.filter((v) => v.length >= 2))]
}

interface PhotonFeature { geometry: { coordinates: [number, number] }; properties: { name?: string; street?: string; city?: string; district?: string; county?: string; country?: string } }

/** Photon (komoot): forgiving with words and typos, the nearest to her first */
async function photon(q: string, near: [number, number] | null, fetcher: typeof fetch): Promise<Place[]> {
  const params = new URLSearchParams({ q, limit: '7' })
  if (near) { params.set('lat', String(near[0])); params.set('lon', String(near[1])) }
  const d = (await get(`https://photon.komoot.io/api/?${params}`, fetcher)) as { features?: PhotonFeature[] }
  return (d.features ?? []).map((f) => {
    const p = f.properties
    return { name: p.name ?? p.street ?? q, address: [p.street, p.district, p.city ?? p.county, p.country].filter(Boolean).join(', '), lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0] }
  }).filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon))
}

/** Nominatim (OpenStreetMap's own search), in her language first, around her (about 60 km) */
async function nominatim(q: string, near: [number, number] | null, lang: string, fetcher: typeof fetch): Promise<Place[]> {
  const params = new URLSearchParams({ q, format: 'jsonv2', limit: '7', addressdetails: '0', 'accept-language': `${lang},ru,en` })
  if (near) params.set('viewbox', [near[1] - 0.6, near[0] + 0.5, near[1] + 0.6, near[0] - 0.5].join(','))
  const rows = (await get(`https://nominatim.openstreetmap.org/search?${params}`, fetcher)) as { lat: string; lon: string; name?: string; display_name: string }[]
  return rows.map((r) => {
    const parts = r.display_name.split(', ')
    return { name: r.name || parts[0], address: parts.slice(1, 4).join(', '), lat: Number(r.lat), lon: Number(r.lon) }
  }).filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon))
}

const far = (a: [number, number], p: Place) => Math.hypot(a[0] - p.lat, (a[1] - p.lon) * Math.cos((a[0] * Math.PI) / 180))

/**
 * Places named like her words, near her first: Photon, then OpenStreetMap's own search, each tried with the
 * words as said and as a map may know them (Russian letters, "базар", without the city), until one is found.
 */
export async function findPlaces(q: string, near: [number, number] | null, lang: string, fetcher: typeof fetch = fetch): Promise<Place[]> {
  for (const v of variantsOf(q)) {
    const found = [...(await photon(v, near, fetcher).catch(() => [] as Place[])), ...(await nominatim(v, near, lang, fetcher).catch(() => [] as Place[]))]
    const seen = new Set<string>()
    const unique = found.filter((p) => {
      const k = `${p.lat.toFixed(3)},${p.lon.toFixed(3)}`
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
    if (unique.length) return (near ? unique.sort((a, b) => far(near, a) - far(near, b)) : unique).slice(0, 7)
  }
  return []
}

interface OsrmStep { distance: number; duration: number; name: string; maneuver: { type: string; modifier?: string; location: [number, number]; exit?: number } }
interface Osrm { code: string; routes?: { distance: number; duration: number; geometry: { coordinates: [number, number][] }; legs: { steps: OsrmStep[] }[] }[] }

/** OSRM's answer as the app's route: the line as [lat, lon] and her turns */
export function routeOf(osrm: Osrm): Route | null {
  const r = osrm.code === 'Ok' ? osrm.routes?.[0] : undefined
  if (!r) return null
  return {
    distance: Math.round(r.distance),
    duration: Math.round(r.duration),
    line: r.geometry.coordinates.map(([lon, lat]) => [lat, lon]),
    steps: r.legs.flatMap((l) => l.steps).map((s) => ({
      type: s.maneuver.type, modifier: s.maneuver.modifier ?? null, name: s.name ?? '', distance: Math.round(s.distance), duration: Math.round(s.duration),
      at: [s.maneuver.location[1], s.maneuver.location[0]], exit: s.maneuver.exit ?? null
    }))
  }
}

/** the way from here to there: on foot or by car */
export async function findRoute(from: [number, number], to: [number, number], mode: 'foot' | 'car', fetcher: typeof fetch = fetch): Promise<Route | null> {
  const server = mode === 'foot' ? 'routed-foot' : 'routed-car'
  const url = `https://routing.openstreetmap.de/${server}/route/v1/driving/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson&steps=true`
  return routeOf((await get(url, fetcher)) as Osrm)
}
