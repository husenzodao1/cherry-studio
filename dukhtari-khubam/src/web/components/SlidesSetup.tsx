'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { withCommand } from '@/lib/aiCommands'
import { bodyFont, coverShapes, FONTS_URL, paint, SLIDE_STYLES, type SlideStyle } from '@/lib/slideStyles'

import { usePrefs } from '../prefs'
import { Icon } from './Icon'

/** A presentation's cover in a style: the same shapes, font and colours as the file's first slide. */
export function SlideCover({ style, title, sub }: { style: SlideStyle; title: string; sub?: string }) {
  const c = coverShapes(style)
  const t = c.title
  return (
    <svg className="slide-cover" viewBox="0 0 160 90" role="img" aria-label={style.name}>
      <rect width="160" height="90" fill={paint(c.back, style)} />
      {c.shapes.map((sh, i) => {
        const fill = paint(sh.c, style)
        const turn = sh.r ? `rotate(${sh.r} ${sh.x + sh.w / 2} ${sh.y + sh.h / 2})` : undefined
        if (sh.k === 'rect') return <rect key={i} x={sh.x} y={sh.y} width={sh.w} height={sh.h} fill={fill} opacity={sh.o ?? 1} transform={turn} />
        if (sh.k === 'box') return <rect key={i} x={sh.x} y={sh.y} width={sh.w} height={sh.h} fill="none" stroke={fill} strokeWidth={sh.line ?? 0.5} opacity={sh.o ?? 1} transform={turn} />
        if (sh.k === 'ellipse' || sh.k === 'ring') {
          return <ellipse key={i} cx={sh.x + sh.w / 2} cy={sh.y + sh.h / 2} rx={sh.w / 2} ry={sh.h / 2} fill={sh.k === 'ring' ? 'none' : fill} stroke={sh.k === 'ring' ? fill : undefined} strokeWidth={sh.line} opacity={sh.o ?? 1} transform={turn} />
        }
        const pts = sh.k === 'tri'
          ? `${sh.x + sh.w / 2},${sh.y} ${sh.x + sh.w},${sh.y + sh.h} ${sh.x},${sh.y + sh.h}`
          : sh.flip ? `${sh.x + sh.w},${sh.y} ${sh.x + sh.w},${sh.y + sh.h} ${sh.x},${sh.y + sh.h}` : `${sh.x},${sh.y} ${sh.x + sh.w},${sh.y + sh.h} ${sh.x},${sh.y + sh.h}`
        return <polygon key={i} points={pts} fill={fill} opacity={sh.o ?? 1} transform={turn} />
      })}
      <foreignObject x={t.x} y={t.y} width={t.w} height={t.h}>
        <div className={`sc-text v-${t.valign}`} style={{ textAlign: t.align, color: paint(t.c, style) }}>
          <b style={{ fontFamily: `'${style.font}', sans-serif`, fontSize: t.size }}>{title}</b>
          {sub ? <span style={{ fontFamily: `'${bodyFont(style)}', sans-serif`, fontSize: t.size * 0.42, color: paint(t.sub, style) }}>{sub}</span> : null}
        </div>
      </foreignObject>
    </svg>
  )
}

/** the styles' fonts, loaded once for the previews */
function useSlideFonts() {
  useEffect(() => {
    if (document.getElementById('slide-fonts')) return
    const link = document.createElement('link')
    link.id = 'slide-fonts'
    link.rel = 'stylesheet'
    link.href = FONTS_URL
    document.head.appendChild(link)
  }, [])
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
  useSlideFonts()

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
                <SlideCover style={s} title={topic.trim() || s.name} sub={topic.trim() ? s.name : undefined} />
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
