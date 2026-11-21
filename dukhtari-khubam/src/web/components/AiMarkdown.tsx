'use client'

import 'katex/dist/katex.min.css'

import type { Element, ElementContent, Root } from 'hast'
import Link from 'next/link'
import { Fragment, type ReactNode } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import remarkBreaks from 'remark-breaks'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'

import { linkAllowed } from '@/lib/aiCatalog'

/**
 * Mahliyo's written answer: Markdown with math (LaTeX: $…$ in a line, $$…$$ on its own), tables, code
 * and lists. A fresh answer comes in word by word; a formula, a table or a piece of code comes in whole.
 */

/** the class of an element of the tree */
const classes = (el: Element): string[] => {
  const c: unknown = el.properties?.className
  return Array.isArray(c) ? c.map(String) : typeof c === 'string' ? c.split(' ') : []
}
/** shown whole: a formula, a table, code */
const whole = (el: Element) => el.tagName === 'pre' || el.tagName === 'table' || el.tagName === 'code' || classes(el).some((c) => c === 'katex' || c === 'katex-display')

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

const components: Components = {
  // a wide table scrolls by itself, the answer stays
  table: ({ node: _, ...p }) => <div className="ai-table"><table {...p} /></div>,
  a: ({ node: _, href, children }) => (href && linkAllowed(href)
    ? href.startsWith('/') ? <Link href={href}>{children}</Link> : <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
    : <>{children}</>),
  // no pictures from elsewhere
  img: () => null,
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
      rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: 'ignore' }], ...(fresh ? [reveal(from, step)] : [])]}
      components={oneLine ? inline : components}
    >
      {text}
    </ReactMarkdown>
  )
}

/** whether a text needs drawing as Markdown (or is plain words) */
export const isMarkdown = (text: string) => /[$*`|_#>]|^\s*([-+]|\d+\.)\s/m.test(text)
