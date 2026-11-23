'use client'

import { useState, type FormEvent } from 'react'

import { PROVIDERS, type ProviderId } from '@/lib/aiProviders'

import { api } from '../api'
import { pagesOf, passagesOf } from '../files/bookText'
import { ErrorState, Loading } from '../components/States'
import { useApi } from '../useApi'
import { MahliyoLog } from './MahliyoLog'
import { Note, useAction } from './ui'

/**
 * Panel → "Маҳлиё AI": the questions learners asked her; the models (a box for each model of each provider:
 * a key saved in a box makes that model answer, at once; the key is checked with its provider, kept
 * encrypted and never shown again — only its last characters); and her books (a book's text is read here,
 * in the browser, cut into passages and sent; she then answers from the passages nearest each question).
 */

type Part = 'log' | 'models' | 'books'
export function AiAdmin() {
  const [part, setPart] = useState<Part>('log')
  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="segmented" role="tablist">
        {([['log', 'Саволҳо'], ['models', 'Моделҳо (API)'], ['books', 'Китобҳо (омӯзиш)']] as const).map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={part === id} onClick={() => setPart(id)}>{label}</button>
        ))}
      </div>
      {part === 'log' ? <MahliyoLog /> : part === 'models' ? <Models /> : <Books />}
    </div>
  )
}

interface Settings { keys: { provider: ProviderId; hint: string; at: string }[]; active: { provider: ProviderId; model: string; at: string } | null; server: boolean }

