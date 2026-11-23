import { z } from 'zod'

import { route, type AnyRoute } from '@/lib/router'

import { call } from '../util'

/**
 * The student's Workspace (Premium): her own study materials, read on her phone and sent as passages; kept for
 * her alone (the database checks her account and her plan). Mahliyo answers her from them (see mahliyo.ts).
 */

type Json = Record<string, unknown>
const Chunk = z.object({ n: z.number().int().min(0), page: z.number().int().min(1).nullable().optional(), text: z.string().min(1).max(4000) })

export const workspaceRoutes: AnyRoute[] = [
  route({
    method: 'GET', path: '/me/workspace', access: 'user', tag: 'Workspace', summary: 'My study materials (and whether my plan has the Workspace)',
    handler: async ({ sb }) => call<Json>(sb(), 'api_ws_docs')
  }),
  route({
    method: 'POST', path: '/me/workspace/start', access: 'user', tag: 'Workspace', summary: 'A new material (its passages follow in batches)',
    body: z.object({ title: z.string().trim().min(1).max(300), file: z.string().max(300), subject: z.string().max(120).optional(), pages: z.number().int().min(0).max(20000) }),
    handler: async ({ sb, body }) => ({ id: await call<string>(sb(), 'api_ws_start', { p_title: body.title, p_file: body.file, p_subject: body.subject ?? null, p_pages: body.pages }) })
  }),
  route({
    method: 'POST', path: '/me/workspace/chunks', access: 'user', tag: 'Workspace', summary: "A batch of a material's passages",
    body: z.object({ doc: z.uuid(), chunks: z.array(Chunk).min(1).max(200) }),
    handler: async ({ sb, body }) => ({ saved: await call<number>(sb(), 'api_ws_chunks', { p_doc: body.doc, p_chunks: body.chunks }) })
  }),
  route({
    method: 'POST', path: '/me/workspace/done', access: 'user', tag: 'Workspace', summary: 'A material is all there: Mahliyo answers from it',
    body: z.object({ doc: z.uuid() }),
    handler: async ({ sb, body }) => { await call(sb(), 'api_ws_done', { p_doc: body.doc }); return { ok: true } }
  }),
  route({
    method: 'POST', path: '/me/workspace/remove', access: 'user', tag: 'Workspace', summary: 'A material taken away, with all its passages',
    body: z.object({ doc: z.uuid() }),
    handler: async ({ sb, body }) => { await call(sb(), 'api_ws_remove', { p_doc: body.doc }); return { ok: true } }
  })
]
