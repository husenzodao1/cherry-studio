'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { api, ApiFailure } from '@/web/api'
import { useAuth } from '@/web/auth'
import { CrownSpin } from '@/web/components/CrownSpin'
import { Header } from '@/web/components/Header'
import { Icon } from '@/web/components/Icon'
import { showToast } from '@/web/components/Toast'
import { pagesOf, passagesOf } from '@/web/files/bookText'
import { usePlan } from '@/web/plans'
import { usePrefs } from '@/web/prefs'
import { markTried } from '@/web/offline/tried'

/**
 * The student's Workspace (Premium): she adds her own study materials — lectures, textbooks, syllabi,
 * assignments, notes (PDF, Word, text) — read here on her phone and kept for her alone; Mahliyo then answers
 * her questions and solves her tasks from them first, as her teachers teach it, citing them ("🎓").
 */

interface Doc { id: string; title: string; file: string | null; subject: string | null; pages: number | null; chunks: number; status: 'loading' | 'ready'; at: string }
interface Space { allowed: boolean; room: { docs: number; chunks: number }; used: number; docs: Doc[] }

const ACCEPT = '.pdf,.docx,.txt,.md,application/pdf,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const BATCH = 200

export default function WorkspacePage() {
  useEffect(() => markTried('workspace'), [])
  const { t } = usePrefs()
  const { session } = useAuth()
  const { open } = usePlan()
  const [space, setSpace] = useState<Space | null>(null)
  const [failed, setFailed] = useState(false)
  const [subject, setSubject] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    if (!session) return
    try {
      setSpace(await api<Space>('/me/workspace'))
      setFailed(false)
    } catch {
      setFailed(true)
    }
  }, [session])
  useEffect(() => { void load() }, [load])

  const add = async (files: FileList | null) => {
    if (!files?.length || !space) return
    for (const file of Array.from(files)) {
      try {
        setBusy(`${t('ws.reading')} ${file.name}`)
        const pages = await pagesOf(file)
        const passages = passagesOf(pages)
        if (!passages.length) { showToast(t('ws.no_text'), 'info'); continue }
        const { id } = await api<{ id: string }>('/me/workspace/start', {
          method: 'POST', body: { title: file.name.replace(/\.[^.]+$/, ''), file: file.name, subject: subject.trim() || undefined, pages: pages.length }
        })
        for (let i = 0; i < passages.length; i += BATCH) {
          setBusy(t('ws.saving').replace('{n}', String(Math.min(i + BATCH, passages.length))).replace('{all}', String(passages.length)))
          await api('/me/workspace/chunks', { method: 'POST', body: { doc: id, chunks: passages.slice(i, i + BATCH) } })
        }
        await api('/me/workspace/done', { method: 'POST', body: { doc: id } })
        showToast(t('ws.added'), 'check')
      } catch (e) {
        const code = e instanceof ApiFailure ? e.code : ''
        if (code === 'plan_limit') open('workspace')
        showToast(code === 'workspace_full' ? t('ws.full') : t('state.error'), 'info')
      }
    }
    setBusy(null)
    if (input.current) input.current.value = ''
    void load()
  }

  const remove = async (d: Doc) => {
    if (!confirm(t('ws.remove_q').replace('{title}', d.title))) return
    try {
      await api('/me/workspace/remove', { method: 'POST', body: { doc: d.id } })
      void load()
    } catch {
      showToast(t('state.error'), 'info')
    }
  }

  // her materials by subject
  const groups = useMemo(() => {
    const by = new Map<string, Doc[]>()
    for (const d of space?.docs ?? []) {
      const k = d.subject ?? ''
      by.set(k, [...(by.get(k) ?? []), d])
    }
    return [...by.entries()]
  }, [space])
  const subjects = useMemo(() => [...new Set((space?.docs ?? []).map((d) => d.subject).filter((s): s is string => !!s))], [space])

  // Mahliyo, in a new chat, with the question begun for her to finish (as a lesson's circle does)
  const router = useRouter()
  const ask = (prefill: string) => {
    try { sessionStorage.setItem('dk.ai.ask', prefill) } catch { /* storage blocked: an empty chat */ }
    router.push('/mahliyo')
  }

  return (
    <>
      <Header back="/" title={t('ws.title')} />
      <div className="section stack ws" style={{ gap: 14 }}>
        <div className="glass card-pad ws-hero">
          <span className="ws-hero-ico" aria-hidden="true"><Icon name="cap" size={30} /></span>
          <div className="stack" style={{ gap: 4 }}>
            <b>{t('ws.title')}</b>
            <span className="muted">{t('ws.lead')}</span>
          </div>
        </div>

        {!session ? (
          <div className="glass card-pad stack" style={{ gap: 10 }}>
            <span>{t('ws.sign_in')}</span>
            <Link className="btn btn-block" href="/start">{t('start.login')}</Link>
          </div>
        ) : failed ? (
          <button type="button" className="btn btn-soft" onClick={() => void load()}>{t('action.retry')}</button>
        ) : !space ? (
          <div className="skeleton" style={{ height: 160, borderRadius: 24 }} />
        ) : !space.allowed ? (
          <div className="glass card-pad ws-locked">
            <CrownSpin plan="premium" size={92} />
            <b>{t('ws.locked')}</b>
            <span className="muted">{t('ws.locked_sub')}</span>
            <button type="button" className="btn btn-block btn-lg" onClick={() => open('workspace')}>{t('pw.settings_cta')}</button>
          </div>
        ) : (
          <>
            <div className="glass card-pad stack" style={{ gap: 10 }}>
              <span className="eyebrow">{t('ws.add')}</span>
              <input className="input" list="ws-subjects" placeholder={t('ws.subject')} value={subject} maxLength={120} onChange={(e) => setSubject(e.target.value)} aria-label={t('ws.subject')} />
              <datalist id="ws-subjects">{subjects.map((s) => <option key={s} value={s} />)}</datalist>
              <input ref={input} type="file" accept={ACCEPT} multiple hidden onChange={(e) => void add(e.target.files)} aria-label={t('ws.add')} />
              <button type="button" className="btn btn-block btn-lg" disabled={!!busy} aria-busy={!!busy} onClick={() => input.current?.click()}>
                <Icon name={busy ? 'refresh' : 'plus'} size={18} /> {busy ?? t('ws.pick')}
              </button>
              <span className="muted" style={{ fontSize: '0.82em' }}>{t('ws.formats')}</span>
              <div className="ws-room" role="meter" aria-valuemin={0} aria-valuemax={space.room.chunks} aria-valuenow={space.used} aria-label={t('ws.used')}>
                <span style={{ width: `${Math.min(100, (space.used / space.room.chunks) * 100)}%` }} />
              </div>
            </div>

            {space.docs.length ? (
              <>
                <button type="button" className="btn btn-soft btn-block ws-ask" onClick={() => ask(t('ws.ask_prefill'))}><Icon name="sparkle" size={18} /> {t('ws.ask')}</button>
                {groups.map(([sub, docs]) => (
                  <div key={sub || '-'} className="stack" style={{ gap: 8 }}>
                    <span className="eyebrow">{sub || t('ws.no_subject')}</span>
                    {docs.map((d) => (
                      <div key={d.id} className="glass ws-doc">
                        <span className="ws-doc-ico" aria-hidden="true"><Icon name="file" size={20} /></span>
                        <span className="grow">
                          <b>{d.title}</b>
                          <span className="muted">{d.status === 'ready'
                            ? [d.pages ? t('ws.pages').replace('{n}', String(d.pages)) : '', t('ws.parts').replace('{n}', String(d.chunks))].filter(Boolean).join(' · ')
                            : t('ws.unfinished')}</span>
                        </span>
                        {d.status === 'ready' ? (
                          <button type="button" className="ws-doc-act" onClick={() => ask(t('ws.ask_doc').replace('{title}', d.title))} aria-label={`${t('ws.ask')}: ${d.title}`}><Icon name="sparkle" size={18} /></button>
                        ) : null}
                        <button type="button" className="ws-doc-act" aria-label={`${t('ws.remove')}: ${d.title}`} onClick={() => void remove(d)}><Icon name="trash" size={18} /></button>
                      </div>
                    ))}
                  </div>
                ))}
              </>
            ) : <p className="muted" style={{ textAlign: 'center', margin: '10px 16px' }}>{t('ws.empty')}</p>}
          </>
        )}
      </div>
    </>
  )
}
