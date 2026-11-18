'use client'

import Link from 'next/link'
import { Suspense } from 'react'

import { BlockView, type Asset, type Block } from '@/web/components/Blocks'
import { Icon } from '@/web/components/Icon'
import { Empty, Loading } from '@/web/components/States'
import { useContent } from '@/web/offline/content'
import { usePrefs } from '@/web/prefs'
import { useQueryParam } from '@/web/useQueryParam'

/** CMS pages (about, privacy, terms) from the content stored on the phone. */
export default function CmsPage() {
  return <Suspense fallback={<Loading />}><Page /></Suspense>
}

function Page() {
  const slug = useQueryParam('slug')
  const { t } = usePrefs()
  const { bundle, loading } = useContent()
  const page = bundle?.pages[slug] as { title: string; body: Omit<Block, 'id'>[]; assets?: Record<string, Asset> } | undefined
  return (
    <article className="reader">
      <header className="topbar"><Link href="/settings" className="icon-btn" aria-label={t('action.back')}><Icon name="back" /></Link></header>
      {!page ? (loading ? <Loading /> : <Empty title="—" />) : (
        <>
          <h1>{page.title}</h1>
          <div className="blocks">{page.body.map((b, i) => <BlockView key={i} block={{ ...b, id: String(i) }} assets={page.assets ?? {}} />)}</div>
        </>
      )}
    </article>
  )
}
