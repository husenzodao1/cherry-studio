'use client'

import { useEffect, useState } from 'react'

import { DEFAULT_LIMITS, limitsFrom, PLANS, PRICES, type Limits, type Plan } from '@/lib/plans'

import { useApi } from '../useApi'
import { ErrorState, Loading } from '../components/States'
import { Field, Note, send, useAction } from './ui'

/**
 * The plans in the panel: on or off, the consultant's link, Paddle's price IDs, the limits of each plan, a plan
 * given to an account (bought through a consultant), and who has a plan now (with ✕ to end it). The tiers of
 * schools, courses and lessons are set where they are edited (Мундариҷа → Дастрасӣ).
 */

interface Member { id: string; email: string; tier: Plan; source: string; ends_at: string | null; note: string | null; auto_renew: boolean | null }
interface Overview {
  members: Member[]
  counts?: { standard: number; premium: number }
  settings: Record<string, unknown>
}

const KINDS: { key: keyof Limits; label: string }[] = [
  { key: 'message', label: 'Саволҳо дар рӯз' },
  { key: 'slides', label: 'Презентатсия / моҳ' },
  { key: 'doc', label: 'Word ва PDF / моҳ' },
  { key: 'file', label: 'Файлҳои дигар / моҳ' },
  { key: 'quiz', label: 'Тестҳо дар чат / моҳ' },
  { key: 'mmt', label: 'Тестҳои ММТ / моҳ' },
  { key: 'exam', label: 'Тайёрӣ ба имтиҳон / моҳ' },
  { key: 'lawyer', label: 'Ҷавобҳои ҳуқуқӣ / моҳ' },
  { key: 'music', label: 'Сурудҳо / моҳ' },
  { key: 'context', label: 'Хотираи чат (паём)' },
  { key: 'keep', label: 'Нигоҳ доштани чатҳо (рӯз)' }
]
const NAME: Record<Plan, string> = { free: 'Ройгон', standard: '⭐ Standard', premium: '👑 Premium' }

