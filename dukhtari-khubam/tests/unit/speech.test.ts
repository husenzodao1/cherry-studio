import { describe, expect, it, vi } from 'vitest'

import { hearingPrompt, transcribe } from '@/server/speech'

describe('"Эй Маҳлиё" online: speech heard by the server', () => {
  it('names her language and how Mahliyo is spelt', () => {
    expect(hearingPrompt('tg')).toContain('Tajik (written in Tajik Cyrillic')
    expect(hearingPrompt('uz')).toContain('Uzbek (Latin script)')
    expect(hearingPrompt('xx')).toContain('Tajik')
    expect(hearingPrompt('ru')).toContain('"Махлиё" in Russian')
  })

  it('without a key: nothing (the phone keeps what its own model heard)', async () => {
    expect(await transcribe('UklGRg==', 'tg', [], ['gemini-x'])).toBeNull()
  })
})

describe('Google Cloud Speech-to-Text (Chirp 2)', () => {
  it('signs its own token request and asks Chirp 2 in Tajik, in the chosen region', async () => {
    const { generateKeyPairSync, createVerify } = await import('node:crypto')
    const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
    const creds = { client_email: 'stt@lifehub.iam.gserviceaccount.com', project_id: 'lifehub-1', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString() }
    const { tokenAssertion, cloudCredentials, forgetCloudToken } = await import('@/server/googleCloud')
    // the key as the file, or as base64 of it
    expect(cloudCredentials(Buffer.from(JSON.stringify(creds)).toString('base64'))?.project_id).toBe('lifehub-1')
    const jwt = tokenAssertion(creds, 1_000)
    const [h, c, sig] = jwt.split('.')
    expect(JSON.parse(Buffer.from(c, 'base64url').toString())).toMatchObject({ iss: creds.client_email, aud: 'https://oauth2.googleapis.com/token', exp: 4_600 })
    expect(createVerify('RSA-SHA256').update(`${h}.${c}`).verify(publicKey, Buffer.from(sig, 'base64url'))).toBe(true)

    process.env.GOOGLE_CLOUD_CREDENTIALS = JSON.stringify(creds)
    forgetCloudToken()
    const calls: { url: string; body: string }[] = []
    const get = vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, body: String(init.body) })
      return new Response(JSON.stringify(url.includes('oauth2') ? { access_token: 'ya29.t', expires_in: 3600 } : { results: [{ alternatives: [{ transcript: 'Эй Маҳлиё,' }] }, { alternatives: [{ transcript: 'маро ба хона бубар.' }] }] }))
    })
    const { chirp } = await import('@/server/speech')
    expect(await chirp('UklGRg==', 'tg', get as unknown as typeof fetch)).toBe('Эй Маҳлиё, маро ба хона бубар.')
    expect(calls[1].url).toBe('https://europe-west4-speech.googleapis.com/v2/projects/lifehub-1/locations/europe-west4/recognizers/_:recognize')
    expect(JSON.parse(calls[1].body).config).toMatchObject({ languageCodes: ['tg-TJ'], model: 'chirp_2' })
    // the token is kept: the next one goes straight to Chirp
    await chirp('UklGRg==', 'ru', get as unknown as typeof fetch)
    expect(calls).toHaveLength(3)
    expect(JSON.parse(calls[2].body).config.languageCodes).toEqual(['ru-RU'])
    delete process.env.GOOGLE_CLOUD_CREDENTIALS
  })
})
