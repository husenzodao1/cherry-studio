'use client'

import { useEffect } from 'react'

import { ErrorState, Loading } from '../components/States'
import { useApi } from '../useApi'

interface Asked { id: string; name: string | null; question: string; answer: string | null; tajik: boolean | null; at: string }

const when = (iso: string) => new Date(iso).toLocaleString('ru', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

/** Panel → "Маҳлиё AI": every question learners asked her in the app, and her answer, newest first. */
export function MahliyoLog() {
  const list = useApi<Asked[]>('/admin/mahliyo')
  useEffect(() => {
    const timer = setInterval(list.reload, 30_000)
    return () => clearInterval(timer)
  }, [list.reload])
  if (list.error) return <ErrorState error={list.error} onRetry={list.reload} />
  if (!list.data) return <Loading />
  if (!list.data.length) return <p className="muted" style={{ textAlign: 'center' }}>Ҳанӯз касе аз Маҳлиё напурсидааст</p>
  return (
    <div className="stack" style={{ gap: 8 }}>
      {list.data.map((q) => (
        <div key={q.id} className="glass card-pad stack" style={{ gap: 6 }}>
          <div className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
            <b>{q.name ?? 'Бе ном'}</b>
            <span className="muted" style={{ fontSize: '0.8em' }}>{when(q.at)}{q.tajik === false ? ' · ба забони дигар' : ''}</span>
          </div>
          <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{q.question}</p>
          {q.answer ? <p className="muted" style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: '0.9em' }}>Маҳлиё: {q.answer}</p>
            : <p className="muted" style={{ margin: 0, fontSize: '0.85em' }}>Бе ҷавоб</p>}
        </div>
      ))}
    </div>
  )
}
