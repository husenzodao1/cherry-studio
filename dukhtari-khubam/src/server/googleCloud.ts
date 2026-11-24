import { createSign } from 'node:crypto'

/**
 * Google Cloud with a service account (Speech-to-Text v2 takes no plain API key): the account's JSON key in
 * GOOGLE_CLOUD_CREDENTIALS (the file as it is, or base64 of it). Its short-lived access token is made here
 * (a signed JWT exchanged at Google's token address) and kept until a minute before it ends.
 */

interface Credentials { client_email: string; private_key: string; project_id: string }

export function cloudCredentials(raw = process.env.GOOGLE_CLOUD_CREDENTIALS): Credentials | null {
  const text = raw?.trim()
  if (!text) return null
  try {
    const json = JSON.parse(text.startsWith('{') ? text : Buffer.from(text, 'base64').toString('utf8')) as Partial<Credentials>
    return json.client_email && json.private_key && json.project_id ? (json as Credentials) : null
  } catch {
    return null
  }
}

export const cloudReady = () => cloudCredentials() !== null

const b64url = (v: string | Buffer) => Buffer.from(v).toString('base64url')

/** the signed request for a token (RS256, an hour) */
export function tokenAssertion(c: Credentials, now = Math.floor(Date.now() / 1000)): string {
  const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = b64url(JSON.stringify({ iss: c.client_email, scope: 'https://www.googleapis.com/auth/cloud-platform', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }))
  const sign = createSign('RSA-SHA256')
  sign.update(`${head}.${claims}`)
  return `${head}.${claims}.${b64url(sign.sign(c.private_key))}`
}

let kept: { token: string; until: number } | null = null
export async function cloudToken(fetcher: typeof fetch = fetch): Promise<string | null> {
  const c = cloudCredentials()
  if (!c) return null
  if (kept && Date.now() < kept.until) return kept.token
  const res = await fetcher('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: tokenAssertion(c) }),
    signal: AbortSignal.timeout(8000)
  })
  const d = (await res.json()) as { access_token?: string; expires_in?: number; error_description?: string }
  if (!d.access_token) throw new Error(`google token: ${d.error_description ?? res.status}`)
  kept = { token: d.access_token, until: Date.now() + ((d.expires_in ?? 3600) - 60) * 1000 }
  return kept.token
}
export const forgetCloudToken = () => { kept = null }
