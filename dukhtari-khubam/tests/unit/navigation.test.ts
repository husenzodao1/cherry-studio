import { readFileSync } from 'node:fs'

import { describe, expect, it, vi } from 'vitest'

import { distanceText, leftFrom, metres, nextTurn, offLine, timeText, turnAngle, turnKey, type NavRoute } from '@/lib/navigation'
import { findPlaces, findRoute, routeOf } from '@/server/navigate'

// a real walk in Dushanbe, as the route service answered it
const osrm = JSON.parse(readFileSync('tests/unit/fixtures/osrm-dushanbe.json', 'utf8'))
const res = (body: unknown, ok = true) => ({ ok, status: ok ? 200 : 503, json: async () => body }) as Response

describe('"Маро бубар": the way and its turns', () => {
  const route = routeOf(osrm) as NavRoute

  it('reads the route service: the line as [lat, lon], every turn with its street (Tajik names kept)', () => {
    expect(route.distance).toBeGreaterThan(3000)
    expect(route.line[0][0]).toBeCloseTo(38.57, 1)
    expect(route.line[0][1]).toBeCloseTo(68.78, 1)
    expect(route.steps[0].type).toBe('depart')
    expect(route.steps.at(-1)!.type).toBe('arrive')
    expect(route.steps.map((s) => s.name)).toContain('кӯчаи Шероз')
    expect(routeOf({ code: 'NoRoute' })).toBeNull()
  })

  it('follows her: on the line she is near it; the next turn moves on as she passes each one; far from it she is off the way', () => {
    const start = route.line[0]
    expect(offLine(start, route.line).metres).toBeLessThan(5)
    expect(nextTurn(route, start, 1)).toBe(1)
    // at the fourth turn: the next is the one after it
    expect(nextTurn(route, route.steps[3].at, 1)).toBe(4)
    // half a kilometre away from every street of it
    const away: [number, number] = [start[0] + 0.006, start[1] - 0.006]
    expect(offLine(away, route.line).metres).toBeGreaterThan(45)
    expect(metres([38.5598, 68.787], [38.5698, 68.787])).toBeCloseTo(1112, -1)
  })

  it('says the turns and the distances as a walker needs them', () => {
    expect(turnKey({ type: 'turn', modifier: 'left' })).toBe('nav.left')
    expect(turnKey({ type: 'new name', modifier: 'slight right' })).toBe('nav.slight_right')
    expect(turnKey({ type: 'roundabout', modifier: 'right' })).toBe('nav.roundabout')
    expect(turnKey({ type: 'arrive', modifier: null })).toBe('nav.arrive')
    expect(turnAngle({ type: 'turn', modifier: 'sharp right' })).toBe(135)
    const u = { m: 'м', km: 'км', min: 'дақ', h: 'соат' }
    expect(distanceText(42, u)).toBe('40 м')
    expect(distanceText(437, u)).toBe('440 м')
    expect(distanceText(1450, u)).toBe('1.4 км')
    expect(timeText(3021, u)).toBe('50 дақ')
    expect(timeText(4000, u)).toBe('1 соат 07 дақ')
    expect(leftFrom(route, 1, 0).metres).toBeGreaterThan(3000)
  })

  it('asks the free map services by name, near her first; a silent service is an error, no route is null', async () => {
    const get = vi.fn(async (url: string, _init?: RequestInit) => res(url.includes('nominatim')
      ? [{ lat: '38.5755', lon: '68.7864', name: 'Донишгоҳи миллии Тоҷикистон', display_name: 'Донишгоҳи миллии Тоҷикистон, хиёбони Рӯдакӣ, Душанбе, Тоҷикистон' }]
      : osrm))
    const places = await findPlaces('донишгоҳи миллӣ', [38.56, 68.78], 'tg', get as unknown as typeof fetch)
    expect(places).toEqual([{ name: 'Донишгоҳи миллии Тоҷикистон', address: 'хиёбони Рӯдакӣ, Душанбе, Тоҷикистон', lat: 38.5755, lon: 68.7864 }])
    expect(get.mock.calls[0][0]).toContain('accept-language=tg%2Cru%2Cen')
    expect(get.mock.calls[0][0]).toContain('viewbox=')
    expect(get.mock.calls[0][1]?.headers).toMatchObject({ 'user-agent': expect.stringContaining('LifeHub') })
    const way = await findRoute([38.57, 68.78], [38.56, 68.79], 'foot', get as unknown as typeof fetch)
    expect(get.mock.calls[1][0]).toContain('routing.openstreetmap.de/routed-foot/route/v1/driving/68.78,38.57;68.79,38.56')
    expect(way?.steps.length).toBe(route.steps.length)
    await expect(findRoute([38.57, 68.78], [38.56, 68.79], 'car', (async () => res({}, false)) as unknown as typeof fetch)).rejects.toThrow()
  })
})
