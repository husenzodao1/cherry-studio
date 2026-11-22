'use client'

import type { ReactNode } from 'react'

import { type BrandKey, sourceLabel } from '@/lib/sources'

import { Icon } from './Icon'

/**
 * Where a resource (picture, video, quote, text) comes from, as a small chip: the source's own icon and
 * its name — Google, YouTube, Instagram, Telegram… — instead of a line "Source: …". A source without a
 * link (a book, a person) gets a book icon and its title.
 */

const G = (
  <svg viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.4-4.6 7l7.4 5.8c4.3-4 6.9-9.9 6.9-17.3z" />
    <path fill="#FBBC05" d="M10.6 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.9-6.1z" />
    <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.8c-2.1 1.4-4.8 2.3-8.5 2.3-6.2 0-11.5-4.1-13.4-9.8l-7.9 6.1C6.6 42.6 14.6 48 24 48z" />
  </svg>
)
const disc = (bg: string, child: ReactNode) => (
  <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="12" fill={bg} />{child}</svg>
)

const MARKS: Record<BrandKey, ReactNode> = {
  google: G,
  youtube: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="1" y="4.5" width="22" height="15" rx="4.5" fill="#FF0000" /><path d="M10 8.6v6.8l5.8-3.4z" fill="#fff" /></svg>
  ),
  instagram: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <defs><linearGradient id="ig-chip" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stopColor="#FEDA75" /><stop offset=".35" stopColor="#FA7E1E" /><stop offset=".6" stopColor="#D62976" /><stop offset="1" stopColor="#4F5BD5" /></linearGradient></defs>
      <rect x="1" y="1" width="22" height="22" rx="6.5" fill="url(#ig-chip)" />
      <rect x="5.5" y="5.5" width="13" height="13" rx="4" fill="none" stroke="#fff" strokeWidth="1.8" /><circle cx="12" cy="12" r="3.1" fill="none" stroke="#fff" strokeWidth="1.8" /><circle cx="16.3" cy="7.7" r="1" fill="#fff" />
    </svg>
  ),
  telegram: disc('#27A7E7', <path d="M5.5 11.7l11.6-4.5c.5-.2 1 .1.8.9l-2 9.3c-.1.6-.5.8-1 .5l-3-2.2-1.5 1.4c-.2.2-.3.3-.6.3l.2-3.1 5.6-5c.2-.2 0-.3-.3-.1l-6.9 4.3-3-.9c-.6-.2-.6-.6.1-.9z" fill="#fff" />),
  facebook: disc('#1877F2', <path d="M13.2 19.5v-6.1h2l.3-2.4h-2.3V9.5c0-.7.2-1.2 1.2-1.2h1.2V6.2c-.2 0-1-.1-1.8-.1-1.8 0-3 1.1-3 3.1V11H8.8v2.4h2v6.1z" fill="#fff" />),
  wikipedia: disc('#e9e9ed', <path d="M5 8.2h3M16 8.2h3M6.3 8.2l3 8.3 2.7-6.4 2.7 6.4 3-8.3" fill="none" stroke="#222" strokeWidth="1.3" strokeLinejoin="round" />),
  tiktok: disc('#111', <path d="M13.3 5.5h2c.2 1.6 1.2 2.6 2.7 2.8v2c-1 0-2-.3-2.7-.8v4.4a3.9 3.9 0 1 1-3.9-3.9v2a1.9 1.9 0 1 0 1.9 1.9z" fill="#fff" />),
  x: disc('#111', <path d="M7.2 6.8h2.7l2.6 3.6 3-3.6h1.4l-3.8 4.5 4.3 5.9h-2.7l-2.8-3.9-3.3 3.9H7.2l4.1-4.8z" fill="#fff" />),
  whatsapp: disc('#25D366', <path d="M8.3 7.3c.3-.4.8-.4 1.1 0l.9 1.6c.2.4.1.8-.2 1.1l-.5.5c.6 1.3 1.6 2.3 2.9 2.9l.5-.5c.3-.3.7-.4 1.1-.2l1.6.9c.4.3.4.8 0 1.1-1 1-2.6 1.2-3.9.4a10 10 0 0 1-3.8-3.8c-.8-1.3-.6-2.9.3-4z" fill="#fff" />),
  vk: disc('#0077FF', <path d="M6.2 8.6h2c.1 3 1.4 4.3 2.4 4.6V8.6h1.9v2.6c1-.1 2-1.3 2.4-2.6h1.9a5.6 5.6 0 0 1-2.6 3.7 5.9 5.9 0 0 1 3 3.7h-2.1a3.7 3.7 0 0 0-2.6-2.7V16h-.2c-4 0-6.2-2.7-6.3-7.4z" fill="#fff" />),
  pinterest: disc('#E60023', <path d="M12.3 5.8c-3.4 0-5.1 2.4-5.1 4.4 0 1.2.5 2.3 1.4 2.7.2.1.3 0 .4-.2l.1-.6c.1-.2 0-.3-.1-.5-.3-.3-.4-.8-.4-1.4 0-1.8 1.4-3.4 3.6-3.4 2 0 3 1.2 3 2.8 0 2.1-.9 3.9-2.3 3.9-.8 0-1.3-.6-1.1-1.4.2-.9.6-1.9.6-2.6 0-.6-.3-1.1-1-1.1-.8 0-1.4.8-1.4 1.9 0 .7.2 1.2.2 1.2l-1 4.2c-.3 1.2 0 2.7 0 2.9h.2c.1-.1 1-1.3 1.3-2.5l.5-2c.3.5 1 .9 1.8.9 2.4 0 4-2.2 4-5.1 0-2.2-1.9-4.3-4.7-4.3z" fill="#fff" />)
}

/**
 * The chip. `title` is the source's own name (a book, an article); `url` its link, if any. A known site
 * shows its icon and name; a book or a person shows a book icon and its title.
 */
export function SourceChip({ title, url, className = '' }: { title?: string | null; url?: string | null; className?: string }) {
  const { label, link, brand } = sourceLabel(title, url)
  if (!label) return null
  const text = title && !/^https?:\/\//i.test(title.trim()) ? title.trim() : null
  const body = (
    <>
      <span className="src-mark">{brand ? MARKS[brand] : <Icon name={link ? 'globe' : 'book'} size={14} />}</span>
      <span className="src-name">{label}</span>
    </>
  )
  // the whole title stays readable on a long press / hover
  const hint = [brand && text ? text : null, link].filter(Boolean).join(' · ') || undefined
  return link ? (
    <a className={`src-chip ${className}`} href={link} target="_blank" rel="noopener noreferrer" title={hint}>{body}</a>
  ) : (
    <span className={`src-chip ${className}`} title={hint}>{body}</span>
  )
}
