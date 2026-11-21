'use client'

import 'katex/dist/katex.min.css'

import type { Element, ElementContent, Root } from 'hast'
import Link from 'next/link'
import { Fragment, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import ReactMarkdown, { type Components } from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import remarkBreaks from 'remark-breaks'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'

import { linkAllowed } from '@/lib/aiCatalog'

import { copyText } from '../offline/mahliyo'
import { EMOJI_RE, emojiName, emojiSrc } from './Emoji'
import { usePrefs } from '../prefs'
import { Icon } from './Icon'
import { showToast } from './Toast'

/**
 * Mahliyo's written answer: Markdown with math (LaTeX: $…$ in a line, $$…$$ on its own), tables, code
 * and lists. A fresh answer comes in word by word; a formula, a table or a piece of code comes in whole.
 */

/** the class of an element of the tree */
const classes = (el: Element): string[] => {
  const c: unknown = el.properties?.className
  return Array.isArray(c) ? c.map(String) : typeof c === 'string' ? c.split(' ') : []
}
/** shown whole: a formula, a table, code, an emoji */
const whole = (el: Element) => el.tagName === 'pre' || el.tagName === 'table' || el.tagName === 'code' || classes(el).some((c) => c === 'katex' || c === 'katex-display' || c === 'emo')

/** The chat's own emoji pictures (Emoji.tsx) in her words — not inside code or formulas. */
function emojiImages() {
  return (tree: Root) => {
    const walk = (node: Root | Element) => {
      node.children = (node.children as ElementContent[]).flatMap((child): ElementContent[] => {
        if (child.type === 'element') {
          if (!(child.tagName === 'pre' || child.tagName === 'code' || classes(child).some((c) => c.startsWith('katex')))) walk(child)
          return [child]
        }
        if (child.type !== 'text') return [child]
        const out: ElementContent[] = []
        let last = 0
        for (const m of child.value.matchAll(EMOJI_RE)) {
          const name = emojiName(m[0])
          if (!name) continue
          if (m.index > last) out.push({ type: 'text', value: child.value.slice(last, m.index) })
          out.push({ type: 'element', tagName: 'img', properties: { className: ['emo'], src: emojiSrc(name), alt: m[0], draggable: 'false' }, children: [] })
          last = m.index + m[0].length
        }
        if (!out.length) return [child]
        if (last < child.value.length) out.push({ type: 'text', value: child.value.slice(last) })
        return out
      }) as Root['children'] & Element['children']
    }
    walk(tree)
  }
}

/**
 * "$$…$$" written inside a line (as the model often writes a formula) is shown on a line of its own, large,
 * as when it stands alone.
 */
type MdNode = { type: string; children?: MdNode[]; position?: { start: { offset?: number } }; data?: Record<string, unknown> }
function displayDollars() {
  return (tree: MdNode, file: { value: unknown }) => {
    const text = String(file.value)
    const walk = (n: MdNode) => {
      const at = n.position?.start.offset
      if (n.type === 'inlineMath' && at !== undefined && text.startsWith('$$', at)) {
        n.data = { ...n.data, hProperties: { className: ['language-math', 'math-display'] } }
      }
      n.children?.forEach(walk)
    }
    walk(tree)
  }
}

/** Wraps every word in a span that comes in after the one before (from `from` ms, `step` ms apart). */
function reveal(from: number, step: number) {
  return () => (tree: Root) => {
    let n = 0
    const at = () => `--w: ${from + n++ * step}ms`
    const walk = (node: Root | Element) => {
      node.children = (node.children as ElementContent[]).flatMap((child): ElementContent[] => {
        if (child.type === 'text') {
          return child.value.split(/(\s+)/).filter(Boolean).map((w): ElementContent => (/^\s+$/.test(w) ? { type: 'text', value: w }
            : { type: 'element', tagName: 'span', properties: { className: ['ai-w'], style: at() }, children: [{ type: 'text', value: w }] }))
        }
        if (child.type === 'element') {
          if (whole(child)) child.properties = { ...child.properties, className: [...classes(child), 'ai-w'], style: at() }
          else walk(child)
        }
        return [child]
      }) as Root['children'] & Element['children']
    }
    walk(tree)
  }
}

/** the words of a piece of the tree (a code block's code) */
const textOf = (n: { type: string; value?: string; children?: unknown[] }): string =>
  n.type === 'text' ? n.value ?? '' : (n.children as typeof n[] | undefined)?.map(textOf).join('') ?? ''

/**
 * A piece of code: its language, "copy" and — for a web page or a drawing (HTML, SVG) — "preview", which
 * shows it working in a sealed frame (its scripts run there, apart from the app).
 */
function CodeBlock({ code, lang, className, style }: { code: string; lang: string; className?: string; style?: CSSProperties }) {
  const { t } = usePrefs()
  const [open, setOpen] = useState(false)
  const page = /^(html|svg|xml)$/i.test(lang) || (!lang && /^\s*<(!doctype|html|svg|div|body)/i.test(code))
  const copy = async () => showToast(t((await copyText(code)) ? 'ai.copied' : 'ai.unavailable'), 'copy')
  return (
    <div className={['ai-code', className].filter(Boolean).join(' ')} style={style}>
      <div className="ai-code-head">
        <span>{lang || 'code'}</span>
        <span className="grow" />
        {page ? <button type="button" className="ai-code-btn" onClick={() => setOpen(true)} aria-label={t('ai.preview')}><Icon name="eye" size={15} /></button> : null}
        <button type="button" className="ai-code-btn" onClick={copy} aria-label={t('ai.copy')}><Icon name="copy" size={15} /></button>
      </div>
      <pre><code>{code}</code></pre>
      {open ? createPortal(
        <div className="ai-preview" role="dialog" aria-modal="true" aria-label={t('ai.preview')}>
          <div className="ai-preview-head">
            <b>{t('ai.preview')}</b>
            <span className="grow" />
            <button type="button" className="ai-code-btn" onClick={copy} aria-label={t('ai.copy')}><Icon name="copy" size={16} /></button>
            <button type="button" className="ai-code-btn" onClick={() => setOpen(false)} aria-label={t('action.close')}><Icon name="x" size={16} /></button>
          </div>
          <iframe title={t('ai.preview')} sandbox="allow-scripts" srcDoc={code} />
        </div>,
        document.body
      ) : null}
    </div>
  )
}

const components: Components = {
  pre: ({ node, className, style }) => {
    const code = node?.children.find((c) => c.type === 'element' && c.tagName === 'code')
    const cls = code && code.type === 'element' ? String((code.properties?.className as string[] | undefined)?.find((c) => String(c).startsWith('language-')) ?? '') : ''
    return <CodeBlock code={textOf(code ?? { type: 'text', value: '' }).replace(/\n$/, '')} lang={cls.replace('language-', '')} className={className} style={style} />
  },
  // a wide table scrolls by itself, the answer stays
  table: ({ node: _, ...p }) => <div className="ai-table"><table {...p} /></div>,
  a: ({ node: _, href, children }) => (href && linkAllowed(href)
    ? href.startsWith('/') ? <Link href={href}>{children}</Link> : <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
    : <>{children}</>),
  // no pictures from elsewhere: only the chat's own emoji
  img: ({ node: _, className, src, alt, style }) => (className?.split(' ').includes('emo') && typeof src === 'string' && src.startsWith('/assets/emoji/')
    ? <img className={className} src={src} alt={alt} style={style} draggable={false} decoding="async" /> : null),
  h1: ({ children }) => <p><b>{children}</b></p>,
  h2: ({ children }) => <p><b>{children}</b></p>,
  h3: ({ children }) => <p><b>{children}</b></p>
}
/** a step's words: no paragraph around them */
const inline: Components = { ...components, p: ({ children }) => <Fragment>{children}</Fragment> }

export function AiMarkdown({ text, fresh = false, from = 0, step = 34, inline: oneLine = false }: { text: string; fresh?: boolean; from?: number; step?: number; inline?: boolean }): ReactNode {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, [remarkMath, { singleDollarTextMath: true }], remarkBreaks, displayDollars]}
      rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: 'ignore' }], emojiImages, ...(fresh ? [reveal(from, step)] : [])]}
      components={oneLine ? inline : components}
    >
      {text}
    </ReactMarkdown>
  )
}

/** whether a text needs drawing as Markdown (or is plain words) */
export const isMarkdown = (text: string) => /[$*`|_#>]|^\s*([-+]|\d+\.)\s|\[[^\]]+\]\(|https?:\/\//m.test(text)
