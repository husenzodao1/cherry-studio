import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { PGlite, type Transaction } from '@electric-sql/pglite'
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', '..')

export type Db = PGlite
export type Tx = Transaction

/** Fresh database with Supabase stubs and every production migration applied in order. */
export async function createDb(): Promise<Db> {
  const db = await PGlite.create({ extensions: { pg_trgm, pgcrypto } })
  await db.exec(readFileSync(join(here, 'supabase-stub.sql'), 'utf8'))
  const dir = join(root, 'supabase', 'migrations')
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    try {
      await db.exec(readFileSync(join(dir, file), 'utf8'))
    } catch (error) {
      throw new Error(`migration ${file} failed: ${(error as Error).message}`)
    }
  }
  return db
}

export async function createUser(db: Db, email: string, roles: string[] = []): Promise<string> {
  const { rows } = await db.query<{ id: string }>('insert into auth.users (email) values ($1) returning id', [email])
  const id = rows[0].id
  for (const role of roles) {
    await db.query('insert into public.user_roles (user_id, role) values ($1, $2)', [id, role])
  }
  return id
}

/** Run `fn` as an API caller: `null` = anonymous, otherwise the authenticated user id (RLS applies). */
export async function as<T>(db: Db, userId: string | null, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify(userId ? { sub: userId, role: 'authenticated' } : { role: 'anon' })
    ])
    await tx.exec(`set local role ${userId ? 'authenticated' : 'anon'}`)
    return fn(tx)
  })
}

/** Call a public RPC function with named arguments and return its single JSON value. */
export async function rpc<T = any>(tx: Tx | Db, fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const names = Object.keys(args)
  const params = names.map((n, i) => `${n} => $${i + 1}`).join(', ')
  const values = names.map((n) => {
    const v = args[n]
    return v !== null && typeof v === 'object' && !Array.isArray(v) ? JSON.stringify(v) : v
  })
  try {
    const { rows } = await tx.query<{ r: T }>(`select public.${fn}(${params}) as r`, values)
    return rows[0].r
  } catch (error) {
    const e = error as Error & { where?: string; detail?: string }
    e.message = `${e.message} [${fn}]${e.detail ? ` detail=${e.detail}` : ''}${e.where ? ` where=${e.where.split('\n')[0]}` : ''}`
    throw e
  }
}

export async function expectError(promise: Promise<unknown>, message: string | RegExp): Promise<void> {
  try {
    await promise
  } catch (error) {
    const text = (error as Error).message
    if (typeof message === 'string' ? text.includes(message) : message.test(text)) return
    throw new Error(`expected error matching ${message}, got: ${text}`)
  }
  throw new Error(`expected error matching ${message}, but call succeeded`)
}
