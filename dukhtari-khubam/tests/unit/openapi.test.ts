import { writeFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { buildOpenApi } from '@/lib/openapi'
import { routes } from '@/server/routes'

describe('OpenAPI contract', () => {
  it('documents every route with a unique operation id', () => {
    const doc = buildOpenApi(routes)
    const ops = Object.values(doc.paths).flatMap((p) => Object.values(p as Record<string, { operationId: string }>))
    expect(ops).toHaveLength(routes.length)
    expect(new Set(ops.map((o) => o.operationId)).size).toBe(ops.length)
    expect(doc.paths['/lessons/{id}']).toBeDefined()
    expect(doc.paths['/admin/lessons/{id}/blocks']).toBeDefined()
    writeFileSync(new URL('../../docs/openapi.json', import.meta.url), `${JSON.stringify(doc, null, 2)}\n`)
  })
})
