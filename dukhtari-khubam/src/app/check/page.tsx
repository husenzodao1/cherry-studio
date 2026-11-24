'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { SUBJECTS, type SubjectId } from '@/lib/study'
import { Header } from '@/web/components/Header'
import { Icon } from '@/web/components/Icon'
import { showToast } from '@/web/components/Toast'
import { apiUrl } from '@/web/offline/base'
import { askMahliyo } from '@/web/offline/mmt'
import { supportToken } from '@/web/offline/support'
import { usePlan } from '@/web/plans'
import { usePrefs } from '@/web/prefs'

interface Mark { box: [number, number, number, number]; kind: 'error' | 'ok' | 'note'; text: string; why: string }
interface Checked { subject: string; grade: number | null; summary: string; marks: Mark[]; next: string[] }

/** the longest side of the photo sent (enough for handwriting, small enough to send quickly) */
const SIDE = 1600

/** a photo made smaller on the phone, as JPEG base64 */
async function shrink(file: File): Promise<{ url: string; data: string }> {
  const bitmap = await createImageBitmap(file)
  const k = Math.min(1, SIDE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * k)
  canvas.height = Math.round(bitmap.height * k)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  const url = canvas.toDataURL('image/jpeg', 0.85)
  return { url, data: url.slice(url.indexOf(',') + 1) }
}

async function session(): Promise<string | undefined> {
  try {
    const { browserSupabase } = await import('@/web/supabase-browser')
    const { data } = await browserSupabase()?.auth.getSession() ?? { data: { session: null } }
    return data.session?.access_token ?? undefined
  } catch {
    return undefined
  }
}

/**
 * The red pen: a photo of a notebook page, checked like a teacher would — her mistakes circled in red right on
 * the photo with the correction written beside, what is right ticked in green, a mark on the 5-point scale, a
 * few warm words and what to practise. A tap on a mark explains it; Mahliyo can go through it with her.
 */
