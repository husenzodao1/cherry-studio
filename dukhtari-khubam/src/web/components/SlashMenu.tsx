'use client'

import { useRef, useState, type PointerEvent as RPointerEvent } from 'react'

import { AI_COMMAND_GROUPS, AI_COMMANDS, findCommands } from '@/lib/aiCommands'

import { usePrefs } from '../prefs'

/** how many commands the small list shows (the whole list once pulled up) */
const SHORT = 40

/**
 * The ready commands over Mahliyo's chat box, once "/" is typed: the ones that fit what follows the "/",
 * each a plain line ("/ош" and its group). Pulled up by its handle (or tapped there) it grows over the chat
 * and shows every command, by group.
 */
export function SlashMenu({ query, onPick }: { query: string; onPick: (title: string) => void }) {
  const { t } = usePrefs()
  const [tall, setTall] = useState(false)
  const [drag, setDrag] = useState(0)
  const start = useRef<number | null>(null)
  const found = findCommands(query)
  const all = !query.trim()

  const down = (e: RPointerEvent) => { start.current = e.clientY; (e.target as Element).setPointerCapture?.(e.pointerId) }
  const move = (e: RPointerEvent) => { if (start.current !== null) setDrag(e.clientY - start.current) }
  const up = () => {
    if (start.current === null) return
    if (Math.abs(drag) < 6) setTall(!tall)
    else if (drag < -40) setTall(true)
    else if (drag > 40) setTall(false)
    start.current = null
    setDrag(0)
  }
  // a tap must not take the focus from the box (the keyboard stays up)
  const keep = (e: { preventDefault: () => void }) => e.preventDefault()
  const row = (title: string, group?: string) => (
    <button key={title} type="button" role="option" aria-selected={false} className="slash-row" onMouseDown={keep} onClick={() => onPick(title)}>
      <b>/{title}</b>{group ? <span>{group}</span> : null}
    </button>
  )

  return (
    <div className={`slash${tall ? ' is-tall' : ''}`} role="listbox" aria-label={t('ai.cmd_title')} onMouseDown={keep}>
      <div className="slash-handle" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}><span /></div>
      <div className="slash-head">
        <span>{t('ai.cmd_title')}</span>
        <small>{found.length}</small>
      </div>
      <div className="slash-list">
        {!found.length ? <p className="slash-none">{t('ai.cmd_none')}</p> : null}
        {all && tall
          ? AI_COMMAND_GROUPS.map((g) => (
            <section key={g.id}>
              <h4>{g.name}</h4>
              {AI_COMMANDS.filter((c) => c.group === g).map((c) => row(c.title))}
            </section>
          ))
          : (tall ? found : found.slice(0, SHORT)).map((c) => row(c.title, c.group.name))}
        {!tall && found.length > SHORT ? <button type="button" className="slash-more" onMouseDown={keep} onClick={() => setTall(true)}>{t('ai.cmd_more')}</button> : null}
      </div>
    </div>
  )
}
