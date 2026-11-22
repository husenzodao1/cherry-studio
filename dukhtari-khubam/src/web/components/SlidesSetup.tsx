'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'

import { withCommand } from '@/lib/aiCommands'
import { SLIDE_STYLES, type SlideStyle } from '@/lib/slideStyles'

import { usePrefs } from '../prefs'
import { Icon } from './Icon'

/** A presentation's cover in a style: its layout and colours, the title on it (the same as the file's first slide). */
export function SlideCover({ style, title, sub }: { style: SlideStyle; title: string; sub?: string }) {
  return (
    <div className={`slide-cover is-${style.layout}`} style={{ '--bg': style.bg, '--fg': style.fg, '--ac': style.accent } as CSSProperties}>
      <i className="sc-a" /><i className="sc-b" />
      <div className="sc-text"><b>{title}</b>{sub ? <span>{sub}</span> : null}</div>
    </div>
  )
}

const EXTRAS = ['notes', 'quiz', 'summary', 'examples', 'sources'] as const
type Extra = (typeof EXTRAS)[number]
const MIN = 3
const MAX = 12

/**
 * "Презентатсия": before Mahliyo makes it, the learner sets it up: the topic, its style (a hundred covers
 * to swipe left and right), how many slides (at most twelve) and what goes in besides (the speaker's notes,
 * a test, a summary, examples, sources). "Сохтан" asks her with all of it.
 */
export function SlidesSetup({ onSend, onClose }: { onSend: (question: string) => void; onClose: () => void }) {
  const { t } = usePrefs()
  const [topic, setTopic] = useState('')
  const [at, setAt] = useState(1)
  const [count, setCount] = useState(8)
  const [extras, setExtras] = useState<Extra[]>(['notes', 'summary'])
  const row = useRef<HTMLDivElement>(null)
  const style = SLIDE_STYLES[at]

  // the chosen cover in the middle of the row
  useEffect(() => {
    row.current?.children[at]?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }, [at])
  useEffect(() => {
    const back = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', back)
    return () => window.removeEventListener('keydown', back)
  }, [onClose])

  const make = () => {
    const lines = [
      `${t('slides.topic_label')}: ${topic.trim()}`,
      `${t('slides.style')}: ${style.name} #${style.id}`,
      `${t('slides.count')}: ${count}`,
      extras.length ? `${t('slides.extra')}: ${extras.map((e) => t(`slides.${e}`)).join(', ')}` : ''
    ].filter(Boolean)
    onSend(withCommand('презентатсия', lines.join('\n')))
  }
  if (typeof document === 'undefined') return null
  return createPortal(
    <div className="attach-veil" onClick={onClose}>
      <section className="slides-setup" role="dialog" aria-modal="true" aria-label={t('slides.title')} onClick={(e) => e.stopPropagation()}>
        <header>
          <span className="attach-ico tone-slides" aria-hidden="true"><Icon name="chart" size={20} /></span>
          <b className="grow">{t('slides.title')}</b>
          <button type="button" className="slides-x" aria-label={t('action.close')} onClick={onClose}><Icon name="x" size={18} /></button>
        </header>
        <textarea className="slides-topic" rows={2} value={topic} maxLength={300} placeholder={t('slides.topic')} onChange={(e) => setTopic(e.target.value)} />

        <div className="slides-label">
          <span>{t('slides.style')}</span><b>{style.name}</b><small>{at + 1} / {SLIDE_STYLES.length}</small>
        </div>
        <div className="slides-styles">
          <button type="button" className="slides-arrow" aria-label={t('slides.prev')} onClick={() => setAt((at - 1 + SLIDE_STYLES.length) % SLIDE_STYLES.length)}><Icon name="back" size={18} /></button>
          <div ref={row} className="slides-row" role="listbox" aria-label={t('slides.style')}>
            {SLIDE_STYLES.map((s, i) => (
              <button key={s.id} type="button" role="option" aria-selected={i === at} className={i === at ? 'is-on' : ''} onClick={() => setAt(i)}>
                <SlideCover style={s} title={topic.trim() || s.name} />
                <span>{s.name}</span>
              </button>
            ))}
          </div>
          <button type="button" className="slides-arrow" aria-label={t('slides.next')} onClick={() => setAt((at + 1) % SLIDE_STYLES.length)}><Icon name="forward" size={18} /></button>
        </div>

        <div className="slides-line">
          <span>{t('slides.count')}</span>
          <div className="slides-step">
            <button type="button" aria-label="−" disabled={count <= MIN} onClick={() => setCount(count - 1)}><Icon name="minus" size={16} /></button>
            <b>{count}</b>
            <button type="button" aria-label="+" disabled={count >= MAX} onClick={() => setCount(count + 1)}><Icon name="plus" size={16} /></button>
          </div>
        </div>
        <div className="slides-extras" role="group" aria-label={t('slides.extra')}>
          {EXTRAS.map((e) => {
            const on = extras.includes(e)
            return (
              <button key={e} type="button" aria-pressed={on} className={on ? 'is-on' : ''} onClick={() => setExtras(on ? extras.filter((x) => x !== e) : [...extras, e])}>
                {on ? <Icon name="check" size={14} /> : null}{t(`slides.${e}`)}
              </button>
            )
          })}
        </div>
        <button type="button" className="btn slides-make" disabled={!topic.trim()} onClick={make}>{t('slides.make')}</button>
      </section>
    </div>,
    document.body
  )
}
