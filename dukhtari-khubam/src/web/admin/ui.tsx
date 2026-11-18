'use client'

import { useState, type ReactNode } from 'react'

import { api, ApiFailure } from '../api'

/** Shared building blocks of the staff panel. Staff labels are Tajik; content is edited per language. */

export const LOCALES = ['tg', 'ru', 'ar'] as const
export type Loc = (typeof LOCALES)[number]
export const LOCALE_NAME: Record<Loc, string> = { tg: 'Тоҷикӣ', ru: 'Русский', ar: 'العربية' }

export const STATUS_LABEL: Record<string, string> = {
  draft: 'Сиёҳнавис', in_review: 'Дар баррасӣ', changes_requested: 'Ислоҳ лозим', approved: 'Тасдиқшуда',
  scheduled: 'Ба нақша', published: 'Нашршуда', archived: 'Бойгонӣ'
}

/** Moves offered from each status; the database decides what the signed-in role may actually do. */
export const NEXT_STATUS: Record<string, { to: string; label: string }[]> = {
  draft: [{ to: 'in_review', label: 'Ба баррасӣ' }, { to: 'published', label: 'Нашр' }],
  changes_requested: [{ to: 'in_review', label: 'Ба баррасӣ' }],
  in_review: [{ to: 'approved', label: 'Тасдиқ' }, { to: 'changes_requested', label: 'Ислоҳ талаб' }],
  approved: [{ to: 'published', label: 'Нашр' }, { to: 'in_review', label: 'Ба баррасӣ' }],
  scheduled: [{ to: 'published', label: 'Ҳозир нашр' }, { to: 'draft', label: 'Бекор' }],
  published: [{ to: 'in_review', label: 'Тағйир ба баррасӣ' }, { to: 'archived', label: 'Ба бойгонӣ' }],
  archived: [{ to: 'draft', label: 'Барқарор' }]
}

export interface Translation { locale: Loc; ready?: boolean; [k: string]: unknown }
export interface Entity { id: string; status?: string; position?: number; slug?: string; translations?: Translation[]; [k: string]: unknown }

export function titleOf(e: Entity, field = 'title'): string {
  const tr = e.translations ?? []
  const pick = tr.find((t) => t.locale === 'tg') ?? tr[0]
  return (pick?.[field] as string | undefined) || e.slug || 'Бе ном'
}

export function errorText(e: unknown): string {
  if (e instanceof ApiFailure) {
    const details = Array.isArray(e.details) ? e.details.map((d: { path?: unknown; message?: string }) => `${d.path ?? ''} ${d.message ?? ''}`.trim()).join('; ') : ''
    return details ? `${e.message} (${details})` : e.message
  }
  return 'Хато'
}

/** Runs an API mutation with a busy flag and an inline message. */
export function useAction() {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const run = async <T,>(fn: () => Promise<T>, okText = 'Захира шуд'): Promise<T | undefined> => {
    setBusy(true)
    setMessage(null)
    try {
      const r = await fn()
      setMessage({ ok: true, text: okText })
      return r
    } catch (e) {
      setMessage({ ok: false, text: errorText(e) })
      return undefined
    } finally {
      setBusy(false)
    }
  }
  return { busy, message, run, setMessage }
}

export const send = <T,>(path: string, method: string, body?: unknown) => api<T>(path, { method, body })

export function Note({ message }: { message: { ok: boolean; text: string } | null }) {
  if (!message) return null
  return <p role="status" style={{ margin: 0, color: message.ok ? 'var(--ok)' : 'var(--bad)', fontSize: '0.9em' }}>{message.text}</p>
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="stack" style={{ gap: 6 }}>
      <span className="eyebrow">{label}</span>
      {children}
      {hint ? <span className="muted" style={{ fontSize: '0.8em' }}>{hint}</span> : null}
    </label>
  )
}

export function StatusBadge({ status }: { status?: string }) {
  if (!status) return null
  const tone = status === 'published' ? 'var(--ok-bg)' : status === 'archived' ? 'var(--surface-2)' : status === 'changes_requested' ? 'var(--bad-bg)' : 'var(--note-bg)'
  return <span className="chip" style={{ background: tone, minHeight: 26, padding: '0 10px', fontSize: '0.78em' }}>{STATUS_LABEL[status] ?? status}</span>
}

export function LocaleTabs({ value, onChange }: { value: Loc; onChange: (l: Loc) => void }) {
  return (
    <div className="segmented" role="tablist">
      {LOCALES.map((l) => (
        <button key={l} type="button" role="tab" aria-selected={value === l} onClick={() => onChange(l)}>{LOCALE_NAME[l]}</button>
      ))}
    </div>
  )
}

/** Rich text ↔ plain text: one paragraph of spans; **bold** and *italic* markers are kept as marks. */
export function toRich(text: string) {
  const spans: { text: string; marks?: string[] }[] = []
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*)/g
  let last = 0
  for (const m of text.matchAll(re)) {
    if (m.index! > last) spans.push({ text: text.slice(last, m.index) })
    const bold = m[0].startsWith('**')
    spans.push({ text: m[0].slice(bold ? 2 : 1, bold ? -2 : -1), marks: [bold ? 'bold' : 'italic'] })
    last = m.index! + m[0].length
  }
  if (last < text.length) spans.push({ text: text.slice(last) })
  return { spans: spans.length ? spans : [{ text: '' }] }
}

export function fromRich(value: unknown): string {
  const spans = (value as { spans?: { text: string; marks?: string[] }[] } | null)?.spans ?? []
  return spans.map((s) => (s.marks?.includes('bold') ? `**${s.text}**` : s.marks?.includes('italic') ? `*${s.text}*` : s.text)).join('')
}