export default function CheckPage() {
  const { t, locale } = usePrefs()
  const router = useRouter()
  const { open } = usePlan()
  const [photo, setPhoto] = useState<{ url: string; data: string } | null>(null)
  const [subject, setSubject] = useState<SubjectId | undefined>()
  const [task, setTask] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<Checked | null>(null)
  const [picked, setPicked] = useState<number | null>(null)

  const take = async (f: File | undefined) => {
    if (!f) return
    try { setPhoto(await shrink(f)); setResult(null); setPicked(null) } catch { showToast(t('state.error'), 'alert') }
  }
  const check = async () => {
    if (!photo || busy) return
    setBusy(true)
    try {
      const res = await fetch(apiUrl('/study/check'), {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          token: supportToken(), session: await session(), image: { mime: 'image/jpeg', data: photo.data }, lang: locale,
          ...(subject ? { subject: SUBJECTS.find((s) => s.id === subject)!.en } : {}), ...(task.trim() ? { task: task.trim() } : {})
        })
      })
      if (res.status === 402) { open('check'); return }
      if (!res.ok) throw new Error(String(res.status))
      setResult((await res.json()) as Checked)
    } catch {
      showToast(t('check.failed'), 'alert')
    } finally {
      setBusy(false)
    }
  }
  const errors = result?.marks.filter((m) => m.kind === 'error') ?? []
  const mark = picked !== null ? result?.marks[picked] : null

  return (
    <>
      <Header back="/schools" title={t('check.title')} />
      <div className="section stack" style={{ gap: 14 }}>
        {!photo ? (
          <section className="glass card-pad stack check-start">
            <span className="tool-ico is-lg" aria-hidden="true"><Icon name="pen" size={24} /></span>
            <b>{t('check.title')}</b>
            <span className="muted">{t('check.sub')}</span>
            <label className="btn btn-block"><Icon name="camera" size={18} /> {t('check.camera')}
              <input type="file" accept="image/*" capture="environment" hidden onChange={(e) => void take(e.target.files?.[0])} /></label>
            <label className="btn btn-soft btn-block"><Icon name="image" size={18} /> {t('check.gallery')}
              <input type="file" accept="image/*" hidden aria-label={t('check.gallery')} onChange={(e) => void take(e.target.files?.[0])} /></label>
          </section>
        ) : (
          <>
            <div className="check-page">
              <img src={photo.url} alt={t('check.photo')} />
              {result?.marks.map((m, i) => {
                const [y0, x0, y1, x1] = m.box
                return (
                  <button key={i} type="button" className={`check-mark is-${m.kind}${picked === i ? ' is-picked' : ''}`} aria-label={m.text || m.why || m.kind}
                    style={{ top: `${y0 / 10}%`, left: `${x0 / 10}%`, height: `${(y1 - y0) / 10}%`, width: `${(x1 - x0) / 10}%` }} onClick={() => setPicked(picked === i ? null : i)}>
                    {m.kind === 'ok' ? <span className="check-tick" aria-hidden="true">✓</span> : null}
                    {m.kind === 'error' && m.text ? <span className="check-fix">{m.text}</span> : null}
                  </button>
                )
              })}
              {result?.grade ? <span className="check-grade" aria-label={t('check.grade')}>{result.grade}</span> : null}
              {busy ? <div className="check-scan" aria-hidden="true" /> : null}
            </div>

            {!result ? (
              <section className="glass card-pad stack" style={{ gap: 10 }}>
                <div className="study-row" role="group" aria-label={t('ai.study_subject')}>
                  {SUBJECTS.map((x) => (
                    <button key={x.id} type="button" className="study-chip" aria-pressed={subject === x.id}
                      onClick={() => setSubject(subject === x.id ? undefined : x.id)}><span aria-hidden="true">{x.emoji}</span>{t(`study.sub_${x.id}` as 'study.sub_math')}</button>
                  ))}
                </div>
                <textarea className="input" rows={2} maxLength={1000} value={task} placeholder={t('check.task')} aria-label={t('check.task')} onChange={(e) => setTask(e.target.value)} />
                <button type="button" className="btn" disabled={busy} onClick={() => void check()}>{busy ? t('check.checking') : t('check.go')}</button>
                <button type="button" className="link-btn" onClick={() => setPhoto(null)}>{t('check.other')}</button>
              </section>
            ) : (
              <>
                {mark ? (
                  <section className={`glass card-pad stack check-detail is-${mark.kind}`} style={{ gap: 6 }}>
                    {mark.text ? <b>{mark.kind === 'error' ? `✗ → ${mark.text}` : mark.text}</b> : null}
                    {mark.why ? <span>{mark.why}</span> : null}
                    {mark.kind === 'error' ? (
                      <button type="button" className="link-btn" style={{ alignSelf: 'flex-start', padding: 0 }}
                        onClick={() => askMahliyo(t('check.ask_prefill').replace('{fix}', mark.text).replace('{why}', mark.why), router.push)}>{t('mmt.explain')}</button>
                    ) : null}
                  </section>
                ) : null}
                <section className="glass card-pad stack" style={{ gap: 8 }}>
                  <b>{result.subject ? `${result.subject} · ` : ''}{t('check.found').replace('{n}', String(errors.length))}</b>
                  <span>{result.summary}</span>
                  {errors.length ? <span className="muted" style={{ fontSize: '0.84em' }}>{t('check.tap')}</span> : null}
                  {result.next.length ? (
                    <>
                      <b style={{ marginTop: 6 }}>{t('check.next')}</b>
                      <ul className="check-next">{result.next.map((n) => <li key={n}>{n}</li>)}</ul>
                    </>
                  ) : null}
                  <button type="button" className="btn btn-soft" onClick={() => { setPhoto(null); setResult(null); setTask('') }}>{t('check.again')}</button>
                </section>
              </>
            )}
          </>
        )}
      </div>
    </>
  )
}