function Models() {
  const s = useApi<Settings>('/admin/ai')
  const act = useAction()
  if (s.error) return <ErrorState error={s.error} onRetry={s.reload} />
  if (!s.data) return <Loading />
  const { keys, active, server } = s.data
  const hint = (p: ProviderId) => keys.find((k) => k.provider === p)?.hint
  const activate = (provider: ProviderId | null, model: string | null) =>
    void act.run(() => api('/admin/ai/activate', { method: 'POST', body: { provider, model } }), 'Модел иваз шуд').then(s.reload)
  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="glass card-pad stack" style={{ gap: 6 }}>
        <b>Ҳоло ҷавоб медиҳад</b>
        <span>{active ? `${PROVIDERS.find((p) => p.id === active.provider)?.name} · ${active.model}` : 'Модели пешфарзи барнома (Gemini)'}</span>
        <span className="muted" style={{ fontSize: '0.82em' }}>
          Калидро дар қуттии модели дилхоҳ гузоред — ҳамон модел фавран ҷавоб медиҳад. Дарсҳо, китобҳо ва қоидаҳои Маҳлиё бо ҳар модел мемонанд.
          Калид рамзгузорӣ шуда нигоҳ дошта мешавад ва дигар нишон дода намешавад.
        </span>
        {active ? <button type="button" className="btn btn-soft" style={{ alignSelf: 'flex-start' }} disabled={act.busy} onClick={() => activate(null, null)}>Ба модели пешфарз баргаштан</button> : null}
        {server ? null : <p style={{ margin: 0, color: 'var(--bad)' }}>Рамзи сервер (MAHLIYO_SERVER_SECRET) гузошта нашудааст: калидҳоро нигоҳ доштан мумкин нест.</p>}
        <Note message={act.message} />
      </div>
      {PROVIDERS.map((p) => (
        <section key={p.id} className="glass card-pad stack" style={{ gap: 10 }} aria-label={p.name}>
          <div className="row" style={{ justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <b>{p.name}</b>
            <span className="muted" style={{ fontSize: '0.8em' }}>
              {hint(p.id) ? `Калид: ${hint(p.id)}` : 'Калид нест'} · <a href={p.keysAt} target="_blank" rel="noopener noreferrer">калид гирифтан</a>
            </span>
          </div>
          {[...p.models, { id: '', note: 'Модели дигар (номашро нависед)' }].map((m) => (
            <ModelBox key={m.id || 'other'} provider={p.id} model={m.id} note={m.note} hasKey={!!hint(p.id)}
              on={!!active && active.provider === p.id && active.model === m.id} onSaved={s.reload} onUse={(model) => activate(p.id, model)} />
          ))}
          {hint(p.id) ? (
            <button type="button" className="btn btn-soft" style={{ alignSelf: 'flex-start' }} disabled={act.busy}
              onClick={() => { if (confirm(`Калиди ${p.name} фаромӯш карда шавад?`)) void act.run(() => api('/admin/ai/forget', { method: 'POST', body: { provider: p.id } }), 'Калид фаромӯш шуд').then(s.reload) }}>
              Калидро фаромӯш кардан
            </button>
          ) : null}
        </section>
      ))}
    </div>
  )
}

/** One model: its name and what it is good at; a key box (saving it makes this model answer), or "use" when the provider's key is there. */
function ModelBox({ provider, model, note, hasKey, on, onSaved, onUse }: {
  provider: ProviderId; model: string; note: string; hasKey: boolean; on: boolean; onSaved: () => void; onUse: (model: string) => void
}) {
  const [key, setKey] = useState('')
  const [name, setName] = useState(model)
  const act = useAction()
  const save = (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim() || key.trim().length < 8) return
    void act.run(() => api('/admin/ai/key', { method: 'POST', body: { provider, model: name.trim(), key: key.trim() } }), 'Калид санҷида ва нигоҳ дошта шуд — ин модел ҷавоб медиҳад')
      .then((r) => { if (r) { setKey(''); onSaved() } })
  }
  return (
    <form onSubmit={save} className="stack" style={{ gap: 6, padding: 10, borderRadius: 14, border: `1px solid ${on ? 'var(--primary)' : 'var(--glass-edge)'}` }}>
      <div className="row" style={{ justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        {model ? <b style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.9em' }}>{model}</b>
          : <input className="input" style={{ flex: 1, minWidth: 160 }} placeholder="номи модел" value={name} onChange={(e) => setName(e.target.value)} aria-label="Номи модел" />}
        {on ? <span className="chip" style={{ minHeight: 26, padding: '0 10px', fontSize: '0.78em', background: 'var(--ok-bg)' }}>Фаъол</span> : null}
      </div>
      <span className="muted" style={{ fontSize: '0.8em' }}>{note}</span>
      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
        <input className="input" style={{ flex: 1, minWidth: 180 }} type="password" autoComplete="off" spellCheck={false}
          placeholder={hasKey ? 'Калиди нав (ихтиёрӣ)' : 'Калиди API'} value={key} onChange={(e) => setKey(e.target.value)} aria-label={`Калиди API барои ${model || 'модел'}`} />
        <button className="btn" disabled={act.busy || !name.trim() || key.trim().length < 8}>{act.busy ? 'Санҷиш…' : 'Нигоҳ доштан'}</button>
        {hasKey && !on && name.trim() ? <button type="button" className="btn btn-soft" onClick={() => onUse(name.trim())}>Истифода бурдан</button> : null}
      </div>
      <Note message={act.message} />
    </form>
  )
}

interface Book { id: string; title: string; file: string | null; pages: number | null; chunks: number; status: 'loading' | 'ready'; at: string }

function Books() {
  const list = useApi<Book[]>('/admin/books')
  const [progress, setProgress] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const learn = async (file: File) => {
    setError(null)
    try {
      setProgress('Матни китоб хонда мешавад…')
      const pages = await pagesOf(file)
      const passages = passagesOf(pages)
      if (!passages.length) throw new Error('Дар ин файл матн ёфт нашуд (шояд расми скан аст — матни онро ҳамчун PDF-и матнӣ ё Word гузоред).')
      const { id } = await api<{ id: string }>('/admin/books/start', { method: 'POST', body: { title: title.trim() || file.name.replace(/\.[^.]+$/, ''), file: file.name, pages: pages.length } })
      for (let i = 0; i < passages.length; i += 200) {
        setProgress(`Омӯзиш: ${Math.min(i + 200, passages.length)} аз ${passages.length} қисм…`)
        await api('/admin/books/chunks', { method: 'POST', body: { book: id, chunks: passages.slice(i, i + 200) } })
      }
      await api('/admin/books/done', { method: 'POST', body: { book: id } })
      setProgress(null)
      setTitle('')
      list.reload()
    } catch (e) {
      setProgress(null)
      setError(e instanceof Error ? e.message : 'Хато')
      list.reload()
    }
  }
  if (list.error) return <ErrorState error={list.error} onRetry={list.reload} />
  if (!list.data) return <Loading />
  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="glass card-pad stack" style={{ gap: 8 }}>
        <b>Китоби нав</b>
        <span className="muted" style={{ fontSize: '0.82em' }}>
          PDF (бо матн), Word (.docx) ё матн (.txt). Китоб ба қисмҳо тақсим ва барои ҷустуҷӯи тез нигоҳ дошта мешавад: ба ҳар савол Маҳлиё аввал
          ҷойҳои наздиктаринро меёбад, баъд аз онҳо ҷавоб медиҳад ва номи китобро ҳамчун манбаъ нишон медиҳад.
        </span>
        <input className="input" placeholder="Номи китоб (ихтиёрӣ)" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Номи китоб" />
        <input type="file" accept=".pdf,.docx,.txt,application/pdf,text/plain" disabled={!!progress} aria-label="Файли китоб"
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void learn(f) }} />
        {progress ? <p role="status" style={{ margin: 0 }}>{progress}</p> : null}
        {error ? <p role="alert" style={{ margin: 0, color: 'var(--bad)' }}>{error}</p> : null}
      </div>
      {list.data.length ? list.data.map((b) => (
        <div key={b.id} className="glass card-pad row" style={{ justifyContent: 'space-between', gap: 10 }}>
          <div className="stack" style={{ gap: 2, minWidth: 0 }}>
            <b>{b.title}</b>
            <span className="muted" style={{ fontSize: '0.8em' }}>
              {b.status === 'ready' ? `${b.chunks} қисм${b.pages ? ` · ${b.pages} саҳифа` : ''}` : 'Нотамом (бори дигар бор кунед)'}{b.file ? ` · ${b.file}` : ''}
            </span>
          </div>
          <button type="button" className="btn btn-soft" onClick={() => { if (confirm(`«${b.title}» бардошта шавад?`)) void api('/admin/books/remove', { method: 'POST', body: { book: b.id } }).then(list.reload) }}>Бардоштан</button>
        </div>
      )) : <p className="muted" style={{ textAlign: 'center' }}>Ҳанӯз китоб нест</p>}
    </div>
  )
}
