import { describe, expect, it } from 'vitest'

import { idTokenClaims } from '@/web/offline/google'

const b64url = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

describe('Google ID token claims', () => {
  it('reads name, e-mail and picture from the token itself (Tajik letters too)', () => {
    const token = `${b64url({ alg: 'RS256' })}.${b64url({ email: 'malika@gmail.com', given_name: 'Малика', name: 'Малика Ҳусейнова', picture: 'https://lh3/x' })}.sig`
    const c = idTokenClaims(token)
    expect(c.given_name).toBe('Малика')
    expect(c.name).toBe('Малика Ҳусейнова')
    expect(c.email).toBe('malika@gmail.com')
  })
  it('gives nothing for a broken token', () => {
    expect(idTokenClaims('nope')).toEqual({})
  })
})
