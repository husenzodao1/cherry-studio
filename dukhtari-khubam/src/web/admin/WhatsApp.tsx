'use client'

import { useState } from 'react'

import { useApi } from '../useApi'
import { ErrorState, Loading } from '../components/States'
import { Field, Note, sendNow, useAction } from './ui'

/**
 * The owner's WhatsApp number, which writes the SOS messages (through the bridge on its own server). Linking
 * works like WhatsApp Web: the number is entered here, an 8-character code appears, and on that phone
 * WhatsApp → Linked devices → Link a device → "Link with phone number instead" takes the code.
 */

interface Status { configured: boolean; state: 'off' | 'connecting' | 'pairing' | 'open' | 'unreachable'; number: string | null }

const STATE: Record<Status['state'], string> = {
  off: '⚪ Пайваст нест',
  connecting: '🟡 Пайваст мешавад…',
  pairing: '🟡 Рамз интизори ворид кардан аст',
  open: '🟢 Пайваст аст',
  unreachable: '🔴 Сервери пул ҷавоб намедиҳад'
}

export function WhatsApp() {
  const status = useApi<Status>('/admin/whatsapp')
  const settings = useApi<{ settings: Record<string, unknown> }>('/admin/premium')
  const act = useAction()
  const classes = settings.data?.settings.classes_enabled === true
  const setClasses = async (on: boolean) => {
    if (await act.run(() => sendNow('/admin/premium/setting', 'POST', { key: 'classes_enabled', value: on }), on ? 'Синфҳо фаъол шуданд' : 'Синфҳо хомӯш шуданд')) settings.reload()
  }
  const [phone, setPhone] = useState('+992')
  const [code, setCode] = useState<string | null>(null)
  if (status.error) return <ErrorState error={status.error} onRetry={status.reload} />
  if (!status.data) return <Loading />
  const s = status.data
  const pair = async () => {
    const r = await act.run(() => sendNow<{ code: string }>('/admin/whatsapp/pair', 'POST', { phone }), 'Рамз омода шуд')
    if (r) { setCode(r.code); status.reload() }
  }
  return (
    <div className="stack" style={{ gap: 14 }}>
      <section className="glass card-pad stack" style={{ gap: 10 }}>
        <b>WhatsApp барои SOS</b>
        <span className="muted" style={{ fontSize: '0.88em' }}>
          Паёмҳои SOS (ҷойи духтар ба волидон) аз ҳамин рақам фиристода мешаванд. Рақами алоҳида гиред — на рақами шахсии худ.
        </span>
        {!s.configured ? (
          <p className="muted" style={{ margin: 0 }}>
            Пул ҳоло танзим нашудааст: дар Vercel <code>WHATSAPP_BRIDGE_URL</code> ва <code>WHATSAPP_BRIDGE_SECRET</code>-ро гузоред (дастур дар whatsapp-bridge/README.md).
          </p>
        ) : (
          <>
            <span>{STATE[s.state] ?? s.state}{s.number ? ` · +${s.number}` : ''}</span>
            {s.state !== 'open' ? (
              <>
                <Field label="Рақами WhatsApp" hint="Бо коди кишвар, масалан +992 90 123 45 67">
                  <input className="input" inputMode="tel" value={phone} maxLength={20} onChange={(e) => setPhone(e.target.value)} />
                </Field>
                <button type="button" className="btn" disabled={act.busy} onClick={() => void pair()}>Гирифтани рамз</button>
              </>
            ) : (
              <button type="button" className="btn btn-soft" disabled={act.busy}
                onClick={() => { if (window.confirm('Рақам аз LifeHub ҷудо шавад? SOS то пайвасти нав бо SMS меравад.')) void act.run(() => sendNow('/admin/whatsapp/logout', 'POST'), 'Ҷудо шуд').then(() => status.reload()) }}>
                Ҷудо кардан
              </button>
            )}
            <button type="button" className="link-btn" onClick={status.reload}>Навсозӣ</button>
          </>
        )}
        <Note message={act.message} />
      </section>
      <section className="glass card-pad stack" style={{ gap: 8 }}>
        <div className="row" style={{ justifyContent: 'space-between', gap: 12 }}>
          <span className="stack" style={{ gap: 2 }}>
            <b>👩‍🏫 Функсияи муаллим (синфҳо)</b>
            <span className="muted" style={{ fontSize: '0.85em' }}>
              Фаъол: муаллим синф месозад, хонандагон бо рамз дохил мешаванд; то 16-сола танҳо бо ҳамсинфон дӯстӣ мекунад.
              Хомӯш: синфҳо пинҳон; то 16-сола танҳо бо ҳамсолони то 16-сола.
            </span>
          </span>
          <button type="button" role="switch" className="switch" aria-checked={classes} disabled={!settings.data || act.busy}
            onClick={() => void setClasses(!classes)} aria-label="Функсияи муаллим" />
        </div>
      </section>
      {code ? (
        <section className="glass card-pad stack" style={{ gap: 8, alignItems: 'center', textAlign: 'center' }}>
          <span className="eyebrow">Рамзи пайвастшавӣ</span>
          <b style={{ fontSize: '2.2rem', letterSpacing: '0.12em', fontVariantNumeric: 'tabular-nums' }}>{code}</b>
          <ol className="muted" style={{ textAlign: 'start', fontSize: '0.88em', margin: 0, paddingInlineStart: 20 }}>
            <li>Дар ҳамон телефон WhatsApp-ро кушоед</li>
            <li>⋮ → Дастгоҳҳои пайваст → Пайваст кардани дастгоҳ</li>
            <li>«Пайваст бо рақами телефон»-ро пахш кунед ва ин рамзро ворид кунед</li>
          </ol>
          <span className="muted" style={{ fontSize: '0.8em' }}>Рамзро ба касе нафиристед. Пас аз ворид кардан «Навсозӣ»-ро пахш кунед.</span>
        </section>
      ) : null}
    </div>
  )
}
