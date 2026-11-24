import { GoogleGenAI, MediaResolution, Modality, Type, type FunctionDeclaration, type LiveConnectConfig } from '@google/genai'

import { geminiKeys } from './mahliyo'

/**
 * Mahliyo's live voice (Gemini Live): she hears the learner and answers in her own voice, in any of the app's
 * languages, can be interrupted, sees through the camera when it is on, looks things up on Google, and asks the
 * phone to do things (a timer, a call, a song, the way somewhere, the weather, a page of the app).
 *
 * The phone never holds the key: it gets a one-use token from here, valid a minute to start and two minutes and
 * a half to talk (each token is a two-minute part of her monthly minutes; the app asks for the next part and
 * goes on with the same conversation by its resumption handle). Everything is locked in the token: the model,
 * Mahliyo's instructions, the tools, the transcripts, the context compression that lets a conversation with the
 * camera last longer than two minutes.
 */

export const LIVE_MODEL = () => process.env.GEMINI_LIVE_MODEL?.trim() || 'gemini-3.8-live'
export const liveReady = () => geminiKeys().length > 0
/** one token: two minutes of talk (and a little more to hand over to the next one) */
export const CHUNK_SECONDS = 120
const GRACE_SECONDS = 30

export type LiveMode = 'assistant' | 'camera' | 'coach'
export type CoachScenario = 'ielts' | 'english' | 'russian' | 'interview'

/** what the phone can do when she asks (the app does it and tells Mahliyo the result) */
export const LIVE_TOOLS: FunctionDeclaration[] = [
  { name: 'set_timer', description: 'Set a timer on the phone.', parameters: { type: Type.OBJECT, properties: { seconds: { type: Type.INTEGER, description: 'length in seconds' }, label: { type: Type.STRING } }, required: ['seconds'] } },
  { name: 'call_contact', description: 'Phone one of her contacts by name, or a number she said.', parameters: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, number: { type: Type.STRING, description: 'digits only' } } } },
  { name: 'play_song', description: 'Find a song or music on YouTube and play it in the app.', parameters: { type: Type.OBJECT, properties: { query: { type: Type.STRING, description: 'singer and song, or a kind of music' } }, required: ['query'] } },
  { name: 'navigate', description: 'Show the way to a place on the map, turn by turn.', parameters: { type: Type.OBJECT, properties: { place: { type: Type.STRING }, mode: { type: Type.STRING, enum: ['foot', 'car'] } }, required: ['place'] } },
  { name: 'weather', description: 'The weather where she is now, or tomorrow.', parameters: { type: Type.OBJECT, properties: { when: { type: Type.STRING, enum: ['now', 'tomorrow'] } } } },
  { name: 'open_page', description: 'Open a page of the app.', parameters: { type: Type.OBJECT, properties: { page: { type: Type.STRING, enum: ['home', 'schools', 'library', 'workspace', 'profile', 'settings', 'plans', 'chat'] } }, required: ['page'] } },
  { name: 'end_conversation', description: 'End the conversation when she says goodbye or thanks and wants to stop.', parameters: { type: Type.OBJECT, properties: {} } }
]

const SCENARIOS: Record<CoachScenario, string> = {
  ielts: 'an IELTS Speaking examiner: Part 1 (familiar questions), Part 2 (a cue card: one minute to prepare, two to speak), Part 3 (discussion). Speak English only.',
  english: 'a friendly English conversation partner on everyday topics at her level. Speak English; slow down and simplify when she struggles.',
  russian: 'a friendly Russian conversation partner (shop, doctor, work, documents, migration offices). Speak Russian; slow down when she struggles.',
  interview: 'an interviewer for a job she names (or a first job), in her language: real interview questions one at a time, follow-ups on her answers.'
}