export function Plans() {
  const data = useApi<Overview>('/admin/premium')
  const act = useAction()
  const s = data.data?.settings ?? {}
  const [limits, setLimits] = useState<Record<Plan, Limits>>(DEFAULT_LIMITS)
  const [paddle, setPaddle] = useState({ standard: '', premium: '', standard_discount: '' })
  const [grant, setGrant] = useState({ email: '', tier: 'premium' as 'standard' | 'premium', months: 1, note: '' })
  useEffect(() => {
    if (!data.data) return
    setLimits(limitsFrom(data.data.settings.plan_limits))
    const p = (data.data.settings.paddle ?? {}) as Record<string, string>
    setPaddle({ standard: p.standard ?? '', premium: p.premium ?? '', standard_discount: p.standard_discount ?? '' })
  }, [data.data])

  const setting = async (key: string, value: unknown, done = 'Сабт шуд') => {
    if (await act.run(() => send('/admin/premium/setting', 'POST', { key, value }), done)) data.reload()
  }
  if (data.error) return <ErrorState error={data.error} onRetry={data.reload} />
  if (!data.data) return <Loading />
  const live = s.plans_live === true
  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="card card-pad stack">
        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          <span className="chip">⭐ Standard: {data.data.counts?.standard ?? 0}</span>
          <span className="chip">👑 Premium: {data.data.counts?.premium ?? 0}</span>
          <span className="chip">Нархҳо: {PRICES.standard} (моҳи аввал {PRICES.standardFirst}) / {PRICES.premium} сомонӣ</span>
        </div>
        <label className="row" style={{ gap: 10 }}>
          <input type="checkbox" checked={live} onChange={(e) => void setting('plans_live', e.target.checked)} />
          <span><b>Обунаҳо фаъоланд</b> — лимитҳо ва қулфҳо кор мекунанд, экрани обуна худкор кушода мешавад (кормандон ҳамеша озоданд)</span>
        </label>
        <label className="row" style={{ gap: 10 }}>
          <input type="checkbox" checked={s.premium_consultant !== false} onChange={(e) => void setting('premium_consultant', e.target.checked)} />
          <span>Тугмаи «Харидорӣ тавассути мушовир» дар экрани обуна</span>
        </label>
      </div>

      <div className="card card-pad stack">
        <b>Додани нақша (харид тавассути мушовир)</b>
        <Field label="Почтаи ҳисоб"><input className="input" type="email" value={grant.email} onChange={(e) => setGrant({ ...grant, email: e.target.value })} /></Field>
        <div className="segmented" role="tablist">
          {(['standard', 'premium'] as const).map((k) => <button key={k} type="button" role="tab" aria-selected={grant.tier === k} onClick={() => setGrant({ ...grant, tier: k })}>{NAME[k]}</button>)}
        </div>
        <Field label="Моҳҳо (0 — бемӯҳлат)"><input className="input" inputMode="numeric" value={grant.months} onChange={(e) => setGrant({ ...grant, months: Number(e.target.value.replace(/\D/g, '') || 0) })} /></Field>
        <Field label="Эзоҳ"><input className="input" value={grant.note} maxLength={500} onChange={(e) => setGrant({ ...grant, note: e.target.value })} /></Field>
        <button type="button" className="btn" disabled={act.busy || !grant.email.includes('@')}
          onClick={async () => { if (await act.run(() => send('/admin/premium/grant', 'POST', { email: grant.email.trim(), tier: grant.tier, months: grant.months, note: grant.note.trim() || undefined }), 'Нақша дода шуд')) { setGrant({ ...grant, email: '', note: '' }); data.reload() } }}>
          Додан
        </button>
      </div>

      <div className="card card-pad stack">
        <b>Paddle</b>
        <p className="muted" style={{ margin: 0, fontSize: '0.86em' }}>
          Дар Paddle ду нархи моҳона созед (Standard 45 ва Premium 99 сомонӣ ба асъори Paddle), барои моҳи аввали Standard — тахфиф (discount) то 25. ID-ҳоро ин ҷо гузоред.
          Дар сервер: PADDLE_CLIENT_TOKEN, PADDLE_WEBHOOK_SECRET (ва PADDLE_ENV=sandbox барои санҷиш); вебхук: /api/v1/billing/paddle/webhook.
        </p>
        <Field label="Нархи Standard (pri_…)"><input className="input" value={paddle.standard} onChange={(e) => setPaddle({ ...paddle, standard: e.target.value.trim() })} /></Field>
        <Field label="Нархи Premium (pri_…)"><input className="input" value={paddle.premium} onChange={(e) => setPaddle({ ...paddle, premium: e.target.value.trim() })} /></Field>
        <Field label="Тахфифи моҳи аввали Standard (dsc_…)"><input className="input" value={paddle.standard_discount} onChange={(e) => setPaddle({ ...paddle, standard_discount: e.target.value.trim() })} /></Field>
        <button type="button" className="btn btn-soft" disabled={act.busy}
          onClick={() => void setting('paddle', Object.fromEntries(Object.entries(paddle).filter(([, v]) => v)))}>Сабт кардан</button>
      </div>

      <div className="card card-pad stack">
        <b>Лимитҳо</b>
        <p className="muted" style={{ margin: 0, fontSize: '0.86em' }}>−1 — бемаҳдуд, 0 — дар ин нақша нест.</p>
        <div className="plan-limits">
          <span />
          {PLANS.map((p) => <b key={p}>{NAME[p]}</b>)}
          {KINDS.map((k) => (
            <div key={k.key} style={{ display: 'contents' }}>
              <span>{k.label}</span>
              {PLANS.map((p) => (
                <input key={p} className="input" inputMode="numeric" value={limits[p][k.key]} aria-label={`${NAME[p]} — ${k.label}`}
                  onChange={(e) => {
                    const v = Number(e.target.value.replace(/[^\d-]/g, '') || 0)
                    setLimits({ ...limits, [p]: { ...limits[p], [k.key]: Math.max(-1, v) } })
                  }} />
              ))}
            </div>
          ))}
        </div>
        <button type="button" className="btn" disabled={act.busy} onClick={() => void setting('plan_limits', limits)}>Сабти лимитҳо</button>
      </div>

      <div className="card card-pad stack">
        <b>Ҳоло нақша доранд</b>
        {data.data.members.length ? data.data.members.map((m) => (
          <div key={m.id} className="row" style={{ gap: 8, flexWrap: 'wrap', borderBottom: '1px solid var(--line)', paddingBottom: 6 }}>
            <span className="chip">{NAME[m.tier] ?? m.tier}</span>
            <span className="grow">{m.email}</span>
            <span className="muted" style={{ fontSize: '0.84em' }}>{m.ends_at ? new Date(m.ends_at).toLocaleDateString('ru') : 'бемӯҳлат'} · {m.note ?? m.source}</span>
            <button type="button" className="btn btn-soft" aria-label={`Қатъ кардани нақшаи ${m.email}`}
              onClick={async () => { if (confirm(`Нақшаи ${m.email} қатъ шавад?`) && await act.run(() => send('/admin/premium/end', 'POST', { id: m.id }), 'Қатъ шуд')) data.reload() }}>✕</button>
          </div>
        )) : <p className="muted" style={{ margin: 0 }}>Ҳанӯз касе нест.</p>}
      </div>
      <Note message={act.message} />
    </div>
  )
}
