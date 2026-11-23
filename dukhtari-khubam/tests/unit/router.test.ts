import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { fromDatabase } from '@/lib/http'
import { dispatch, route } from '@/lib/router'

const routes = [
  route({ method: 'GET', path: '/things/:id', access: 'public', tag: 't', summary: 's', handler: async ({ params }) => ({ id: params.id }) }),
  route({ method: 'POST', path: '/things', access: 'user', tag: 't', summary: 's', body: z.strictObject({ name: z.string().min(1) }), handler: async ({ body }) => body }),
  route({ method: 'GET', path: '/kept', access: 'public', tag: 't', summary: 's', cache: 300, handler: async () => ({ ready: true }) }),
  route({ method: 'GET', path: '/boom', access: 'public', tag: 't', summary: 's', handler: async () => { throw fromDatabase({ code: 'P0001', message: 'premium_required' }) } })
]
const req = (method: string, path: string, init: RequestInit = {}) => new Request(`https://x.test/api/v1${path}`, { method, ...init })

describe('router', () => {
  it('matches params and caches anonymous GETs', async () => {
    const res = await dispatch(routes, req('GET', '/things/42'), '/things/42')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ id: '42' })
    expect(res.headers.get('cache-control')).toBe('private, no-store')
  })
  it('a public answer the CDN keeps is readable by the app, even when the website asked for it first', async () => {
    const res = await dispatch(routes, req('GET', '/kept'), '/kept')
    expect(res.headers.get('cache-control')).toMatch(/^public/)
    expect(res.headers.get('access-control-allow-origin')).toBe('*')
    expect(res.headers.get('vary')).toBe('origin')
  })
  it('returns 404, 405, 401 and 422 with the error model', async () => {
    expect((await dispatch(routes, req('GET', '/nope'), '/nope')).status).toBe(404)
    expect((await dispatch(routes, req('DELETE', '/things/1'), '/things/1')).status).toBe(405)
    const unauth = await dispatch(routes, req('POST', '/things', { body: '{}' }), '/things')
    expect(unauth.status).toBe(401)
    expect((await unauth.json()).error.code).toBe('auth_required')
    const invalid = await dispatch(routes, req('POST', '/things', { body: '{"name":""}', headers: { authorization: 'Bearer a.b.c' } }), '/things')
    expect(invalid.status).toBe(422)
  })
  it('maps database errors without leaking SQL', async () => {
    const res = await dispatch(routes, req('GET', '/boom'), '/boom')
    expect(res.status).toBe(403)
    expect((await res.json()).error.code).toBe('premium_required')
    expect(fromDatabase({ code: '42501', message: 'permission denied for table quiz_answer_keys' }).status).toBe(403)
    expect(fromDatabase({ code: 'XX000', message: 'secret internal detail' }).message).not.toContain('secret')
    expect(fromDatabase({ code: 'P0001', message: 'version_conflict', details: '{"current_version":3}' }).details).toEqual({ current_version: 3 })
  })
})