/** Mahliyo's instructions for a live conversation */
export function liveInstruction(o: { mode: LiveMode; scenario?: CoachScenario; lang: string; name?: string; me?: string; now?: string; boy?: boolean }): string {
  const who = o.boy ? 'a young man' : 'a girl or young woman'
  const parts = [
    `You are Mahliyo, the voice assistant of the LifeHub learning app, talking live with ${who}${o.name ? ` called ${o.name}` : ''}. Speak naturally and warmly, like a clever older friend: short, clear spoken sentences (no lists, no markdown, no emoji read aloud), one or two at a time unless she asks for more. She may interrupt you: stop and listen.`,
    `LANGUAGE: answer in the language she speaks (the app is set to "${o.lang}"); Tajik is spoken with its own sounds (ҳ, қ, ҷ, ғ, ӣ, ӯ), never in a Russian accent. Never name or hint at the technology or company behind you: you are Mahliyo.`,
    'TOOLS: when she asks the phone to do something, call the tool (timer, call, song, way, weather, a page) and then say in a few words that it is done. For news, prices, events or anything that changes, search Google first and say where it is from. Never invent facts.',
    'SAFETY: you speak with young people. No adult or violent content; for danger, self-harm or abuse, gently give the emergency number 112 and tell her to talk to a trusted adult.'
  ]
  if (o.mode === 'camera') parts.push('CAMERA: you see what her camera shows, about once a second, and sometimes a sharp still photo. When she shows her notebook, a book or a task, read it carefully, say what is right and exactly where a mistake is ("in the third line…"), and explain step by step how to fix it. Never just give the final answer of homework: lead her to it.')
  if (o.mode === 'coach' && o.scenario) parts.push(`SPEAKING COACH: you are ${SCENARIOS[o.scenario]} Keep it a real conversation. When she says she wants to finish, give a short spoken report: her level (CEFR A1–C2), her strongest points, her three most important mistakes with the right way to say them, and one thing to practise.`)
  if (o.me) parts.push(`ABOUT HER (from her phone): ${o.me.slice(0, 1500)}`)
  if (o.now) parts.push(`HER TIME NOW: ${o.now}`)
  return parts.join('\n\n')
}

/** the conversation's settings, all locked in the token */
export function liveConfig(o: Parameters<typeof liveInstruction>[0] & { handle?: string }): LiveConnectConfig {
  return {
    responseModalities: [Modality.AUDIO],
    systemInstruction: liveInstruction(o),
    tools: [{ functionDeclarations: LIVE_TOOLS }, { googleSearch: {} }],
    inputAudioTranscription: {},
    outputAudioTranscription: {},
    // with the camera on, a conversation lasts longer than two minutes only with its oldest part let go
    contextWindowCompression: { slidingWindow: {} },
    sessionResumption: o.handle ? { handle: o.handle } : {},
    ...(o.mode === 'camera' ? { mediaResolution: MediaResolution.MEDIA_RESOLUTION_MEDIUM } : { mediaResolution: MediaResolution.MEDIA_RESOLUTION_LOW })
  }
}

/** a one-use token for one two-minute part of a live conversation */
export async function liveToken(config: LiveConnectConfig, now = Date.now(), keys = geminiKeys()): Promise<{ token: string; model: string; expires: string }> {
  let failure: unknown = new Error('no Gemini key')
  for (const key of keys) {
    try {
      const ai = new GoogleGenAI({ apiKey: key, httpOptions: { apiVersion: 'v1alpha' } })
      const expires = new Date(now + (CHUNK_SECONDS + GRACE_SECONDS) * 1000).toISOString()
      const t = await ai.authTokens.create({
        config: { uses: 1, expireTime: expires, newSessionExpireTime: new Date(now + 60_000).toISOString(), liveConnectConstraints: { model: LIVE_MODEL(), config } }
      })
      if (!t.name) throw new Error('no token')
      return { token: t.name, model: LIVE_MODEL(), expires }
    } catch (e) {
      failure = e
      console.warn('[live] token failed:', String(e instanceof Error ? e.message : e).slice(0, 160))
    }
  }
  throw failure
}
