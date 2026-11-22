'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { linkAllowed, SPOT_IDS, type AiBlock } from '@/lib/aiCatalog'
import { emojify } from '@/web/components/Emoji'
import { AnswerBlocks, Sources } from '@/web/components/MahliyoBlocks'
import { ErrorState, Loading } from '@/web/components/States'
import { apiUrl } from '@/web/offline/base'
import { usePrefs } from '@/web/prefs'

interface Shared { title: string; at: string; turns: { role: 'user' | 'assistant'; content: string; blocks?: AiBlock[] }[] }

const https = (u: unknown) => typeof u === 'string' && /^https:\/\//.test(u)
/** a shared answer's blocks as they may be shown: only what the chat itself draws, links only to allowed places */
function safe(blocks: unknown): AiBlock[] {
  if (!Array.isArray(blocks)) return []
  return (blocks as AiBlock[]).filter((b) => {
    switch (b?.type) {
      case 'text': return typeof b.text === 'string'
      case 'steps': return typeof b.title === 'string' && Array.isArray(b.items) && b.items.every((i) => typeof i === 'string')
      case 'screen': return (SPOT_IDS as readonly string[]).includes(b.spot)
      case 'link': return typeof b.to === 'string' && typeof b.label === 'string' && linkAllowed(b.to)
      case 'sources': return Array.isArray(b.items) && b.items.every((i) => typeof i.title === 'string' && (i.url === '' || https(i.url)))
      case 'images': return Array.isArray(b.items) && b.items.every((i) => https(i.src) && https(i.url))
      default: return false
    }
  })
}

/** A chat someone shared with Mahliyo AI, read-only: her questions and Mahliyo's answers. */
export default function SharedChat() {
  const { t } = usePrefs()
  const [chat, setChat] = useState<Shared | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const load = () => {
    const id = new URLSearchParams(window.location.search).get('id') ?? ''
    setError(null)
    fetch(apiUrl(`/mahliyo/shared?id=${encodeURIComponent(id)}`))
      .then(async (r) => { if (!r.ok) throw new Error(t('ai.shared_missing')); setChat((await r.json()) as Shared) })
      .catch((e: unknown) => setError(e instanceof Error ? e : new Error(String(e))))
  }
  useEffect(load, [t]) // eslint-disable-line react-hooks/exhaustive-deps
  if (error) return <ErrorState error={error} onRetry={load} />
  if (!chat) return <Loading />
  return (
    <div className="ai-shared">
      <header className="ai-shared-head">
        <span className="ai-orb ai-orb-sm" aria-hidden="true"><span className="ai-orb-ring" /><img src="/assets/mascot/face.webp" alt="" /></span>
        <div className="grow">
          <h1 className="ai-name">{emojify(chat.title)}</h1>
          <span className="ai-status">{t('ai.shared_title')} · {new Date(chat.at).toLocaleDateString()}</span>
        </div>
      </header>
      <div className="ai-chat ai-shared-chat">
        {chat.turns.map((m, i) => (m.role === 'user' ? (
          <div key={i} className="ai-asked"><span className="bubble"><span className="ai-q is-whole">{emojify(m.content)}</span></span></div>
        ) : (
          <div key={i} className="ai-said">
            <div className="grow">
              <AnswerBlocks blocks={safe(m.blocks).length ? safe(m.blocks) : [{ type: 'text', text: m.content }]} fresh={false} />
              {safe(m.blocks).map((b, n) => (b.type === 'sources' ? <div key={n} className="ai-acts ai-acts-start"><Sources items={b.items} /></div> : null))}
            </div>
          </div>
        )))}
      </div>
      <Link href="/mahliyo" className="btn ai-shared-cta">{t('ai.shared_cta')}</Link>
    </div>
  )
}
