import { z } from 'zod'

import type { AnyRoute } from './router'

const schema = (s: z.ZodType) => {
  const out = z.toJSONSchema(s, { io: 'input', unrepresentable: 'any' }) as Record<string, unknown>
  delete out.$schema
  return out
}

/** OpenAPI 3.1 document generated from the same route table that serves requests. */
export function buildOpenApi(routes: AnyRoute[], serverUrl = '/api/v1') {
  const paths: Record<string, Record<string, unknown>> = {}
  for (const r of routes) {
    const path = r.path.replace(/:([A-Za-z]+)/g, '{$1}')
    const params: unknown[] = [...r.path.matchAll(/:([A-Za-z]+)/g)].map((m) => ({
      name: m[1], in: 'path', required: true, schema: { type: 'string' }
    }))
    if (r.query) {
      const q = schema(r.query) as { properties?: Record<string, unknown>; required?: string[] }
      for (const [name, s] of Object.entries(q.properties ?? {})) {
        params.push({ name, in: 'query', required: q.required?.includes(name) ?? false, schema: s })
      }
    }
    const op: Record<string, unknown> = {
      tags: [r.tag],
      summary: r.summary,
      operationId: `${r.method.toLowerCase()}${r.path.replace(/[/:-](\w)/g, (_, c: string) => c.toUpperCase())}`,
      parameters: params,
      responses: {
        [String(r.status ?? 200)]: { description: r.status === 204 ? 'No content' : 'OK' },
        default: { description: 'Error', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } }
      }
    }
    if (r.access !== 'public') op.security = [{ bearerAuth: [] }]
    if (r.access === 'staff') op.description = 'Requires a staff role; permissions are enforced in the database.'
    if (r.body) op.requestBody = { required: true, content: { 'application/json': { schema: schema(r.body) } } }
    paths[path] = { ...(paths[path] ?? {}), [r.method.toLowerCase()]: op }
  }
  return {
    openapi: '3.1.0',
    info: {
      title: 'Духтари хубам API',
      version: '1.0.0',
      description:
        'One backend for Android, Web and the Admin Panel. Authenticate with Supabase Auth and send the access token as a Bearer token.'
    },
    servers: [{ url: serverUrl }],
    components: {
      securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'object',
              properties: { code: { type: 'string' }, message: { type: 'string' }, details: {} },
              required: ['code', 'message']
            }
          }
        }
      }
    },
    paths
  }
}
